"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { toast } from "react-toastify";
import { useBoardTool, type BoardTool } from "@/context/BoardToolContext";
import type { BoardElementsById, OpHandler } from "@/hooks/useBoardTransport";
import { useUndoRedo, type HistoryEntry } from "@/hooks/useUndoRedo";
import { ElementRenderer } from "./ElementRenderer";
import { TextEditor } from "./TextEditor";
import {
  boxFromDrag,
  diamondPoints,
  fitWithin,
  flattenPoints,
} from "@/lib/board/geometry";
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  readImageSize,
} from "@/lib/board/images";
import {
  applyView,
  focusStageOn,
  viewOf,
  zoomStageAtPointer,
  type BoardCamera,
  type CameraStore,
} from "@/lib/board/camera";
import { minTextBoxSize, textHeightAtWidth } from "@/lib/board/text";
import type {
  BoardElement,
  ElementType,
  Point,
  Size,
  TextData,
} from "@/types/board";
import type { Dispatch, RefObject, SetStateAction } from "react";

const SHAPE_TYPES: readonly BoardTool[] = ["rectangle", "diamond", "ellipse"];
const LINEAR_TYPES: readonly BoardTool[] = ["line", "freedraw"];
const BOX_TOOLS: readonly BoardTool[] = [...SHAPE_TYPES, "text"];
const RESIZABLE_TYPES: readonly BoardTool[] = [
  "rectangle",
  "diamond",
  "ellipse",
  "text",
  "image",
];
/** Images resize from the corners only, which keep their proportions. */
const IMAGE_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const ALL_ANCHORS = [
  ...IMAGE_ANCHORS,
  "top-center",
  "middle-right",
  "bottom-center",
  "middle-left",
];

function isElementType(tool: BoardTool): tool is ElementType {
  return tool !== "select" && tool !== "pan";
}

/** Whether a key press is going into a field being typed in. */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, select"))
  );
}

interface DatagramPayload {
  type?: string;
  clientId?: string;
  points?: Point[];
}

/** One element's field changes, as committed to state, the server and the undo history. */
interface ElementUpdate {
  id: string;
  type: ElementType;
  changes: Record<string, unknown>;
}

/** A multi-selection being dragged: the element under the pointer leads, the rest follow. */
interface GroupDrag {
  leaderId: string;
  leaderStart: Point;
  /** Where each other selected node started. */
  followers: Map<string, Point>;
  delta: Point;
}

/** The element shifted by `delta`: what moving it as part of a group commits. */
function movedBy(element: BoardElement, delta: Point): Record<string, unknown> {
  const data = element.data as { position?: Point; points?: Point[] };
  if (data.points) {
    return {
      points: data.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
    };
  }
  if (data.position) {
    return {
      position: { x: data.position.x + delta.x, y: data.position.y + delta.y },
    };
  }
  return {};
}

interface BoardCanvasProps {
  elements: BoardElementsById;
  setElements: Dispatch<SetStateAction<BoardElementsById>>;
  sendOp: (
    elementId: string,
    field: string,
    value: unknown,
    type?: ElementType,
  ) => void;
  sendDatagram: (payload: unknown) => void;
  onDatagram: (handler: (payload: unknown) => void) => () => void;
  onOp: (handler: OpHandler) => () => void;
  clientId: string | null;
  /** Populated with a camera handle while mounted, for the chat panel and following. */
  cameraRef?: RefObject<BoardCamera | null>;
  /** Fed with every camera change, so HTML overlays can follow the stage. */
  cameraStore: CameraStore;
  /** Called when the user pans or zooms by hand; following someone ends there. */
  onCameraGesture?: () => void;
  /** Attached to the group holding every element, which is what an export draws. */
  boardRef?: RefObject<Konva.Group | null>;
  /** Uploads a picture for the Image tool, resolving to the id the API gave it. */
  uploadImage: (file: File) => Promise<string>;
}

