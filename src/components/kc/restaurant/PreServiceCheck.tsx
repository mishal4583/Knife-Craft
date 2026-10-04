import { KButton } from "@/components/kc/common/primitives";
import { cn } from "@/lib/utils";
import type { RecipeDefinition } from "@/game/recipes/recipeTypes";
import type { IngredientId } from "@/game/definitions";
import { INGREDIENTS } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { formatQuantity } from "@/game/business/businessInventory";
import { purchaseUnitFor } from "@/game/business/businessPricing";
import { formatUsd } from "@/game/money";
import type { ServiceStockCheck, StockRow } from "@/game/restaurant/campaignStock";
import type { DayService } from "@/game/restaurant/restaurantDay";

/**
 * PRE_SERVICE_CHECK (Unified Restaurant spec §6, §24–25) — shown before a
 * campaign service ONLY when something needs attention (missing or
 * expired stock). Everything comes from the save through
 * `serviceStockCheck`; this sheet keeps no state of its own.
 *
 *  - today's orders (the rolled tickets still to serve);
 *  - each ingredient: need / usable, ✓ or what's missing, with RESTOCK →
 *    the Market preselecting that ingredient (Market stays the only place
 *    ingredients are bought);
 *  - expired stock: THROW OUT EXPIRED (recorded as waste, no money);
 *  - what the missing stock costs against the wallet, and fridge space;
 *  - only when the wallet can't cover it: Grandma's pantry (free, the
 *    missing items only, never automatic);
 *  - START SERVICE once everything is ready.
 *
 * Phase 5: it is also the day's OPENING card. When a level opens a new
 * restaurant day it always shows ("Day N · Opening time", the day's services
 * by name and level) and its button opens the restaurant; before Level 11
 * there is no stock to check, so it is only the opening card.
 */
