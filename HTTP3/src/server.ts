import { Http3Server } from "@fails-components/webtransport";
import { readFileSync } from "fs";
import { createHash, randomUUID, X509Certificate } from "crypto";
import { createClient } from "redis";
import {
  ELEMENT_TYPES,
  parseChatMessage,
  parseChatSendRequest,
  parseOp,
  type ChatMessage,
  type Op,
  type Presence,
  type PresenceMessage,
} from "./types.js";

const cert = readFileSync(process.env.HTTP3_CERT_FILE_PATH ?? "./cert.pem");
const key = readFileSync(process.env.HTTP3_KEY_FILE_PATH ?? "./key.pem");

const h3Server = new Http3Server({
  port: Number(process.env.PORT ?? 5000),
  host: process.env.HTTP3_HOST ?? "0.0.0.0",
  secret: process.env.HTTP3_SECRET ?? "changeme",
  cert,
  privKey: key,
});

const x509 = new X509Certificate(cert);
const certHashBase64 = createHash("sha256").update(x509.raw).digest("base64");
console.log("Cert hash (dán vào client):", certHashBase64);

const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

redis.on("error", (err) => console.error("Redis error:", err));
await redis.connect();

interface RoomState {
  sessions: Set<any>;
}
const rooms = new Map<string, RoomState>();
const sessionRoomId = new Map<any, string>(); // session -> roomId, để biết dọn khỏi phòng nào lúc đóng kết nối
/** Who each session is, for sessions that identified themselves on GET_STATE. */
const sessionPresence = new Map<any, Presence>();

function roomKeyFor(roomId: string): string {
  return `board:${roomId}`;
}

function getOrCreateRoom(roomId: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = { sessions: new Set() };
    rooms.set(roomId, room);
  }
  return room;
}

function joinRoom(session: any, roomId: string): void {
  const previous = sessionRoomId.get(session);
  if (previous === roomId) return; // gọi lại GET_STATE trên phòng đang ở — không cần làm gì thêm
  if (previous) {
    // hiếm: đổi phòng giữa chừng
    getOrCreateRoom(previous).sessions.delete(session);
    announceLeave(session, previous);
  }
  getOrCreateRoom(roomId).sessions.add(session);
  sessionRoomId.set(session, roomId);
  console.log(`session joined room "${roomId}" (${rooms.get(roomId)!.sessions.size} in room now)`);
}

const ROOM_CLOSE_DEBOUNCE_MS = Number(process.env.ROOM_CLOSE_DEBOUNCE_MS ?? 5000);

function leaveRoom(session: any): void {
  const roomId = sessionRoomId.get(session);
  if (!roomId) return;
  const room = rooms.get(roomId);
  room?.sessions.delete(session);
  sessionRoomId.delete(session);
  // Only once the session is out of the room, so the leave goes to those still in it.
  announceLeave(session, roomId);
  if (room && room.sessions.size === 0) {
    rooms.delete(roomId);
    // Debounce: a quick refresh/reconnect shouldn't trigger a flush+evict in
    // the API — only announce the room as closed if it's still empty after a
    // short grace period.
    setTimeout(() => {
      if (!rooms.has(roomId)) {
        redis.publish("room:closed", JSON.stringify({ roomId })).catch((err) =>
          console.error("failed to publish room:closed:", err),
        );
      }
    }, ROOM_CLOSE_DEBOUNCE_MS);
  }
}

const TOMBSTONE_TTL_MS = Number(process.env.TOMBSTONE_TTL_MS ?? 24 * 60 * 60 * 1000); // 24h
const TOMBSTONE_SWEEP_INTERVAL_MS = Number(process.env.TOMBSTONE_SWEEP_INTERVAL_MS ?? 10 * 60 * 1000); // 10p

/** Shape actually stored in the Redis hash for every `elementId:field` entry. */
interface StoredField {
  value: unknown;
  time: [number, string];
}