export function BoardCanvas({
  elements,
  setElements,
  sendOp,
  sendDatagram,
  onDatagram,
  onOp,
  clientId,
  cameraRef,
  cameraStore,
  onCameraGesture,
  boardRef,
  uploadImage,
}: BoardCanvasProps) {
  const { tool, color, fontSize, selectedIds, setSelectedIds } = useBoardTool();

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const lastDatagramAtRef = useRef(0);
  const groupDragRef = useRef<GroupDrag | null>(null);
  // The Image tool's file picker, and where on the board the click that
  // opened it landed.
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageAtRef = useRef<Point | null>(null);

  // Kept in sync via effect below so commitFields/createElement/deleteSelected
  // can read the latest elements without needing `elements` in their own
  // dependency arrays (keeps their identity — and ElementRenderer's props —
  // stable across unrelated state updates).
  const elementsRef = useRef(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Read by Konva's drag handlers, which fire outside React's render cycle.
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Mirrors the camera into the store. Whatever moves it (wheel zoom, a pan
  // drag, the chat's jump-to-location animation, following someone) ends in
  // one of these attribute setters, so one listener covers every case.
  // Published once per frame, in step with Konva's own batched redraw.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const publish = () => {
      frame = 0;
      cameraStore.set({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(publish);
    };
    stage.on("xChange.camera yChange.camera scaleXChange.camera", schedule);
    publish();
    return () => {
      stage.off(".camera");
      if (frame) cancelAnimationFrame(frame);
    };
  }, [cameraStore]);

  useEffect(() => {
    if (!cameraRef) return;
    cameraRef.current = {
      getViewportCenter() {
        const stage = stageRef.current;
        if (!stage) return { x: 0, y: 0 };
        const { x, y } = viewOf(stage);
        return { x, y };
      },
      focusOn(point) {
        const stage = stageRef.current;
        if (stage) void focusStageOn(stage, point);
      },
      getView() {
        const stage = stageRef.current;
        return stage ? viewOf(stage) : { x: 0, y: 0, scale: 1 };
      },
      setView(view) {
        const stage = stageRef.current;
        if (stage) applyView(stage, view);
      },
    };
    return () => {
      cameraRef.current = null;
    };
  }, [cameraRef]);

  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<Point | null>(null);
  const [strokePoints, setStrokePoints] = useState<Point[] | null>(null);
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(
    null,
  );
  const [remoteDrafts, setRemoteDrafts] = useState<Record<string, Point[]>>({});

  // The stage fills its container, not the window — the board sits under a
  // header, so the two differ, and measuring the window would push the bottom
  // of the canvas out of view and skew every viewport-centre calculation.
  // "Infinite" comes from the camera (stage scale/position), not this size.
  useEffect(() => {
    const container = stageRef.current?.container()?.parentElement;
    if (!container) return;

    function updateSize() {
      setSize({
        width: container!.clientWidth,
        height: container!.clientHeight,
      });
    }
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Resize handles follow a single selection, for the element types resizing
  // makes sense for. A multi-selection shows each element's outline instead.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const onlyId = selectedIds.length === 1 ? selectedIds[0] : null;
    const el = onlyId ? elements[onlyId] : null;
    const node = onlyId ? nodeRefs.current[onlyId] : null;
    // Resize handles would sit on top of the textarea while editing.
    if (
      el &&
      node &&
      el.id !== editingId &&
      RESIZABLE_TYPES.includes(el.type)
    ) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedIds, elements, editingId]);

  // Other clients' in-progress line/freedraw strokes, via datagram, drawn as a
  // dashed preview. Their cursors and name tags are RemoteCursors' job.
  useEffect(() => {
    return onDatagram((payload) => {
      const msg = payload as DatagramPayload;
      if (!msg.clientId) return; // dữ liệu cũ/hỏng, không rõ của ai — bỏ qua
      const authorId = msg.clientId;
      if (msg.type === "draft" && msg.points) {
        const points = msg.points;
        setRemoteDrafts((prev) => ({ ...prev, [authorId]: points }));
      } else if (msg.type === "cursor") {
        // Matched by type rather than by having x/y: viewport datagrams carry
        // those too, and one arriving mid-stroke mustn't wipe the draft.
        // client này không còn vẽ dở (đã thả tay, kể cả khi nét quá ngắn để tạo
        // phần tử — trường hợp đó không có Op nào được gửi để dọn qua onOp bên dưới)
        setRemoteDrafts((prev) => {
          if (!(authorId in prev)) return prev;
          const next = { ...prev };
          delete next[authorId];
          return next;
        });
      }
    });
  }, [onDatagram]);

  // Một op đáng tin cậy (reliable stream) từ 1 client đồng nghĩa họ vừa chốt
  // xong hành động — dọn draft dang dở của họ, y hệt cách index.html cũ làm
  // với `delete remoteDrafts[op.time[1]]`.
  useEffect(() => {
    return onOp((op) => {
      const authorId = op.time[1];
      setRemoteDrafts((prev) => {
        if (!(authorId in prev)) return prev;
        const next = { ...prev };
        delete next[authorId];
        return next;
      });
    });
  }, [onOp]);

  const { record, undo, redo, setDeleted } = useUndoRedo({
    elements,
    setElements,
    sendOp,
    onDeselect: (id) => setSelectedIds((ids) => ids.filter((x) => x !== id)),
  });

  const deleteSelected = useCallback(() => {
    const entries: HistoryEntry[] = [];
    for (const id of selectedIds) {
      const el = elementsRef.current[id];
      if (!el) continue;
      setDeleted(id, true);
      entries.push({
        kind: "toggleDeleted",
        elementId: id,
        type: el.type,
        deletedAfter: true,
      });
    }
    if (entries.length === 0) return;
    setSelectedIds([]);
    record(entries.length === 1 ? entries[0] : { kind: "batch", entries });
  }, [selectedIds, setSelectedIds, setDeleted, record]);

  // Delete/Backspace soft-deletes the current selection; Ctrl/Cmd+Z undoes;
  // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes. All three only fire when nothing
  // else on the page has focus, same guard the delete handler always had.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (document.activeElement !== document.body) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, deleteSelected]);

  // Holding Alt borrows the pan tool, the way holding Space does in
  // Excalidraw. The mode only flips between gestures: a drag already under
  // way finishes as whatever it started as, whenever Alt goes down or up.
  const [altPanning, setAltPanning] = useState(false);
  useEffect(() => {
    let altDown = false;
    let buttonDown = false;

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Alt") return;
      // Otherwise tapping Alt on its own moves focus to the browser's menu.
      if (!isTypingTarget(e.target)) e.preventDefault();
      altDown = e.type === "keydown";
      if (!buttonDown) setAltPanning(altDown);
    }
    function onPointer(e: PointerEvent) {
      buttonDown = e.type === "pointerdown";
      if (!buttonDown) setAltPanning(altDown);
    }
    // Alt+Tab to another window never delivers the keyup.
    function onBlur() {
      altDown = false;
      buttonDown = false;
      setAltPanning(false);
    }

    // Capture phase, so nothing that stops propagation can strand the mode on.
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("pointerup", onPointer, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointerup", onPointer, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  const panning = tool === "pan" || altPanning;

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current[id] = node;
    else delete nodeRefs.current[id];
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      if (tool !== "select") return;
      // Pressing an element that's already selected keeps the whole
      // selection, so a drag-selection can then be moved as a group.
      setSelectedIds((ids) => (ids.includes(id) ? ids : [id]));
    },
    [tool, setSelectedIds],
  );

  const commitMany = useCallback(
    (updates: ElementUpdate[]) => {
      if (updates.length === 0) return;
      const entries = updates.map(({ id, type, changes }): HistoryEntry => {
        const current = elementsRef.current[id];
        const before: Record<string, unknown> = {};
        for (const field of Object.keys(changes)) {
          before[field] = current
            ? (current.data as Record<string, unknown>)[field]
            : undefined;
        }
        return { kind: "fields", elementId: id, type, before, after: changes };
      });
      setElements((prev) => {
        const next = { ...prev };
        for (const { id, changes } of updates) {
          const existing = next[id];
          if (existing) {
            next[id] = {
              ...existing,
              data: { ...existing.data, ...changes },
            } as BoardElement;
          }
        }
        return next;
      });
      for (const { id, type, changes } of updates) {
        for (const [field, value] of Object.entries(changes))
          sendOp(id, field, value, type);
      }
      // One undo step for the whole action, however many elements it touched.
      record(entries.length === 1 ? entries[0] : { kind: "batch", entries });
    },
    [setElements, sendOp, record],
  );

  const commitFields = useCallback(
    (id: string, type: ElementType, changes: Record<string, unknown>) => {
      const group = groupDragRef.current;
      if (!group || group.leaderId !== id) {
        commitMany([{ id, type, changes }]);
        return;
      }
      // The leader of a group drag was just dropped: its own move and every
      // follower's are committed together.
      groupDragRef.current = null;
      const updates: ElementUpdate[] = [{ id, type, changes }];
      for (const followerId of group.followers.keys()) {
        const el = elementsRef.current[followerId];
        if (!el) continue;
        updates.push({
          id: followerId,
          type: el.type,
          changes: movedBy(el, group.delta),
        });
        // Lines carry the offset in their points rather than on the node,
        // exactly as a single line drag does.
        if (el.type === "line" || el.type === "freedraw") {
          nodeRefs.current[followerId]?.position({ x: 0, y: 0 });
        }
      }
      commitMany(updates);
    },
    [commitMany],
  );

  const createElement = useCallback(
    (
      type: ElementType,
      data: Record<string, unknown>,
      fields: readonly string[],
    ) => {
      const id = crypto.randomUUID();
      setElements((prev) => ({
        ...prev,
        [id]: { id, type, deleted: false, data } as BoardElement,
      }));
      // Deliberately not selected: you carry on with the same tool, and resize
      // handles on what you just drew would only get in the way.
      for (const field of fields) sendOp(id, field, data[field], type);
      record({
        kind: "toggleDeleted",
        elementId: id,
        type,
        deletedAfter: false,
      });
      return id;
    },
    [setElements, sendOp, record],
  );

  // Uploads a picture chosen with the Image tool and puts it on the board
  // with its top-left corner at `at`, where the board was clicked.
  const insertImage = useCallback(
    async (file: File, at: Point) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error("That image is over 10 MB.");
        return;
      }
      let natural: Size;
      let imageId: string;
      try {
        natural = await readImageSize(file);
        imageId = await toast.promise(uploadImage(file), {
          pending: "Uploading image…",
        });
      } catch {
        toast.error("Couldn't add that image. PNG, JPEG, GIF and WebP work.");
        return;
      }
      // At its own size, unless that's more than half the view: then shrunk to fit.
      const scale = stage.scaleX();
      const size = fitWithin(natural, {
        width: stage.width() / scale / 2,
        height: stage.height() / scale / 2,
      });
      createElement("image", { position: at, size, imageId }, [
        "position",
        "size",
        "imageId",
      ]);
    },
    [uploadImage, createElement],
  );

  const handleStartEdit = useCallback(
    (id: string) => {
      if (tool !== "select") return; // the text tool is busy drawing new boxes
      setSelectedIds([id]);
      setEditingId(id);
    },
    [tool, setSelectedIds],
  );

  const handleCommitText = useCallback(
    (text: string) => {
      const id = editingId;
      setEditingId(null);
      if (!id) return;

      const el = elementsRef.current[id];
      if (!el || el.type !== "text") return;
      const data = el.data as Partial<TextData>;

      if (!text.trim()) {
        // Nothing to show, and an empty box has no hit area to click back
        // into — drop it, the way Paint discards a text box you leave blank.
        setSelectedIds((ids) => ids.filter((x) => x !== id));
        setDeleted(id, true);
        record({
          kind: "toggleDeleted",
          elementId: id,
          type: "text",
          deletedAfter: true,
        });
        return;
      }

      const changes: Record<string, unknown> = {};
      if (text !== data.text) changes.text = text;

      // Typing more than fits has to grow the box, otherwise the overflow is
      // simply clipped — the resize clamp only guards the other direction.
      const node = nodeRefs.current[id] as Konva.Text | undefined;
      if (node && data.size) {
        const neededHeight = textHeightAtWidth(node, data.size.width, text);
        if (neededHeight > data.size.height) {
          changes.size = { width: data.size.width, height: neededHeight };
        }
      }

      if (Object.keys(changes).length > 0) commitFields(id, "text", changes);
    },
    [editingId, commitFields, setDeleted, record, setSelectedIds],
  );

  // Selects every element lying wholly inside the box dragged out.
  const selectInside = useCallback(
    (a: Point, b: Point) => {
      const stage = stageRef.current;
      const { position, size: box } = boxFromDrag(a, b);
      if (!stage || (box.width < 3 && box.height < 3)) return; // just a click
      const right = position.x + box.width;
      const bottom = position.y + box.height;
      const inside: string[] = [];
      for (const [id, node] of Object.entries(nodeRefs.current)) {
        if (elementsRef.current[id]?.deleted !== false) continue;
        // Relative to the stage means world coordinates, the box's own space.
        const r = node.getClientRect({ relativeTo: stage });
        if (
          r.x >= position.x &&
          r.y >= position.y &&
          r.x + r.width <= right &&
          r.y + r.height <= bottom
        ) {
          inside.push(id);
        }
      }
      setSelectedIds(inside);
    },
    [setSelectedIds],
  );

  const getWorldPointer = useCallback((): Point | null => {
    const stage = stageRef.current;
    const p = stage?.getRelativePointerPosition();
    return p ? { x: p.x, y: p.y } : null;
  }, []);

  const maybeBroadcastPointer = useCallback(
    (p: Point, draftPoints: Point[] | null) => {
      if (!clientId) return; // chưa kết nối xong, chưa có id để tự nhận diện
      const now = Date.now();
      if (now - lastDatagramAtRef.current < 100) return;
      lastDatagramAtRef.current = now;
      if (draftPoints && draftPoints.length > 1) {
        sendDatagram({ type: "draft", clientId, points: draftPoints });
      } else {
        sendDatagram({ type: "cursor", clientId, x: p.x, y: p.y });
      }
    },
    [sendDatagram, clientId],
  );

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return;
      onCameraGesture?.();
      const factor = e.evt.deltaY > 0 ? 0.9 : 1.1;
      zoomStageAtPointer(stage, pointer, factor);
    },
    [onCameraGesture],
  );

  const handleStageDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Element drags bubble up here too; only panning the stage itself moves the camera.
      if (e.target === e.target.getStage()) {
        onCameraGesture?.();
        return;
      }
      // Dragging one element of a multi-selection brings the rest along.
      const selected = selectedIdsRef.current;
      const leaderId = Object.keys(nodeRefs.current).find(
        (id) => nodeRefs.current[id] === e.target,
      );
      if (!leaderId || selected.length < 2 || !selected.includes(leaderId)) {
        return;
      }
      const followers = new Map<string, Point>();
      for (const id of selected) {
        const node = nodeRefs.current[id];
        if (id !== leaderId && node) followers.set(id, node.position());
      }
      groupDragRef.current = {
        leaderId,
        leaderStart: e.target.position(),
        followers,
        delta: { x: 0, y: 0 },
      };
    },
    [onCameraGesture],
  );

  const handleStageDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const group = groupDragRef.current;
      if (!group || nodeRefs.current[group.leaderId] !== e.target) return;
      const at = e.target.position();
      group.delta = {
        x: at.x - group.leaderStart.x,
        y: at.y - group.leaderStart.y,
      };
      for (const [id, start] of group.followers) {
        nodeRefs.current[id]?.position({
          x: start.x + group.delta.x,
          y: start.y + group.delta.y,
        });
      }
    },
    [],
  );

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // A pan borrowed with Alt leaves the selection alone, as Space does in
      // Excalidraw; the stage's own drag does the panning.
      if (altPanning) return;
      const onEmptyCanvas = e.target === e.target.getStage();
      // A press on empty canvas clears the selection whatever the tool, so
      // clicking away is how you deselect. (In Select mode a press on an
      // element never reaches here: the element swallows it.)
      if (onEmptyCanvas) setSelectedIds([]); // click nền trống -> bỏ chọn
      if (tool === "pan") return;
      const p = getWorldPointer();
      if (!p) return;
      if (tool === "select") {
        // Dragging from empty canvas draws a box that selects what it encloses.
        if (onEmptyCanvas) setMarquee({ start: p, end: p });
        return;
      }
      if (BOX_TOOLS.includes(tool)) {
        setDrawStart(p);
        setDrawCurrent(p);
      } else if (LINEAR_TYPES.includes(tool)) {
        setStrokePoints([p]);
      }
    },
    [tool, altPanning, getWorldPointer, setSelectedIds],
  );

  const handleStageMouseMove = useCallback(() => {
    const p = getWorldPointer();
    if (!p) return;

    if (marquee) {
      setMarquee({ start: marquee.start, end: p });
    } else if (drawStart) {
      setDrawCurrent(p);
    } else if (strokePoints) {
      if (tool === "line") {
        setStrokePoints([strokePoints[0], p]);
      } else if (tool === "freedraw") {
        const last = strokePoints[strokePoints.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 4) {
          setStrokePoints([...strokePoints, p]);
        }
      }
    }

    maybeBroadcastPointer(p, LINEAR_TYPES.includes(tool) ? strokePoints : null);
  }, [
    marquee,
    drawStart,
    strokePoints,
    tool,
    getWorldPointer,
    maybeBroadcastPointer,
  ]);

  const handleStageMouseUp = useCallback(() => {
    if (marquee) {
      setMarquee(null);
      selectInside(marquee.start, marquee.end);
      return;
    }

    if (drawStart && drawCurrent) {
      const { position, size: boxSize } = boxFromDrag(drawStart, drawCurrent);
      setDrawStart(null);
      setDrawCurrent(null);
      const minSize = tool === "text" ? 10 : 4;
      if (boxSize.width < minSize || boxSize.height < minSize) return;

      if (tool === "text") {
        // Drag lays out an empty box and drops the caret straight into it,
        // like Paint — the content is typed on the canvas, not in a dialog.
        const id = createElement(
          "text",
          { position, size: boxSize, text: "", color, fontSize },
          ["position", "size", "text", "color", "fontSize"],
        );
        setEditingId(id);
      } else if (isElementType(tool)) {
        createElement(
          tool,
          {
            position,
            size: boxSize,
            strokeColor: color,
            backgroundColor: "transparent",
          },
          ["position", "size", "strokeColor", "backgroundColor"],
        );
      }
      return;
    }

    if (strokePoints && strokePoints.length > 1 && isElementType(tool)) {
      const points = strokePoints;
      setStrokePoints(null);
      createElement(tool, { points, strokeColor: color }, [
        "points",
        "strokeColor",
      ]);
      return;
    }
    setStrokePoints(null);
  }, [
    marquee,
    selectInside,
    drawStart,
    drawCurrent,
    strokePoints,
    tool,
    color,
    fontSize,
    createElement,
  ]);

  // With the Image tool, a click marks where the picture's top-left corner
  // goes and opens the file picker. It has to open inside the click itself:
  // browsers only show a file dialog in answer to something the user did.
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== "image" || altPanning || e.evt.button !== 0) return;
      const p = getWorldPointer();
      if (!p) return;
      imageAtRef.current = p;
      imageInputRef.current?.click();
    },
    [tool, altPanning, getWorldPointer],
  );

  const editingElement = editingId ? elements[editingId] : null;
  const editingData =
    editingElement?.type === "text"
      ? (editingElement.data as Partial<TextData>)
      : null;
  const selectedSet = new Set(selectedIds);
  const onlySelected =
    selectedIds.length === 1 ? elements[selectedIds[0]] : undefined;

  return (
    <>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={panning}
        className={
          panning
            ? "cursor-grab active:cursor-grabbing"
            : tool === "image"
              ? "cursor-crosshair"
              : undefined
        }
        onWheel={handleWheel}
        onDragStart={handleStageDragStart}
        onDragMove={handleStageDragMove}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onClick={handleStageClick}
      >
        <Layer>
          {/* Existing elements only take the pointer in Select mode, and not
              while Alt is held for panning. Each one swallows its mousedown
              (so selecting doesn't also clear the selection via the stage),
              which with a drawing tool meant a stroke or shape could never be
              started on top of another one, nor a pan. Konva's listening is
              inherited, so this one flag covers them all. */}
          <Group ref={boardRef} listening={tool === "select" && !altPanning}>
            {Object.values(elements)
              .filter((el) => !el.deleted)
              .map((el) => (
                <ElementRenderer
                  key={el.id}
                  element={el}
                  selected={selectedSet.has(el.id)}
                  draggable={tool === "select"}
                  editing={el.id === editingId}
                  cameraStore={cameraStore}
                  registerNode={registerNode}
                  onSelect={handleSelect}
                  onStartEdit={handleStartEdit}
                  onCommitFields={commitFields}
                />
              ))}
          </Group>

          {/* preview of whatever the local user is currently drawing */}
          {drawStart &&
            drawCurrent &&
            (() => {
              const { position, size: boxSize } = boxFromDrag(
                drawStart,
                drawCurrent,
              );
              if (tool === "diamond") {
                return (
                  <Line
                    x={position.x}
                    y={position.y}
                    points={diamondPoints(boxSize.width, boxSize.height)}
                    closed
                    stroke="#9ca3af"
                    dash={[4, 4]}
                    listening={false}
                  />
                );
              }
              return (
                <Rect
                  x={position.x}
                  y={position.y}
                  width={boxSize.width}
                  height={boxSize.height}
                  stroke="#9ca3af"
                  dash={[4, 4]}
                  listening={false}
                />
              );
            })()}
          {strokePoints && strokePoints.length > 1 && (
            <Line
              points={flattenPoints(strokePoints)}
              stroke="#9ca3af"
              dash={[4, 4]}
              strokeWidth={2}
              listening={false}
            />
          )}

          {/* other clients' in-progress line/freedraw strokes, via datagram */}
          {Object.entries(remoteDrafts).map(
            ([authorId, pts]) =>
              pts.length > 1 && (
                <Line
                  key={authorId}
                  points={flattenPoints(pts)}
                  stroke="#9ca3af"
                  dash={[4, 4]}
                  strokeWidth={2}
                  listening={false}
                />
              ),
          )}

          {/* the drag-select box */}
          {marquee &&
            (() => {
              const { position, size: box } = boxFromDrag(
                marquee.start,
                marquee.end,
              );
              return (
                <Rect
                  x={position.x}
                  y={position.y}
                  width={box.width}
                  height={box.height}
                  fill="rgba(99, 102, 241, 0.08)"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                  dash={[4, 4]}
                  listening={false}
                />
              );
            })()}

          <Transformer
            ref={transformerRef}
            // While panning, a press on a resize handle pans too.
            listening={!panning}
            rotateEnabled={false}
            enabledAnchors={
              onlySelected?.type === "image" ? IMAGE_ANCHORS : ALL_ANCHORS
            }
            boundBoxFunc={(oldBox, newBox) => {
              // Stop a text box being dragged smaller than the text it holds.
              // Rejecting the whole frame (returning oldBox) rather than just
              // clamping the width keeps the box's position pinned too —
              // clamping alone lets the dragged edge run away from the box.
              const onlyId = selectedIds.length === 1 ? selectedIds[0] : null;
              const el = onlyId ? elementsRef.current[onlyId] : null;
              if (!onlyId || el?.type !== "text") return newBox;
              const node = nodeRefs.current[onlyId] as Konva.Text | undefined;
              if (!node) return newBox;

              // boundBox is in screen pixels, element geometry in world units.
              const scale = stageRef.current?.scaleX() ?? 1;
              const minimum = minTextBoxSize(node);
              if (newBox.width < minimum.width * scale) return oldBox;

              const minHeight = textHeightAtWidth(node, newBox.width / scale);
              if (newBox.height < minHeight * scale) return oldBox;

              return newBox;
            }}
          />
        </Layer>
      </Stage>

      {editingId && editingData?.position && editingData.size && (
        <TextEditor
          key={editingId}
          initialText={editingData.text ?? ""}
          position={editingData.position}
          size={editingData.size}
          color={editingData.color ?? "#1f2937"}
          fontSize={editingData.fontSize ?? 16}
          cameraStore={cameraStore}
          onCommit={handleCommitText}
        />
      )}

      {/* The Image tool's file picker, opened by a click on the board. */}
      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          const at = imageAtRef.current;
          // Cleared so picking the same file again still counts as a change.
          e.target.value = "";
          imageAtRef.current = null;
          if (file && at) void insertImage(file, at);
        }}
      />
    </>
  );
}
