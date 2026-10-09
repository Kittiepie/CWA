/**
 * Redis key scheme shared between `RoomService` (Postgres <-> Redis load) and
 * `BoardSyncService` (Redis -> Postgres flush), so both sides agree on where
 * a room's data lives without duplicating string templates.
 */

export const ACTIVE_ROOMS_SET_KEY = 'rooms:active';

export function roomKey(roomId: string): string {
  return `room:${roomId}`;
}

export function roomParticipantsKey(
  roomId: string,
  participantId: string,
): string {
  return `room:${roomId}:participants:${participantId}`;
}

/**
 * Matches every participant hash in a room. Deliberately a scan pattern
 * rather than an index set: a `room:{id}:participants` key holding ids would
 * collide with the `room:{id}:participants:{pid}` hashes it indexes, which
 * makes the keyspace read as though participants were stored as bare ids.
 * Eviction is the only caller and runs once per room close, so a scan is
 * cheap enough to be worth the clearer layout.
 */
export function roomParticipantsPattern(roomId: string): string {
  return `room:${roomId}:participants:*`;
}

export function boardHashKey(roomId: string): string {
  return `board:${roomId}`;
}

/**
 * The room's chat log, written by the HTTP3 server. Session-scoped by design:
 * unlike board elements there is no Postgres mirror, so it is dropped with the
 * room rather than flushed anywhere.
 */
export function chatListKey(roomId: string): string {
  return `chat:${roomId}`;
}

export function roomLastFlushedAtKey(roomId: string): string {
  return `room:${roomId}:lastFlushedAt`;
}
