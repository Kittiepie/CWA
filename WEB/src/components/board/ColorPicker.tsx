"use client";

import { useRef, useState } from "react";
import { useDismiss } from "@/hooks/useDismiss";

/**
 * Laid out like Word's colour menu: strong hues across the top, deeper
 * shades, then lighter tints beneath. No white, which would vanish on the
 * canvas.
 */
// prettier-ignore
const PALETTE = [
  "#1f2937", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
  "#000000", "#b91c1c", "#c2410c", "#a16207", "#15803d", "#0f766e", "#1d4ed8", "#4338ca", "#7e22ce", "#be185d",
  "#6b7280", "#fca5a5", "#fdba74", "#fde047", "#86efac", "#5eead4", "#93c5fd", "#a5b4fc", "#d8b4fe", "#f9a8d4",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

/** Word-style colour button: an "A" over a bar of the current colour, opening a swatch grid. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, setOpen);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Color"
        title="Color"
        className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
      >
        <span className="flex flex-col items-center leading-none">
          <span className="text-sm font-semibold">A</span>
          <span
            className="mt-0.5 h-1 w-4 rounded-sm"
            style={{ backgroundColor: value }}
          />
        </span>
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
          role="dialog"
          aria-label="Choose a color"
          className="absolute left-0 top-full z-50 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        >
          <p className="px-1 pb-1.5 text-xs font-medium text-slate-500">
            Colors
          </p>
          <div className="grid grid-cols-10 gap-1">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                aria-label={color}
                title={color}
                className={`h-5 w-5 rounded-sm border border-black/10 transition-transform hover:scale-110 ${
                  color === value ? "ring-2 ring-indigo-500 ring-offset-1" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          {/* The system picker, like Word's "More Colors…" dialog. Left open
              while it's in use: closing would unmount the input under it. */}
          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs text-slate-600 hover:bg-slate-100">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            More colors…
          </label>
        </div>
      )}
    </div>
  );
}
