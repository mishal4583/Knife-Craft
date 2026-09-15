import { Toast } from "../modals";
import type { QualityLabel } from "@/types/game";

/** Matches the Phase 1 grade ladder's tone — the lowest result is a direction, never a verdict. */
const ENCOURAGEMENT: Record<QualityLabel, string> = {
  Masterful: "Masterful. Effortless.",
  Clean: "Clean cut.",
  Honest: "Honest work.",
  Rustic: "Rustic, and still lovely.",
  Learning: "A direction, not a verdict.",
};

/** Transient in-play feedback after each cut. Never punishing. */
export function CutResultPanel({ quality }: { quality: QualityLabel | null }) {
  if (!quality) return null;
  return (
    <Toast
      message={ENCOURAGEMENT[quality]}
      tone={quality === "Learning" || quality === "Rustic" ? "copper" : "sage"}
    />
  );
}
