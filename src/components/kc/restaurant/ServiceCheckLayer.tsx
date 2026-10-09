import type { SaveData } from "@/game/SaveManager";
import { openStaffFor } from "../staffFocus";
import type { ScreenId } from "@/components/kc/data";
import { getLevel } from "@/game/levels/LevelManager";
import { dayStockFor, servicePlanFor } from "@/game/restaurant/preServiceCheck";
import { pantryForMissing } from "@/game/restaurant/campaignStock";
import { grandmasSpares } from "@/game/restaurant/serviceSupplies";
import { markEmergencyService } from "@/game/restaurant/emergencyService";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { fridgeUsage } from "@/game/restaurant/fridgeUsage";
import { isSystemLive } from "@/game/restaurant/restaurantProgression";
import { dayCeremonyAt } from "@/game/restaurant/firstLevels";
import {
  openMarketIngredients,
  openMarketPlan,
  openMarketSupplies,
} from "@/components/kc/marketFocus";
import { PreServiceCheck } from "./PreServiceCheck";
import { hasBoughtIngredients } from "@/game/restaurant/firstRestock";
import { measureOf } from "@/game/business/measure";
import {
  quickRestock,
  quickRestockPlan,
  type QuickRestockLine,
} from "@/game/restaurant/quickRestock";

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
  onQuickRestock,
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
  /** Quick restock bought: App records one ledger entry per ingredient and saves. */
  onQuickRestock: (next: SaveData, lines: readonly QuickRestockLine[]) => void;
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
          className="press pointer-events-auto min-h-12 rounded-full border border-walnut-dark/40 bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] px-5 font-ui text-[14.5px] font-extrabold text-ivory shadow-lift"
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
      // Before Level 21 a new day opens without its card (firstLevels.ts).
      opening={dayCeremonyAt(n) ? plan.opening : null}
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
        // Final economy pass: the service now runs on emergency goods (no quality bonus).
        if (next) onUsePantry(markEmergencyService(next, plan.level.id));
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
      guests={plan.guests}
      onRestockGuest={(id, units) => openMarketIngredients(go, id, units)}
      dayStock={dayStockFor(save, plan.level)}
      onRestockDay={(id, units) => openMarketIngredients(go, id, units)}
      staff={plan.staff}
      onHireStaff={() =>
        openStaffFor(
          go,
          plan.staff.filter((r) => !r.met).map((r) => r.id),
        )
      }
      fridge={isSystemLive("fridge-freshness", n) ? fridgeUsage(save) : null}
      measure={measureOf(save)}
      grandmasFridge={plan.grandmasFridge}
      onRestockFridge={(id, units) => openMarketIngredients(go, id, units)}
      onBuyAllInMarket={() => openMarketPlan(go)}
      firstRestock={!hasBoughtIngredients(save)}
      quickRestock={quickRestockPlan(save, check)}
      onQuickRestock={() => {
        const r = quickRestock(save, check);
        if (r.ok) onQuickRestock(r.save, r.lines);
      }}
      onBorrowSpares={() => {
        const next = grandmasSpares(save, plan.supplies);
        if (next) onUsePantry(markEmergencyService(next, plan.level.id));
      }}
    />
  );
}
