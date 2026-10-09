"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BoardElement, ElementType } from "@/types/board";
import type { BoardElementsById } from "./useBoardTransport";

type FieldValues = Record<string, unknown>;

/**
 * One undo-able action. Deliberately just a few kinds:
 *  - "toggleDeleted" covers both create (deletedAfter: false — undo hides
 *    it) and explicit delete (deletedAfter: true — undo restores it). The
 *    element's fields are never actually removed by an undo, only the
 *    `deleted` flag flips — consistent with the tombstone model already
 *    used for real deletes (see board-elements.md).
 *  - "fields" covers everything else: move, resize, recolor, font size —
 *    anything that's a plain field value change, batched per user action
 *    (e.g. a resize commits `position` + `size` together as ONE entry, not
 *    two, so one Ctrl+Z undoes the whole resize).
 *  - "batch" groups the entries of one action that touched several elements
 *    (moving or deleting a drag-selection), so one Ctrl+Z undoes them all.
 */
export type HistoryEntry =
    | { kind: "toggleDeleted"; elementId: string; type: ElementType; deletedAfter: boolean }
    | { kind: "fields"; elementId: string; type: ElementType; before: FieldValues; after: FieldValues }
    | { kind: "batch"; entries: HistoryEntry[] };

const MAX_HISTORY = 100;

interface UseUndoRedoOptions {
    elements: BoardElementsById;
    setElements: Dispatch<SetStateAction<BoardElementsById>>;
    sendOp: (elementId: string, field: string, value: unknown, type?: ElementType) => void;
    onDeselect?: (elementId: string) => void;
}

/**
 * Local-only undo/redo: this stack records only actions the CURRENT client
 * initiated (record() is only ever called from this client's own create/
 * move/delete handlers, never from incoming remote ops) — undo can never
 * revert someone else's edit. That's a deliberate scope choice, not an
 * oversight: true multi-user undo (reverting the right thing regardless of
 * who did what since) is a much harder CRDT problem than what a whiteboard
 * needs for v1, and it's the same choice most collaborative tools make.
 */
export function useUndoRedo({ elements, setElements, sendOp, onDeselect }: UseUndoRedoOptions) {
    const elementsRef = useRef(elements);
    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    const undoStack = useRef<HistoryEntry[]>([]);
    const redoStack = useRef<HistoryEntry[]>([]);

    const record = useCallback((entry: HistoryEntry) => {
        undoStack.current.push(entry);
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
        redoStack.current = []; // 1 hành động mới luôn xoá redo stack cũ, giống mọi undo stack thông thường
    }, []);

    const setDeleted = useCallback(
        (elementId: string, deleted: boolean) => {
            setElements((prev) => {
                const existing = prev[elementId];
                if (!existing) return prev;
                return { ...prev, [elementId]: { ...existing, deleted } };
            });
            sendOp(elementId, "deleted", deleted);
            if (deleted) onDeselect?.(elementId);
        },
        [setElements, sendOp, onDeselect],
    );

    /**
     * Applies `target` field values, but only for fields whose CURRENT value
     * still matches `guardAgainst` — i.e. only if nobody else has changed
     * that specific field since this history entry was recorded. This is
     * what stops a stale local undo from clobbering a newer edit from
     * another client on the same element (a real risk with LWW field merge:
     * without this check, undo would resend `before` with a fresh timestamp
     * and simply win, silently overwriting whatever they'd changed it to).
     */
    const applyFieldsIfUnchanged = useCallback(
        (elementId: string, type: ElementType, target: FieldValues, guardAgainst: FieldValues) => {
            const current = elementsRef.current[elementId];
            if (!current) return;
            const toApply: FieldValues = {};
            for (const field of Object.keys(target)) {
                const currentValue = (current.data as FieldValues)[field];
                if (JSON.stringify(currentValue) === JSON.stringify(guardAgainst[field])) {
                    toApply[field] = target[field];
                }
            }
            if (Object.keys(toApply).length === 0) return;
            setElements((prev) => {
                const existing = prev[elementId];
                if (!existing) return prev;
                return { ...prev, [elementId]: { ...existing, data: { ...existing.data, ...toApply } } as BoardElement };
            });
            for (const [field, value] of Object.entries(toApply)) sendOp(elementId, field, value, type);
        },
        [setElements, sendOp],
    );

    /** Plays an entry back either way; a batch replays its parts, last-first when undoing. */
    const apply = useCallback(
        (entry: HistoryEntry, direction: "undo" | "redo") => {
            const run = (e: HistoryEntry): void => {
                if (e.kind === "batch") {
                    const parts = direction === "undo" ? [...e.entries].reverse() : e.entries;
                    parts.forEach(run);
                } else if (e.kind === "toggleDeleted") {
                    setDeleted(e.elementId, direction === "undo" ? !e.deletedAfter : e.deletedAfter);
                } else if (direction === "undo") {
                    applyFieldsIfUnchanged(e.elementId, e.type, e.before, e.after);
                } else {
                    applyFieldsIfUnchanged(e.elementId, e.type, e.after, e.before);
                }
            };
            run(entry);
        },
        [applyFieldsIfUnchanged, setDeleted],
    );

    const undo = useCallback(() => {
        const entry = undoStack.current.pop();
        if (!entry) return;
        redoStack.current.push(entry);
        apply(entry, "undo");
    }, [apply]);

    const redo = useCallback(() => {
        const entry = redoStack.current.pop();
        if (!entry) return;
        undoStack.current.push(entry);
        apply(entry, "redo");
    }, [apply]);

    return { record, undo, redo, setDeleted };
}
