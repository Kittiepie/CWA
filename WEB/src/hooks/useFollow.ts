"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { BoardCamera, CameraStore, View } from "@/lib/board/camera";
import type { DatagramHandler } from "@/lib/board/webtransportClient";
import type { Presence } from "@/types/board";

/** At most this often while the view is moving; the final position always goes out. */
const VIEWPORT_THROTTLE_MS = 100;
/**
 * Resent this often even when nothing moves: datagrams can be lost, and
 * someone who starts following an idle user still needs a view to jump to.
 */
const VIEWPORT_HEARTBEAT_MS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function viewFrom(payload: unknown): { clientId: string; view: View } | null {
  if (!isRecord(payload) || payload.type !== "viewport") return null;
  const { clientId, x, y, scale } = payload;
  if (typeof clientId !== "string") return null;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (typeof scale !== "number" || !(scale > 0)) return null;
  return { clientId, view: { x, y, scale } };
}

interface UseFollowOptions {
  cameraRef: RefObject<BoardCamera | null>;
  cameraStore: CameraStore;
  clientId: string | null;
  participants: Record<string, Presence>;
  sendDatagram: (payload: unknown) => void;
  onDatagram: (handler: DatagramHandler) => () => void;
}

/**
 * Excalidraw-style following. Every client broadcasts where it's looking
 * (centre and zoom) as a small datagram; while you follow someone, your
 * camera mirrors each view they send. Panning or zooming yourself ends it,
 * which is up to the caller to wire to `unfollow`.
 */
export function useFollow({
  cameraRef,
  cameraStore,
  clientId,
  participants,
  sendDatagram,
  onDatagram,
}: UseFollowOptions) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  // Following someone who has since left ends quietly.
  const followingId = chosenId && participants[chosenId] ? chosenId : null;

  const views = useRef(new Map<string, View>());
  const followingRef = useRef(followingId);
  useEffect(() => {
    followingRef.current = followingId;
  }, [followingId]);

  // Tell everyone where we're looking.
  useEffect(() => {
    if (!clientId) return;
    let lastSentAt = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;

    const send = () => {
      trailing = null;
      const view = cameraRef.current?.getView();
      if (!view) return;
      lastSentAt = Date.now();
      sendDatagram({ type: "viewport", clientId, ...view });
    };
    const onCameraChange = () => {
      if (trailing) return;
      const wait = VIEWPORT_THROTTLE_MS - (Date.now() - lastSentAt);
      if (wait <= 0) send();
      else trailing = setTimeout(send, wait);
    };

    const unsubscribe = cameraStore.subscribe(onCameraChange);
    const heartbeat = setInterval(send, VIEWPORT_HEARTBEAT_MS);
    return () => {
      unsubscribe();
      clearInterval(heartbeat);
      if (trailing) clearTimeout(trailing);
    };
  }, [cameraRef, cameraStore, clientId, sendDatagram]);

  // Remember everyone's latest view, and mirror the one we're following.
  useEffect(() => {
    return onDatagram((payload) => {
      const update = viewFrom(payload);
      if (!update) return;
      views.current.set(update.clientId, update.view);
      if (update.clientId === followingRef.current) {
        cameraRef.current?.setView(update.view);
      }
    });
  }, [onDatagram, cameraRef]);

  const follow = useCallback(
    (id: string) => {
      setChosenId(id);
      // Jump straight away if we've already heard where they are.
      const view = views.current.get(id);
      if (view) cameraRef.current?.setView(view);
    },
    [cameraRef],
  );

  const unfollow = useCallback(() => setChosenId(null), []);

  return { followingId, follow, unfollow };
}
