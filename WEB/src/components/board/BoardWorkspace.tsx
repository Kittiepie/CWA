"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type Konva from "konva";
import { toast } from "react-toastify";
import { HEADER_SLOT_ID } from "@/components/layout/header/headerSlot";
import { BoardToolProvider } from "@/context/BoardToolContext";
import { useBoardTransport } from "@/hooks/useBoardTransport";
import { useFollow } from "@/hooks/useFollow";
import { useAppSelector } from "@/services/client/hooks";
import { useUploadBoardImageMutation } from "@/services/client/slice/room.slice";
import { CameraStore, type BoardCamera } from "@/lib/board/camera";
import {
  downloadPng,
  exportFileName,
  renderBoardImage,
} from "@/lib/board/exportImage";
import { themeSwatch } from "@/lib/board/theme";
import type { Point } from "@/types/board";
import { BoardCanvas } from "./BoardCanvas";
import { BoardToolbar, ConnectionStatus, ExportButton } from "./BoardToolbar";
import { ChatPanel } from "./ChatPanel";
import { FollowMenu } from "./FollowMenu";
import { RemoteCursors } from "./RemoteCursors";

export interface BoardWorkspaceProps {
  roomId: string;
  wsUrl: string;
  certHashBase64: string | null;
}

function BoardWorkspaceInner({
  roomId,
  wsUrl,
  certHashBase64,
}: BoardWorkspaceProps) {
  const participantId = useAppSelector(
    (state) => state.auth.authState?.participantId ?? null,
  );

  // BoardCanvas owns the Konva stage; the chat panel and following read and
  // move the view through this handle rather than reaching for the stage.
  const cameraRef = useRef<BoardCamera | null>(null);
  // The group BoardCanvas draws every element into, for exporting the drawing.
  const boardRef = useRef<Konva.Group>(null);
  // Fed by BoardCanvas, read by the overlays (cursors, text editor), so a
  // camera move re-renders only those rather than the whole canvas.
  const [cameraStore] = useState(() => new CameraStore());
  const [chatOpen, setChatOpen] = useState(false);

  // The toolbar and people menu live in the page header rather than floating
  // over the canvas, portalled into the slot the header leaves for them.
  // Outside that layout there's no slot, and they float over the board instead.
  const [headerSlot] = useState(() =>
    typeof document === "undefined"
      ? null
      : document.getElementById(HEADER_SLOT_ID),
  );

  const {
    elements,
    setElements,
    sendOp,
    sendDatagram,
    onDatagram,
    onOp,
    chatMessages,
    sendChat,
    participants,
    connectionState,
    clientId,
  } = useBoardTransport({
    url: wsUrl,
    certHashBase64,
    roomId,
    participantId,
  });

  const { followingId, follow, unfollow } = useFollow({
    cameraRef,
    cameraStore,
    clientId,
    participants,
    sendDatagram,
    onDatagram,
  });

  const getViewportCenter = useCallback(
    () => cameraRef.current?.getViewportCenter() ?? null,
    [],
  );

  const focusCoordinate = useCallback(
    (point: Point) => {
      // Jumping somewhere yourself means you're no longer following anyone.
      unfollow();
      cameraRef.current?.focusOn(point);
    },
    [unfollow],
  );

  const [uploadBoardImage] = useUploadBoardImageMutation();
  const uploadImage = useCallback(
    async (file: File) => {
      const response = await uploadBoardImage({ roomId, file }).unwrap();
      if (!response.success) throw new Error(response.message);
      return response.data.id;
    },
    [roomId, uploadBoardImage],
  );

  const hasDrawing = Object.values(elements).some((el) => !el.deleted);
  const exportImage = useCallback(async () => {
    const board = boardRef.current;
    const image = board ? renderBoardImage(board) : null;
    if (!image || !(await downloadPng(image, exportFileName()))) {
      toast.error("Couldn't export the board as an image.");
    }
  }, []);

  const followed = followingId ? participants[followingId] : undefined;
  const followedSwatch = followed ? themeSwatch(followed.themeColor) : null;

  const headerControls = (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
      <BoardToolbar />
      <div className="ml-auto flex items-center gap-3">
        <ConnectionStatus state={connectionState} />
        <ExportButton
          disabled={!hasDrawing}
          onExport={() => void exportImage()}
        />
        <FollowMenu
          participants={participants}
          selfClientId={clientId}
          followingId={followingId}
          onFollow={follow}
          onUnfollow={unfollow}
        />
      </div>
    </div>
  );

  return (
    // overflow-clip rather than overflow-hidden: both clip the collapsed chat
    // panel, but `hidden` still makes this a scrollable box, so focusing or
    // revealing anything parked off-screen shunts the whole board sideways.
    <div className="relative h-full w-full overflow-clip bg-white">
      <BoardCanvas
        elements={elements}
        setElements={setElements}
        sendOp={sendOp}
        sendDatagram={sendDatagram}
        onDatagram={onDatagram}
        onOp={onOp}
        clientId={clientId}
        cameraRef={cameraRef}
        cameraStore={cameraStore}
        onCameraGesture={unfollow}
        boardRef={boardRef}
        uploadImage={uploadImage}
      />
      <RemoteCursors
        onDatagram={onDatagram}
        participants={participants}
        cameraStore={cameraStore}
      />
      {/* Divides the canvas from the header above: a firm line with a soft
          shadow falling onto the board. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-3 border-t border-slate-400"
        style={{
          background:
            "linear-gradient(to bottom, rgb(15 23 42 / 0.18), transparent)",
        }}
      />

      {headerSlot ? (
        createPortal(headerControls, headerSlot)
      ) : (
        <div className="absolute inset-x-4 top-4 z-30">{headerControls}</div>
      )}

      {followed && followedSwatch && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-20 border-4"
            style={{ borderColor: followedSwatch.background }}
            aria-hidden
          />
          <div
            className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full py-1 pl-3 pr-1 text-sm font-medium shadow-lg"
            style={{
              backgroundColor: followedSwatch.background,
              color: followedSwatch.text,
            }}
          >
            Following {followed.displayName}
            <button
              type="button"
              onClick={unfollow}
              className="rounded-full bg-black/15 px-2 py-0.5 text-xs hover:bg-black/25"
            >
              Stop
            </button>
          </div>
        </>
      )}

      <ChatPanel
        open={chatOpen}
        messages={chatMessages}
        canSend={connectionState === "connected" && participantId !== null}
        onSend={sendChat}
        onFocusCoordinate={focusCoordinate}
        getViewportCenter={getViewportCenter}
      />

      <button
        type="button"
        onClick={() => setChatOpen((open) => !open)}
        aria-label={chatOpen ? "Collapse chat" : "Open chat"}
        aria-expanded={chatOpen}
        // Sits clear of the panel when it's open rather than on top of it.
        className={`absolute bottom-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg transition-all duration-200 hover:bg-indigo-400 ${
          chatOpen ? "right-[22rem]" : "right-6"
        }`}
      >
        {chatOpen ? (
          <span aria-hidden className="text-lg leading-none">
            ›
          </span>
        ) : (
          <span aria-hidden className="text-lg leading-none">
            💬
          </span>
        )}
        {!chatOpen && chatMessages.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white ring-2 ring-indigo-500">
            {chatMessages.length > 99 ? "99+" : chatMessages.length}
          </span>
        )}
      </button>
    </div>
  );
}

/** Public entry point — wrap the actual hook/canvas so BoardToolProvider covers both toolbar and canvas. */
export function BoardWorkspace(props: BoardWorkspaceProps) {
  return (
    <BoardToolProvider>
      <BoardWorkspaceInner {...props} />
    </BoardToolProvider>
  );
}