function parseStoredField(raw: string): StoredField | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  const t = p.time;
  if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== "number" || typeof t[1] !== "string") {
    return null;
  }
  return { value: p.value, time: [t[0], t[1]] };
}

async function sweepExpiredTombstones(): Promise<void> {
  for await (const roomKeys of redis.scanIterator({ MATCH: "board:*", COUNT: 100 })) {
    for (const roomKey of roomKeys) {
      await sweepRoomTombstones(roomKey).catch((err) =>
        console.error(`tombstone sweep error for ${roomKey}:`, err)
      );
    }
  }
}

async function sweepRoomTombstones(roomKey: string): Promise<void> {
  const all = await redis.hGetAll(roomKey);
  const now = Date.now();

  const candidateIds: string[] = [];
  for (const [hashField, raw] of Object.entries(all)) {
    if (!hashField.endsWith(":deleted")) continue;
    const parsed = parseStoredField(raw);
    if (!parsed || parsed.value !== true) continue;
    if (now - parsed.time[0] < TOMBSTONE_TTL_MS) continue;
    candidateIds.push(hashField.slice(0, -":deleted".length));
  }
  if (candidateIds.length === 0) return;

  let purgedElements = 0;
  let purgedFields = 0;
  for (const elementId of candidateIds) {
    const recheckRaw = await redis.hGet(roomKey, `${elementId}:deleted`);
    const recheck = recheckRaw ? parseStoredField(recheckRaw) : null;
    if (!recheck || recheck.value !== true || now - recheck.time[0] < TOMBSTONE_TTL_MS) continue;

    const fields = Object.keys(all).filter((f) => f.startsWith(`${elementId}:`));
    if (fields.length === 0) continue;
    await redis.hDel(roomKey, fields);
    purgedElements += 1;
    purgedFields += fields.length;
  }
  if (purgedElements > 0) {
    console.log(`tombstone sweep (${roomKey}): purged ${purgedFields} fields from ${purgedElements} elements`);
  }
}

const CHAT_HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT ?? 200);

function chatKeyFor(roomId: string): string {
  return `chat:${roomId}`;
}

function participantKeyFor(roomId: string, participantId: string): string {
  return `room:${roomId}:participants:${participantId}`;
}

/** The room's conversation so far, oldest first. Skips anything unparseable. */
async function readChatHistory(roomId: string): Promise<ChatMessage[]> {
  const entries = await redis.lRange(chatKeyFor(roomId), 0, -1);
  const messages: ChatMessage[] = [];
  for (const entry of entries) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(entry);
    } catch {
      continue;
    }
    const message = parseChatMessage(parsed);
    if (message) messages.push(message);
  }
  return messages;
}

async function handleChatMessage(raw: unknown, roomId: string): Promise<void> {
  const request = parseChatSendRequest(raw);
  if (!request) {
    console.log("dropped: invalid chat message");
    return;
  }

  // Display name and theme are read from the participant hash the API wrote
  // at join time, never taken from the sender — otherwise a client could post
  // under anyone's name. An unknown participant simply can't post.
  const participant = await redis.hGetAll(
    participantKeyFor(roomId, request.participantId),
  );
  if (!participant?.displayName) {
    console.log(`dropped: chat from unknown participant ${request.participantId}`);
    return;
  }

  const message: ChatMessage = {
    kind: "chat",
    id: randomUUID(),
    participantId: request.participantId,
    displayName: participant.displayName,
    themeColor: participant.themeColor ?? "blue",
    content: request.content,
    coordinate: request.coordinate,
    createdAt: new Date().toISOString(),
  };

  const chatKey = chatKeyFor(roomId);
  await redis.rPush(chatKey, JSON.stringify(message));
  await redis.lTrim(chatKey, -CHAT_HISTORY_LIMIT, -1);

  console.log(`chat    [${roomId}] ${message.displayName}: ${message.content.slice(0, 60)}`);

  // Broadcast with no exclusion, so the sender renders the server's copy too:
  // everyone ends up with the same id, timestamp and ordering, and the client
  // needs no optimistic-echo de-duplication.
  await broadcastStreamOp(
    new TextEncoder().encode(JSON.stringify(message)),
    null,
    roomId,
  );
}

