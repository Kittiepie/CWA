import { randomUUID } from "node:crypto";
import type { Config } from "./config.js";
import { Histogram } from "./histogram.js";
import type { BotSpec, Cell, ClientView, Plan, Point } from "./messages.js";
import { encode, Session } from "./session.js";

/**
 * Bot client ids start with "z", which never occurs in the browser's hex ids,
 * so a human watching the room is kept out of the numbers.
 */
const BOT_ID_PREFIX = "z";
const CHAT_PREFIX = "[bot";
const CHAT_LINES = [
  "checking in",
  "drawing over here",
  "look at this",
  "nice one",
  "who drew that?",
  "almost done",
];

/** Where the contention scenario's shared shapes live: a band above the grid. */
export const SHARED_AREA = { x: 0, y: -460, width: 1400, height: 320 };
/** The fields bots fight over, and so the only ones the convergence check compares. */
export const CONTENDED_FIELDS = ["position", "size"] as const;
/** Head start for bot 0's shared shapes before anyone starts grabbing them. */
const CONTENTION_SETTLE_MS = 3000;
const MARGIN = 14;
const STEP = 7;

/** Tallies shared by every bot in one worker process. */
export class Counters {
  connected = 0;
  readonly connectErrors: string[] = [];
  readonly connectMs = new Histogram();
  opsSent = 0;
  opsReceived = 0;
  reliableSendErrors = 0;
  readonly opLatency = new Histogram();
  datagramsSent = 0;
  datagramsDelivered = 0;
  datagramOversize = 0;
  datagramSendErrors = 0;
  readonly datagramLatency = new Histogram();
  maxDatagramSize = 0;
  chatSent = 0;
  chatReceived = 0;
  elementsCreated = 0;
  sharedEdits = 0;

  recordConnectError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (
      this.connectErrors.length < 5 &&
      !this.connectErrors.includes(message)
    ) {
      this.connectErrors.push(message);
    }
  }
}

export interface BotContext {
  config: Config;
  plan: Plan;
  counters: Counters;
  sharedIds: ReadonlySet<string>;
  certHash: Uint8Array;
}

