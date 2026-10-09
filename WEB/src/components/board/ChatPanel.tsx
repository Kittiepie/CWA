"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Point } from "@/types/board";

/**
 * Theme colours mirror AllParticipantThemeColors on the API, which is what
 * the server stamps onto each message from the room's participant hash.
 */
const THEME_TEXT: Record<string, string> = {
  blue: "text-blue-400",
  green: "text-emerald-400",
  orange: "text-orange-400",
  purple: "text-purple-400",
  red: "text-red-400",
  yellow: "text-yellow-400",
};

const THEME_BG: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
};

function themeClass(map: Record<string, string>, color: string): string {
  return map[color] ?? map.blue;
}

function formatTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ChatPanelProps {
  open: boolean;
  messages: ChatMessage[];
  /** Null until the guest session resolves; sending is disabled until then. */
  canSend: boolean;
  onSend: (content: string, coordinate: Point | null) => void;
  onFocusCoordinate: (point: Point) => void;
  getViewportCenter: () => Point | null;
}

export function ChatPanel({
  open,
  messages,
  canSend,
  onSend,
  onFocusCoordinate,
  getViewportCenter,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<Point | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Follow the conversation as it grows, and when the panel is reopened.
  // Scrolls the list directly rather than via scrollIntoView: that walks every
  // scrollable ancestor — overflow-hidden ones included — and while the panel
  // is still animating in from off-screen it drags the whole board sideways.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, open]);

  function send() {
    const content = draft.trim();
    if (!content && !attached) return;
    onSend(content || "Shared a location", attached);
    setDraft("");
    setAttached(null);
  }

  return (
    <aside
      className={`absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-slate-700/60 bg-slate-900/95 text-slate-100 shadow-xl backdrop-blur transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!open}
      // Stays mounted so it can slide and keep its scroll position, so it also
      // has to stop being tabbable while it's off-screen.
      inert={!open}
    >
      <header className="border-b border-slate-700/60 px-4 py-3 text-sm font-semibold">
        Room chat
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="px-1 text-xs text-slate-500">
            No messages yet. Say something, or share where you&apos;re looking.
          </p>
        )}

        {messages.map((message) => (
          <article key={message.id} className="flex gap-2">
            {/* Avatar placeholder — the per-animal icon goes in here later. */}
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${themeClass(
                THEME_BG,
                message.themeColor,
              )}`}
              aria-hidden
            >
              {message.displayName.charAt(0)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span
                  className={`truncate text-xs font-semibold ${themeClass(
                    THEME_TEXT,
                    message.themeColor,
                  )}`}
                >
                  {message.displayName}
                </span>
                <time className="shrink-0 text-[10px] text-slate-500">
                  {formatTime(message.createdAt)}
                </time>
              </div>

              <div className="mt-1 whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-slate-800 px-3 py-2 text-sm">
                {message.content}
              </div>

              {message.coordinate && (
                <button
                  type="button"
                  onClick={() => onFocusCoordinate(message.coordinate as Point)}
                  className="mt-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                >
                  Jump to location{" "}
                  <span className="font-mono text-blue-400">
                    [{Math.round(message.coordinate.x)},{" "}
                    {Math.round(message.coordinate.y)}]
                  </span>
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-slate-700/60 p-3">
        {attached && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300">
            <span>
              Location attached ({Math.round(attached.x)},{" "}
              {Math.round(attached.y)})
            </span>
            <button
              type="button"
              onClick={() => setAttached(null)}
              className="text-slate-400 hover:text-slate-200"
              aria-label="Remove attached location"
            >
              ✕
            </button>
          </div>
        )}

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter makes a new line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          disabled={!canSend}
          placeholder={canSend ? "Message the room…" : "Connecting…"}
          className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
        />

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={!canSend}
            onClick={() => setAttached(attached ? null : getViewportCenter())}
            className={`rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
              attached
                ? "bg-indigo-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
            title="Attach the centre of your current view"
          >
            Attach view
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={send}
            className="ml-auto rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