async function broadcastStreamOp(payload: Uint8Array, exclude: any, roomId: string): Promise<void> {
  const room = rooms.get(roomId);
  if (!room) return;
  // To every recipient at once. One after another, each op waited on every
  // earlier recipient's stream to open and finish: in a room of 100, a stroke
  // queued behind 99 of them.
  await Promise.all(
    [...room.sessions]
      .filter((s) => s !== exclude)
      .map(async (s) => {
        try {
          const stream = await s.createUnidirectionalStream();
          const writer = stream.getWriter();
          await writer.write(payload);
          await writer.close();
        } catch {
          // session có thể vừa đóng — bỏ qua, sẽ tự bị dọn khỏi registry qua session.closed
        }
      }),
  );
}

async function handleWriteStream(stream: ReadableStream<Uint8Array>, session: any): Promise<void> {
  const roomId = sessionRoomId.get(session);
  if (!roomId) {
    console.log("dropped: write op before session joined a room");
    return;
  }
  const roomKey = roomKeyFor(roomId);

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const rawBytes = Buffer.concat(chunks);

  let raw: unknown;
  try {
    raw = JSON.parse(rawBytes.toString("utf-8"));
  } catch {
    console.log("dropped: invalid JSON");
    return;
  }

  // Chat rides the same reliable stream as board ops; `kind` tells them apart.
  if (typeof raw === "object" && raw !== null && (raw as Record<string, unknown>).kind === "chat") {
    await handleChatMessage(raw, roomId);
    return;
  }

  const op: Op | null = parseOp(raw);
  if (!op) {
    console.log("dropped: invalid op", raw);
    return;
  }

  const hashField = `${op.elementId}:${op.field}`;

  const existingRaw = await redis.hGet(roomKey, hashField);
  const existing = existingRaw ? parseStoredField(existingRaw) : null;

  // CRDT merge tối giản: Last-Write-Wins theo timestamp, ở cấp FIELD (không phải cấp object)
  // "points" (nét vẽ tự do / line) cũng chỉ là 1 field như "position"/"strokeColor" — không cần xử lý riêng
  if (!existing || op.time[0] > existing.time[0]) {
    const stored: StoredField = { value: op.value, time: op.time };
    await redis.hSet(roomKey, hashField, JSON.stringify(stored));

    if (op.field !== "deleted") {
      const typeField = `${op.elementId}:__type`;
      const storedType: StoredField = { value: op.type, time: op.time };
      await redis.hSetNX(roomKey, typeField, JSON.stringify(storedType));
    }

    console.log(`merged  [${roomId}] ${hashField}`);
    await broadcastStreamOp(rawBytes, session, roomId); // đẩy real-time cho các session khác trong phòng
  } else {
    console.log(`skipped [${roomId}] ${hashField} (stale)`);
  }
}

// ---------------------------------------------------------------------------
// Presence: who is in each room, one entry per connection, pushed to everyone
// as people join and leave.
// ---------------------------------------------------------------------------

const FALLBACK_THEME = "blue";

/**
 * The name and theme shown on this session's cursor, read from the
 * participant hash the API wrote when they joined, never taken from the
 * client itself.
 */
async function resolvePresence(
  roomId: string,
  clientId: string,
  participantId: string | null,
): Promise<Presence> {
  const stored = participantId
    ? await redis.hGetAll(participantKeyFor(roomId, participantId))
    : null;
  return {
    clientId,
    participantId,
    displayName: stored?.displayName || "Guest",
    themeColor: stored?.themeColor || FALLBACK_THEME,
  };
}

function listPresence(roomId: string): Presence[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  const present: Presence[] = [];
  for (const s of room.sessions) {
    const presence = sessionPresence.get(s);
    if (presence) present.push(presence);
  }
  return present;
}

