import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/money";
import { INGREDIENTS } from "@/game/definitions";
import {
  SUPPLIER_EXAMPLE_INGREDIENT,
  supplierChoices,
} from "@/game/restaurant/restaurantBackOffice";

const ICON: Record<string, string> = {
  "local-market": "🏪",
  "wholesale-supplier": "🚚",
  "premium-supplier": "🧺",
};

function change(fraction: number): string {
  const v = Math.round(fraction * 100);
  return v === 0 ? "Standard prices" : `${v > 0 ? "+" : "−"}${Math.abs(v)}% on ingredients`;
}

/**
 * Unified Restaurant phase 7 (restaurant build): the ingredient supplier on
 * Restaurant → Suppliers. The same free selection the Market's Campaign
 * Supplier tab made (App.selectSupplier → SupplierManager); it sets every
 * Market ingredient price (restaurantBackOffice.supplierChoices, priced by
 * the Market's own quote). Contracts stay below it, unchanged.
 */
export function IngredientSupplier({
  save,
  selectSupplier,
}: {
  save: SaveData;
  selectSupplier: (id: string) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const choices = supplierChoices(save);
  const example = INGREDIENTS[SUPPLIER_EXAMPLE_INGREDIENT].name;
  return (
    <div data-testid="ingredient-supplier">
      <Panel className="p-4">
        <Eyebrow>🚚 Your ingredient supplier</Eyebrow>
        <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/70">
          Who stocks the Market for you. It sets the price of every ingredient you buy — free to
          switch any time.
        </p>
        {message ? (
          <p className="mt-2 text-center font-hand text-[17px] text-copper">{message}</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {choices.map((c) => (
            <div
              key={c.id}
              data-supplier={c.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-[16px] border p-3 card-warm",
                c.current ? "border-olive/50" : "border-walnut/15",
              )}
            >
              <span className="text-[30px] leading-none" aria-hidden>
                {ICON[c.id] ?? "🚚"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[17px] font-black leading-tight text-walnut-dark">
                  {c.name}
                </p>
                <p className="font-hand text-[15px] leading-tight text-walnut/65">
                  {change(c.priceChange)} · {example} {formatUsd(c.exampleUnitCost)} a unit
                </p>
                {c.freshnessBonusDays > 0 || c.qualityBonusPct > 0 ? (
                  <p
                    className="font-ui text-[12.5px] font-bold text-olive"
                    data-testid="supplier-extras"
                  >
                    {[
                      c.freshnessBonusDays > 0
                        ? `stays fresh ${c.freshnessBonusDays} day${c.freshnessBonusDays === 1 ? "" : "s"} longer`
                        : null,
                      c.qualityBonusPct > 0 ? "a small quality bonus" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              {c.current ? (
                <Badge tone="sage">Current</Badge>
              ) : (
                <KButton
                  size="md"
                  variant="cream"
                  onClick={() => {
                    selectSupplier(c.id);
                    setMessage(`${c.name} now stocks your Market.`);
                  }}
                >
                  Choose
                </KButton>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