export function PreServiceCheck({
  levelNumber,
  day,
  credits,
  tickets,
  check,
  opening,
  onStart,
  onRestock,
  onThrowOutExpired,
  onUsePantry,
  onUpgradeFridge,
  onClose,
}: {
  levelNumber: number;
  day: number;
  credits: number;
  tickets: readonly RecipeDefinition[];
  check: ServiceStockCheck;
  /** Today's services when this level opens the day; null mid-day. */
  opening: DayService[] | null;
  onStart: () => void;
  onRestock: (ingredientId: IngredientId) => void;
  onThrowOutExpired: () => void;
  onUsePantry: () => void;
  onUpgradeFridge: () => void;
  onClose: () => void;
}) {
  const stock = check.applies ? check : null;
  const fridgeShort = !!stock && stock.storageNeeded > stock.storageFree;
  const canStart =
    !stock || (stock.ready && !stock.rows.some((r) => r.expired > 0 && r.usable < r.needed));
  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center"
      data-testid="pre-service-check"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-walnut-dark/45 backdrop-blur-[2px]"
      />
      <div className="anim-up relative m-3 flex max-h-[calc(100%-24px)] w-[calc(100%-24px)] flex-col rounded-[26px] border border-walnut/20 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] shadow-lift">
        <div className="px-5 pb-2 pt-4">
          <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-walnut/20" />
          <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-walnut/60">
            Day {day} · {opening ? "Opening time" : `Level ${levelNumber}`}
          </p>
          <p className="font-display text-[22px] font-black text-walnut-dark">
            {opening ? `Good morning! Day ${day}` : "Pre-Service Check"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          {opening ? (
            <div
              className="mb-2 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
              data-testid="psc-opening"
            >
              <p className="font-ui text-[12px] font-extrabold uppercase tracking-wide text-walnut/60">
                Today's services
              </p>
              <ul className="mt-1 space-y-0.5">
                {opening.map((s) => (
                  <li key={s.name} className="font-ui text-[14px] font-bold text-walnut-dark">
                    {s.name} · Level {s.levelNumber}
                  </li>
                ))}
              </ul>
              <p className="mt-1 font-ui text-[12px] text-walnut/70">
                After the last service it's closing time: clean up and count the day.
              </p>
            </div>
          ) : null}
          <p className="mt-1 font-ui text-[12px] font-extrabold uppercase tracking-wide text-walnut/60">
            {opening ? `Level ${levelNumber} · today's orders` : "Today's orders"}
          </p>
          <ul className="mt-1 space-y-0.5" data-testid="psc-orders">
            {tickets.map((r, i) => (
              <li key={`${r.id}-${i}`} className="font-ui text-[14px] font-bold text-walnut-dark">
                {r.name}
              </li>
            ))}
          </ul>

          {stock ? (
            <>
              <p className="mt-3 font-ui text-[12px] font-extrabold uppercase tracking-wide text-walnut/60">
                Ingredients
              </p>
              <ul className="mt-1 divide-y divide-walnut/10" data-testid="psc-ingredients">
                {stock.rows.map((row) => (
                  <IngredientRow key={row.ingredientId} row={row} onRestock={onRestock} />
                ))}
              </ul>
            </>
          ) : null}

          {stock?.hasExpired ? (
            <div className="mt-3 rounded-2xl border border-tomato/30 bg-tomato/10 p-3">
              <p className="font-ui text-[13px] font-bold text-walnut-dark">
                Some stock has expired and can't be served.
              </p>
              <KButton
                size="sm"
                variant="ghost"
                className="mt-2 min-h-12"
                onClick={onThrowOutExpired}
              >
                🗑 Throw Out Expired
              </KButton>
            </div>
          ) : null}

          {stock && !stock.ready ? (
            <div
              className="mt-3 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
              data-testid="psc-summary"
            >
              <p className="font-ui text-[13px] font-bold text-walnut-dark">
                Missing: {stock.missingRows.length}{" "}
                {stock.missingRows.length === 1 ? "item" : "items"} · {formatUsd(stock.missingCost)}
              </p>
              <p className="font-ui text-[12px] text-walnut/70">You have {formatUsd(credits)}.</p>
              {!stock.affordable ? (
                <>
                  <p className="mt-1 font-ui text-[13px] font-bold text-tomato">
                    Not enough money — need {formatUsd(stock.missingCost - credits)} more.
                  </p>
                  <KButton size="sm" variant="sage" className="mt-2 min-h-12" onClick={onUsePantry}>
                    🧺 Use Grandma's pantry (free, this service only)
                  </KButton>
                </>
              ) : null}
              {fridgeShort ? (
                <>
                  <p className="mt-1 font-ui text-[13px] font-bold text-tomato">
                    Your refrigerator is full: this needs {stock.storageNeeded} units,{" "}
                    {stock.storageFree} free.
                  </p>
                  <KButton
                    size="sm"
                    variant="ghost"
                    className="mt-2 min-h-12"
                    onClick={onUpgradeFridge}
                  >
                    Manage fridge →
                  </KButton>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-walnut/10 px-5 py-3">
          <KButton variant="ghost" className="min-h-12" onClick={onClose}>
            Back
          </KButton>
          <KButton full className="min-h-12" disabled={!canStart} onClick={onStart}>
            {canStart ? (opening ? "OPEN THE RESTAURANT" : "START SERVICE") : "Restock to start"}
          </KButton>
        </div>
      </div>
    </div>
  );
}

function IngredientRow({
  row,
  onRestock,
}: {
  row: StockRow;
  onRestock: (id: IngredientId) => void;
}) {
  const unit = purchaseUnitFor(row.ingredientId);
  const ok = row.missing === 0;
  return (
    <li
      className="flex min-h-12 items-center gap-2 py-1.5"
      data-psc-ingredient={row.ingredientId}
      data-psc-status={ok ? "ok" : "missing"}
    >
      <span className="text-[20px]" aria-hidden>
        {INGREDIENT_EMOJI[row.ingredientId]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[14px] font-bold text-walnut-dark">
          {INGREDIENTS[row.ingredientId].name}
        </p>
        <p className={cn("font-ui text-[12px]", ok ? "text-walnut/60" : "text-tomato")}>
          Need {formatQuantity(row.needed)} {unit} · have {formatQuantity(row.usable)}
          {row.expired > 0 ? ` (+${formatQuantity(row.expired)} expired)` : ""}
        </p>
      </div>
      {ok ? (
        <span className="font-ui text-[13px] font-extrabold text-sage">✓ Ready</span>
      ) : (
        <KButton
          size="sm"
          variant="copper"
          className="min-h-12"
          onClick={() => onRestock(row.ingredientId)}
        >
          Restock {row.buyUnits} · {formatUsd(row.quote?.totalCost ?? 0)}
        </KButton>
      )}
    </li>
  );
}
