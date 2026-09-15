import { Toast } from "../modals";
import type { QualityLabel } from "@/types/game";

const ENCOURAGEMENT: Record<QualityLabel, string> = {
  Perfect: "Perfect. Effortless.",
  Beautiful: "Beautiful cut.",
  Nice: "Nice rhythm.",
  Good: "Good, keep going.",
  Almost: "Almost there — steady hand.",
};

/** Transient in-play feedback after each cut. Never punishing. */
export function CutResultPanel({ quality }: { quality: QualityLabel | null }) {
  if (!quality) return null;
  return (
    <Toast
      message={ENCOURAGEMENT[quality]}
      tone={quality === "Almost" || quality === "Good" ? "copper" : "sage"}
    />
  );
}