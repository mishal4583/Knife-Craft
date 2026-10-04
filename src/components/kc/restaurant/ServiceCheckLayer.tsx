import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "@/components/kc/data";
import { getLevel } from "@/game/levels/LevelManager";
import { serviceCheckFor } from "@/game/restaurant/preServiceCheck";
import { pantryForMissing } from "@/game/restaurant/campaignStock";
import { openMarketIngredients } from "@/components/kc/marketFocus";
import { PreServiceCheck } from "./PreServiceCheck";

/**
 * Where the open Pre-Service Check shows (Unified Restaurant, behind
 * RESTAURANT_MODE): over the Order Board / Kitchen it is the sheet; while
 * the player restocks in the Market it shrinks to a "Back to the check"
 * pill, so buying and returning is one tap each way. Everything is read
 * from the save on every render, so a purchase or a throw-out updates it
 * at once.
 */
export function ServiceCheckLayer({
  save,
  levelId,
  screen,
  go,
  onStart,
  onClose,
  onThrowOutExpired,
  onUsePantry,
}: {
  save: SaveData;
  levelId: string;
  screen: ScreenId;
  go: (s: ScreenId) => void;
  onStart: () => void;
  onClose: () => void;
  onThrowOutExpired: () => void;
  onUsePantry: (next: SaveData) => void;
}) {
  const level = getLevel(levelId);
  const pending = level ? serviceCheckFor(save, level) : null;
  if (!pending) return null;
  const n = pending.levelNumber;

  if (screen === "shop" || screen === "shop-ingredients") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[84px] z-40 flex justify-center px-4">
        <button
          type="button"
          data-testid="psc-back"
          onClick={() => go("board")}
          className="press pointer-events-auto min-h-12 rounded-full border border-walnut-dark/40 bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] px-5 font-ui text-[14px] font-extrabold text-ivory shadow-lift"
        >
          ↩ Back to Level {n} Pre-Service Check
        </button>
      </div>
    );
  }
  if (screen !== "board" && screen !== "kitchen") return null;

  return (
    <PreServiceCheck
      levelNumber={n}
      day={save.business.calendar.businessDay}
      credits={save.credits}
      tickets={pending.tickets}
      check={pending.check}
      onStart={onStart}
      onRestock={(id) =>
        openMarketIngredients(
          go,
          id,
          pending.check.missingRows.find((r) => r.ingredientId === id)?.buyUnits,
        )
      }
      onThrowOutExpired={onThrowOutExpired}
      onUsePantry={() => {
        const next = pantryForMissing(save, pending.check);
        if (next) onUsePantry(next);
      }}
      onUpgradeFridge={() => go("business-refrigerator")}
      onClose={onClose}
    />
  );
}