type Pointer =
  | { type: "cursor"; x: number; y: number }
  | { type: "draft"; points: Point[] }
  | { type: "viewport"; x: number; y: number; scale: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isContended(field: string): boolean {
  return (CONTENDED_FIELDS as readonly string[]).includes(field);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomIn(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Spreads a period over 0.5x to 1.5x so bots never settle into lockstep. */
function jitter(ms: number): number {
  return ms * (0.5 + Math.random());
}

function randomPointIn(cell: Cell): Point {
  return {
    x: randomIn(cell.x + MARGIN, cell.x + cell.size - MARGIN),
    y: randomIn(cell.y + MARGIN, cell.y + cell.size - MARGIN),
  };
}

/**
 * One simulated user. Once connected it moves its cursor at the browser's
 * datagram rate. While drawing it either scribbles freehand strokes and
 * rectangles inside its own grid cell (grid), or keeps moving and resizing
 * the shapes every other bot is also grabbing (contention).
 */
export class Bot {
  readonly clientId =
    BOT_ID_PREFIX + randomUUID().replaceAll("-", "").slice(0, 7);
  private session: Session | null = null;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private seq = 0;
  private cursor: Point;
  private heading = Math.random() * Math.PI * 2;
  private stroke: { points: Point[]; ticksLeft: number } | null = null;
  private box: { start: Point; ticksLeft: number } | null = null;
  private actions = 0;
  private nextActionAt: number;
  private nextChatAt: number;
  private sharedCreated = false;
  /** Per sending peer: the datagram sequence range seen, and how many arrived. */
  private readonly peers = new Map<
    string,
    { min: number; max: number; count: number }
  >();
  private readonly naive = new Map<string, string>();
  private readonly lww = new Map<string, { json: string; time: number }>();

  constructor(
    readonly spec: BotSpec,
    private readonly context: BotContext,
  ) {
    const { config, plan } = context;
    this.cursor = randomPointIn(spec.cell);
    this.nextActionAt =
      plan.drawStartAt + Math.random() * config.actionInterval * 1000;
    this.nextChatAt =
      plan.drawStartAt + Math.random() * config.chatInterval * 1000;
  }

  get connected(): boolean {
    return this.session !== null;
  }

  /** Joins as the browser does: open the session, then GET_STATE, which also enters the room. */
  async connect(): Promise<void> {
    const { config, plan, counters, certHash } = this.context;
    const startedAt = performance.now();
    let opened: Session | null = null;
    try {
      const session = await Session.open(config.wt, certHash);
      opened = session;
      session.listenReliable((message) => this.onReliable(message));
      session.listenDatagrams((message) => this.onDatagram(message));
      const state = await session.getState(plan.roomId, {
        clientId: this.clientId,
        participantId: this.spec.participantId,
      });
      this.seedViews(state.board);

      this.session = session;
      counters.connected++;
      counters.connectMs.record(performance.now() - startedAt);
      counters.maxDatagramSize = Math.max(
        counters.maxDatagramSize,
        session.maxDatagramSize,
      );
      this.startTicking();
    } catch (error) {
      opened?.close();
      counters.recordConnectError(error);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  close(): void {
    this.stop();
    this.session?.close();
    this.session = null;
  }

  /** Numbered datagrams received from peers, and how many their sequence ranges imply were sent. */
  datagramWindow(): { received: number; expected: number } {
    let received = 0;
    let expected = 0;
    for (const peer of this.peers.values()) {
      received += peer.count;
      expected += peer.max - peer.min + 1;
    }
    return { received, expected };
  }

  view(): ClientView {
    return {
      botIndex: this.spec.index,
      naive: Object.fromEntries(this.naive),
      lww: Object.fromEntries(
        [...this.lww].map(([key, entry]) => [key, entry.json]),
      ),
    };
  }

  private startTicking(): void {
    const period = 1000 / this.context.config.cursorHz;
    // Random phase, so a hundred bots don't all fire in the same millisecond.
    setTimeout(() => {
      if (!this.stopped) this.timer = setInterval(() => this.tick(), period);
    }, Math.random() * period);
  }

  private tick(): void {
    const now = Date.now();
    const { plan, config } = this.context;
    if (now >= plan.drawEndAt) {
      this.stop();
      return;
    }

    if (this.spec.active && now >= plan.drawStartAt) {
      if (config.scenario === "grid") this.stepGrid(now);
      else this.stepContention(now);
      if (config.chatInterval > 0 && now >= this.nextChatAt) this.sendChat(now);
    }

    // Same rule as the browser: a draft once a stroke has two points, a cursor otherwise.
    if (this.stroke && this.stroke.points.length > 1) {
      this.sendPointer({ type: "draft", points: this.stroke.points });
    } else {
      if (!this.box) this.walk(STEP); // a box drag moves the cursor itself
      this.sendPointer({ type: "cursor", x: this.cursor.x, y: this.cursor.y });
    }

    // A viewport heartbeat about every 2s, as the browser sends, so a bot can
    // be followed: its "view" is its own cell at 100%.
    const heartbeatEvery = Math.max(1, Math.round(config.cursorHz * 2));
    if (this.seq % heartbeatEvery === 0) {
      const { cell } = this.spec;
      this.sendPointer({
        type: "viewport",
        x: cell.x + cell.size / 2,
        y: cell.y + cell.size / 2,
        scale: 1,
      });
    }
  }

  private stepGrid(now: number): void {
    const stroke = this.stroke;
    if (stroke) {
      const steps = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < steps; i++) {
        this.walk(STEP);
        stroke.points.push({ ...this.cursor });
      }
      if (--stroke.ticksLeft <= 0) {
        this.stroke = null;
        this.commitStroke(stroke.points);
      }
      return;
    }

    const box = this.box;
    if (box) {
      this.walk(STEP * 2);
      if (--box.ticksLeft <= 0) {
        this.box = null;
        this.commitBox(box.start);
      }
      return;
    }

    if (now < this.nextActionAt) return;
    this.nextActionAt = now + jitter(this.context.config.actionInterval * 1000);
    // Mostly freehand strokes; every fourth action is a rectangle, so shape ops get exercised too.
    this.actions++;
    if (this.actions % 4 === 0) {
      this.box = {
        start: { ...this.cursor },
        ticksLeft: 4 + Math.floor(Math.random() * 4),
      };
    } else {
      this.stroke = {
        points: [{ ...this.cursor }],
        ticksLeft: 8 + Math.floor(Math.random() * 13),
      };
    }
  }

  private commitStroke(points: Point[]): void {
    const id = randomUUID();
    // The same two fields the browser's createElement sends for a freehand stroke.
    this.sendOp(id, "freedraw", "points", points);
    this.sendOp(id, "freedraw", "strokeColor", this.spec.color);
    this.context.counters.elementsCreated++;
  }

  private commitBox(start: Point): void {
    const { cell, color } = this.spec;
    const x = Math.min(start.x, this.cursor.x);
    const y = Math.min(start.y, this.cursor.y);
    // The browser throws away tiny drags; keep every bot box visible instead.
    const width = clamp(
      Math.abs(this.cursor.x - start.x),
      30,
      cell.x + cell.size - MARGIN - x,
    );
    const height = clamp(
      Math.abs(this.cursor.y - start.y),
      20,
      cell.y + cell.size - MARGIN - y,
    );

    const id = randomUUID();
    this.sendOp(id, "rectangle", "position", { x, y });
    this.sendOp(id, "rectangle", "size", { width, height });
    this.sendOp(id, "rectangle", "strokeColor", color);
    this.sendOp(id, "rectangle", "backgroundColor", "transparent");
    this.context.counters.elementsCreated++;
  }

  private stepContention(now: number): void {
    const { plan, config, counters } = this.context;
    if (this.spec.index === 0 && !this.sharedCreated) {
      this.sharedCreated = true;
      this.createSharedShapes();
      return;
    }
    if (
      now < plan.drawStartAt + CONTENTION_SETTLE_MS ||
      now < this.nextActionAt
    ) {
      return;
    }
    this.nextActionAt = now + jitter(config.actionInterval * 1000);

    const ids = plan.sharedShapeIds;
    const id = ids[Math.floor(Math.random() * ids.length)];
    // A drag commits position; a resize commits position and size together,
    // which are the ops the browser sends for those gestures.
    this.sendOp(id, "rectangle", "position", {
      x: randomIn(SHARED_AREA.x, SHARED_AREA.x + SHARED_AREA.width - 140),
      y: randomIn(SHARED_AREA.y, SHARED_AREA.y + SHARED_AREA.height - 90),
    });
    if (Math.random() < 0.3) {
      this.sendOp(id, "rectangle", "size", {
        width: randomIn(60, 140),
        height: randomIn(40, 90),
      });
    }
    counters.sharedEdits++;
  }

  private createSharedShapes(): void {
    this.context.plan.sharedShapeIds.forEach((id, i) => {
      this.sendOp(id, "rectangle", "position", {
        x: SHARED_AREA.x + (i % 5) * 260 + 20,
        y: SHARED_AREA.y + Math.floor(i / 5) * 140 + 20,
      });
      this.sendOp(id, "rectangle", "size", { width: 120, height: 70 });
      this.sendOp(id, "rectangle", "strokeColor", "#b91c1c");
      this.sendOp(id, "rectangle", "backgroundColor", "#fee2e2");
      this.context.counters.elementsCreated++;
    });
  }

  private sendChat(now: number): void {
    const { config, counters } = this.context;
    this.nextChatAt = now + jitter(config.chatInterval * 1000);
    const session = this.session;
    if (!session) return;

    const { cell, index, participantId } = this.spec;
    const line = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)];
    // Half the messages share a location, like the chat panel's "Attach view".
    const coordinate =
      Math.random() < 0.5
        ? { x: cell.x + cell.size / 2, y: cell.y + cell.size / 2 }
        : null;

    counters.chatSent++;
    session
      .sendReliable({
        kind: "chat",
        participantId,
        content: `${CHAT_PREFIX} #${index}] ${line}`,
        coordinate,
      })
      .catch(() => counters.reliableSendErrors++);
  }

  private sendOp(
    elementId: string,
    type: string,
    field: string,
    value: unknown,
  ): void {
    const session = this.session;
    if (!session) return;
    const { counters } = this.context;
    const time: [number, string] = [Date.now(), this.clientId];
    // Applied locally straight away, like the browser's optimistic update.
    this.applyToViews(elementId, field, value, time[0]);
    counters.opsSent++;
    session
      .sendReliable({ elementId, type, field, value, time })
      .catch(() => counters.reliableSendErrors++);
  }

  private sendPointer(pointer: Pointer): void {
    const session = this.session;
    if (!session) return;
    const { counters } = this.context;
    const payload = { ...pointer, clientId: this.clientId, sentAt: Date.now() };
    const numbered = encode({ ...payload, seq: this.seq + 1 });
    const onError = () => {
      counters.datagramSendErrors++;
    };

    counters.datagramsSent++;
    const limit = session.maxDatagramSize;
    if (limit > 0 && numbered.byteLength > limit) {
      // Too big for one datagram: the transport drops it, just as it drops the
      // browser's long drafts. Sent unnumbered so it's reported here rather
      // than counted as network loss.
      counters.datagramOversize++;
      session.sendDatagram(encode(payload), onError);
      return;
    }
    this.seq++;
    session.sendDatagram(numbered, onError);
  }

  private walk(step: number): void {
    const { x: left, y: top, size } = this.spec.cell;
    const minX = left + MARGIN;
    const maxX = left + size - MARGIN;
    const minY = top + MARGIN;
    const maxY = top + size - MARGIN;

    this.heading += (Math.random() - 0.5) * 1.2;
    let x = this.cursor.x + Math.cos(this.heading) * step;
    let y = this.cursor.y + Math.sin(this.heading) * step;
    // Bounce off the cell walls so every bot stays inside its own tile.
    if (x < minX || x > maxX) {
      this.heading = Math.PI - this.heading;
      x = clamp(x, minX, maxX);
    }
    if (y < minY || y > maxY) {
      this.heading = -this.heading;
      y = clamp(y, minY, maxY);
    }
    this.cursor = { x, y };
  }

  private applyToViews(
    elementId: string,
    field: string,
    value: unknown,
    time: number,
  ): void {
    if (!this.context.sharedIds.has(elementId) || !isContended(field)) return;
    const key = `${elementId}:${field}`;
    const json = JSON.stringify(value);
    this.naive.set(key, json);
    const current = this.lww.get(key);
    if (!current || time > current.time) this.lww.set(key, { json, time });
  }

  private seedViews(board: Record<string, string>): void {
    for (const [key, raw] of Object.entries(board)) {
      const separator = key.indexOf(":");
      const elementId = key.slice(0, separator);
      if (!this.context.sharedIds.has(elementId)) continue;
      let stored: unknown;
      try {
        stored = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!isRecord(stored) || !Array.isArray(stored.time)) continue;
      const time: unknown = stored.time[0];
      if (typeof time !== "number") continue;
      this.applyToViews(
        elementId,
        key.slice(separator + 1),
        stored.value,
        time,
      );
    }
  }

  private onReliable(message: unknown): void {
    if (!isRecord(message)) return;
    const { counters } = this.context;

    if (message.kind === "chat") {
      if (
        typeof message.content === "string" &&
        message.content.startsWith(CHAT_PREFIX)
      ) {
        counters.chatReceived++;
      }
      return;
    }

    const { elementId, field, time } = message;
    if (typeof elementId !== "string" || typeof field !== "string") return;
    if (!Array.isArray(time)) return;
    const [sentAt, author]: unknown[] = time;
    if (typeof sentAt !== "number" || typeof author !== "string") return;
    if (!author.startsWith(BOT_ID_PREFIX)) return;

    counters.opsReceived++;
    counters.opLatency.record(Date.now() - sentAt);
    this.applyToViews(elementId, field, message.value, sentAt);
  }

  private onDatagram(message: unknown): void {
    if (!isRecord(message)) return;
    const { clientId, sentAt, seq } = message;
    // Our own are skipped too: the server sends every client the same
    // batches, senders included.
    if (
      typeof clientId !== "string" ||
      !clientId.startsWith(BOT_ID_PREFIX) ||
      clientId === this.clientId
    ) {
      return;
    }
    const { counters } = this.context;
    counters.datagramsDelivered++;
    if (typeof sentAt === "number")
      counters.datagramLatency.record(Date.now() - sentAt);
    if (typeof seq !== "number") return;

    const peer = this.peers.get(clientId);
    if (!peer) {
      this.peers.set(clientId, { min: seq, max: seq, count: 1 });
      return;
    }
    peer.min = Math.min(peer.min, seq);
    peer.max = Math.max(peer.max, seq);
    peer.count++;
  }
}
