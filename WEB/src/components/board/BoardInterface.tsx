// not in use

"use client";

import check from "check-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";

type Shape = {
  id: string;
  x: number;
  y: number;
  size: number;
  fill: string;
};

type BoardOperation = {
  elementId: string;
  field: string;
  value: unknown;
  time: [number, string];
};

const encoder = new TextEncoder();

function createClientId() {
  return crypto.randomUUID();
}

function createOperation(
  clientId: string,
  elementId: string,
  field: string,
  value: unknown,
): BoardOperation {
  return {
    elementId,
    field,
    value,
    time: [Date.now(), clientId],
  };
}

export default function BoardInterface() {
  const clientIdRef = useRef<string>("");
  const transportRef = useRef<WebTransport | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Connecting");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    clientIdRef.current = createClientId();

    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (!("WebTransport" in window)) {
        setConnectionStatus("WebTransport is not supported by this browser");
        return;
      }

      try {
        const transport = (() => {
          if (process.env.NODE_ENV === "development" && check.string(process.env.NEXT_PUBLIC_CERT_HASH)) {
            return new WebTransport(`${process.env.NEXT_PUBLIC_HTTP3_URL}/wt`, {
              serverCertificateHashes: [
                {
                  algorithm: "sha-256",
                  value: Uint8Array.from(atob(process.env.NEXT_PUBLIC_CERT_HASH), (c) => c.charCodeAt(0)),
                },
              ],
            });
          }
          else {
            return new WebTransport(`${process.env.NEXT_PUBLIC_HTTP3_URL}/wt`);
          }

        })();
        transportRef.current = transport;

        await transport.ready;

        if (!cancelled) {
          setConnectionStatus("Connected");
        }

        await transport.closed;

        if (!cancelled) {
          setConnectionStatus("Disconnected");
        }
      } catch (error) {
        console.error("WebTransport connection failed:", error);

        if (!cancelled) {
          setConnectionStatus("Connection failed");
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      void transportRef.current?.close();
      transportRef.current = null;
    };
  }, []);

  const sendOperation = useCallback(
    async (operation: BoardOperation) => {
      const transport = transportRef.current;

      if (!transport) {
        console.warn("WebTransport is not connected; operation was not sent.", operation);
        return;
      }

      try {
        const stream = await transport.createUnidirectionalStream();
        const writer = stream.getWriter();

        await writer.write(encoder.encode(JSON.stringify(operation)));
        await writer.close();
      } catch (error) {
        console.error("Unable to send board operation:", error);
      }
    },
    [],
  );

  const sendCursor = useCallback(async (x: number, y: number) => {
    const transport = transportRef.current;

    if (!transport) {
      return;
    }

    try {
      const writer = transport.datagrams.writable.getWriter();

      await writer.write(
        encoder.encode(
          JSON.stringify({
            type: "cursor",
            clientId: clientIdRef.current,
            x,
            y,
          }),
        ),
      );

      writer.releaseLock();
    } catch (error) {
      console.error("Unable to send cursor datagram:", error);
    }
  }, []);

  const createSquare = useCallback(() => {
    const id = crypto.randomUUID();
    const square: Shape = {
      id,
      x: Math.max(24, viewport.width / 2 - 50),
      y: Math.max(24, viewport.height / 2 - 50),
      size: 100,
      fill: "#2563eb",
    };

    setShapes((currentShapes) => [...currentShapes, square]);
    setSelectedShapeId(id);

    void sendOperation(
      createOperation(clientIdRef.current, id, "deleted", false),
    );
    void sendOperation(createOperation(clientIdRef.current, id, "x", square.x));
    void sendOperation(createOperation(clientIdRef.current, id, "y", square.y));
    void sendOperation(
      createOperation(clientIdRef.current, id, "size", square.size),
    );
    void sendOperation(
      createOperation(clientIdRef.current, id, "fill", square.fill),
    );
  }, [sendOperation, viewport.height, viewport.width]);

  const deleteSelectedShape = useCallback(() => {
    if (!selectedShapeId) {
      return;
    }

    const deletedShapeId = selectedShapeId;

    setShapes((currentShapes) =>
      currentShapes.filter((shape) => shape.id !== deletedShapeId),
    );
    setSelectedShapeId(null);

    void sendOperation(
      createOperation(clientIdRef.current, deletedShapeId, "deleted", true),
    );
  }, [selectedShapeId, sendOperation]);

  const selectedShape = shapes.find((shape) => shape.id === selectedShapeId);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-100">
      <Stage
        width={viewport.width}
        height={viewport.height}
        onMouseMove={(event) => {
          const position = event.target.getStage()?.getPointerPosition();

          if (position) {
            void sendCursor(position.x, position.y);
          }
        }}
        onTouchMove={(event) => {
          const position = event.target.getStage()?.getPointerPosition();

          if (position) {
            void sendCursor(position.x, position.y);
          }
        }}
        onClick={(event) => {
          if (event.target === event.target.getStage()) {
            setSelectedShapeId(null);
          }
        }}
        onTap={(event) => {
          if (event.target === event.target.getStage()) {
            setSelectedShapeId(null);
          }
        }}
      >
        <Layer>
          {shapes.map((shape) => (
            <Rect
              key={shape.id}
              x={shape.x}
              y={shape.y}
              width={shape.size}
              height={shape.size}
              fill={shape.fill}
              cornerRadius={8}
              draggable
              shadowColor="black"
              shadowBlur={selectedShapeId === shape.id ? 10 : 0}
              shadowOpacity={selectedShapeId === shape.id ? 0.2 : 0}
              onClick={() => setSelectedShapeId(shape.id)}
              onTap={() => setSelectedShapeId(shape.id)}
              onDragStart={() => setSelectedShapeId(shape.id)}
              onDragEnd={(event) => {
                const x = event.target.x();
                const y = event.target.y();

                setShapes((currentShapes) =>
                  currentShapes.map((currentShape) =>
                    currentShape.id === shape.id
                      ? { ...currentShape, x, y }
                      : currentShape,
                  ),
                );

                void sendOperation(
                  createOperation(clientIdRef.current, shape.id, "x", x),
                );
                void sendOperation(
                  createOperation(clientIdRef.current, shape.id, "y", y),
                );
              }}
            />
          ))}
        </Layer>
      </Stage>

      <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-3">
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
          onClick={createSquare}
        >
          Add square
        </button>

        <span className="rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow">
          {connectionStatus}
        </span>
      </div>

      {selectedShape && (
        <button
          type="button"
          className="absolute rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-red-700"
          style={{
            left: Math.min(selectedShape.x + selectedShape.size + 12, viewport.width - 110),
            top: Math.max(selectedShape.y - 4, 12),
          }}
          onClick={deleteSelectedShape}
        >
          Delete
        </button>
      )}
    </main>
  );
}
