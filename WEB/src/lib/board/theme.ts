import type { ParticipantThemeColor } from "@/lib/types/dto/ParticipantThemeColors";

export interface ThemeSwatch {
  /** Fill for someone's cursor, name tag, avatar and follow border. */
  background: string;
  /** Text drawn on `background`. */
  text: string;
}

/**
 * Picked per colour for contrast. The dark theme colours take white text; on
 * the light ones (green, orange, yellow) white would all but vanish, so they
 * take a deep shade of their own hue instead.
 */
const SWATCHES: Record<ParticipantThemeColor, ThemeSwatch> = {
  blue: { background: "#2563eb", text: "#ffffff" },
  green: { background: "#4ade80", text: "#052e16" },
  orange: { background: "#fb923c", text: "#431407" },
  purple: { background: "#9333ea", text: "#ffffff" },
  red: { background: "#dc2626", text: "#ffffff" },
  yellow: { background: "#facc15", text: "#422006" },
};

export function themeSwatch(themeColor: string): ThemeSwatch {
  return (
    (SWATCHES as Record<string, ThemeSwatch | undefined>)[themeColor] ??
    SWATCHES.blue
  );
}

/** Placeholder avatar content until the per-animal icons arrive. */
export function initialOf(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "?";
}
