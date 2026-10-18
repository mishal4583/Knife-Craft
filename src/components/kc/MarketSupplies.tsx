import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { BULK_MAX_PACKS, bulkDiscountFor } from "@/game/restaurant/bulkBuying";
import { BulkPresets } from "./BulkPresets";
import { useEffect, useMemo, useRef, useState } from "react";
import { marketNeeds, needLabel, needsFirst, type MarketNeed } from "@/game/restaurant/marketNeeds";
import { Badge, KButton, Panel } from "./common/primitives";
import { cn } from "@/lib/utils";
import { InfoTip, StatChip } from "./common/InfoTip";
import type { SaveData } from "@/game/SaveManager";
import { formatUsd } from "@/game/money";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import { ShortfallOffer } from "./ads/ShortfallOffer";
import {
  SUPPLY_CATALOG,
  SUPPLY_PRICES_RETRIEVED,
  SUPPLY_SECTIONS,
  isConsumableSupply,
  supplyPackPrice,
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
 * promises what the tap won't do. Inventory → Supplies shows the same saved
 * stock and spending.
 */
export function MarketSupplies({
  save,
  section,
  focusId = null,
  focusPacks = null,
  purchaseSupply,
  setNotice,
  planLevelId = null,
}: {
  save: SaveData;
  section: SupplySection;
  /** The open Pre-Service Check's level: what is highlighted is for it. */
  planLevelId?: string | null;
  /** Preselected by an Inventory → Market link: its group opens and the card scrolls into view. */
  focusId?: SupplyId | null;
  /** The packs to preset on the focused card (a Pre-Service Check's "Buy"). */
  focusPacks?: number | null;
  purchaseSupply: (supplyId: string, packs: number) => PurchaseSupplyResult;
  setNotice: (text: string) => void;
}) {
  const meta = SUPPLY_SECTIONS[section];
  const focusItem = focusId
    ? SUPPLY_CATALOG.find((i) => i.id === focusId && i.section === section)
    : undefined;
  // What today's service, tonight's closing and the cleaning jobs need (restaurant build):
  // highlighted, listed first, and preset to the amount needed (developer 2026-10-16).
  const needs = useMemo(
    () => (RESTAURANT_MODE ? marketNeeds(save, planLevelId).supplies : {}),
    [save, planLevelId],
  ) as Partial<Record<SupplyId, MarketNeed>>;
  // With needed items in this section the Market opens on All, so none is hidden in another
  // group (developer 2026-10-17); otherwise on the tapped item's group.
  const sectionNeeds = SUPPLY_CATALOG.filter((i) => i.section === section && needs[i.id]);
  const [group, setGroup] = useState<string>(
    sectionNeeds.length > 0 ? "All" : (focusItem?.group ?? "All"),
  );
  /** How many items of a group (or All) are needed — a badge on its chip. */
  const needCountOf = (g: string) =>
    sectionNeeds.filter((i) => g === "All" || i.group === g).length;
  const soonCount = sectionNeeds.filter((i) => needs[i.id]?.when === "soon").length;
  const focusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center" });
  }, []);
  const [packs, setPacks] = useState<Partial<Record<SupplyId, number>>>(
    focusItem && focusPacks ? { [focusItem.id]: focusPacks } : {},
  );
  const [messages, setMessages] = useState<Partial<Record<SupplyId, string>>>({});
  const supplies = save.business.supplies;
  const items = needsFirst(
    SUPPLY_CATALOG.filter(
      (item) => item.section === section && (group === "All" || item.group === group),
    ),
    (item) => needs[item.id],
  );
  const neededNow = SUPPLY_CATALOG.filter(
    (item) => item.section === section && needs[item.id] && needs[item.id]!.when !== "soon",
  );

  function packsFor(id: SupplyId): number {
    return packs[id] ?? needs[id]?.buy ?? 1;
  }

  function buyAllNeeded() {
    let bought = 0;
    let spent = 0;
    for (const item of neededNow) {
      const r = purchaseSupply(item.id, needs[item.id]!.buy);
      if (r.ok) {
        bought += 1;
        spent += r.totalCost;
      }
    }
    setNotice(
      bought === neededNow.length
        ? `✓ Bought all ${bought} · ${formatUsd(spent)}`
        : `✓ Bought ${bought}/${neededNow.length} · 💸 not enough for the rest`,
    );
  }

  /** Unified Restaurant wholesale buying: consumables only (the same rule App's purchase uses). */
  const wholesale = (item: (typeof SUPPLY_CATALOG)[number]) =>
    RESTAURANT_MODE && isConsumableSupply(item);
  const bulk = (item: (typeof SUPPLY_CATALOG)[number], n: number) =>
    wholesale(item) ? bulkDiscountFor(n) : 0;

  function step(id: SupplyId, delta: number) {
    const item = SUPPLY_CATALOG.find((i) => i.id === id)!;
    const max = wholesale(item) ? BULK_MAX_PACKS : MAX_SUPPLY_PACKS;
    setPacks((p) => ({
      ...p,
      [id]: Math.min(max, Math.max(1, packsFor(id) + delta)),
    }));
  }

  function handleBuy(id: SupplyId) {
    const item = SUPPLY_CATALOG.find((i) => i.id === id)!;
    const n = packsFor(id);
    const quote = supplyQuote(save, item, n, bulk(item, n));
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
    setNotice(`✓ ${item.name}: ${bought}`);
  }

  return (
    <div className="space-y-3" data-testid={`market-supplies-${section}`}>
      <Panel className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.12em] text-copper">
            {meta.emoji} {meta.kicker}
          </p>
          <InfoTip label={`About ${meta.short}`}>
            {RESTAURANT_MODE
              ? section === "culinary"
                ? "Your dishes need these tools — the Pre-Service Check asks for each one when a dish first does. They last; you buy them once."
                : section === "service"
                  ? "Your dining room's tableware. It lasts and is washed after every service."
                  : section === "cleaning"
                    ? "Your Cleanliness supplies: chemicals, restroom refills and liners are used up by each cleaning task; the mop, broom and toilet brush last."
                    : "Takeaway packaging, napkins, soap and cleaning liquid — used up service by service."
              : section === "packaging"
                ? "Each Business order goes out in one container and one carry bag while you have them."
                : "Restaurant equipment for your Business kitchen and dining room. It lasts; it's never used up."}{" "}
            Prices are restaurant-supply prices ({SUPPLY_PRICES_RETRIEVED}), less your wholesale
            discount.
          </InfoTip>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(RESTAURANT_MODE
            ? section === "culinary"
              ? [
                  ["🔁", "Buy once"],
                  ["📋", "Asked when a dish needs it"],
                ]
              : section === "service"
                ? [
                    ["🔁", "Lasts"],
                    ["🫧", "Washed each service"],
                  ]
                : section === "cleaning"
                  ? [
                      ["🧴", "Used per task"],
                      ["🧹", "Tools last"],
                    ]
                  : [["📦", "Used each service"]]
            : section === "packaging"
              ? [["📦", "1 per order"]]
              : [["🔁", "Lasts"]]
          ).map(([icon, text]) => (
            <StatChip key={text} icon={icon}>
              {text}
            </StatChip>
          ))}
          <StatChip icon="🏷️" tone="sage">
            Wholesale
          </StatChip>
        </div>
      </Panel>

      {neededNow.length > 0 ? (
        <Panel className="border-copper/50 p-3" data-testid={`market-needed-${section}`}>
          <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
            📌 {neededNow.length} item{neededNow.length === 1 ? "" : "s"} needed for today
          </p>
          <p className="mt-0.5 font-ui text-[12px] leading-snug text-walnut/70">
            ⬇️ Listed first · amount preset
          </p>
          <div className="mt-2" data-testid={`market-buy-needed-${section}`}>
            <KButton
              full
              className="h-12 px-2 text-[12.5px]"
              variant="copper"
              onClick={buyAllNeeded}
            >
              {`Buy everything needed · ${formatUsd(
                neededNow.reduce((t, item) => {
                  const n = needs[item.id]!.buy;
                  return t + supplyQuote(save, item, n, bulk(item, n)).totalCost;
                }, 0),
              )}`}
            </KButton>
          </div>
        </Panel>
      ) : soonCount > 0 ? (
        <Panel className="border-gold/60 p-3" data-testid={`market-soon-${section}`}>
          <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
            🔜 {soonCount} item{soonCount === 1 ? "" : "s"} needed for the next levels
          </p>
          <p className="mt-0.5 font-ui text-[12px] leading-snug text-walnut/70">
            ⬇️ Listed first · each card says which level
          </p>
        </Panel>
      ) : null}

      <div
        // Vertical room so the chips' borders aren't cut off (the row scrolls sideways).
        className="-mx-4 -my-1 flex gap-2 overflow-x-auto no-scrollbar px-4 py-1.5"
        aria-label={`${meta.short} groups`}
      >
        {["All", ...meta.groups].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            aria-pressed={group === g}
            className={cn(
              "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12.5px] font-extrabold",
              group === g
                ? "wood border-walnut-dark/50 text-ivory"
                : "card-warm border-walnut/15 text-walnut-dark",
            )}
          >
            {g}
            {needCountOf(g) > 0 ? (
              <span
                className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-copper px-1 font-ui text-[11px] font-extrabold text-ivory"
                aria-label={`${needCountOf(g)} needed`}
                data-group-needs={needCountOf(g)}
              >
                {needCountOf(g)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const n = packsFor(item.id);
          const quote = supplyQuote(save, item, n, bulk(item, n));
          const onHand = supplyUnits(supplies, item.id);
          const message = messages[item.id];
          return (
            <article
              key={item.id}
              ref={item.id === focusItem?.id ? focusRef : undefined}
              data-supply={item.id}
              data-needed={needs[item.id]?.when}
              className={cn(
                "product-card flex flex-col rounded-[20px] border p-3 card-warm",
                item.id === focusItem?.id
                  ? "border-copper ring-2 ring-copper/60"
                  : needs[item.id]
                    ? "border-copper/70 ring-1 ring-copper/40"
                    : "border-walnut/15",
              )}
            >
              {needs[item.id] ? (
                <NeedNote
                  need={needs[item.id]!}
                  unit={needs[item.id]!.buy === 1 ? "pack" : "packs"}
                />
              ) : null}
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
              <p className="mt-1 font-display text-[14.5px] font-black leading-tight text-walnut-dark">
                {item.name}
              </p>
              <p className="font-ui text-[12.5px] font-extrabold text-copper">
                {formatUsd(quote.packPrice)}
                <span className="font-bold text-walnut/60">
                  {" "}
                  / {item.packSize === 1 ? unitLabel(item, 1) : `pack of ${item.packSize}`}
                </span>
              </p>
              <p className="font-hand text-[14px] leading-tight text-walnut/60">
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
                <span className="text-center font-ui text-[12.5px] font-extrabold leading-tight text-walnut-dark">
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
              {wholesale(item) ? (
                <BulkPresets
                  value={n}
                  label="packs"
                  onPick={(q) => setPacks((p) => ({ ...p, [item.id]: q }))}
                />
              ) : null}
              {quote.bulkDiscount > 0 ? (
                <p
                  className="mt-1 text-center font-ui text-[12px] font-bold text-olive"
                  data-testid="bulk-saving"
                >
                  Bulk −{Math.round(quote.bulkDiscount * 100)}% · saves{" "}
                  {formatUsd(supplyPackPrice(item) * n - quote.totalCost)}
                </p>
              ) : null}
              {message ? (
                <p className="mt-1 text-center font-hand text-[13px] leading-tight text-copper">
                  {message}
                </p>
              ) : null}
              <KButton
                full
                variant={quote.verdict === "ok" ? "copper" : "ghost"}
                className="mt-auto h-12 px-2 text-[12.5px]"
                onClick={() => handleBuy(item.id)}
              >
                Buy · {formatUsd(quote.totalCost)}
              </KButton>
              <p
                className={cn(
                  "wallet-line mt-1 text-center font-ui text-[12px] font-bold leading-tight",
                  quote.verdict === "ok" ? "text-walnut/65" : "text-copper",
                )}
              >
                {quote.verdict === "insufficientFunds"
                  ? notEnoughMoneyText(quote.totalCost, save.credits)
                  : `${balanceText(save.credits)} → ${balanceText(quote.remainingCredits)}`}
              </p>
              {quote.verdict === "insufficientFunds" ? (
                <ShortfallOffer price={quote.totalCost} />
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** The "📌 Needed today · buy 2 packs" label on a Market card (supplies and ingredients). */
export function NeedNote({
  need,
  unit,
  detail,
}: {
  need: MarketNeed;
  /** The unit to buy in ("pack", "lb", "kg", "loaves"…), already plural-ready. */
  unit: string;
  /** Replaces the "Need …, have …" line (ingredients show their own lb / kg). */
  detail?: string;
}) {
  const urgent = need.when === "today" || need.when === "tonight";
  return (
    <div
      className={cn(
        "-mx-1 -mt-1 mb-1.5 rounded-[12px] px-2 py-1",
        urgent ? "bg-copper/15" : "bg-gold/15",
      )}
      data-testid="need-note"
    >
      <p className="font-ui text-[11.5px] font-extrabold leading-tight text-copper">
        📌 {needLabel(need)} · buy {need.buy} {unit}
      </p>
      <p className="font-ui text-[11px] font-bold leading-tight text-walnut/70">
        {detail ??
          (need.when === "soon"
            ? need.why
            : `Need ${formatNeed(need.need)}, have ${formatNeed(need.have)} · ${need.why}`)}
      </p>
    </div>
  );
}

const formatNeed = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
