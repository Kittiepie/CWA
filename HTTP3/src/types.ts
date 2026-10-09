/**
 * Shared types for the whiteboard's board elements.
 *
 * An element is never sent over the wire as one whole object. Clients send
 * one `BoardOp` per field that changed, and the server merges each field
 * independently — last-write-wins by `time[0]` (ms timestamp), tie-broken by
 * `time[1]` (sending client id). This file is the single source of truth for
 * both shapes: what a merged element looks like, and what a legal field op
 * looks like for each element type. See board-elements.md for the narrative
 * version of this file.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const ELEMENT_TYPES = [
  "rectangle",
  "diamond",
  "ellipse",
  "line",
  "freedraw",
  "text",
  "image",
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Per-type `data` shapes — this is what board_elements.data (jsonb) holds.
// ---------------------------------------------------------------------------

/** rectangle | diamond | ellipse — anything defined by a bounding box. */
export interface ShapeData {
  position: Point; // top-left corner of the bounding box
  size: Size;
  strokeColor: string; // CSS color, e.g. "#1f2937"
  backgroundColor: string; // fill color; "transparent" if unfilled
}

/** line | freedraw — anything defined by an ordered list of points. */
export interface LinearData {
  points: Point[]; // absolute canvas coordinates, in drawing order
  strokeColor: string;
}

export interface TextData {
  position: Point; // top-left of the text box
  size: Size; // box the text wraps within — chosen by dragging, like a shape
  text: string;
  color: string;
  fontSize: number; // px
}

/** A picture uploaded to the API, drawn stretched to `size`. */
export interface ImageElementData {
  position: Point; // top-left corner
  size: Size;
  imageId: string; // the upload's id; the file is served at /board-images/{imageId}
}

export interface BoardElementDataMap {
  rectangle: ShapeData;
  diamond: ShapeData;
  ellipse: ShapeData;
  line: LinearData;
  freedraw: LinearData;
  text: TextData;
  image: ImageElementData;
}

export type BoardElementData = BoardElementDataMap[ElementType];

export const FIELDS_BY_TYPE: { [T in ElementType]: readonly (keyof BoardElementDataMap[T])[] } = {
  rectangle: ["position", "size", "strokeColor", "backgroundColor"],
  diamond: ["position", "size", "strokeColor", "backgroundColor"],
  ellipse: ["position", "size", "strokeColor", "backgroundColor"],
  line: ["points", "strokeColor"],
  freedraw: ["points", "strokeColor"],
  text: ["position", "size", "text", "color", "fontSize"],
  image: ["position", "size", "imageId"],
};

/**
 * A fully merged element as reconstructed from Redis/Postgres.
 * `data` is Partial because a brand new element may not have every field's
 * op merged in yet (e.g. "position" arrived but "backgroundColor" hasn't).
 */
export type BoardElement = {
  [T in ElementType]: {
    id: string;
    type: T;
    deleted: boolean;
    data: Partial<BoardElementDataMap[T]>;
  };
}[ElementType];

// ---------------------------------------------------------------------------
// Field-level ops sent over WebTransport streams.
// ---------------------------------------------------------------------------

export type FieldOf<T extends ElementType> = keyof BoardElementDataMap[T];

/** One field mutation for one element of type T. */
export type BoardOp = {
  [T in ElementType]: {
    [F in FieldOf<T>]: {
      elementId: string;
      type: T;
      field: F;
      value: BoardElementDataMap[T][F];
      time: [number, string];
    };
  }[FieldOf<T>];
}[ElementType];

/**
 * Marks a whole element as deleted or restored. Deliberately kept outside
 * `BoardElementDataMap` — deletion isn't part of the element's rendered
 * data, it's a separate soft-delete flag (mirrors board_elements.deleted /
 * deleted_at in Postgres, see board-elements.md).
 */
export interface DeleteOp {
  elementId: string;
  field: "deleted";
  value: boolean;
  time: [number, string];
}

export type Op = BoardOp | DeleteOp;

// ---------------------------------------------------------------------------
// Chat. Deliberately Redis-only and session-scoped: unlike board elements
// there's no Postgres mirror, so a room's conversation dies with the room.
// ---------------------------------------------------------------------------

export const MAX_CHAT_CONTENT_LENGTH = 2000;

/** Optional canvas location attached to a message, in world coordinates. */
export type ChatCoordinate = Point;

/** What a client sends to post a message. */
export interface ChatSendRequest {
  kind: "chat";
  participantId: string;
  content: string;
  coordinate: ChatCoordinate | null;
}

/**
 * What the server stores and pushes back out. The author's display name and
 * theme are resolved server-side from the room's participant hash rather than
 * taken from the sender, so a client can't post under someone else's name.
 */
export interface ChatMessage {
  kind: "chat";
  id: string;
  participantId: string;
  displayName: string;
  themeColor: string;
  content: string;
  coordinate: ChatCoordinate | null;
  createdAt: string;
}

