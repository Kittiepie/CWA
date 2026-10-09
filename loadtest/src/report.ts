import { CONTENDED_FIELDS } from "./bot.js";
import type { Config } from "./config.js";
import {
  mergeHistograms,
  percentile,
  type HistogramData,
} from "./histogram.js";
import type { ClientView, Plan, WorkerStats } from "./messages.js";

export function mergeStats(parts: WorkerStats[]): WorkerStats {
  const sum = (pick: (stats: WorkerStats) => number) =>
    parts.reduce((total, stats) => total + pick(stats), 0);
  const max = (pick: (stats: WorkerStats) => number) =>
    parts.reduce((highest, stats) => Math.max(highest, pick(stats)), 0);

  return {
    bots: sum((s) => s.bots),
    connected: sum((s) => s.connected),
    connectErrors: [...new Set(parts.flatMap((s) => s.connectErrors))].slice(
      0,
      5,
    ),
    connectMs: mergeHistograms(parts.map((s) => s.connectMs)),
    opsSent: sum((s) => s.opsSent),
    opsReceived: sum((s) => s.opsReceived),
    reliableSendErrors: sum((s) => s.reliableSendErrors),
    opLatency: mergeHistograms(parts.map((s) => s.opLatency)),
    datagramsSent: sum((s) => s.datagramsSent),
    datagramsDelivered: sum((s) => s.datagramsDelivered),
    datagramsReceived: sum((s) => s.datagramsReceived),
    datagramsExpected: sum((s) => s.datagramsExpected),
    datagramOversize: sum((s) => s.datagramOversize),
    datagramSendErrors: sum((s) => s.datagramSendErrors),
    datagramLatency: mergeHistograms(parts.map((s) => s.datagramLatency)),
    maxDatagramSize: max((s) => s.maxDatagramSize),
    chatSent: sum((s) => s.chatSent),
    chatReceived: sum((s) => s.chatReceived),
    elementsCreated: sum((s) => s.elementsCreated),
    sharedEdits: sum((s) => s.sharedEdits),
    unhandledRejections: sum((s) => s.unhandledRejections),
    loopLagP99Ms: max((s) => s.loopLagP99Ms),
    loopLagMaxMs: max((s) => s.loopLagMaxMs),
    views: parts.flatMap((s) => s.views),
  };
}

interface Divergence {
  clients: number;
  fields: number;
}

export interface Convergence {
  clients: number;
  /** Contended fields the server holds a value for. */
  fields: number;
  naive: Divergence;
  lww: Divergence;
}

/** Compares what every client believes the shared shapes look like against the server's copy. */
export function compareViews(
  views: ClientView[],
  board: Record<string, string>,
  sharedIds: string[],
): Convergence {
  const truth = new Map<string, string>();
  for (const id of sharedIds) {
    for (const field of CONTENDED_FIELDS) {
      const raw = board[`${id}:${field}`];
      if (raw === undefined) continue;
      try {
        const stored = JSON.parse(raw) as { value: unknown };
        truth.set(`${id}:${field}`, JSON.stringify(stored.value));
      } catch {
        // Unreadable entry: leave it out of the comparison.
      }
    }
  }

  const tally = (pick: (view: ClientView) => Record<string, string>) => {
    const result: Divergence = { clients: 0, fields: 0 };
    for (const view of views) {
      const believed = pick(view);
      let wrong = 0;
      for (const [key, value] of truth) if (believed[key] !== value) wrong++;
      if (wrong > 0) {
        result.clients++;
        result.fields += wrong;
      }
    }
    return result;
  };

  return {
    clients: views.length,
    fields: truth.size,
    naive: tally((view) => view.naive),
    lww: tally((view) => view.lww),
  };
}

// Plain ASCII throughout: a Windows console on a legacy code page mangles
// anything fancier.
const count = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (ratio: number) =>
  Number.isFinite(ratio) ? `${(ratio * 100).toFixed(2)}%` : "n/a";
const ms = (value: number) =>
  Number.isFinite(value) ? `${Math.round(value)} ms` : "n/a";

function latency(histogram: HistogramData): string {
  if (histogram.count === 0) return "no samples";
  return [
    `p50 <= ${ms(percentile(histogram, 0.5))}`,
    `p95 <= ${ms(percentile(histogram, 0.95))}`,
    `p99 <= ${ms(percentile(histogram, 0.99))}`,
    `max ${ms(histogram.max)}`,
  ].join(" | ");
}

function row(label: string, value: string): string {
  return `   ${`${label} `.padEnd(24, ".")} ${value}`;
}

export interface ReportInput {
  config: Config;
  plan: Plan;
  requested: number;
  signedIn: number;
  activeCount: number;
  stats: WorkerStats;
  convergence: Convergence | null;
}

