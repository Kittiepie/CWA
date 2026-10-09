"use client";

import { useEffect, useState } from "react";
import { useCamera, type CameraStore } from "@/lib/board/camera";
import { themeSwatch } from "@/lib/board/theme";
import type { DatagramHandler } from "@/lib/board/webtransportClient";
import type { Point, Presence } from "@/types/board";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Where a pointer datagram puts that person's cursor: its position for a
 * plain cursor, or the newest point (the pen tip) while they're drawing.
 */
function pointerFrom(
  payload: unknown,
): { clientId: string; point: Point } | null {
  if (!isRecord(payload) || typeof payload.clientId !== "string") return null;
  const { clientId } = payload;

  if (
    payload.type === "cursor" &&
    typeof payload.x === "number" &&
    typeof payload.y === "number"
  ) {
    return { clientId, point: { x: payload.x, y: payload.y } };
  }

  if (payload.type === "draft" && Array.isArray(payload.points)) {
    const tip: unknown = payload.points[payload.points.length - 1];
    if (
      isRecord(tip) &&
      typeof tip.x === "number" &&
      typeof tip.y === "number"
    ) {
      return { clientId, point: { x: tip.x, y: tip.y } };
    }
  }
  return null;
}

interface RemoteCursorsProps {
  onDatagram: (handler: DatagramHandler) => () => void;
  /** Who is in the room, by clientId: supplies each cursor's name and colour. */
  participants: Record<string, Presence>;
  cameraStore: CameraStore;
}

/**
 * Everyone else's pointer, with a name tag in their theme colour. Drawn as
 * HTML over the canvas rather than inside Konva so the tags stay the same
 * size at any zoom. Your own never appears: the server doesn't echo a
 * client's datagrams back to it.
 */
export function RemoteCursors({
  onDatagram,
  participants,
  cameraStore,
}: RemoteCursorsProps) {
  const camera = useCamera(cameraStore);
  const [cursors, setCursors] = useState<Record<string, Point>>({});

  useEffect(() => {
    let frame = 0;
    let pending: Record<string, Point> = {};
    const flush = () => {
      frame = 0;
      const batch = pending;
      pending = {};
      setCursors((current) => ({ ...current, ...batch }));
    };

    const unsubscribe = onDatagram((payload) => {
      const update = pointerFrom(payload);
      if (!update) return;
      pending[update.clientId] = update.point;
      // One render per animation frame however many arrive: a full room sends
      // around a thousand pointer datagrams a second.
      if (!frame) frame = requestAnimationFrame(flush);
    });

    return () => {
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [onDatagram]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden
    >
      {/* The pan offset moves the whole layer at once and only each cursor's
          own position animates, so tags glide between the ~10 updates a second
          they arrive at without trailing behind the canvas when you pan. */}
      <div style={{ transform: `translate(${camera.x}px, ${camera.y}px)` }}>
        {Object.entries(cursors).map(([clientId, point]) => {
          const person = participants[clientId];
          if (!person) return null; // left the room, or not announced yet
          const swatch = themeSwatch(person.themeColor);

          return (
            <div
              key={clientId}
              className="absolute left-0 top-0 transition-transform duration-100 ease-linear"
              style={{
                transform: `translate(${point.x * camera.scale}px, ${point.y * camera.scale}px)`,
              }}
            >
              <svg
                width="14"
                height="19"
                viewBox="0 0 14 19"
                className="drop-shadow-md"
              >
                <path
                  d="M1 1v15.5l4.2-4 2.9 6.3 2.6-1.1-2.9-6.2H13.5z"
                  fill={swatch.background}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="absolute left-3 top-4 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold shadow-md"
                style={{
                  backgroundColor: swatch.background,
                  color: swatch.text,
                }}
              >
                {person.displayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
