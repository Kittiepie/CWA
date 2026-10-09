import type Konva from "konva";

/**
 * Konva name for nodes drawn only as UI, such as selection outlines: they sit
 * among the elements on the canvas but aren't part of the drawing.
 */
export const NOT_EXPORTED = "not-exported";

/** Margin left around the drawing, in world units. */
const PADDING = 32;
/** Image pixels per world unit: 2x keeps lines sharp on high-DPI screens. */
const PIXELS_PER_UNIT = 2;
/** Inside every browser's canvas limits (Safari caps the area at 4096²). */
const MAX_PIXELS = 4096 * 4096;
const MAX_SIDE = 16384;

/**
 * Draws everything in `board` (the group holding the elements) onto a new
 * canvas on white, framed to the smallest rectangle that covers the whole
 * drawing plus a margin. It works on a detached copy in world coordinates, so
 * the camera plays no part: elements far outside the view are included, and
 * the result is the same at any zoom. Null when nothing is drawn.
 */
export function renderBoardImage(board: Konva.Group): HTMLCanvasElement | null {
  const copy = board.clone();
  try {
    copy.find(`.${NOT_EXPORTED}`).forEach((node) => node.destroy());

    // Detached and untransformed, the copy measures in world coordinates.
    const bounds = copy.getClientRect();
    if (bounds.width === 0 && bounds.height === 0) return null;
    const width = bounds.width + PADDING * 2;
    const height = bounds.height + PADDING * 2;

    // A huge drawing comes out at a lower resolution rather than not at all.
    const pixelRatio = Math.min(
      PIXELS_PER_UNIT,
      Math.sqrt(MAX_PIXELS / (width * height)),
      MAX_SIDE / Math.max(width, height),
    );

    // Moved to the origin rather than cropped with toCanvas's x/y: Konva
    // sizes a scratch canvas by those offsets, which a drawing far from the
    // origin would blow up.
    copy.position({ x: PADDING - bounds.x, y: PADDING - bounds.y });
    const canvas = copy.toCanvas({ x: 0, y: 0, width, height, pixelRatio });

    // Konva leaves the background transparent; paint white behind the drawing.
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    return canvas;
  } finally {
    copy.destroy();
  }
}

/** Saves `canvas` as a PNG download; false if the browser couldn't encode it. */
export async function downloadPng(
  canvas: HTMLCanvasElement,
  fileName: string,
): Promise<boolean> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Released once the click has handed the file to the download.
  setTimeout(() => URL.revokeObjectURL(url));
  return true;
}

/** e.g. "board-2026-09-14-1530.png", in local time. */
export function exportFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `board-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.png`;
}
