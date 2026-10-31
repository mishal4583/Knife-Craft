import { MorningDeliveries } from "./Deliveries";
import { ParAuditCard } from "./ParAuditCard";
import {
  TASK_RULES,
  cleanlinessOf,
  isCleanlinessLive,
  type CleanlinessAction,
  type CleanlinessActionResult,
} from "@/game/restaurant/cleanliness";
import { ShiftChecklist } from "./ShiftChecklist";
import { SinkWash } from "./SinkWash";
import type { SaveData } from "@/game/SaveManager";
import { pendingCashTotal } from "@/game/economy/pendingCash";
import { openStaffFor } from "../staffFocus";
import type { ScreenId } from "@/components/kc/data";
import { getLevel } from "@/game/levels/LevelManager";
import { dayStockFor, servicePlanFor } from "@/game/restaurant/preServiceCheck";
import { coverFor, type CoverPart } from "@/game/restaurant/serviceCover";
import { supplierCreditOf } from "@/game/restaurant/supplierCredit";
import type { CoverAdOutcome } from "./CoverActions";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { fridgeUsage } from "@/game/restaurant/fridgeUsage";
import { isSystemLive } from "@/game/restaurant/restaurantProgression";
import { FIRST_INGREDIENT_PURCHASE_LEVEL, dayCeremonyAt } from "@/game/restaurant/firstLevels";
import {
  openMarketIngredients,
  openMarketPlan,
  openMarketSupplies,
} from "@/components/kc/marketFocus";
import { PreServiceCheck } from "./PreServiceCheck";
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
  onQuickRestock,
  onDismissFirstRestock,
  adAvailable,
  onCoverWithAd,
  onCoverWithCredit,
  cleanlinessAction,
  onCollectTableCash,
}: {
  save: SaveData;
  levelId: string;
  screen: ScreenId;
  go: (s: ScreenId) => void;
  /** `opensDay`: this start opens the restaurant day. */
  onStart: (opensDay: boolean) => void;
  onClose: () => void;
  onThrowOutExpired: () => void;
  /** The platform can show a rewarded ad now. */
  adAvailable: boolean;
  /** From Level 3, when the wallet can't pay: an ad brings the missing part (App.coverServiceWithAd). */
  onCoverWithAd: (part: CoverPart) => Promise<CoverAdOutcome>;
  /** …or supplier credit (App.coverServiceWithCredit). */
  onCoverWithCredit: (part: CoverPart) => void;
  /** A real restaurant's day: the opening / lull checklist's actions (App.cleanlinessAction). */
  cleanlinessAction?: (action: CleanlinessAction) => CleanlinessActionResult | null;
  /** Quick restock bought: App records one ledger entry per ingredient and saves. */
  onQuickRestock: (next: SaveData, lines: readonly QuickRestockLine[]) => void;
  onDismissFirstRestock: () => void;
  /** Takes the cash lying on the tables into the wallet (App.collectTableCash). */
  onCollectTableCash?: () => void;
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
          ↩ Back to the Pre-Service Check
        </button>
      </div>
    );
  }
  if (screen !== "board" && screen !== "kitchen") return null;

  const canBuy = n >= FIRST_INGREDIENT_PURCHASE_LEVEL;
  return (
    <PreServiceCheck
      levelNumber={n}
      day={plan.day}
      credits={save.credits}
      tableCash={pendingCashTotal(save)}
      {...(onCollectTableCash ? { onCollectTableCash } : {})}
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
      cover={{
        stock: coverFor(plan, "stock"),
        supplies: coverFor(plan, "supplies"),
        tools: coverFor(plan, "tools"),
      }}
      tools={plan.tools}
      toolsSoon={plan.toolsSoon}
      firstShoppingList={plan.firstShoppingList}
      onBuyTool={(id, packs) => openMarketSupplies(go, "culinary", id, packs)}
      cleaningOpen={
        isCleanlinessLive(n)
          ? cleanlinessOf(save).tasks.filter((t) => !TASK_RULES[t.kind].phase).length
          : 0
      }
      openingChores={plan.opening ? plan.chores : 0}
      chores={
        cleanlinessAction ? (
          <div id="psc-opening-chores" className="space-y-2">
            {plan.opening ? <MorningDeliveries save={save} /> : null}
            {/* Last service's dishes waiting in the sink (the sink game, 2026-10-23). */}
            <SinkWash save={save} go={go} cleanlinessAction={cleanlinessAction} />
            {plan.opening ? (
              <ParAuditCard
                save={save}
                level={n}
                onBuy={(id, packs) =>
                  openMarketSupplies(go, getSupplyItem(id)?.section ?? "service", id, packs)
                }
              />
            ) : null}
            <ShiftChecklist
              save={save}
              phase={plan.opening ? "opening" : "lull"}
              onAction={cleanlinessAction}
              onBuy={(id) => openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id)}
              onOpenCleanliness={() => go("business-cleanliness")}
            />
          </div>
        ) : null
      }
      onOpenCleanliness={() => go("business-cleanliness")}
      adAvailable={adAvailable}
      onCoverWithAd={onCoverWithAd}
      onCoverWithCredit={onCoverWithCredit}
      owed={supplierCreditOf(save).owed}
      canBuy={canBuy}
      onUpgradeFridge={() => go("business-refrigerator")}
      onClose={onClose}
      services={plan.services}
      supplies={plan.supplies}
      onRestockSupply={(id) =>
        openMarketSupplies(
          go,
          getSupplyItem(id)?.section ?? "packaging",
          id,
          plan.supplies.applies ? plan.supplies.rows.find((r) => r.id === id)?.packs : undefined,
        )
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
      onRestockFridge={(id, units) => openMarketIngredients(go, id, units)}
      onBuyAllInMarket={() => openMarketPlan(go)}
      firstRestock={plan.firstStockService && !save.business.firstStockCheckSeen}
      onDismissFirstRestock={onDismissFirstRestock}
      quickRestock={quickRestockPlan(save, check)}
      onQuickRestock={() => {
        const r = quickRestock(save, check);
        if (r.ok) onQuickRestock(r.save, r.lines);
      }}
    />
  );
}
