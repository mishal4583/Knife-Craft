import { useEffect, useState } from "react";
import { isPhoneLandscape } from "@/components/kc/game/layoutMode";

/**
 * A mini-game that is drawn on one fixed upright stage (Unload the Van, Dessert Run) shrinks to a strip about 220 px wide on a PHONE on its
 * side, with text of 4-7 px (developer 2026-11-18: "turn your phone upright" card with a "Play anyway" button, instead of a landscape
 * redesign). `useTurnUpright()` says whether the game is held; `<TurnUprightCard>` covers the game while it is. "Play anyway" lets the
 * player carry on for the rest of the visit; turning the phone upright removes the card by itself.
 *
 * Since 2026-11-19 every wide window gets the landscape layout (`fitLayout`), so this asks the REAL window, not the layout: a desktop or tablet window
 * (a screen at least 640 px tall) is big enough for the stage and never sees the card.
 */
export function useTurnUpright(): { held: boolean; playAnyway: () => void } {
  const read = () =>
    typeof window !== "undefined" && isPhoneLandscape(window.innerWidth, window.innerHeight);
  const [phoneOnItsSide, setPhoneOnItsSide] = useState(read);
  const [anyway, setAnyway] = useState(false);
  useEffect(() => {
    const onResize = () => setPhoneOnItsSide(read());
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return { held: phoneOnItsSide && !anyway, playAnyway: () => setAnyway(true) };
}