function parseCoordinate(value: unknown): ChatCoordinate | null {
  return isPoint(value) ? { x: value.x, y: value.y } : null;
}

export function parseChatSendRequest(raw: unknown): ChatSendRequest | null {
  if (!isRecord(raw) || raw.kind !== "chat") return null;
  if (typeof raw.participantId !== "string" || raw.participantId.length === 0) return null;
  if (typeof raw.content !== "string") return null;

  const content = raw.content.trim();
  if (content.length === 0 || content.length > MAX_CHAT_CONTENT_LENGTH) return null;

  return {
    kind: "chat",
    participantId: raw.participantId,
    content,
    coordinate: parseCoordinate(raw.coordinate),
  };
}

export function parseChatMessage(raw: unknown): ChatMessage | null {
  if (!isRecord(raw) || raw.kind !== "chat") return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.participantId !== "string" ||
    typeof raw.displayName !== "string" ||
    typeof raw.themeColor !== "string" ||
    typeof raw.content !== "string" ||
    typeof raw.createdAt !== "string"
  ) {
    return null;
  }

  return {
    kind: "chat",
    id: raw.id,
    participantId: raw.participantId,
    displayName: raw.displayName,
    themeColor: raw.themeColor,
    content: raw.content,
    coordinate: parseCoordinate(raw.coordinate),
    createdAt: raw.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Presence: who is in the room right now, one entry per connection. Kept in
// the HTTP3 server's memory only; nothing about it is stored.
// ---------------------------------------------------------------------------

export interface Presence {
  /** Per-connection id, which is also what cursor and viewport datagrams carry. */
  clientId: string;
  participantId: string | null;
  displayName: string;
  themeColor: string;
}

export type PresenceMessage =
  | { kind: "presence"; event: "join"; participant: Presence }
  | { kind: "presence"; event: "leave"; clientId: string };

export function parsePresence(raw: unknown): Presence | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.clientId !== "string" ||
    typeof raw.displayName !== "string" ||
    typeof raw.themeColor !== "string"
  ) {
    return null;
  }
  return {
    clientId: raw.clientId,
    participantId: typeof raw.participantId === "string" ? raw.participantId : null,
    displayName: raw.displayName,
    themeColor: raw.themeColor,
  };
}

export function parsePresenceMessage(raw: unknown): PresenceMessage | null {
  if (!isRecord(raw) || raw.kind !== "presence") return null;
  if (raw.event === "join") {
    const participant = parsePresence(raw.participant);
    return participant ? { kind: "presence", event: "join", participant } : null;
  }
  if (raw.event === "leave" && typeof raw.clientId === "string") {
    return { kind: "presence", event: "leave", clientId: raw.clientId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Runtime validation — JSON.parse gives you `any`; this narrows `unknown`
// into a real Op (or null) without ever casting through `any`.
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isPoint(v: unknown): v is Point {
  return isRecord(v) && typeof v.x === "number" && typeof v.y === "number";
}

function isSize(v: unknown): v is Size {
  return isRecord(v) && typeof v.width === "number" && typeof v.height === "number";
}

function isElementType(v: unknown): v is ElementType {
  return typeof v === "string" && (ELEMENT_TYPES as readonly string[]).includes(v);
}

/** Upload ids are UUIDs. Holding them to that keeps a URL built from one pointing at an upload. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isFieldValueValid(field: string, value: unknown): boolean {
  switch (field) {
    case "position":
      return isPoint(value);
    case "size":
      return isSize(value);
    case "points":
      return Array.isArray(value) && value.every(isPoint);
    case "strokeColor":
    case "backgroundColor":
    case "color":
    case "text":
      return typeof value === "string";
    case "fontSize":
      return typeof value === "number";
    case "imageId":
      return typeof value === "string" && UUID.test(value);
    default:
      return false;
  }
}

/** Parses + validates a raw, untrusted network payload into a typed Op. */
export function parseOp(raw: unknown): Op | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.elementId !== "string" || typeof raw.field !== "string") return null;

  const t = raw.time;
  if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== "number" || typeof t[1] !== "string") {
    return null;
  }
  const time: [number, string] = [t[0], t[1]];

  if (raw.field === "deleted") {
    if (typeof raw.value !== "boolean") return null;
    return { elementId: raw.elementId, field: "deleted", value: raw.value, time };
  }

  if (!isElementType(raw.type)) return null;
  const type = raw.type;

  const legalFields: readonly string[] = FIELDS_BY_TYPE[type];
  if (!legalFields.includes(raw.field)) return null;
  if (!isFieldValueValid(raw.field, raw.value)) return null;

  // Every branch above has already verified `field`/`value` agree with
  // `type`, so this reflects a runtime-checked invariant, not a blind cast.
  return { elementId: raw.elementId, type, field: raw.field, value: raw.value, time } as BoardOp;
}