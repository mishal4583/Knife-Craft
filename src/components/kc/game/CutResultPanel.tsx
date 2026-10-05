import { Toast } from "../modals";
import type { QualityLabel } from "@/types/game";
import { ENCOURAGEMENT } from "@/game/qualityCopy";

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