function sendPresence(roomId: string, message: PresenceMessage, exclude: any): void {
  broadcastStreamOp(new TextEncoder().encode(JSON.stringify(message)), exclude, roomId).catch(
    (err) => console.error("presence broadcast error:", err),
  );
}

function announceLeave(session: any, roomId: string): void {
  const presence = sessionPresence.get(session);
  if (!presence) return;
  sessionPresence.delete(session);
  console.log(`presence [${roomId}] ${presence.displayName} left`);
  sendPresence(roomId, { kind: "presence", event: "leave", clientId: presence.clientId }, session);
}

/** Shape of the one request bidirectional streams carry today. */
interface JoinAndGetStateRequest {
  cmd: "GET_STATE";
  roomId: string;
  /**
   * Both optional, so an older client still gets the board; without a
   * clientId the session just isn't listed in the room's presence.
   */
  clientId: string | null;
  participantId: string | null;
}

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseJoinAndGetStateRequest(raw: string): JoinAndGetStateRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p.cmd !== "GET_STATE" || typeof p.roomId !== "string" || p.roomId.length === 0) return null;
  return {
    cmd: "GET_STATE",
    roomId: p.roomId,
    clientId: optionalId(p.clientId),
    participantId: optionalId(p.participantId),
  };
}

async function handleReadStream(stream: any, session: any): Promise<void> {
  const reader = stream.readable.getReader();
  const writer = stream.writable.getWriter();
  const { value } = await reader.read();
  if (value) {
    const req = parseJoinAndGetStateRequest(new TextDecoder().decode(value));
    if (req) {
      joinRoom(session, req.roomId);
      const [board, chat, presence] = await Promise.all([
        redis.hGetAll(roomKeyFor(req.roomId)),
        readChatHistory(req.roomId),
        req.clientId ? resolvePresence(req.roomId, req.clientId, req.participantId) : null,
      ]);
      // Only if the session is still here: it may have closed during the
      // lookups above, and registering it then would leave a ghost behind.
      const stillHere = sessionRoomId.get(session) === req.roomId;
      // Registered before listing, so the reply includes this session too.
      if (presence && stillHere) sessionPresence.set(session, presence);
      const participants = listPresence(req.roomId);
      await writer.write(new TextEncoder().encode(JSON.stringify({ board, chat, participants })));
      console.log(
        `sent state [${req.roomId}] (${Object.keys(board).length} fields, ${chat.length} chat, ${participants.length} present)`,
      );
      if (presence && stillHere) {
        console.log(`presence [${req.roomId}] ${presence.displayName} joined`);
        sendPresence(req.roomId, { kind: "presence", event: "join", participant: presence }, session);
      }
    } else {
      console.log("dropped: invalid GET_STATE request");
    }
  }
  await writer.close();
}

// ---------------------------------------------------------------------------
// Datagrams (cursors, drafts, viewports). Relaying each one to every other
// session the moment it arrived made sends grow with the square of the room:
// ~70,000 a second at 85 people, against a measured ceiling of ~10,000. So a
// tick's worth is collected per room and sent packed into as few datagrams
// as fit, the same packets to everyone. Nothing is dropped or merged: every
// update still arrives, just grouped.
// ---------------------------------------------------------------------------

const DATAGRAM_TICK_MS = Number(process.env.DATAGRAM_TICK_MS ?? 100);
/** Under the ~1,200-byte datagram limit, with room to spare. */
const DATAGRAM_BATCH_BYTES = Number(process.env.DATAGRAM_BATCH_BYTES ?? 1100);

/** Per room, the datagrams received since the last tick, as JSON text. */
const pendingDatagrams = new Map<string, string[]>();
/** One writer per session for its whole life, instead of one taken and released per send. */
const datagramWriters = new WeakMap<any, WritableStreamDefaultWriter<Uint8Array>>();

function datagramWriterFor(session: any): WritableStreamDefaultWriter<Uint8Array> {
  let writer = datagramWriters.get(session);
  if (!writer) {
    writer = session.datagrams.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
    datagramWriters.set(session, writer);
  }
  return writer;
}

