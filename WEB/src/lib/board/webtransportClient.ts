import type { ChatCoordinate, ChatMessage, ElementType, Op, Presence, PresenceMessage } from "@/types/board";
import { parseChatMessage, parseOp, parsePresence, parsePresenceMessage } from "@/types/board";
import check from "check-types";

export type OpHandler = (op: Op) => void;
export type DatagramHandler = (payload: unknown) => void;
export type ChatHandler = (message: ChatMessage) => void;
export type PresenceHandler = (message: PresenceMessage) => void;

/** GET_STATE hands back the board, the chat log and who's in the room in one round trip. */
export interface BoardState {
    board: Record<string, RawStateEntry>;
    chat: ChatMessage[];
    participants: Presence[];
}

/** Shape of one Redis hash entry as returned by the server's GET_STATE reply. */
export interface RawStateEntry {
    value: unknown;
    time: [number, string];
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        result.set(c, offset);
        offset += c.length;
    }
    return result;
}

async function readAll(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const reader = readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    return concatChunks(chunks);
}

function parseStoredField(raw: string): RawStateEntry | null {
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

/**
 * Thin wrapper around the browser WebTransport API, carrying exactly the
 * three channels the HTTP3 server exposes (see /HTTP3/server.ts):
 *  - unidirectional streams for reliable traffic: CRDT-merged field ops,
 *    chat, and presence (who joined or left)
 *  - one bidirectional stream per GET_STATE request (which also declares
 *    which room this session belongs to — see loadState below)
 *  - datagrams for cursor/draft/viewport broadcasts (no Redis, no ordering guarantee)
 *
 * Deliberately has no React/Konva knowledge — `useBoardTransport` is the
 * hook that adapts this to React state.
 */
export class BoardTransport {
    readonly clientId: string = crypto.randomUUID().slice(0, 8);

    private transport: WebTransport | null = null;
    private connected = false;
    private closeRequested = false;
    private readonly opHandlers = new Set<OpHandler>();
    private readonly datagramHandlers = new Set<DatagramHandler>();
    private readonly chatHandlers = new Set<ChatHandler>();
    private readonly presenceHandlers = new Set<PresenceHandler>();

    async connect(url: string, certHashBase64: string | null): Promise<void> {
        const transport: WebTransport = (() => {
          // if certHashBase64 is a string, use certificate pinning
          if (check.string(certHashBase64)) {
            return new WebTransport(url, {
              serverCertificateHashes: [
                {
                  algorithm: "sha-256",
                  value: Uint8Array.from(atob(certHashBase64), (c) => c.charCodeAt(0)),
                },
              ],
            });
          }
          // if certHashBase64 is null, don't use certificate pinning, which waits for the browser to trust the CA
          else {
            return new WebTransport(url);
          }
        })();

        this.transport = transport;
        await transport.ready;
        this.connected = true;

        // A caller that gave up during the handshake couldn't close the
        // session then (see close below) — honour it now that it's legal.
        if (this.closeRequested) {
            this.teardown();
            return;
        }

        this.listenForPushedOps();
        this.listenForDatagrams();
    }

    /**
     * Ends the session. The server only learns a client left when the
     * underlying connection closes (`session.closed` -> leaveRoom in
     * server.ts), which is what eventually triggers the room's final flush to
     * Postgres — so leaving this uncalled strands the room as "active".
     *
     * Safe to call at any point: WebTransport throws on close() while the
     * handshake is still in flight (which React does on every StrictMode
     * double-mount), so that case defers to connect() instead of closing here.
     */
    close(): void {
        this.closeRequested = true;
        if (this.connected) this.teardown();
    }

    private teardown(): void {
        this.transport?.close();
        this.transport = null;
        this.connected = false;
    }

    onOp(handler: OpHandler): () => void {
        this.opHandlers.add(handler);
        return () => this.opHandlers.delete(handler);
    }

    onDatagram(handler: DatagramHandler): () => void {
        this.datagramHandlers.add(handler);
        return () => this.datagramHandlers.delete(handler);
    }

    onChat(handler: ChatHandler): () => void {
        this.chatHandlers.add(handler);
        return () => this.chatHandlers.delete(handler);
    }

    onPresence(handler: PresenceHandler): () => void {
        this.presenceHandlers.add(handler);
        return () => this.presenceHandlers.delete(handler);
    }

    /**
     * Posts a chat message. Nothing is echoed locally on purpose — the server
     * stamps the id, timestamp and author, then pushes the result back to
     * everyone including us, so every client shows the same thing.
     */
    async sendChat(participantId: string, content: string, coordinate: ChatCoordinate | null): Promise<void> {
        if (!this.transport) throw new Error("BoardTransport: not connected");
        const request = { kind: "chat", participantId, content, coordinate };
        const stream = await this.transport.createUnidirectionalStream();
        const writer = stream.getWriter();
        await writer.write(new TextEncoder().encode(JSON.stringify(request)));
        await writer.close();
    }

    /** `type` is omitted for the one field that isn't tied to an element type: "deleted". */
    async sendOp(elementId: string, field: string, value: unknown, type?: ElementType): Promise<void> {
        if (!this.transport) throw new Error("BoardTransport: not connected");
        const op =
            field === "deleted"
                ? { elementId, field, value, time: [Date.now(), this.clientId] }
                : { elementId, type, field, value, time: [Date.now(), this.clientId] };
        const stream = await this.transport.createUnidirectionalStream();
        const writer = stream.getWriter();
        await writer.write(new TextEncoder().encode(JSON.stringify(op)));
        await writer.close();
    }

    async sendDatagram(payload: unknown): Promise<void> {
        if (!this.transport) throw new Error("BoardTransport: not connected");
        const writer = this.transport.datagrams.writable.getWriter();
        try {
            await writer.write(new TextEncoder().encode(JSON.stringify(payload)));
        } finally {
            writer.releaseLock();
        }
    }

    /**
     * One round trip over a fresh bidirectional stream. Doubles as both
     * "give me this room's current state" AND "put this session in that
     * room" — the server does both from the same request (see
     * `handleReadStream` in server.ts) since there's no reliable way to pass
     * a dynamic roomId through the WebTransport connection URL itself.
     * Safe to call again later for the same room (e.g. a manual resync) —
     * joining a room you're already in is a no-op server-side.
     *
     * `clientId` and `participantId` also list us in the room's presence, so
     * everyone else sees our cursor under our name; the server looks the
     * name up itself rather than taking one from us.
     */
    async loadState(roomId: string, participantId: string | null): Promise<BoardState> {
        if (!this.transport) throw new Error("BoardTransport: not connected");
        const stream = await this.transport.createBidirectionalStream();
        const writer = stream.writable.getWriter();
        const request = { cmd: "GET_STATE", roomId, clientId: this.clientId, participantId };
        await writer.write(new TextEncoder().encode(JSON.stringify(request)));
        const bytes = await readAll(stream.readable as ReadableStream<Uint8Array>);
        await writer.close();

        const reply = JSON.parse(new TextDecoder().decode(bytes)) as {
            board?: Record<string, string>;
            chat?: unknown[];
            participants?: unknown[];
        };

        const board: Record<string, RawStateEntry> = {};
        for (const [hashField, fieldDataRaw] of Object.entries(reply.board ?? {})) {
            const parsed = parseStoredField(fieldDataRaw);
            if (parsed) board[hashField] = parsed;
        }

        const chat: ChatMessage[] = [];
        for (const entry of reply.chat ?? []) {
            const message = parseChatMessage(entry);
            if (message) chat.push(message);
        }

        const participants: Presence[] = [];
        for (const entry of reply.participants ?? []) {
            const presence = parsePresence(entry);
            if (presence) participants.push(presence);
        }

        return { board, chat, participants };
    }

    private listenForPushedOps(): void {
        if (!this.transport) return;
        const transport = this.transport;
        (async () => {
            const reader = transport.incomingUnidirectionalStreams.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const bytes = await readAll(value as ReadableStream<Uint8Array>);
                let raw: unknown;
                try {
                    raw = JSON.parse(new TextDecoder().decode(bytes));
                } catch {
                    continue;
                }
                // The same push channel carries board ops, chat and presence.
                const message = parseChatMessage(raw);
                if (message) {
                    this.chatHandlers.forEach((h) => h(message));
                    continue;
                }
                const presence = parsePresenceMessage(raw);
                if (presence) {
                    this.presenceHandlers.forEach((h) => h(presence));
                    continue;
                }
                const op = parseOp(raw);
                if (op) this.opHandlers.forEach((h) => h(op));
            }
        })().catch((err) => console.error("BoardTransport: push-stream loop error", err));
    }

    private listenForDatagrams(): void {
        if (!this.transport) return;
        const transport = this.transport;
        (async () => {
            const reader = transport.datagrams.readable.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                try {
                    const payload: unknown = JSON.parse(new TextDecoder().decode(value));
                    // The server groups each tick's updates into one array and sends the
                    // same packets to everyone, us included, so our own entries are
                    // skipped here and nothing downstream ever sees its own cursor.
                    const messages = Array.isArray(payload) ? payload : [payload];
                    for (const message of messages) {
                        if ((message as { clientId?: unknown } | null)?.clientId === this.clientId) continue;
                        this.datagramHandlers.forEach((h) => h(message));
                    }
                } catch {
                    // rác/mất gói — bỏ qua, datagram vốn không đảm bảo tin cậy
                }
            }
        })().catch((err) => console.error("BoardTransport: datagram loop error", err));
    }
}
