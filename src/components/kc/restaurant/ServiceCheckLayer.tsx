import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "@/components/kc/data";
import { getLevel } from "@/game/levels/LevelManager";
import { servicePlanFor } from "@/game/restaurant/preServiceCheck";
import { pantryForMissing } from "@/game/restaurant/campaignStock";
import { grandmasSpares } from "@/game/restaurant/serviceSupplies";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { fridgeUsage } from "@/game/restaurant/fridgeUsage";
import { isSystemLive } from "@/game/restaurant/restaurantProgression";
import { openMarketIngredients, openMarketSupplies } from "@/components/kc/marketFocus";
import { PreServiceCheck } from "./PreServiceCheck";

/**
 * Where the open Pre-Service Check shows (Unified Restaurant, behind
 * RESTAURANT_MODE): over the Order Board / Kitchen it is the sheet; while
 * the player restocks in the Market it shrinks to a "Back to the check"
 * pill, so buying and returning is one tap each way. Everything is read
 * from the save on every render, so a purchase or a throw-out updates it
 * at once. When the level opens a new day, the sheet is the opening card
 * and START opens the restaurant (`onStart(true)`).
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
  /** `opensDay`: this start opens the restaurant day. */
  onStart: (opensDay: boolean) => void;
  onClose: () => void;
  onThrowOutExpired: () => void;
  onUsePantry: (next: SaveData) => void;
}) {
  const level = getLevel(levelId);
  const plan = level ? servicePlanFor(save, level) : null;
  if (!plan) return null;
  const n = plan.levelNumber;
  const check = plan.check;

  if (
    screen === "shop" ||
    screen === "shop-ingredients" ||
    screen === "shop-supplies" ||
    screen === "business-staff"
  ) {
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
      day={plan.day}
      credits={save.credits}
      tickets={plan.tickets}
      check={check}
      opening={plan.opening}
      onStart={() => onStart(!!plan.opening)}
      onRestock={(id) =>
        openMarketIngredients(
          go,
          id,
          check.applies
            ? check.missingRows.find((r) => r.ingredientId === id)?.buyUnits
            : undefined,
        )
      }
      onThrowOutExpired={onThrowOutExpired}
      onUsePantry={() => {
        const next = pantryForMissing(save, check);
        if (next) onUsePantry(next);
      }}
      onUpgradeFridge={() => go("business-refrigerator")}
      onClose={onClose}
      services={plan.services}
      supplies={plan.supplies}
      onRestockSupply={(id) =>
        openMarketSupplies(go, getSupplyItem(id)?.section ?? "packaging", id)
      }
      news={plan.news}
      welcome={plan.welcome}
      staff={plan.staff}
      onHireStaff={() => go("business-staff")}
      fridge={isSystemLive("fridge-freshness", n) ? fridgeUsage(save) : null}
      onBorrowSpares={() => {
        const next = grandmasSpares(save, plan.supplies);
        if (next) onUsePantry(next);
      }}
    />
  );
}
