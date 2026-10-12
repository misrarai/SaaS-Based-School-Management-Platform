import { tileColors } from "../../../theme";

/** Accent colour per grade band, shared by every academics screen. */
export const BAND_COLORS = {
  primary: tileColors.blue,
  middle: tileColors.purple,
  secondary: tileColors.teal,
} as const;

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
