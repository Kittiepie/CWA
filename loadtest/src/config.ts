import { createHash, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export type Scenario = "grid" | "contention";

export interface Config {
  users: number;
  active: number;
  scenario: Scenario;
  duration: number;
  ramp: number;
  actionInterval: number;
  cursorHz: number;
  chatInterval: number;
  sharedShapes: number;
  room: string | null;
  startDelay: number;
  workers: number;
  api: string;
  wt: string;
  web: string;
  /** Base64 SHA-256 of the server certificate, pinned exactly as the browser pins it. */
  certHash: string;
  json: string | null;
}

const DEFAULT_CERT_PATH = fileURLToPath(
  new URL("../../HTTP3/cert.pem", import.meta.url),
);

function defaultWorkers(): number {
  // Leave cores for the servers when everything runs on one machine.
  return Math.max(1, Math.min(4, availableParallelism() - 2));
}

export const HELP = `
CWA load test: simulates many users drawing in one room.

Usage: npm start -- [options]

  --users <n>             Simulated users (default 100)
  --active <0-1>          Share of users drawing; the rest only move their cursor
                          (default 0.3; 1 = everyone draws, the worst case)
  --scenario <name>       grid        each user draws inside its own cell (default)
                          contention  users keep moving/resizing the same shared shapes,
                                      then every client is checked against the server
  --duration <s>          Length of the drawing phase (default 60)
  --ramp <s>              Spread the connections over this many seconds (default 20)
  --action-interval <s>   Seconds between one user's strokes or edits (default 4)
  --cursor-hz <n>         Cursor/draft datagrams per user per second (default 10, as the browser)
  --chat-interval <s>     Seconds between chat messages per drawing user, 0 = off (default 45)
  --shared-shapes <n>     Shapes fought over in the contention scenario (default 10)
  --room <id>             Use an existing room instead of creating one
  --start-delay <s>       Pause after printing the room link so it can be opened (default 15)
  --workers <n>           Load-generator processes (default ${defaultWorkers()})
  --api <url>             API base URL (default http://localhost:8081)
  --wt <url>              WebTransport URL (default https://127.0.0.1:5000/wt)
  --web <url>             Web app URL, used for the viewer link (default http://localhost:8080)
  --cert <path>           Server certificate to pin (default ../HTTP3/cert.pem)
  --cert-hash <base64>    Or the pinned SHA-256 hash itself
  --json <path>           Also write the full report as JSON
  --help                  Show this help
`;

function number(
  raw: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max = Number.POSITIVE_INFINITY,
): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`--${name} must be a number from ${min} to ${max}`);
  }
  return value;
}

function integer(
  raw: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max?: number,
): number {
  const value = number(raw, fallback, name, min, max);
  if (!Number.isInteger(value))
    throw new Error(`--${name} must be a whole number`);
  return value;
}

function certHashFrom(path: string): string {
  const certificate = new X509Certificate(readFileSync(path));
  return createHash("sha256").update(certificate.raw).digest("base64");
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Parses the command line; returns null when --help was asked for. */
export function loadConfig(argv: string[]): Config | null {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      users: { type: "string" },
      active: { type: "string" },
      scenario: { type: "string" },
      duration: { type: "string" },
      ramp: { type: "string" },
      "action-interval": { type: "string" },
      "cursor-hz": { type: "string" },
      "chat-interval": { type: "string" },
      "shared-shapes": { type: "string" },
      room: { type: "string" },
      "start-delay": { type: "string" },
      workers: { type: "string" },
      api: { type: "string" },
      wt: { type: "string" },
      web: { type: "string" },
      cert: { type: "string" },
      "cert-hash": { type: "string" },
      json: { type: "string" },
      help: { type: "boolean" },
    },
  });

  if (values.help) return null;

  const scenario = values.scenario ?? "grid";
  if (scenario !== "grid" && scenario !== "contention") {
    throw new Error('--scenario must be "grid" or "contention"');
  }

  return {
    users: integer(values.users, 100, "users", 2, 1000),
    active: number(values.active, 0.3, "active", 0.01, 1),
    scenario,
    duration: number(values.duration, 60, "duration", 5),
    ramp: number(values.ramp, 20, "ramp", 0),
    actionInterval: number(
      values["action-interval"],
      4,
      "action-interval",
      0.2,
    ),
    cursorHz: number(values["cursor-hz"], 10, "cursor-hz", 1, 60),
    chatInterval: number(values["chat-interval"], 45, "chat-interval", 0),
    sharedShapes: integer(values["shared-shapes"], 10, "shared-shapes", 1, 100),
    room: values.room ?? null,
    startDelay: number(values["start-delay"], 15, "start-delay", 0),
    workers: integer(values.workers, defaultWorkers(), "workers", 1, 64),
    api: trimSlash(values.api ?? "http://localhost:8081"),
    wt: values.wt ?? "https://127.0.0.1:5000/wt",
    web: trimSlash(values.web ?? "http://localhost:8080"),
    certHash:
      values["cert-hash"] ?? certHashFrom(values.cert ?? DEFAULT_CERT_PATH),
    json: values.json ?? null,
  };
}
