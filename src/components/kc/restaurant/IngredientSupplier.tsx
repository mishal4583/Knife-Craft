import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { KButton } from "../common/primitives";
import { Art, PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/money";
import { INGREDIENTS } from "@/game/definitions";
import {
  SUPPLIER_EXAMPLE_INGREDIENT,
  supplierChoices,
} from "@/game/restaurant/restaurantBackOffice";
import { InfoTip } from "@/components/kc/common/InfoTip";

const ICON: Record<string, string> = {
  "local-market": "🏪",
  "wholesale-supplier": "🚚",
  "premium-supplier": "🧺",
};

/** The painted supplier pictures (RB-icons-a). */
const ART: Record<string, string> = {
  "local-market": "biz:icons-a/local-market",
  "wholesale-supplier": "biz:icons-a/wholesale-truck",
  "premium-supplier": "biz:icons-a/premium-basket",
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
      <ProgressCard
        title="Your ingredient supplier"
        icon={<PIcon name="icons-a/storefront" fallback="🚚" size={26} />}
        right={
          <InfoTip label="About suppliers">
            Who stocks the Market for you. It sets the price of every ingredient you buy — free to
            switch any time.
          </InfoTip>
        }
        className="pt-10"
      >
        <Art
          name="biz:decor-a/produce-cluster"
          className="pointer-events-none absolute right-12 top-0 hidden h-16 w-auto @min-[620px]:block"
        />
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-hand text-[16px] leading-snug text-walnut/70">
          <span className="inline-flex items-center gap-1.5">
            <PIcon name="icons-a/coins" fallback="💵" size={24} /> Sets Market prices
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PIcon name="icons-a/cash" fallback="🔁" size={24} /> switch free
          </span>
        </p>
        {message ? (
          <p className="mt-2 text-center font-hand text-[16px] text-copper">{message}</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {choices.map((c) => (
            <div
              key={c.id}
              data-supplier={c.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-[18px] border p-3",
                c.current
                  ? "bz-hot"
                  : "border-[#ebd2a0] bg-[linear-gradient(180deg,#fffaf0,#fcefd6)]",
              )}
            >
              <PIcon
                name={ART[c.id] ?? ART["local-market"]!}
                fallback={ICON[c.id] ?? "🚚"}
                size={56}
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[18px] font-black leading-tight text-walnut-dark">
                  {c.name}
                </p>
                <p className="font-hand text-[15px] leading-tight text-walnut/70">
                  {change(c.priceChange)} · {example} {formatUsd(c.exampleUnitCost)} a unit
                </p>
                {c.freshnessBonusDays > 0 || c.qualityBonusPct > 0 ? (
                  <p
                    className="mt-1 flex flex-wrap gap-1.5 font-ui text-[12px] font-extrabold text-walnut-dark"
                    data-testid="supplier-extras"
                  >
                    {c.freshnessBonusDays > 0 ? (
                      <span className="pg-pill inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                        <PIcon name="biz:icons-a/alarm-clock" fallback="🕒" size={18} />+
                        {c.freshnessBonusDays} day{c.freshnessBonusDays === 1 ? "" : "s"} fresh
                      </span>
                    ) : null}
                    {c.qualityBonusPct > 0 ? (
                      <span className="pg-pill inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                        <PIcon name="icons-a/star" fallback="⭐" size={18} />
                        quality bonus
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              {c.current ? (
                <ValuePill tone="green" className="min-h-10 px-4 uppercase">
                  <PIcon name="icons-c/tick" fallback="✓" size={20} />
                  Current
                </ValuePill>
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
      </ProgressCard>
    </div>
  );
}
