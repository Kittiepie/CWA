import type { Config } from "./config.js";
import type { HistogramData } from "./histogram.js";

export interface Point {
  x: number;
  y: number;
}

export interface Cell {
  x: number;
  y: number;
  size: number;
}

export interface BotSpec {
  index: number;
  participantId: string;
  /** Epoch ms at which this bot opens its session; spreads the ramp-up. */
  connectAt: number;
  /** Drawing bots stroke/edit; the rest only move their cursor. */
  active: boolean;
  color: string;
  cell: Cell;
}

/**
 * Absolute timestamps shared by every process. Everything runs on one
 * machine, so one clock lines the phases up without any extra choreography.
 */
export interface Plan {
  roomId: string;
  rampStartAt: number;
  drawStartAt: number;
  drawEndAt: number;
  reportAt: number;
  /** Contention scenario only: bot 0 creates these, everyone then fights over them. */
  sharedShapeIds: string[];
}

/** What one client believes the contended fields hold, keyed `elementId:field`. */
export interface ClientView {
  botIndex: number;
  /** Applied the way the current frontend does: whatever arrived last wins. */
  naive: Record<string, string>;
  /** Applied only when newer by timestamp, the rule the server itself uses. */
  lww: Record<string, string>;
}

export interface WorkerStats {
  bots: number;
  connected: number;
  connectErrors: string[];
  connectMs: HistogramData;
  opsSent: number;
  opsReceived: number;
  reliableSendErrors: number;
  opLatency: HistogramData;
  datagramsSent: number;
  /** Every bot datagram that arrived, numbered or not. */
  datagramsDelivered: number;
  /** Numbered datagrams that arrived; with `datagramsExpected`, gives the loss rate. */
  datagramsReceived: number;
  datagramsExpected: number;
  datagramOversize: number;
  datagramSendErrors: number;
  datagramLatency: HistogramData;
  maxDatagramSize: number;
  chatSent: number;
  chatReceived: number;
  elementsCreated: number;
  sharedEdits: number;
  unhandledRejections: number;
  loopLagP99Ms: number;
  loopLagMaxMs: number;
  views: ClientView[];
}

export interface StartMessage {
  type: "start";
  workerId: number;
  config: Config;
  plan: Plan;
  bots: BotSpec[];
}

export type ToWorker = StartMessage | { type: "shutdown" };

export interface ProgressMessage {
  type: "progress";
  workerId: number;
  connected: number;
  opsSent: number;
  datagramsSent: number;
  datagramsDelivered: number;
}

export type FromWorker =
  | { type: "ready" }
  | ProgressMessage
  | { type: "report"; workerId: number; stats: WorkerStats };
