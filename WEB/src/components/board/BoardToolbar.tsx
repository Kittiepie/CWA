"use client";

import { useBoardTool, type BoardTool } from "@/context/BoardToolContext";
import type { ConnectionState } from "@/hooks/useBoardTransport";
import { ColorPicker } from "./ColorPicker";

const TOOLS: { tool: BoardTool; label: string }[] = [
  { tool: "select", label: "Select" },
  { tool: "pan", label: "Pan" },
  { tool: "rectangle", label: "Rectangle" },
  { tool: "diamond", label: "Diamond" },
  { tool: "ellipse", label: "Ellipse" },
  { tool: "line", label: "Line" },
  { tool: "freedraw", label: "Draw" },
  { tool: "text", label: "Text" },
  { tool: "image", label: "Image" },
];

/** The sizes Word offers. */
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  error: "Connection error",
};

const CONNECTION_DOT: Record<ConnectionState, string> = {
  connecting: "bg-amber-400",
  connected: "bg-emerald-500",
  error: "bg-red-500",
};

function toolButtonClasses(active: boolean) {
  return [
    "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
    active ? "bg-indigo-500 text-white" : "text-slate-700 hover:bg-slate-100",
  ].join(" ");
}

/**
 * Tool picker, then colour and text size. The groups sit on one line and
 * wrap onto a second only when the header gets too narrow for them.
 */
export function BoardToolbar() {
  const { tool, setTool, color, setColor, fontSize, setFontSize } =
    useBoardTool();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="toolbar"
        aria-label="Tools"
        className="flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
      >
        {TOOLS.map(({ tool: t, label }) => (
          <button
            key={t}
            type="button"
            aria-pressed={tool === t}
            className={toolButtonClasses(tool === t)}
            onClick={() => setTool(t)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <ColorPicker value={color} onChange={setColor} />
        <select
          aria-label="Text size"
          title="Text size"
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="rounded-md border border-slate-200 bg-white py-1 pl-2 pr-1 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
      <span
        className={`h-2 w-2 rounded-full ${CONNECTION_DOT[state]}`}
        aria-hidden
      />
      {CONNECTION_LABEL[state]}
    </span>
  );
}

/** Downloads the whole drawing as a PNG, however far it spreads. */
export function ExportButton({
  disabled,
  onExport,
}: {
  disabled: boolean;
  onExport: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      title="Download the whole drawing as a PNG"
      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path
          d="M7 2v7M4 6l3 3 3-3M2.5 11.5h9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Export PNG
    </button>
  );
}
