import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import { formatUsd } from "@/game/money";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { restaurantAttention, type AttentionRow } from "@/game/restaurant/restaurantAttention";
import { openMarketIngredients, openMarketSupplies } from "../marketFocus";
import { ItemTile } from "./ItemTile";

/** Tiles shown before "View all" (two rows of three). */
const SHOWN = 6;

const ACTION: Record<AttentionRow["action"]["to"], string> = {
  ingredient: "Restock ›",
  supply: "Restock ›",
  fridge: "Fridge ›",
  staff: "Hire ›",
};

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
        className="rounded-[16px] border border-olive/30 bg-olive/10 px-3 py-2 font-ui text-[13.5px] font-bold text-walnut-dark"
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
  const urgent = a.rows.filter((r) => r.severity === "urgent").length;
  const low = a.rows.length - urgent;
  return (
    <section
      className="rounded-[20px] border-2 border-tomato/40 bg-[linear-gradient(170deg,var(--color-ivory),rgba(200,80,60,0.08))] p-3"
      data-testid="restaurant-attention"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="flex-1 font-display text-[17.5px] font-black text-walnut-dark">
          ⚠️ NEEDS ATTENTION
        </p>
        {urgent > 0 ? (
          <span
            className="rounded-full bg-tomato/12 px-2 py-0.5 font-ui text-[12.5px] font-black text-tomato"
            title={`${urgent} needed to start`}
          >
            ⛔ {urgent}
          </span>
        ) : null}
        {low > 0 ? (
          <span
            className="rounded-full bg-copper/15 px-2 py-0.5 font-ui text-[12.5px] font-black text-copper"
            title={`${low} running low`}
          >
            🟠 {low}
          </span>
        ) : null}
      </div>
      {a.nextLevel && a.recommendedCost > 0 ? (
        <p
          className="mt-0.5 font-ui text-[12.5px] font-bold text-walnut/70"
          data-testid="restaurant-recommended"
          title={`Recommended restock for Level ${a.nextLevel} at Market prices`}
        >
          🛒 Lv {a.nextLevel} restock · {formatUsd(a.recommendedCost)}
        </p>
      ) : null}
      {/* Pictures of what's short (developer 2026-10-23); tap a tile to fix it. */}
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="min-w-0"
            data-attention={row.id}
            data-attention-severity={row.severity}
          >
            <ItemTile
              icon={row.icon}
              name={row.name}
              amount={row.amount}
              tone={row.severity}
              badge={row.severity === "urgent" ? "⛔" : "🟠"}
              action={ACTION[row.action.to]}
              label={`${row.text}${row.severity === "urgent" ? " (urgent)" : " (low)"}. ${ACTION[row.action.to]}`}
              onClick={() => act(row)}
            >
              <span className="sr-only">
                {row.text}
                {row.severity === "urgent" ? " (urgent)" : " (low)"}
              </span>
            </ItemTile>
          </li>
        ))}
      </ul>
      {a.rows.length > SHOWN ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="press mt-1 min-h-12 w-full rounded-full font-ui text-[13.5px] font-extrabold text-copper"
        >
          {all ? "Show less" : `View all ${a.rows.length}`}
        </button>
      ) : null}
    </section>
  );
}
