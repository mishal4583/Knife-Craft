import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import { formatUsd } from "@/game/money";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { restaurantAttention, type AttentionRow } from "@/game/restaurant/restaurantAttention";
import { openMarketIngredients, openMarketSupplies } from "../marketFocus";

/** Rows shown before "View all". */
const SHOWN = 4;

/**
 * ⚠️ NEEDS ATTENTION for the whole restaurant (Unified Restaurant,
 * RESTAURANT_MODE only) at the top of Inventory: ingredients, supplies,
 * tableware, packaging, cleaning bottles, fridge space and staff, most
 * urgent first, each with where to fix it — plus what the next service's
 * check would ask to buy. Read-only (`restaurantAttention`); every action
 * only navigates (Market, Equipment, Staff).
 */
export function RestaurantAttentionPanel({
  save,
  go,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
}) {
  const [all, setAll] = useState(false);
  const a = restaurantAttention(save);
  if (a.rows.length === 0)
    return (
      <p
        className="rounded-[16px] border border-olive/30 bg-olive/10 px-3 py-2 font-ui text-[14.5px] font-bold text-walnut-dark"
        data-testid="restaurant-attention-clear"
      >
        ✓ Everything is stocked{a.nextLevel ? ` for Level ${a.nextLevel}` : ""}.
      </p>
    );
  const rows = all ? a.rows : a.rows.slice(0, SHOWN);
  function act(row: AttentionRow) {
    const t = row.action;
    if (t.to === "ingredient") openMarketIngredients(go, t.id, t.quantity);
    else if (t.to === "supply")
      openMarketSupplies(go, getSupplyItem(t.id)?.section ?? "packaging", t.id);
    else if (t.to === "fridge") go("business-refrigerator");
    else go("business-staff");
  }
  return (
    <section
      className="rounded-[20px] border-2 border-tomato/40 bg-[linear-gradient(170deg,var(--color-ivory),rgba(200,80,60,0.08))] p-3"
      data-testid="restaurant-attention"
    >
      <p className="font-display text-[18px] font-black text-walnut-dark">⚠️ NEEDS ATTENTION</p>
      {a.nextLevel && a.recommendedCost > 0 ? (
        <p className="font-ui text-[13.5px] text-walnut/70" data-testid="restaurant-recommended">
          Recommended restock for Level {a.nextLevel}: {formatUsd(a.recommendedCost)} at Market
          prices.
        </p>
      ) : null}
      <ul className="mt-1 divide-y divide-walnut/10">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex min-h-12 items-center gap-2 py-1.5"
            data-attention={row.id}
            data-attention-severity={row.severity}
          >
            <span aria-hidden className="text-[17px]">
              {row.severity === "urgent" ? "⛔" : "🟠"}
            </span>
            <p
              className={cn(
                "min-w-0 flex-1 font-ui text-[14.5px] font-bold leading-snug",
                row.severity === "urgent" ? "text-tomato" : "text-walnut-dark",
              )}
            >
              {row.text}
              <span className="sr-only">{row.severity === "urgent" ? " (urgent)" : " (low)"}</span>
            </p>
            <button
              type="button"
              onClick={() => act(row)}
              className="press min-h-12 shrink-0 rounded-full border border-walnut-dark/30 bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] px-3 font-ui text-[13.5px] font-extrabold text-ivory"
            >
              {row.action.to === "staff"
                ? "Hire →"
                : row.action.to === "fridge"
                  ? "Fridge →"
                  : "Restock →"}
            </button>
          </li>
        ))}
      </ul>
      {a.rows.length > SHOWN ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="press mt-1 min-h-12 w-full rounded-full font-ui text-[14.5px] font-extrabold text-copper"
        >
          {all ? "Show less" : `View all ${a.rows.length}`}
        </button>
      ) : null}
    </section>
  );
}
