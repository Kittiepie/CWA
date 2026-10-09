import type { Point, Size } from "@/types/board";

/** Normalizes two drag corners into a top-left position + a positive size. */
export function boxFromDrag(a: Point, b: Point): { position: Point; size: Size } {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    return { position: { x, y }, size: { width, height } };
}

/** `size` scaled down to fit inside `box`, keeping its proportions. Never scaled up. */
export function fitWithin(size: Size, box: Size): Size {
    const k = Math.min(1, box.width / size.width, box.height / size.height);
    return { width: size.width * k, height: size.height * k };
}

/**
 * Flat [x, y, x, y, ...] point list for a diamond inscribed in a
 * `width` x `height` box, for use as a Konva.Line's `points` prop (Line
 * points are relative to the node's own x/y, which we set to the
 * element's position — see ElementRenderer).
 */
export function diamondPoints(width: number, height: number): number[] {
    return [width / 2, 0, width, height / 2, width / 2, height, 0, height / 2];
}

/** Flattens `[{x,y}, ...]` into Konva's `[x, y, x, y, ...]` points format. */
export function flattenPoints(points: Point[]): number[] {
    return points.flatMap((p) => [p.x, p.y]);
}

/** Inverse of flattenPoints — Konva hands points back flat after a drag/transform. */
export function unflattenPoints(flat: number[]): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < flat.length - 1; i += 2) {
        points.push({ x: flat[i], y: flat[i + 1] });
    }
    return points;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Linear interpolation, used to tween the camera toward a focus point. */
export function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
}