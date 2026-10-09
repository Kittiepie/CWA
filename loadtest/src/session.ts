import { quicheLoaded, WebTransport } from "@fails-components/webtransport";

export { quicheLoaded };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encode(payload: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(payload));
}

function parse(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
}

async function readAll(
  readable: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.byteLength;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export interface RoomState {
  board: Record<string, string>;
  chat: unknown[];
}

/**
 * One WebTransport session speaking the browser's protocol, as implemented in
 * WEB/src/lib/board/webtransportClient.ts: ops and chat each on a fresh
 * unidirectional stream, GET_STATE on a bidirectional stream, and cursors and
 * drafts as datagrams. Keeping the traffic identical is what makes the load
 * real rather than a guess at it.
 */
export class Session {
  private constructor(
    private readonly transport: WebTransport,
    private readonly datagramWriter: WritableStreamDefaultWriter<Uint8Array>,
  ) {}

  static async open(url: string, certHash: Uint8Array): Promise<Session> {
    const transport = new WebTransport(url, {
      serverCertificateHashes: [{ algorithm: "sha-256", value: certHash }],
    });
    // A dropped session rejects `closed`; its streams surface the failure.
    transport.closed.catch(() => {});
    await transport.ready;
    return new Session(
      transport,
      transport.datagrams.createWritable().getWriter(),
    );
  }

  /** Largest datagram the connection will carry; anything bigger is dropped. */
  get maxDatagramSize(): number {
    return this.transport.datagrams.maxDatagramSize ?? 0;
  }

  /**
   * GET_STATE: puts this session in the room and returns its board and chat.
   * With an identity it's also listed in the room's presence, so the bot's
   * cursor shows up under its name exactly as a person's does.
   */
  async getState(
    roomId: string,
    identity?: { clientId: string; participantId: string },
  ): Promise<RoomState> {
    const stream = await this.transport.createBidirectionalStream();
    const writer = stream.writable.getWriter();
    await writer.write(encode({ cmd: "GET_STATE", roomId, ...identity }));
    const bytes = await readAll(stream.readable);
    await writer.close();

    const reply = parse(bytes) as Partial<RoomState> | null;
    return { board: reply?.board ?? {}, chat: reply?.chat ?? [] };
  }

  async sendReliable(payload: unknown): Promise<void> {
    const stream = await this.transport.createUnidirectionalStream();
    const writer = stream.getWriter();
    await writer.write(encode(payload));
    await writer.close();
  }

  /** Fire-and-forget, as the browser does. */
  sendDatagram(bytes: Uint8Array, onError: () => void): void {
    this.datagramWriter.write(bytes).catch(onError);
  }

  /**
   * Pushed ops and chat. Streams are drained one after another, exactly as the
   * browser's loop does, so arrival order and head-of-line delays match what a
   * real client experiences.
   */
  listenReliable(handler: (message: unknown) => void): void {
    void (async () => {
      const reader = this.transport.incomingUnidirectionalStreams.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        handler(parse(await readAll(value)));
      }
    })().catch(() => {});
  }

  listenDatagrams(handler: (message: unknown) => void): void {
    void (async () => {
      const reader = this.transport.datagrams.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        // The server groups each tick's updates into one JSON array.
        const payload = parse(value);
        for (const message of Array.isArray(payload) ? payload : [payload]) {
          handler(message);
        }
      }
    })().catch(() => {});
  }

  close(): void {
    try {
      this.transport.close();
    } catch {
      // Already closing or never fully open.
    }
  }
}
