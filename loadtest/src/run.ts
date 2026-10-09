import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createGuest, createRoom, joinRoom, type Guest } from "./api.js";
import { SHARED_AREA } from "./bot.js";
import { HELP, loadConfig, type Config } from "./config.js";
import type {
  BotSpec,
  FromWorker,
  Plan,
  ProgressMessage,
  StartMessage,
  WorkerStats,
} from "./messages.js";
import { compareViews, formatReport, mergeStats } from "./report.js";
import { quicheLoaded, Session } from "./session.js";

const CELL_SIZE = 200;
const SIGN_IN_CONCURRENCY = 10;
/** Head start for the workers to receive the plan before the first connect. */
const WORKER_BOOT_MS = 1000;
/** Gap between the last connection and the first stroke, so nobody draws into a half-full room. */
const CONNECT_BUFFER_MS = 3000;
/** How long to keep listening after drawing stops, so in-flight messages still count. */
const DRAIN_MS = 5000;
const PROGRESS_EVERY_MS = 5000;
const WORKER_PATH = fileURLToPath(new URL("./worker.ts", import.meta.url));

let workers: ChildProcess[] = [];

process.on("SIGINT", () => {
  for (const worker of workers) worker.kill();
  process.exit(130);
});

/** Runs `task` for 0..total-1 with at most `limit` in flight, collecting every outcome. */
async function inPool<T>(
  total: number,
  limit: number,
  task: (index: number) => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let next = 0;
  async function lane(): Promise<void> {
    while (next < total) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task(index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, total) }, lane));
  return results;
}

/** Each bot becomes a real guest and joins through the API, exactly as a browser visit would. */
async function signIn(config: Config, roomId: string): Promise<Guest[]> {
  let done = 0;
  const results = await inPool(config.users, SIGN_IN_CONCURRENCY, async () => {
    const guest = await createGuest(config.api);
    await joinRoom(config.api, guest.accessToken, roomId);
    done++;
    process.stdout.write(`\r  Signing in guests: ${done}/${config.users}`);
    return guest;
  });
  process.stdout.write("\n");

  const guests = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : [],
  );
  const failed = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (failed.length > 0) {
    console.warn(
      `  ${failed.length} sign-ins failed, first: ${String(failed[0].reason)}`,
    );
  }
  if (guests.length < 2) {
    throw new Error("Fewer than 2 guests signed in. Is the API running?");
  }
  return guests;
}

function makePlan(config: Config, roomId: string): Plan {
  const rampStartAt = Date.now() + WORKER_BOOT_MS;
  const drawStartAt = rampStartAt + config.ramp * 1000 + CONNECT_BUFFER_MS;
  const drawEndAt = drawStartAt + config.duration * 1000;
  return {
    roomId,
    rampStartAt,
    drawStartAt,
    drawEndAt,
    reportAt: drawEndAt + DRAIN_MS,
    sharedShapeIds:
      config.scenario === "contention"
        ? Array.from({ length: config.sharedShapes }, () => randomUUID())
        : [],
  };
}

function makeSpecs(config: Config, guests: Guest[], plan: Plan): BotSpec[] {
  const columns = Math.ceil(Math.sqrt(guests.length));
  return guests.map((guest, index) => ({
    index,
    participantId: guest.participantId,
    connectAt: plan.rampStartAt + (index / guests.length) * config.ramp * 1000,
    // Spreads the drawing bots evenly through the grid instead of bunching
    // them in the top rows. Bot 0 always draws in contention: it creates the
    // shared shapes.
    active:
      Math.floor((index + 1) * config.active) >
        Math.floor(index * config.active) ||
      (config.scenario === "contention" && index === 0),
    color: `hsl(${Math.round((index * 137.508) % 360)}, 70%, 42%)`,
    cell: {
      x: (index % columns) * CELL_SIZE,
      y: Math.floor(index / columns) * CELL_SIZE,
      size: CELL_SIZE,
    },
  }));
}

function startWorker(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PATH, [], { stdio: "inherit" });
    workers.push(child);
    const timeout = setTimeout(
      () =>
        reject(new Error("A load-generator worker did not start within 30s")),
      30_000,
    );
    child.once("message", (message: FromWorker) => {
      if (message.type !== "ready") return;
      clearTimeout(timeout);
      resolve(child);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `A load-generator worker exited during start-up (code ${code})`,
        ),
      );
    });
  });
}

function phase(plan: Plan, now: number): string {
  if (now < plan.drawStartAt) return "connecting";
  if (now < plan.drawEndAt) {
    return `drawing, ${Math.ceil((plan.drawEndAt - now) / 1000)}s left`;
  }
  return "draining";
}

