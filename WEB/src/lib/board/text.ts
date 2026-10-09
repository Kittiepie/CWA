import Konva from "konva";
import type { Size } from "@/types/board";

/**
 * Font settings shared by the three places text has to agree: the Konva node
 * that renders it, the measurements that decide how small its box may get,
 * and the HTML textarea overlaid while editing. They must stay identical or
 * the text visibly shifts the moment editing starts or ends.
 */
export const TEXT_FONT_FAMILY = "Arial, sans-serif";
export const TEXT_LINE_HEIGHT = 1.2;
export const TEXT_PADDING = 4;

/** Floor for an empty box, which has no text to derive a width from. */
const MIN_BOX_WIDTH = 40;

/** Konva accepts "auto" for height at runtime; its TS types only admit numbers. */
function setHeightAuto(node: Konva.Text): void {
  (node.height as unknown as (value: string) => void).call(node, "auto");
}

/**
 * A detached node used purely to measure. Measuring means setting a width and
 * reading back the height Konva's own word wrap produces — doing that on the
 * live node would mutate it mid-render, and one caller (the Transformer's
 * boundBoxFunc) runs inside Konva's own layout pass, where that is asking for
 * trouble. Created lazily so importing this module never touches the DOM.
 */
let probe: Konva.Text | null = null;

function probeFor(node: Konva.Text, width: number, text: string): Konva.Text {
  probe ??= new Konva.Text({});
  probe.setAttrs({
    text,
    fontSize: node.fontSize(),
    fontFamily: node.fontFamily(),
    fontStyle: node.fontStyle(),
    lineHeight: node.lineHeight(),
    padding: node.padding(),
    wrap: node.wrap(),
    width,
  });
  setHeightAuto(probe);
  return probe;
}

/**
 * Height the text needs when wrapped at `width`. Pass `text` to measure
 * content the node doesn't carry yet — what's just been typed, say.
 */
export function textHeightAtWidth(
  node: Konva.Text,
  width: number,
  text: string = node.text(),
): number {
  return probeFor(node, width, text).height();
}

/**
 * Smallest box that still shows every glyph: wide enough for the longest
 * single word (narrower than that and the word would be clipped, since word
 * wrap can't break inside a word) and tall enough for the wrap at that width.
 */
export function minTextBoxSize(node: Konva.Text): Size {
  const measurer = probeFor(node, node.width(), node.text());
  const words = node.text().split(/\s+/).filter(Boolean);

  let width = MIN_BOX_WIDTH;
  for (const word of words) {
    width = Math.max(
      width,
      measurer.measureSize(word).width + TEXT_PADDING * 2,
    );
  }

  return { width, height: textHeightAtWidth(node, width) };
}