export function formatReport({
  config,
  plan,
  requested,
  signedIn,
  activeCount,
  stats,
  convergence,
}: ReportInput): string {
  // Every op goes to everyone in the room except its sender; chat goes to
  // everyone, sender included.
  const opsExpected = stats.opsSent * Math.max(0, stats.connected - 1);
  const opDelivery =
    opsExpected > 0 ? stats.opsReceived / opsExpected : Number.NaN;
  const datagramLoss =
    stats.datagramsExpected > 0
      ? 1 - stats.datagramsReceived / stats.datagramsExpected
      : Number.NaN;
  const chatExpected = stats.chatSent * stats.connected;
  const opP95 = percentile(stats.opLatency, 0.95);
  const rule = "=".repeat(78);

  const lines = [
    "",
    rule,
    ` CWA load test report  (${config.scenario} scenario)`,
    rule,
    row("Room", plan.roomId),
    row(
      "Users",
      `${requested} requested | ${signedIn} signed in | ${stats.connected} connected`,
    ),
    row(
      "Drawing users",
      `${activeCount}, for ${config.duration}s, one action every ~${config.actionInterval}s`,
    ),
    row("Connect time", latency(stats.connectMs)),
    row("Elements created", count(stats.elementsCreated)),
    "",
    " Board ops (reliable streams: strokes, shapes, edits)",
    row(
      "Sent",
      `${count(stats.opsSent)} (${(stats.opsSent / config.duration).toFixed(1)}/s)`,
    ),
    row(
      "Delivered",
      `${count(stats.opsReceived)} of ${count(opsExpected)} expected (${pct(opDelivery)})`,
    ),
    row("Latency", latency(stats.opLatency)),
    "",
    " Cursors and drafts (datagrams)",
    row("Sent", count(stats.datagramsSent)),
    row(
      "Delivered",
      `${count(stats.datagramsDelivered)} (loss ${pct(datagramLoss)} of those small enough to send)`,
    ),
    row("Latency", latency(stats.datagramLatency)),
    row(
      "Too big to send",
      `${count(stats.datagramOversize)} drafts over the ${stats.maxDatagramSize || "?"}-byte limit` +
        ` (${pct(stats.datagramOversize / stats.datagramsSent)} of datagrams, never delivered)`,
    ),
  ];

  if (config.chatInterval > 0) {
    lines.push(
      "",
      " Chat",
      row(
        "Sent / received",
        `${count(stats.chatSent)} / ${count(stats.chatReceived)} of ${count(chatExpected)} expected` +
          ` (${pct(chatExpected > 0 ? stats.chatReceived / chatExpected : Number.NaN)})`,
      ),
    );
  }

  if (convergence) {
    lines.push(
      "",
      ` Convergence (${config.sharedShapes} shared shapes, ${count(stats.sharedEdits)} edits,` +
        ` ${convergence.fields} contended fields)`,
      row(
        "Current frontend",
        `${convergence.naive.clients} of ${convergence.clients} clients disagree with the server` +
          ` on ${convergence.naive.fields} fields`,
      ),
      "      (applies whatever arrives last, as useBoardTransport does today)",
      row(
        "Timestamp-checked",
        `${convergence.lww.clients} of ${convergence.clients} clients disagree` +
          ` on ${convergence.lww.fields} fields`,
      ),
      "      (applies an edit only if it is newer, the rule the server uses)",
    );
  }

  const checks: [boolean, string, string][] = [
    [
      stats.connected === requested,
      "Every requested user connected",
      `${stats.connected}/${requested}`,
    ],
    [opDelivery >= 0.995, "Board ops delivered >= 99.5%", pct(opDelivery)],
    [opP95 <= 250, "Board op latency p95 <= 250 ms", `<= ${ms(opP95)}`],
    [datagramLoss <= 0.05, "Cursor/draft loss <= 5%", pct(datagramLoss)],
  ];
  if (convergence) {
    checks.push([
      convergence.naive.clients === 0,
      "Every client ends up matching the server",
      `${convergence.naive.clients} diverged`,
    ]);
  }
  lines.push(
    "",
    " Targets",
    ...checks.map(
      ([pass, label, value]) =>
        `   ${pass ? "PASS" : "FAIL"}  ${`${label} `.padEnd(42, ".")} ${value}`,
    ),
  );

  lines.push(
    "",
    " Load generator health",
    row(
      "Event-loop lag",
      `p99 ${ms(stats.loopLagP99Ms)} | max ${ms(stats.loopLagMaxMs)}`,
    ),
    stats.loopLagP99Ms <= 50
      ? "   OK: the bots kept up, so the latencies above reflect the servers."
      : "   WARNING: the bots' own processes were overloaded, which inflates every latency\n" +
          "   above. Rerun with more --workers, a lower --cursor-hz, or from a second machine.",
  );
  if (stats.connectErrors.length > 0) {
    lines.push(row("Connect errors", stats.connectErrors.join(" | ")));
  }
  if (stats.reliableSendErrors + stats.datagramSendErrors > 0) {
    lines.push(
      row(
        "Send errors",
        `${count(stats.reliableSendErrors)} stream | ${count(stats.datagramSendErrors)} datagram`,
      ),
    );
  }
  if (stats.unhandledRejections > 0) {
    lines.push(
      row("Transport errors", `${count(stats.unhandledRejections)} unhandled`),
    );
  }
  lines.push(rule);

  return lines.join("\n");
}
