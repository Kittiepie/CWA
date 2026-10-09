"use client";

import dynamic from "next/dynamic";
import type { BoardWorkspaceProps } from "./BoardWorkspace";

// solely serve for `ssr: false` as it cannot be used in page.tsx
const BoardWorkspace = dynamic<BoardWorkspaceProps>(
  () => import("./BoardWorkspace").then((m) => m.BoardWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-dvw items-center justify-center bg-slate-950 text-sm text-slate-400">
        Loading board…
      </div>
    ),
  },
);

export function BoardWorkspaceLoader(props: BoardWorkspaceProps) {
  return <BoardWorkspace {...props} />;
}