/**
 * Groups messages into JSON arrays of at most DATAGRAM_BATCH_BYTES each. A
 * message too big to share a packet goes out alone, exactly as it arrived;
 * clients accept both shapes.
 */
function packDatagrams(messages: string[]): Uint8Array[] {
  const encoder = new TextEncoder();
  const packets: Uint8Array[] = [];
  let batch: string[] = [];
  let batchBytes = 2; // "[" and "]"

  const close = () => {
    if (batch.length > 0) packets.push(encoder.encode(`[${batch.join(",")}]`));
    batch = [];
    batchBytes = 2;
  };

  for (const message of messages) {
    const size = Buffer.byteLength(message);
    if (size + 2 > DATAGRAM_BATCH_BYTES) {
      packets.push(encoder.encode(message));
      continue;
    }
    if (batchBytes + size + 1 > DATAGRAM_BATCH_BYTES) close();
    batchBytes += size + (batch.length > 0 ? 1 : 0);
    batch.push(message);
  }
  close();
  return packets;
}

function flushDatagrams(): void {
  for (const [roomId, messages] of pendingDatagrams) {
    const room = rooms.get(roomId);
    if (!room) continue;
    const packets = packDatagrams(messages);
    // Everyone gets the same packets, senders included, and each client skips
    // its own entries: far cheaper than building a batch per recipient.
    for (const session of room.sessions) {
      try {
        const writer = datagramWriterFor(session);
        for (const packet of packets) writer.write(packet).catch(() => { });
      } catch {
        // session có thể vừa đóng — bỏ qua, sẽ tự bị dọn khỏi registry qua session.closed
      }
    }
  }
  pendingDatagrams.clear();
}

setInterval(flushDatagrams, DATAGRAM_TICK_MS);

function isJsonObject(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

async function handleDatagrams(session: any): Promise<void> {
  const reader = session.datagrams.readable.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const roomId = sessionRoomId.get(session);
    if (!roomId) continue; // chưa join phòng nào (chưa gửi GET_STATE lần đầu) — bỏ qua
    const text = decoder.decode(value);
    // One malformed message spliced into a batch would break the whole packet for everyone.
    if (!isJsonObject(text)) continue;
    let messages = pendingDatagrams.get(roomId);
    if (!messages) {
      messages = [];
      pendingDatagrams.set(roomId, messages);
    }
    messages.push(text);
  }
}

(async () => {
  const sessionStream = h3Server.sessionStream("/wt");
  const sessionReader = sessionStream.getReader();

  while (true) {
    const { done, value: session } = await sessionReader.read();
    if (done) break;

    await session.ready;
    console.log("client connected");
    session.closed.then(() => leaveRoom(session)).catch(() => leaveRoom(session));

    handleDatagrams(session).catch((err) => console.error("datagram loop error:", err));

    const uniReader = session.incomingUnidirectionalStreams.getReader();
    (async () => {
      while (true) {
        const { done, value: s } = await uniReader.read();
        if (done) break;
        handleWriteStream(s, session).catch((err) => console.error("write stream error:", err));
      }
    })().catch((err) => console.error("uni stream loop error:", err));

    const bidiReader = session.incomingBidirectionalStreams.getReader();
    (async () => {
      while (true) {
        const { done, value: s } = await bidiReader.read();
        if (done) break;
        handleReadStream(s, session).catch((err) => console.error("read stream error:", err));
      }
    })().catch((err) => console.error("bidi stream loop error:", err));
  }
})();

h3Server.startServer();
console.log(`Server started at port ${h3Server.port ?? process.env.PORT ?? 5000}`);
console.log("Element types supported:", ELEMENT_TYPES.join(", "));

sweepExpiredTombstones().catch((err) => console.error("tombstone sweep error:", err));
setInterval(() => {
  sweepExpiredTombstones().catch((err) => console.error("tombstone sweep error:", err));
}, TOMBSTONE_SWEEP_INTERVAL_MS);