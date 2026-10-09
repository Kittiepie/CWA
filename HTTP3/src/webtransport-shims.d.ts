// `@fails-components/webtransport` doesn't ship published TypeScript types
// for the slice of its API server.ts uses. This ambient module fills in
// just that slice so server.ts can be fully typed instead of falling back
// to `any`.
//
// If your installed version already ships its own `.d.ts` (check
// node_modules/@fails-components/webtransport for a "types"/"typings"
// field in its package.json), delete this file and rely on those instead —
// don't keep both around, a duplicate ambient declaration for the same
// module will conflict with the real one.

declare module "@fails-components/webtransport" {
  export interface Http3ServerOptions {
    port: number;
    host: string;
    secret: string;
    cert: Buffer;
    privKey: Buffer;
  }

  export interface WebTransportDuplexStream {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  }

  export interface WebTransportSession {
    readonly ready: Promise<void>;
    readonly closed: Promise<void>;
    readonly datagrams: WebTransportDuplexStream;
    readonly incomingUnidirectionalStreams: ReadableStream<ReadableStream<Uint8Array>>;
    readonly incomingBidirectionalStreams: ReadableStream<WebTransportDuplexStream>;
    createUnidirectionalStream(): Promise<WritableStream<Uint8Array>>;
  }

  export class Http3Server {
    constructor(options: Http3ServerOptions);
    sessionStream(path: string): ReadableStream<WebTransportSession>;
    startServer(): void;
    readonly port?: number;
  }
}
