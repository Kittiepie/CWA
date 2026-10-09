"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ElementType } from "@/types/board";

export type BoardTool = "select" | "pan" | ElementType;

interface BoardToolContextValue {
  tool: BoardTool;
  setTool: (tool: BoardTool) => void;
  color: string;
  setColor: (color: string) => void;
  fontSize: number;
  setFontSize: (fontSize: number) => void;
  /** Everything currently selected: one element from a click, several from a drag-select. */
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}

const BoardToolContext = createContext<BoardToolContextValue | null>(null);

export function BoardToolProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<BoardTool>("select");
  const [color, setColor] = useState("#1f2937");
  const [fontSize, setFontSize] = useState(18);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <BoardToolContext.Provider
      value={{
        tool,
        setTool,
        color,
        setColor,
        fontSize,
        setFontSize,
        selectedIds,
        setSelectedIds,
      }}
    >
      {children}
    </BoardToolContext.Provider>
  );
}

export function useBoardTool(): BoardToolContextValue {
  const ctx = useContext(BoardToolContext);
  if (!ctx)
    throw new Error("useBoardTool must be used within a BoardToolProvider");
  return ctx;
}
