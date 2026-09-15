export type GradeBand = "primary" | "middle" | "secondary";

export function gradeBand(levelOrder: number): GradeBand {
  if (levelOrder <= 5) return "primary";
  if (levelOrder <= 8) return "middle";
  return "secondary";
}

export const GRADE_BAND_LABELS: Record<GradeBand, string> = {
  primary: "Primary (1-5)",
  middle: "Middle (6-8)",
  secondary: "Secondary (9-10)",
};
