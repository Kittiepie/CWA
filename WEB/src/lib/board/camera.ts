import { useSyncExternalStore } from "react";
import type Konva from "konva";
import { clamp, lerp } from "./geometry";
import type { Point } from "@/types/board";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

/** Where someone is looking: the world point at the centre of their screen, and their zoom. */
export interface View {
    x: number;
    y: number;
    scale: number;
}

/**
 * Imperative handle BoardCanvas publishes so siblings can read and move the
 * view without owning the stage — the chat panel needs it to attach "look
 * here" coordinates and to jump to one someone else sent, and following
 * someone reads and replaces the whole view.
 */
export interface BoardCamera {
    /** World coordinate currently at the centre of the viewport. */
    getViewportCenter(): Point;
    /** Pans so `point` ends up centred. Zoom is left alone. */
    focusOn(point: Point): void;
    /** The current view, for broadcasting to anyone following us. */
    getView(): View;
    /** Jumps straight to `view`: what following someone does on each update. */
    setView(view: View): void;
}

/** The stage transform as plain numbers: world point p lands on screen at p * scale + (x, y). */
export interface CameraState {
    scale: number;
    x: number;
    y: number;
}

/**
 * A tiny observable over the stage's camera. The stage moves imperatively
 * (wheel, pan, animations, following) and re-rendering the whole canvas on
 * every frame of that would be wasteful, so the HTML laid over the board —
 * the text editor, remote cursors — subscribes here and re-renders alone.
 */
export class CameraStore {
    private state: CameraState = { scale: 1, x: 0, y: 0 };
    private readonly listeners = new Set<() => void>();

    readonly get = (): CameraState => this.state;

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    set(next: CameraState): void {
        const { scale, x, y } = this.state;
        if (next.scale === scale && next.x === x && next.y === y) return;
        this.state = next;
        this.listeners.forEach((listener) => listener());
    }
}

export function useCamera(store: CameraStore): CameraState {
    return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function viewOf(stage: Konva.Stage): View {
    const scale = stage.scaleX();
    return {
        x: (stage.width() / 2 - stage.x()) / scale,
        y: (stage.height() / 2 - stage.y()) / scale,
        scale,
    };
}

/** Puts `view`'s world point at the centre of this stage, at `view`'s zoom. */
export function applyView(stage: Konva.Stage, view: View): void {
    const scale = clamp(view.scale, MIN_ZOOM, MAX_ZOOM);
    stage.scale({ x: scale, y: scale });
    stage.position({
        x: stage.width() / 2 - view.x * scale,
        y: stage.height() / 2 - view.y * scale,
    });
    stage.batchDraw();
}

/**
 * Zooms `stage` by `factor`, keeping the world point under `pointer` (stage/
 * screen coordinates, e.g. from `stage.getPointerPosition()`) fixed on
 * screen — the standard "zoom to cursor" feel. Mutates the stage directly;
 * this is intentionally imperative rather than React state, since camera
 * updates happen on every wheel tick and re-rendering React for that would
 * be wasteful (Konva already redraws itself when you call batchDraw()).
 */
export function zoomStageAtPointer(stage: Konva.Stage, pointer: { x: number; y: number }, factor: number): void {
    const oldScale = stage.scaleX();
    const newScale = clamp(oldScale * factor, MIN_ZOOM, MAX_ZOOM);

    const worldX = (pointer.x - stage.x()) / oldScale;
    const worldY = (pointer.y - stage.y()) / oldScale;

    stage.scale({ x: newScale, y: newScale });
    stage.position({
        x: pointer.x - worldX * newScale,
        y: pointer.y - worldY * newScale,
    });
    stage.batchDraw();
}

/**
 * Animates `stage` so that the given world coordinate ends up centered in
 * the viewport — this is what a "click a coordinate in chat" feature calls
 * on every client that receives the focus message. Zoom level is left as-is,
 * only pan changes.
 */
export function focusStageOn(stage: Konva.Stage, worldPoint: { x: number; y: number }, durationMs = 300): Promise<void> {
    const scale = stage.scaleX();
    const targetX = stage.width() / 2 - worldPoint.x * scale;
    const targetY = stage.height() / 2 - worldPoint.y * scale;
    const startX = stage.x();
    const startY = stage.y();
    const start = performance.now();

    return new Promise((resolve) => {
        function step(now: number) {
            const t = clamp((now - start) / durationMs, 0, 1);
            stage.position({ x: lerp(startX, targetX, t), y: lerp(startY, targetY, t) });
            stage.batchDraw();
            if (t < 1) requestAnimationFrame(step);
            else resolve();
        }
        requestAnimationFrame(step);
    });
}
