"use client";

import { useEffect, useState, useSyncExternalStore, type Ref } from "react";
import { Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { CameraStore } from "@/lib/board/camera";
import { boardImageUrl, loadImage } from "@/lib/board/images";

/** The zoom rounded up to a power of two, so zooming swaps in a new copy only at a few steps. */
function zoomStep(scale: number): number {
  return 2 ** Math.ceil(Math.log2(scale));
}

interface BoardImageProps {
  ref: Ref<Konva.Image>;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  draggable: boolean;
  cameraStore: CameraStore;
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
}

/**
 * An uploaded picture on the board, fetched through Next's image optimiser at
 * the size it's drawn: a small copy when zoomed out, a sharper one as you zoom
 * in. Until the first copy arrives, a dashed box holds its place and can
 * already be selected and moved.
 */
export function BoardImage({
  imageId,
  width,
  cameraStore,
  ...node
}: BoardImageProps) {
  const zoom = useSyncExternalStore(
    cameraStore.subscribe,
    () => zoomStep(cameraStore.get().scale),
    () => 1,
  );
  const url = boardImageUrl(imageId, width * zoom);
  // Kept while a sharper copy loads, so zooming never blanks the picture.
  const [shown, setShown] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let current = true;
    loadImage(url).then(
      (image) => {
        if (current) setShown(image);
      },
      () => {
        // Keeps whatever is shown: the placeholder, or the last copy.
      },
    );
    return () => {
      current = false;
    };
  }, [url]);

  return (
    <KonvaImage
      {...node}
      width={width}
      image={shown ?? undefined}
      fill={shown ? undefined : "#f1f5f9"}
      stroke={shown ? undefined : "#94a3b8"}
      strokeWidth={1}
      dash={[4, 4]}
    />
  );
}
