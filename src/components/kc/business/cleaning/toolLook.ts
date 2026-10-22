import type { CleaningToolId } from "@/game/restaurant/cleaningDirt";

/** Each cleaning tool's name, and its emoji where Unicode has one (CleaningToolIcon draws the rest). */
export const TOOL_LOOK: Record<CleaningToolId, { name: string; emoji?: string }> = {
  sponge: { name: "Sponge", emoji: "🧽" },
  cloth: { name: "Spray & cloth" },
  broom: { name: "Broom", emoji: "🧹" },
  scraper: { name: "Grill scraper" },
  mop: { name: "Mop" },
  "toilet-brush": { name: "Toilet brush" },
  "glass-cloth": { name: "Squeegee" },
};
