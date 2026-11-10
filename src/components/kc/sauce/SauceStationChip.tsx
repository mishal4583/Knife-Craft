import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import {
  SAUCE_AD_ROUNDS,
  canOfferRoundsAd,
  roundsAllowed,
  masteredCount,
  roundsLeft,
  SAUCES,
} from "@/game/business/sauceStation";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { ScreenId } from "../data";

/**
 * "🥣 Sauce Station · 3" (developer 2026-11-08): the entry to the Sauce Station mini-game (business/sauceStation.ts), beside the other kitchen games in the
 * Market's Ingredients tab and above the Inventory fridge from Level 7, while today's three rounds are not used up. The number is the rounds left; the
 * shelf count shows how many sauces are mastered. A small chip, never a popup; nothing waits on it.
 */
export function SauceStationChip({
  save,
  go,
  className,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
  className?: string;
}) {
  const level = restaurantLevelOf(save.levelProgress);
  const left = roundsLeft(save, level);
  const m = masteredCount(save);
  // The free rounds are used: the chip stays once a day with the ad offer (developer 2026-11-10); the ad itself is asked inside the game.
  if (left <= 0 && canOfferRoundsAd(save, level))
    return (
      <button
        type="button"
        data-testid="sauce-station-chip"
        data-offer="ad"
        onClick={() => go("sauce-station")}
        className={cn(
          "press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#b4552f] bg-[linear-gradient(170deg,#fbdcc9,#eeb08f)] px-4 font-ui text-[14px] font-extrabold text-walnut-dark shadow-soft",
          className,
        )}
      >
        <span aria-hidden>🥣</span> Sauce Station · ▶ {SAUCE_AD_ROUNDS} more rounds
      </button>
    );
  if (left <= 0) return null;
  return (
    <button
      type="button"
      data-testid="sauce-station-chip"
      onClick={() => go("sauce-station")}
      className={cn(
        "press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#b4552f] bg-[linear-gradient(170deg,#fbdcc9,#eeb08f)] px-4 font-ui text-[14px] font-extrabold text-walnut-dark shadow-soft",
        className,
      )}
    >
      <span aria-hidden>🥣</span> Sauce Station · {left}/{roundsAllowed(save)}
      {m > 0 ? (
        <span className="text-[12px] font-bold text-walnut/70">
          · 🍾 {m}/{SAUCES.length}
        </span>
      ) : null}
    </button>
  );
}
