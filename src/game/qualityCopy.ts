import type { QualityLabel } from "@/types/game";

/** Matches the Phase 1 grade ladder's tone — the lowest result is a direction, never a verdict. */
export const ENCOURAGEMENT: Record<QualityLabel, string> = {
  Masterful: "Masterful. Effortless.",
  Clean: "Clean cut.",
  Honest: "Honest work.",
  Rustic: "Rustic, and still lovely.",
  Learning: "A direction, not a verdict.",
};
