import { CHAOS, type ChaosEventId } from "./kitchenChaos";
import { VARIANTS, withArticle, type VariantId } from "./specialVariants";
import type { InspectionReport } from "./business/businessInspection";

/**
 * The Knife Report's lines for an order's Kitchen Chaos event and special
 * variant (Phase 3, C/D) — pure, so the words are tested. Every line is
 * acknowledgement only: no event or variant pays, unlocks or saves
 * anything, so no line ever mentions money.
 */
export type SpecialsLine = { id: string; text: string; good: boolean };

export function specialsReportLines(input: {
  chaos: ChaosEventId | null;
  variant: VariantId | null;
  /** Grandma's Challenge: the best combo this run reached. */
  grandmaBest: number;
  /** The run's Evenness (the plating judge reads it). */
  evenness: number;
  /** The avalanche: how many of how many were sliced (null if it never landed). */
  avalanche: { sliced: number; total: number } | null;
  /** The live inspection, read when the report opens (null when there is none). */
  inspection: InspectionReport | null;
}): SpecialsLine[] {
  const lines: SpecialsLine[] = [];
  if (input.variant)
    lines.push({
      id: "variant",
      text: `✨ Made with ${withArticle(VARIANTS[input.variant].name)}`,
      good: true,
    });
  switch (input.chaos) {
    case "giant":
      lines.push({ id: "giant", text: "🍅 Giant Ingredient — cut down to size!", good: true });
      break;
    case "avalanche": {
      const a = input.avalanche;
      if (a)
        lines.push({
          id: "avalanche",
          text:
            a.sliced >= a.total
              ? `🥕 Avalanche cleared — all ${a.total} sliced!`
              : `🥕 Avalanche: ${a.sliced} of ${a.total} sliced`,
          good: a.sliced >= a.total,
        });
      break;
    }
    case "rush-hour":
      lines.push({ id: "rush-hour", text: "⏱️ Rush Hour — the plate went out fast!", good: true });
      break;
    case "grandma":
      lines.push(
        input.grandmaBest >= CHAOS.GRANDMA_COMBO
          ? {
              id: "grandma",
              text: `👵 Grandma's Challenge: Clean ×${CHAOS.GRANDMA_COMBO} — she's proud!`,
              good: true,
            }
          : {
              id: "grandma",
              text: `👵 Grandma's Challenge: best ×${input.grandmaBest} of ×${CHAOS.GRANDMA_COMBO} — next time!`,
              good: false,
            },
      );
      break;
    case "perfect-plating":
      lines.push(
        input.evenness >= CHAOS.PERFECT_PLATING_EVENNESS
          ? {
              id: "perfect-plating",
              text: `🍽️ Perfect Plating! Evenness ${input.evenness}`,
              good: true,
            }
          : {
              id: "perfect-plating",
              text: `🍽️ Plating judge: Evenness ${input.evenness} — ${CHAOS.PERFECT_PLATING_EVENNESS} for the stamp`,
              good: false,
            },
      );
      break;
    case "inspection": {
      const r = input.inspection;
      if (!r) break;
      const first = r.categories.find((c) => c.result !== "PASS");
      lines.push(
        r.overall === "PASS" || !first
          ? { id: "inspection", text: "📋 Inspection: all clear — spotless!", good: true }
          : { id: "inspection", text: `📋 Inspector's note: ${first.reason}`, good: false },
      );
      break;
    }
    default:
      break;
  }
  return lines;
}
