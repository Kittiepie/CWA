"use client";

import { useRef, useState } from "react";
import { useDismiss } from "@/hooks/useDismiss";
import { initialOf, themeSwatch } from "@/lib/board/theme";
import type { Presence } from "@/types/board";

function Avatar({ person }: { person: Presence }) {
  const swatch = themeSwatch(person.themeColor);
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{ backgroundColor: swatch.background, color: swatch.text }}
      aria-hidden
    >
      {initialOf(person.displayName)}
    </span>
  );
}

interface FollowMenuProps {
  participants: Record<string, Presence>;
  selfClientId: string | null;
  followingId: string | null;
  onFollow: (clientId: string) => void;
  onUnfollow: () => void;
}

/** Your avatar, opening the list of everyone in the room; pick someone to follow their view. */
export function FollowMenu({
  participants,
  selfClientId,
  followingId,
  onFollow,
  onUnfollow,
}: FollowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, setOpen);

  const self = selfClientId ? participants[selfClientId] : undefined;
  if (!self) return null; // not in the room's presence yet

  const others = Object.values(participants)
    .filter((person) => person.clientId !== selfClientId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="People in this room"
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <Avatar person={self} />
        {others.length > 0 && (
          <span className="text-xs font-medium">+{others.length}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl"
        >
          <p className="px-2 pb-2 pt-1 text-center text-xs text-slate-500">
            Click on user to follow
          </p>
          <ul className="max-h-80 overflow-y-auto">
            <li className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <Avatar person={self} />
              <span className="flex-1 truncate text-sm">
                {self.displayName}
              </span>
              <span className="text-xs text-slate-500">(You)</span>
            </li>
            {others.map((person) => {
              const following = person.clientId === followingId;
              return (
                <li key={person.clientId}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (following) onUnfollow();
                      else onFollow(person.clientId);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 ${
                      following ? "bg-indigo-50" : ""
                    }`}
                  >
                    <Avatar person={person} />
                    <span className="flex-1 truncate text-sm">
                      {person.displayName}
                    </span>
                    {following && (
                      <span className="text-xs text-indigo-600">Following</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {others.length === 0 && (
            <p className="px-2 py-2 text-center text-xs text-slate-400">
              Nobody else is here yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
