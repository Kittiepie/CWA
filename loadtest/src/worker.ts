import { monitorEventLoopDelay } from "node:perf_hooks";

// Derived rather than imported: the exported name has moved between @types/node versions.
type IntervalHistogram = ReturnType<typeof monitorEventLoopDelay>;
import { Bot, Counters } from "./bot.js";
import type {
  FromWorker,
  StartMessage,
  ToWorker,
  WorkerStats,
} from "./messages.js";
import { quicheLoaded } from "./session.js";

let bots: Bot[] = [];
let unhandledRejections = 0;

// A session dropping mid-run rejects promises deep inside the transport; one
// bad connection must not take down every other bot in this process.
process.on("unhandledRejection", () => {
  unhandledRejections++;
});

function send(message: FromWorker): void {
  process.send?.(message);
}

function buildStats(
  counters: Counters,
  lag: IntervalHistogram,
  withViews: boolean,
): WorkerStats {
  let received = 0;
  let expected = 0;
  for (const bot of bots) {
    const seen = bot.datagramWindow();
    received += seen.received;
    expected += seen.expected;
  }

  return {
    bots: bots.length,
    connected: counters.connected,
    connectErrors: counters.connectErrors,
    connectMs: counters.connectMs.toJSON(),
    opsSent: counters.opsSent,
    opsReceived: counters.opsReceived,
    reliableSendErrors: counters.reliableSendErrors,
    opLatency: counters.opLatency.toJSON(),
    datagramsSent: counters.datagramsSent,
    datagramsDelivered: counters.datagramsDelivered,
    datagramsReceived: received,
    datagramsExpected: expected,
    datagramOversize: counters.datagramOversize,
    datagramSendErrors: counters.datagramSendErrors,
    datagramLatency: counters.datagramLatency.toJSON(),
    maxDatagramSize: counters.maxDatagramSize,
    chatSent: counters.chatSent,
    chatReceived: counters.chatReceived,
    elementsCreated: counters.elementsCreated,
    sharedEdits: counters.sharedEdits,
    unhandledRejections,
    // monitorEventLoopDelay reports nanoseconds.
    loopLagP99Ms: lag.percentile(99) / 1e6,
    loopLagMaxMs: lag.max / 1e6,
    views: withViews
      ? bots.filter((bot) => bot.connected).map((bot) => bot.view())
      : [],
  };
}

function start({ workerId, config, plan, bots: specs }: StartMessage): void {
  const lag = monitorEventLoopDelay({ resolution: 10 });
  lag.enable();

  const counters = new Counters();
  const context = {
    config,
    plan,
    counters,
    sharedIds: new Set(plan.sharedShapeIds),
    certHash: Buffer.from(config.certHash, "base64"),
  };
  bots = specs.map((spec) => new Bot(spec, context));
  for (const bot of bots) {
    setTimeout(
      () => void bot.connect(),
      Math.max(0, bot.spec.connectAt - Date.now()),
    );
  }

  const progress = setInterval(() => {
    send({
      type: "progress",
      workerId,
      connected: counters.connected,
      opsSent: counters.opsSent,
      datagramsSent: counters.datagramsSent,
      datagramsDelivered: counters.datagramsDelivered,
    });
  }, 1000);

  setTimeout(
    () => {
      clearInterval(progress);
      for (const bot of bots) bot.stop();
      lag.disable();
      send({
        type: "report",
        workerId,
        stats: buildStats(counters, lag, config.scenario === "contention"),
      });
    },
    Math.max(0, plan.reportAt - Date.now()),
  );
}

function shutdown(): void {
  for (const bot of bots) bot.close();
  // A moment for the transport to send its close frames, so the server sees
  // clean leaves rather than timeouts.
  setTimeout(() => process.exit(0), 1000);
}

process.on("message", (message: ToWorker) => {
  if (message.type === "start") start(message);
  else shutdown();
});

await quicheLoaded;
send({ type: "ready" });
