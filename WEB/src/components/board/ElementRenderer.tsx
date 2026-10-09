"use client";

import { Ellipse, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type {
  BoardElement,
  ElementType,
  ImageElementData,
  LinearData,
  ShapeData,
  TextData,
} from "@/types/board";
import type { CameraStore } from "@/lib/board/camera";
import { NOT_EXPORTED } from "@/lib/board/exportImage";
import { diamondPoints, flattenPoints } from "@/lib/board/geometry";
import {
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  TEXT_PADDING,
} from "@/lib/board/text";
import { BoardImage } from "./BoardImage";

export type KonvaMouseEvent = Konva.KonvaEventObject<MouseEvent>;
export type KonvaDragEvent = Konva.KonvaEventObject<DragEvent>;
export type KonvaTransformEvent = Konva.KonvaEventObject<Event>;

interface ElementRendererProps {
  element: BoardElement;
  selected: boolean;
  draggable: boolean;
  /** True while this element's text is being typed into the overlaid textarea. */
  editing: boolean;
  /** Followed by images, which fetch a sharper copy as the view zooms in. */
  cameraStore: CameraStore;
  /** Registers the underlying Konva node so BoardCanvas can attach a Transformer to it. */
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCommitFields: (
    id: string,
    type: ElementType,
    changes: Record<string, unknown>,
  ) => void;
}

const SELECTION_COLOR = "#000000";

/** Renders one board element as Konva node(s), plus a dashed selection outline when selected. */
export function ElementRenderer({
  element,
  selected,
  draggable,
  editing,
  cameraStore,
  registerNode,
  onSelect,
  onStartEdit,
  onCommitFields,
}: ElementRendererProps) {
  const { id, type, data } = element;

  const stopBubbleAndSelect = (e: KonvaMouseEvent) => {
    e.cancelBubble = true; // đừng để Stage cũng bắt đầu pan khi đang thao tác trên 1 phần tử
    onSelect(id);
  };

  // What dragging or resizing commits for anything placed by its top-left
  // corner and size: rectangles, diamonds and images.
  const commitBoxDrag = (e: KonvaDragEvent) => {
    onCommitFields(id, type, {
      position: { x: e.target.x(), y: e.target.y() },
    });
  };
  const commitBoxResize = (e: KonvaTransformEvent) => {
    const node = e.target as Konva.Node;
    const newWidth = Math.max(4, node.width() * node.scaleX());
    const newHeight = Math.max(4, node.height() * node.scaleY());
    node.scaleX(1);
    node.scaleY(1);
    onCommitFields(id, type, {
      position: { x: node.x(), y: node.y() },
      size: { width: newWidth, height: newHeight },
    });
  };

  if (type === "rectangle" || type === "diamond") {
    const d = data as Partial<ShapeData>;
    if (!d.position || !d.size) return null;
    const { x, y } = d.position;
    const { width, height } = d.size;
    const fill =
      d.backgroundColor && d.backgroundColor !== "transparent"
        ? d.backgroundColor
        : undefined;
    const stroke = d.strokeColor ?? "#1f2937";

    return (
      <Group>
        {type === "rectangle" ? (
          <Rect
            ref={(node) => registerNode(id, node)}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
            draggable={draggable}
            onMouseDown={stopBubbleAndSelect}
            onDragEnd={commitBoxDrag}
            onTransformEnd={commitBoxResize}
          />
        ) : (
          <Line
            ref={(node) => registerNode(id, node)}
            x={x}
            y={y}
            width={width}
            height={height}
            points={diamondPoints(width, height)}
            closed
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
            draggable={draggable}
            onMouseDown={stopBubbleAndSelect}
            onDragEnd={commitBoxDrag}
            onTransformEnd={commitBoxResize}
          />
        )}
        {selected && (
          <Rect
            name={NOT_EXPORTED}
            x={x - 3}
            y={y - 3}
            width={width + 6}
            height={height + 6}
            stroke={SELECTION_COLOR}
            dash={[3, 3]}
            listening={false}
          />
        )}
      </Group>
    );
  }

  if (type === "ellipse") {
    const d = data as Partial<ShapeData>;
    if (!d.position || !d.size) return null;
    const { x, y } = d.position;
    const { width, height } = d.size;
    const fill =
      d.backgroundColor && d.backgroundColor !== "transparent"
        ? d.backgroundColor
        : undefined;
    const stroke = d.strokeColor ?? "#1f2937";
    const cx = x + width / 2;
    const cy = y + height / 2;

    const handleDragEnd = (e: KonvaDragEvent) => {
      const node = e.target;
      onCommitFields(id, type, {
        position: { x: node.x() - width / 2, y: node.y() - height / 2 },
      });
    };
    const handleTransformEnd = (e: KonvaTransformEvent) => {
      const node = e.target as Konva.Node;
      const newWidth = Math.max(4, width * node.scaleX());
      const newHeight = Math.max(4, height * node.scaleY());
      node.scaleX(1);
      node.scaleY(1);
      onCommitFields(id, type, {
        position: { x: node.x() - newWidth / 2, y: node.y() - newHeight / 2 },
        size: { width: newWidth, height: newHeight },
      });
    };

    return (
      <Group>
        <Ellipse
          ref={(node) => registerNode(id, node)}
          x={cx}
          y={cy}
          radiusX={width / 2}
          radiusY={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          draggable={draggable}
          onMouseDown={stopBubbleAndSelect}
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
        />
        {selected && (
          <Ellipse
            name={NOT_EXPORTED}
            x={cx}
            y={cy}
            radiusX={width / 2 + 3}
            radiusY={height / 2 + 3}
            stroke={SELECTION_COLOR}
            dash={[3, 3]}
            listening={false}
          />
        )}
      </Group>
    );
  }

  if (type === "line" || type === "freedraw") {
    const d = data as Partial<LinearData>;
    if (!d.points || d.points.length < 2) return null;
    const stroke = d.strokeColor ?? "#1f2937";
    const flat = flattenPoints(d.points);

    const handleDragEnd = (e: KonvaDragEvent) => {
      const node = e.target;
      const dx = node.x();
      const dy = node.y();
      node.position({ x: 0, y: 0 }); // gộp lệch vào chính points, không giữ offset trên node
      const translated = d.points!.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      onCommitFields(id, type, { points: translated });
    };

    return (
      <Group>
        <Line
          ref={(node) => registerNode(id, node)}
          points={flat}
          stroke={stroke}
          strokeWidth={3}
          lineCap="round"
          lineJoin="round"
          tension={type === "freedraw" ? 0.3 : 0}
          draggable={draggable}
          onMouseDown={stopBubbleAndSelect}
          onDragEnd={handleDragEnd}
          hitStrokeWidth={16}
        />
        {selected && (
          <Line
            name={NOT_EXPORTED}
            points={flat}
            stroke={SELECTION_COLOR}
            strokeWidth={9}
            opacity={0.25}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
      </Group>
    );
  }

  if (type === "image") {
    const d = data as Partial<ImageElementData>;
    if (!d.position || !d.size || !d.imageId) return null;
    const { x, y } = d.position;
    const { width, height } = d.size;

    return (
      <Group>
        <BoardImage
          ref={(node) => registerNode(id, node)}
          imageId={d.imageId}
          x={x}
          y={y}
          width={width}
          height={height}
          draggable={draggable}
          cameraStore={cameraStore}
          onMouseDown={stopBubbleAndSelect}
          onDragEnd={commitBoxDrag}
          onTransformEnd={commitBoxResize}
        />
        {selected && (
          <Rect
            name={NOT_EXPORTED}
            x={x - 3}
            y={y - 3}
            width={width + 6}
            height={height + 6}
            stroke={SELECTION_COLOR}
            dash={[3, 3]}
            listening={false}
          />
        )}
      </Group>
    );
  }

  // type === "text"
  const d = data as Partial<TextData>;
  if (!d.position || !d.size || d.text === undefined) return null;
  const { x, y } = d.position;
  const { width, height } = d.size;
  const fontSize = d.fontSize ?? 16;
  const fill = d.color ?? "#1f2937";

  const handleDragEnd = (e: KonvaDragEvent) => {
    onCommitFields(id, type, {
      position: { x: e.target.x(), y: e.target.y() },
    });
  };

  // Runs on every frame of a resize, not just at the end: a Transformer works
  // by scaling its node, which on a Text would stretch the glyphs themselves.
  // Folding that scale straight back into width/height leaves the letters at
  // their own font size and reflows the wrap instead. The lower bound lives on
  // the Transformer's boundBoxFunc (see BoardCanvas) rather than here, so a
  // rejected frame keeps the box's position too, not just its size.
  const handleTransform = (e: KonvaTransformEvent) => {
    const node = e.target as Konva.Text;
    node.setAttrs({
      width: node.width() * node.scaleX(),
      height: node.height() * node.scaleY(),
      scaleX: 1,
      scaleY: 1,
    });
  };

  const handleTransformEnd = (e: KonvaTransformEvent) => {
    const node = e.target as Konva.Text;
    onCommitFields(id, type, {
      position: { x: node.x(), y: node.y() },
      size: { width: node.width(), height: node.height() },
    });
  };

  return (
    <Group>
      <Text
        ref={(node) => registerNode(id, node)}
        x={x}
        y={y}
        width={width}
        height={height}
        text={d.text}
        fontSize={fontSize}
        fontFamily={TEXT_FONT_FAMILY}
        lineHeight={TEXT_LINE_HEIGHT}
        padding={TEXT_PADDING}
        fill={fill}
        wrap="word"
        visible={!editing}
        draggable={draggable}
        onMouseDown={stopBubbleAndSelect}
        onDblClick={() => onStartEdit(id)}
        onDblTap={() => onStartEdit(id)}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
      />
      {selected && !editing && (
        <Rect
          name={NOT_EXPORTED}
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          stroke={SELECTION_COLOR}
          dash={[2, 2]}
          listening={false}
        />
      )}
    </Group>
  );
}
