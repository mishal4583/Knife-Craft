import { useState } from "react";
import { Badge, KButton, Panel } from "./common/primitives";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { formatUsd } from "@/game/money";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import {
  SUPPLY_CATALOG,
  SUPPLY_PRICES_RETRIEVED,
  SUPPLY_SECTIONS,
  isConsumableSupply,
  unitLabel,
  type SupplyId,
  type SupplySection,
} from "@/game/business/businessSupplies";
import {
  MAX_SUPPLY_PACKS,
  supplyQuote,
  supplyUnits,
  type PurchaseSupplyResult,
} from "@/game/business/BusinessSuppliesManager";

/** A balance for the card: whole dollars when there are no cents ("$1,332"), else "$1,332.40". */
function balanceText(cents: number): string {
  return formatUsd(cents).replace(/\.00$/, "");
}

/**
 * MARKET · SUPPLIES — one of the three supply sections (smallwares,
 * tableware, takeaway packaging). Every price and verdict comes from
 * `supplyQuote`, the same numbers `purchaseSupply` uses, so the card never
 * promises what the tap won't do. Business → Supplies shows the same saved
 * stock and spending.
 */
export function MarketSupplies({
  save,
  section,
  purchaseSupply,
  setNotice,
}: {
  save: SaveData;
  section: SupplySection;
  purchaseSupply: (supplyId: string, packs: number) => PurchaseSupplyResult;
  setNotice: (text: string) => void;
}) {
  const meta = SUPPLY_SECTIONS[section];
  const [group, setGroup] = useState<string>("All");
  const [packs, setPacks] = useState<Partial<Record<SupplyId, number>>>({});
  const [messages, setMessages] = useState<Partial<Record<SupplyId, string>>>({});
  const supplies = save.business.supplies;
  const items = SUPPLY_CATALOG.filter(
    (item) => item.section === section && (group === "All" || item.group === group),
  );

  function packsFor(id: SupplyId): number {
    return packs[id] ?? 1;
  }

  function step(id: SupplyId, delta: number) {
    setPacks((p) => ({
      ...p,
      [id]: Math.min(MAX_SUPPLY_PACKS, Math.max(1, packsFor(id) + delta)),
    }));
  }

  function handleBuy(id: SupplyId) {
    const item = SUPPLY_CATALOG.find((i) => i.id === id)!;
    const n = packsFor(id);
    const quote = supplyQuote(save, item, n);
    const result = purchaseSupply(id, n);
    if (!result.ok) {
      setMessages((m) => ({
        ...m,
        [id]:
          result.reason === "insufficientFunds"
            ? notEnoughMoneyText(quote.totalCost, save.credits)
            : "That purchase couldn't be made.",
      }));
      return;
    }
    const bought = `Bought ${result.units} ${unitLabel(item, result.units)} · ${formatUsd(result.totalCost)}`;
    setMessages((m) => ({ ...m, [id]: bought }));
    setNotice(`${item.name}: ${bought}. It's in Business → Supplies.`);
  }

  return (
    <div className="space-y-3" data-testid={`market-supplies-${section}`}>
      <Panel className="p-3">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.12em] text-copper">
          {meta.emoji} {meta.kicker}
        </p>
        <p className="mt-1 font-hand text-[14px] leading-snug text-walnut/65">
          {section === "packaging"
            ? "Each Business order goes out in one container and one carry bag while you have them."
            : "Restaurant equipment for your Business kitchen and dining room. It lasts; it's never used up."}{" "}
          Prices are restaurant-supply prices ({SUPPLY_PRICES_RETRIEVED}), less your wholesale
          discount.
        </p>
      </Panel>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4"
        aria-label={`${meta.short} groups`}
      >
        {["All", ...meta.groups].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={cn(
              "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12px] font-extrabold",
              group === g
                ? "wood border-walnut-dark/50 text-ivory"
                : "card-warm border-walnut/15 text-walnut-dark",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const n = packsFor(item.id);
          const quote = supplyQuote(save, item, n);
          const onHand = supplyUnits(supplies, item.id);
          const message = messages[item.id];
          return (
            <article
              key={item.id}
              data-supply={item.id}
              className="product-card flex flex-col rounded-[20px] border border-walnut/15 p-3 card-warm"
            >
              <div className="flex items-start justify-between">
                <span className="text-[30px] leading-none" aria-hidden>
                  {item.icon}
                </span>
                {onHand > 0 ? (
                  <Badge tone="sage">
                    {onHand.toLocaleString("en-US")} {isConsumableSupply(item) ? "left" : "owned"}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 font-display text-[14px] font-black leading-tight text-walnut-dark">
                {item.name}
              </p>
              <p className="font-ui text-[12px] font-extrabold text-copper">
                {formatUsd(quote.packPrice)}
                <span className="font-bold text-walnut/60">
                  {" "}
                  / {item.packSize === 1 ? unitLabel(item, 1) : `pack of ${item.packSize}`}
                </span>
              </p>
              <p className="font-hand text-[13px] leading-tight text-walnut/60">
                {item.group} · retail {formatUsd(item.retailPackCents)}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => step(item.id, -1)}
                  className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                  aria-label={`Fewer packs of ${item.name}`}
                >
                  −
                </button>
                <span className="text-center font-ui text-[12px] font-extrabold leading-tight text-walnut-dark">
                  {n} pack{n === 1 ? "" : "s"}
                  <br />
                  <span className="font-bold text-walnut/60">
                    {quote.units.toLocaleString("en-US")} {unitLabel(item, quote.units)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => step(item.id, 1)}
                  className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                  aria-label={`More packs of ${item.name}`}
                >
                  +
                </button>
              </div>
              {message ? (
                <p className="mt-1 text-center font-hand text-[12px] leading-tight text-copper">
                  {message}
                </p>
              ) : null}
              <KButton
                full
                variant={quote.verdict === "ok" ? "copper" : "ghost"}
                className="mt-auto h-12 px-2 text-[12px]"
                onClick={() => handleBuy(item.id)}
              >
                Buy · {formatUsd(quote.totalCost)}
              </KButton>
              <p
                className={cn(
                  "wallet-line mt-1 text-center font-ui text-[11px] font-bold leading-tight",
                  quote.verdict === "ok" ? "text-walnut/65" : "text-copper",
                )}
              >
                {quote.verdict === "insufficientFunds"
                  ? notEnoughMoneyText(quote.totalCost, save.credits)
                  : `${balanceText(save.credits)} → ${balanceText(quote.remainingCredits)}`}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