function runWorkers(
  config: Config,
  plan: Plan,
  specs: BotSpec[],
): Promise<WorkerStats[]> {
  return new Promise((resolve) => {
    const reports = new Map<number, WorkerStats>();
    const progress = new Map<number, ProgressMessage>();
    const dead = new Set<number>();
    let previous = { at: Date.now(), ops: 0, delivered: 0 };

    const finish = () => {
      clearInterval(ticker);
      clearTimeout(deadline);
      resolve([...reports.values()]);
    };
    const allAccountedFor = () => reports.size + dead.size === workers.length;

    workers.forEach((child, workerId) => {
      child.on("message", (message: FromWorker) => {
        if (message.type === "progress") {
          progress.set(workerId, message);
        } else if (message.type === "report") {
          reports.set(workerId, message.stats);
          if (allAccountedFor()) finish();
        }
      });
      child.on("exit", () => {
        if (reports.has(workerId)) return;
        dead.add(workerId);
        console.warn(
          `  Worker ${workerId} died before reporting; its bots are missing from the results.`,
        );
        if (allAccountedFor()) finish();
      });

      const start: StartMessage = {
        type: "start",
        workerId,
        config,
        plan,
        bots: specs.filter((spec) => spec.index % workers.length === workerId),
      };
      child.send(start);
    });

    const ticker = setInterval(() => {
      const now = Date.now();
      let connected = 0;
      let ops = 0;
      let delivered = 0;
      for (const p of progress.values()) {
        connected += p.connected;
        ops += p.opsSent;
        delivered += p.datagramsDelivered;
      }
      const seconds = (now - previous.at) / 1000;
      const opsRate = (ops - previous.ops) / seconds;
      const deliveryRate = Math.round(
        (delivered - previous.delivered) / seconds,
      );
      previous = { at: now, ops, delivered };
      console.log(
        `  [${phase(plan, now)}] connected ${connected}/${specs.length}` +
          ` | ops ${opsRate.toFixed(1)}/s` +
          ` | datagrams delivered ${deliveryRate.toLocaleString("en-US")}/s`,
      );
    }, PROGRESS_EVERY_MS);

    // A hung worker shouldn't hold the report hostage.
    const deadline = setTimeout(finish, plan.reportAt - Date.now() + 30_000);
  });
}

function stopWorkers(): Promise<void> {
  return Promise.all(
    workers.map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || !child.connected) return resolve();
          const timer = setTimeout(() => {
            child.kill();
            resolve();
          }, 5000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
          child.send({ type: "shutdown" });
        }),
    ),
  ).then(() => undefined);
}

function printViewerHint(config: Config, roomId: string, users: number): void {
  const columns = Math.ceil(Math.sqrt(users));
  const span = columns * CELL_SIZE;
  console.log(`\n  Room:  ${roomId}`);
  console.log(`  Watch: ${config.web}/room/${roomId}`);
  console.log(
    `  The bots draw in a ${columns}x${columns} grid of ${CELL_SIZE}px cells,` +
      ` from (0, 0) to (${span}, ${span}). Zoom out to see all of it.`,
  );
  if (config.scenario === "contention") {
    console.log(
      `  The shared shapes sit above the grid, around (0, ${SHARED_AREA.y}).`,
    );
  }
  console.log("");
}

async function main(): Promise<void> {
  let config: Config | null;
  try {
    config = loadConfig(process.argv.slice(2));
  } catch (error) {
    console.error(
      `\n  ${error instanceof Error ? error.message : String(error)}`,
    );
    console.log(HELP);
    process.exit(2);
  }
  if (!config) {
    console.log(HELP);
    return;
  }

  console.log(
    `\nCWA load test: ${config.scenario} scenario, ${config.users} users,` +
      ` ${config.duration}s of drawing\n`,
  );

  const owner = await createGuest(config.api);
  const roomId =
    config.room ?? (await createRoom(config.api, owner.accessToken));
  const guests = await signIn(config, roomId);
  console.log(
    `  (Each run adds ${guests.length + 1} guest participants to Postgres; they are ordinary guest rows.)`,
  );

  printViewerHint(config, roomId, guests.length);
  if (config.startDelay > 0) {
    console.log(
      `  Starting in ${config.startDelay}s, open the link now if you want to watch.`,
    );
    await sleep(config.startDelay * 1000);
  }

  console.log(`  Starting ${config.workers} load-generator processes...`);
  await Promise.all(Array.from({ length: config.workers }, startWorker));

  const plan = makePlan(config, roomId);
  const specs = makeSpecs(config, guests, plan);
  const stats = mergeStats(await runWorkers(config, plan, specs));

  let convergence = null;
  if (config.scenario === "contention") {
    // Read the server's final state while the bots are still connected, so
    // the room can't be evicted from Redis underneath the check.
    await quicheLoaded;
    const auditor = await Session.open(
      config.wt,
      Buffer.from(config.certHash, "base64"),
    );
    const state = await auditor.getState(roomId);
    auditor.close();
    convergence = compareViews(stats.views, state.board, plan.sharedShapeIds);
  }

  await stopWorkers();

  console.log(
    formatReport({
      config,
      plan,
      requested: config.users,
      signedIn: guests.length,
      activeCount: specs.filter((spec) => spec.active).length,
      stats,
      convergence,
    }),
  );

  if (config.json) {
    const { certHash: _pinned, ...settings } = config;
    const { views: _views, ...totals } = stats;
    writeFileSync(
      config.json,
      JSON.stringify({ roomId, settings, stats: totals, convergence }, null, 2),
    );
    console.log(`  Full report written to ${config.json}`);
  }
}

main()
  // The transport keeps native handles open; exit explicitly once the report is out.
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(
      `\n  Load test failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    for (const worker of workers) worker.kill();
    process.exit(1);
  });
