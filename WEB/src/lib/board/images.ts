import { getImageProps } from "next/image";
import type { Size } from "@/types/board";

/** What the Image tool accepts: the formats Next's image optimiser resizes. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
/** The API's upload limit, checked here too so a big file fails before uploading. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Where an upload is served on this app's own origin; next.config.ts forwards it to the API. */
export function boardImageSrc(imageId: string): string {
  return `/board-images/${encodeURIComponent(imageId)}`;
}

/**
 * The URL of an uploaded image as resized by Next's image optimiser, for
 * drawing `cssWidth` pixels wide on this screen. `getImageProps` lists every
 * width the optimiser offers, like the srcset of an <Image>; on a canvas there
 * is no <img> for the browser to choose with, so this picks the smallest that
 * is still sharp at this screen's pixel density.
 */
export function boardImageUrl(imageId: string, cssWidth: number): string {
  const width = Math.max(1, Math.ceil(cssWidth));
  const { props } = getImageProps({
    src: boardImageSrc(imageId),
    alt: "",
    fill: true,
    sizes: `${width}px`,
  });
  const needed = width * window.devicePixelRatio;
  const candidates = (props.srcSet ?? "").split(", ").map((candidate) => {
    const [url, descriptor] = candidate.split(" ");
    return { url, width: Number.parseInt(descriptor, 10) };
  });
  const best = candidates.find((c) => c.width >= needed) ?? candidates.at(-1);
  return best?.url ?? props.src;
}

const loading = new Map<string, Promise<HTMLImageElement>>();

/**
 * Fetches and decodes each URL once, so elements showing the same picture
 * share it, and a big image is decoded before its first frame rather than
 * during it. A failed load is forgotten, so it can be retried.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = loading.get(url);
  if (!pending) {
    const image = new window.Image();
    image.src = url;
    pending = image.decode().then(() => image);
    pending.catch(() => loading.delete(url));
    loading.set(url, pending);
  }
  return pending;
}

/** The picture's own pixel size. Rejects if the browser can't decode the file as an image. */
export async function readImageSize(file: File): Promise<Size> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
