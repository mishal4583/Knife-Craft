import { useState } from "react";
import { useLandscape } from "@/components/kc/game/layoutMode";

/**
 * A mini-game that is drawn on one fixed upright stage (Unload the Van, Dessert Run) shrinks to a strip about 220 px wide on a phone on
 * its side, with text of 4-7 px (developer 2026-11-18: "turn your phone upright" card with a "Play anyway" button, instead of a landscape
 * redesign). `useTurnUpright()` says whether the game is held; `<TurnUprightCard>` covers the game while it is. "Play anyway" lets the
 * player carry on for the rest of the visit; turning the phone upright removes the card by itself.
 */
export function useTurnUpright(): { held: boolean; playAnyway: () => void } {
  const landscape = useLandscape();
  const [anyway, setAnyway] = useState(false);
  return { held: landscape && !anyway, playAnyway: () => setAnyway(true) };
}
