import { useMemo, useRef, useState, type ReactNode } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { BottomNav } from "../Kitchen";
import { Coin, KButton, Panel, ScreenHeader } from "../common/primitives";
import { Bar, Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import type { PerishabilityState } from "@/game/business/perishability";
import {
  EXPIRING_SOON_DAYS,
  INGREDIENT_GROUPS,
  inventorySummary,
} from "@/game/business/inventoryAnalytics";
import { INVENTORY_STATUS_META, type InventoryStatus } from "@/game/business/inventoryStatus";
import {
  INVENTORY_SORTS,
  inventoryView,
  sortInventory,
  type InventoryAttentionGroup,
  type InventoryItemView,
  type InventorySort,
} from "@/game/business/inventoryView";
import { BUSINESS_TAB_SCREEN } from "../business/businessTabs";
import { openMarketIngredients } from "../marketFocus";
import { PhysicalFridge } from "./fridge/PhysicalFridge";
import { InventorySupplies } from "./InventorySupplies";

/** How many rows each Needs Attention group shows before "View all". */
const ATTENTION_PREVIEW = 3;

const FRESHNESS_LABEL: Record<PerishabilityState, string> = {
  FRESH: "Fresh",
  AGING: "Aging",
  NEAR_EXPIRY: "Near expiry",
  EXPIRED: "Expired",
};

const STATUS_PILL: Record<"sage" | "gold" | "copper" | "tomato", string> = {
  sage: "border-olive/30 bg-sage/20 text-olive",
  gold: "border-gold/45 bg-gold/20 text-walnut-dark",
  copper: "border-copper/40 bg-copper/15 text-copper",
  tomato: "border-tomato/40 bg-tomato/12 text-tomato",
};

function qty(item: { quantity: number; unit: string }): string {
  return `${formatQuantity(item.quantity)} ${item.unit}`;
}

/** An estimate (today's requirement, what's left after service): one decimal, never false precision. */
function approx(n: number, unit: string): string {
  if (n > 0 && n < 0.05) return `< 0.1 ${unit}`;
  return `${Number(n.toFixed(1)).toLocaleString("en-US")} ${unit}`;
}

function daysText(days: number): string {
  if (days <= 0) return "Expired";
  if (days === 1) return "Spoils tonight";
  return `${days} days left`;
}

/** Status shown as marker + word, never colour alone. */
function StatusPill({ status }: { status: InventoryStatus }) {
  const meta = INVENTORY_STATUS_META[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-ui text-[10px] font-extrabold uppercase tracking-[0.06em]",
        STATUS_PILL[meta.tone],
      )}
    >
      <span aria-hidden>{meta.marker}</span>
      {meta.label}
    </span>
  );
}

function FreshBar({ item }: { item: InventoryItemView }) {
  return (
    <Bar
      fraction={item.freshness}
      tone={item.status === "healthy" || item.status === "low" ? "sage" : "copper"}
    />
  );
}

function RestockButton({
  go,
  id,
  label = "Restock in Market →",
  className,
}: {
  go: (s: ScreenId) => void;
  id?: IngredientId;
  label?: string;
  className?: string;
}) {
  return (
    <KButton
      size="sm"
      variant="copper"
      className={cn("h-12 shrink-0 px-3 text-[12px]", className)}
      onClick={() => openMarketIngredients(go, id)}
    >
      {label}
    </KButton>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  testId,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="press min-h-[84px] rounded-[20px] border border-walnut/15 p-3 text-left card-warm"
    >
      <p className="font-ui text-[11px] font-extrabold text-walnut/65">
        <span aria-hidden>{icon}</span> {label}
      </p>
      <p className="mt-0.5 font-display text-[19px] font-black leading-tight text-walnut-dark tabular-nums">
        {value}
      </p>
      <p className="font-hand text-[13px] leading-tight text-walnut/60">{sub}</p>
    </button>
  );
}

function AttentionRow({
  item,
  go,
  onOpen,
}: {
  item: InventoryItemView;
  go: (s: ScreenId) => void;
  onOpen: (id: IngredientId) => void;
}) {
  const usableLine =
    item.status === "expired"
      ? `${qty(item)} · 0 ${item.unit} usable · thrown out at End Business Day`
      : item.status === "spoils_today"
        ? `${qty(item)} left · spoils at End Business Day`
        : item.status === "expiring"
          ? `${qty(item)} · ${daysText(item.daysRemaining)}`
          : `${qty(item)} remaining`;
  return (
    <div
      data-attention-item={item.ingredientId}
      className="flex items-center gap-2 border-b border-walnut/10 py-2 last:border-b-0"
    >
      <button
        type="button"
        onClick={() => onOpen(item.ingredientId)}
        className="press flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left"
        aria-label={`${item.name}: details`}
      >
        <span className="text-[24px]" aria-hidden>
          {INGREDIENT_EMOJI[item.ingredientId]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-ui text-[13px] font-extrabold text-walnut-dark">
              {item.name}
            </span>
            <StatusPill status={item.status} />
          </span>
          <span className="block font-hand text-[13px] leading-tight text-walnut/70">
            {usableLine}
          </span>
          {item.todayRequirement !== undefined &&
          (item.status === "critical" || item.status === "low") ? (
            <span className="block font-hand text-[13px] leading-tight text-walnut/70">
              Today's menu needs ≈ {approx(item.todayRequirement, item.unit)}
            </span>
          ) : null}
        </span>
      </button>
      <RestockButton go={go} id={item.ingredientId} label="Restock →" />
    </div>
  );
}

function AttentionGroup({
  group,
  go,
  onOpen,
  open,
}: {
  group: InventoryAttentionGroup;
  go: (s: ScreenId) => void;
  onOpen: (id: IngredientId) => void;
  open: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? group.items : group.items.slice(0, ATTENTION_PREVIEW);
  return (
    <details
      open={open}
      data-attention-group={group.id}
      className="rounded-[16px] border border-walnut/12 bg-ivory/60 px-3"
    >
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-ui text-[13px] font-extrabold text-walnut-dark">
        <span aria-hidden>{group.marker}</span>
        <span className="flex-1">{group.title}</span>
        <span className="rounded-full bg-walnut/10 px-2 tabular-nums">{group.items.length}</span>
      </summary>
      <div className="pb-1">
        {shown.map((item) => (
          <AttentionRow key={item.ingredientId} item={item} go={go} onOpen={onOpen} />
        ))}
        {group.items.length > ATTENTION_PREVIEW ? (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="press my-1 h-12 w-full rounded-[12px] font-ui text-[12px] font-extrabold text-copper"
          >
            {all ? "Show fewer" : `View all ${group.items.length} →`}
          </button>
        ) : null}
      </div>
    </details>
  );
}

function StockCard({
  item,
  go,
  onOpen,
}: {
  item: InventoryItemView;
  go: (s: ScreenId) => void;
  onOpen: (id: IngredientId) => void;
}) {
  return (
    <article
      data-inventory-item={item.ingredientId}
      data-status={item.status}
      className="rounded-[18px] border border-walnut/12 bg-ivory/70 px-3 py-2"
    >
      <button
        type="button"
        onClick={() => onOpen(item.ingredientId)}
        className="press flex min-h-12 w-full items-center gap-2.5 text-left"
        aria-label={`${item.name}: ${qty(item)}, ${daysText(item.daysRemaining)}, ${INVENTORY_STATUS_META[item.status].label}. Details`}
      >
        <span className="text-[28px] leading-none" aria-hidden>
          {INGREDIENT_EMOJI[item.ingredientId]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-ui text-[13px] font-extrabold text-walnut-dark">
              {item.name}
            </span>
            <StatusPill status={item.status} />
          </span>
          <span className="block font-ui text-[12px] font-bold text-walnut/70 tabular-nums">
            {qty(item)} · {formatUsd(item.unitPrice)} / {item.unit} · {formatUsd(item.stockValue)}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="w-16 shrink-0">
              <FreshBar item={item} />
            </span>
            <span className="font-ui text-[11px] font-bold text-walnut/65">
              {item.daysRemaining <= 0
                ? "Expired"
                : `${FRESHNESS_LABEL[item.freshnessState]} · ${daysText(item.daysRemaining)}`}
            </span>
          </span>
        </span>
      </button>
      <div className="mt-1 flex items-center gap-2 border-t border-walnut/10 pt-1.5">
        <span className="min-w-0 flex-1 font-hand text-[13px] leading-tight text-walnut/65">
          {item.todayRequirement !== undefined
            ? `Today's menu: ≈ ${approx(item.todayRequirement, item.unit)} needed`
            : "Not on today's menu"}
        </span>
        <RestockButton go={go} id={item.ingredientId} label="Restock →" />
      </div>
    </article>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-walnut/10 py-1.5 last:border-b-0">
      <span className="font-ui text-[12px] font-bold text-walnut/60">{label}</span>
      <span className="text-right font-ui text-[13px] font-extrabold text-walnut-dark tabular-nums">
        {children}
      </span>
    </div>
  );
}

/** The tapped ingredient's details, above the bottom bar. Read-only; its one action opens the Market. */
function DetailSheet({
  item,
  go,
  onClose,
}: {
  item: InventoryItemView;
  go: (s: ScreenId) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 bottom-[78px] z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 bg-walnut-dark/35"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`${item.name} details`}
        data-testid="inventory-detail"
        className="paper anim-up relative max-h-[86%] overflow-y-auto rounded-t-[24px] border border-walnut/20 px-4 pb-4 pt-3 shadow-lift"
      >
        <div className="flex items-center gap-3">
          <span className="text-[34px]" aria-hidden>
            {INGREDIENT_EMOJI[item.ingredientId]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[20px] font-black leading-tight text-walnut-dark">
              {item.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <StatusPill status={item.status} />
              <span className="font-ui text-[11px] font-bold text-walnut/60">{item.category}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="press grid h-12 w-12 shrink-0 place-items-center rounded-full text-[18px] font-black text-walnut-dark"
          >
            ✕
          </button>
        </div>
        <div className="mt-2">
          <DetailRow label="In stock">{qty(item)}</DetailRow>
          <div className="border-b border-walnut/10 py-1.5">
            <div className="flex items-baseline justify-between">
              <span className="font-ui text-[12px] font-bold text-walnut/60">Freshness</span>
              <span className="font-ui text-[13px] font-extrabold text-walnut-dark">
                {FRESHNESS_LABEL[item.freshnessState]}
              </span>
            </div>
            <div className="mt-1">
              <FreshBar item={item} />
            </div>
          </div>
          <DetailRow label="Days remaining">{daysText(item.daysRemaining)}</DetailRow>
          <DetailRow label="Average cost">
            {formatUsd(item.unitPrice)} / {item.unit}
          </DetailRow>
          <DetailRow label="Stock value">{formatUsd(item.stockValue)}</DetailRow>
          {item.todayRequirement !== undefined ? (
            <>
              <DetailRow label="Today's requirement">
                ≈ {approx(item.todayRequirement, item.unit)}
              </DetailRow>
              <DetailRow label="After today's service">
                ≈ {approx(item.afterToday ?? 0, item.unit)}
              </DetailRow>
            </>
          ) : null}
        </div>
        <p className="mt-2 font-ui text-[11px] font-extrabold uppercase tracking-[0.08em] text-walnut/60">
          Used by
        </p>
        {item.menuUses.length > 0 ? (
          <ul className="mt-0.5 list-disc pl-5 font-hand text-[14px] leading-snug text-walnut/75">
            {item.menuUses.slice(0, 6).map((d) => (
              <li key={d}>{d}</li>
            ))}
            {item.menuUses.length > 6 ? <li>+{item.menuUses.length - 6} more</li> : null}
          </ul>
        ) : (
          <p className="font-hand text-[14px] text-walnut/65">Not used by today's menu.</p>
        )}
        {item.todayRequirement !== undefined ? (
          <p className="mt-1 font-hand text-[12px] leading-snug text-walnut/55">
            Today's requirement is what today's customers are expected to order, spread over your
            active menu.
          </p>
        ) : null}
        <RestockButton go={go} id={item.ingredientId} className="mt-3 w-full" />
      </div>
    </div>
  );
}

/**
 * INVENTORY — the restaurant's stock control (bottom bar → Inventory):
 * what the restaurant owns, what is running low or expiring, how much fridge
 * space is left, and what to restock. A read-only view of the one inventory
 * (`save.business.inventory`) through inventoryView.ts. It buys nothing:
 * Restock opens Market → Ingredients, Upgrade/Repair opens Business →
 * Equipment.
 */
export type InventoryKind = "ingredients" | "supplies";

const KINDS: ReadonlyArray<{ id: InventoryKind; label: string; icon: string; sub: string }> = [
  { id: "ingredients", label: "Ingredients", icon: "🥕", sub: "food in the fridge" },
  { id: "supplies", label: "Supplies", icon: "🍽️", sub: "smallwares · cutlery · parcels" },
];

export function InventoryScreen({
  go,
  save,
  initialKind = "ingredients",
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  initialKind?: InventoryKind;
}) {
  const [kind, setKind] = useState<InventoryKind>(initialKind);
  const view = useMemo(() => inventoryView(save), [save]);
  const analytics = inventorySummary(save);
  const [selectedId, setSelectedId] = useState<IngredientId | null>(null);
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<InventorySort>("status");
  const attentionRef = useRef<HTMLDivElement>(null);
  const fridgeRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLDivElement>(null);
  const s = view.summary;
  const selected = view.items.find((i) => i.ingredientId === selectedId) ?? null;
  const toEquipment = () => go(BUSINESS_TAB_SCREEN.equipment);
  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ block: "start" });

  const groups = useMemo(
    () =>
      INGREDIENT_GROUPS.map((g) => ({
        ...g,
        count: view.items.filter((i) => i.category === g.label).length,
      })),
    [view.items],
  );
  const list = useMemo(
    () =>
      sortInventory(
        filter === "All" ? view.items : view.items.filter((i) => i.category === filter),
        sort,
      ),
    [view.items, filter, sort],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.22),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-28" data-testid="inventory">
        <ScreenHeader
          title="Inventory"
          subtitle="Manage your restaurant stock"
          onBack={() => go("kitchen")}
          right={<Coin n={save.credits} />}
        />

        <div className="space-y-3 px-4">
          {/* What kind of stock: food (the fridge) or supplies (smallwares, tableware, takeaway) */}
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Kind of stock">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kind === k.id}
                data-inventory-kind={k.id}
                onClick={() => {
                  setKind(k.id);
                  setSelectedId(null);
                }}
                className={cn(
                  "press flex min-h-[60px] flex-col items-center justify-center rounded-[18px] border px-2 py-1.5",
                  kind === k.id
                    ? "wood border-walnut-dark/50 text-ivory shadow-soft"
                    : "card-warm border-walnut/15 text-walnut-dark",
                )}
              >
                <span className="font-ui text-[14px] font-extrabold leading-tight">
                  <span aria-hidden>{k.icon}</span> {k.label}
                </span>
                <span className="font-ui text-[10px] font-bold leading-tight opacity-75">
                  {k.sub}
                </span>
              </button>
            ))}
          </div>

          {kind === "supplies" ? (
            <InventorySupplies go={go} save={save} />
          ) : (
            <>
              {/* Current fridge */}
              <button
                type="button"
                onClick={() => scrollTo(fridgeRef.current)}
                data-testid="inventory-fridge-pill"
                className="press flex min-h-12 w-full items-center justify-between gap-3 rounded-[16px] border border-walnut/15 px-3 py-2 text-left card-warm"
              >
                <span className="font-ui text-[13px] font-extrabold text-walnut-dark">
                  ❄️ Fridge: {s.fridgeShortName}
                </span>
                <span className="font-display text-[16px] font-black text-walnut-dark tabular-nums">
                  {formatQuantity(s.used)} / {s.capacity} units
                </span>
              </button>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3" data-testid="inventory-summary">
                <SummaryCard
                  icon="📦"
                  label="Total Stock"
                  value={`${formatQuantity(s.used)} / ${s.capacity} units`}
                  sub={`${formatUsd(s.stockValue)} stock value`}
                  testId="summary-stock"
                  onClick={() => scrollTo(fridgeRef.current)}
                />
                <SummaryCard
                  icon="⚠️"
                  label="Running Low"
                  value={`${s.runningLow} item${s.runningLow === 1 ? "" : "s"}`}
                  sub="below today's menu need"
                  testId="summary-low"
                  onClick={() => scrollTo(attentionRef.current)}
                />
                <SummaryCard
                  icon="⏳"
                  label="Expiring Soon"
                  value={`${s.expiringSoon} item${s.expiringSoon === 1 ? "" : "s"}`}
                  sub={`within ${EXPIRING_SOON_DAYS} Business Days`}
                  testId="summary-expiring"
                  onClick={() => scrollTo(attentionRef.current)}
                />
                <SummaryCard
                  icon="🍽"
                  label="Ready to Cook"
                  value={`${s.readyDishes} / ${s.menuDishes} dishes`}
                  sub="on today's menu"
                  testId="summary-ready"
                  onClick={() => scrollTo(readyRef.current)}
                />
              </div>

              {/* Needs attention */}
              <div ref={attentionRef} className="scroll-mt-3">
                <Panel className="p-4">
                  <div data-testid="inventory-attention">
                    <Eyebrow>⚠️ Needs Attention</Eyebrow>
                    {view.attention.length > 0 ? (
                      <>
                        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="attention-counts">
                          {view.attention.map((g) => (
                            <span
                              key={g.id}
                              className="rounded-full border border-walnut/15 bg-ivory/70 px-2.5 py-1 font-ui text-[12px] font-extrabold text-walnut-dark"
                            >
                              <span aria-hidden>{g.marker}</span> {g.items.length} {g.title}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 space-y-2">
                          {view.attention.map((g, i) => (
                            <AttentionGroup
                              key={g.id}
                              group={g}
                              go={go}
                              onOpen={setSelectedId}
                              open={i === 0}
                            />
                          ))}
                        </div>
                        <KButton
                          full
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-12"
                          onClick={() => {
                            setFilter("All");
                            setSort("status");
                            scrollTo(allRef.current);
                          }}
                        >
                          View All Inventory Issues →
                        </KButton>
                      </>
                    ) : (
                      <p className="mt-1 font-hand text-[15px] leading-snug text-olive">
                        ✓ Nothing needs attention — everything in stock is fresh and covers today's
                        menu.
                      </p>
                    )}
                  </div>
                </Panel>
              </div>

              {/* The physical fridge */}
              <div ref={fridgeRef} className="-mx-2 scroll-mt-3">
                <PhysicalFridge
                  view={view.fridge}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onEquipment={toEquipment}
                />
              </div>

              {view.items.length === 0 ? (
                <Panel className="p-4 text-center">
                  <p className="font-hand text-[15px] leading-snug text-walnut/65">
                    Your fridge is empty. Buy ingredients from the Market to start serving Business
                    orders.
                  </p>
                  <RestockButton go={go} label="Go to Market →" className="mt-2 w-full" />
                </Panel>
              ) : null}

              {/* Ready to cook */}
              <div ref={readyRef} className="scroll-mt-3">
                <Panel className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Eyebrow>🍽 Ready to Cook</Eyebrow>
                    <span
                      className="font-ui text-[12px] font-extrabold text-walnut-dark"
                      data-testid="menu-ready"
                    >
                      {s.readyDishes} / {s.menuDishes} dishes ready
                    </span>
                  </div>
                  <div className="mt-2">
                    <Bar fraction={s.menuDishes > 0 ? s.readyDishes / s.menuDishes : 0} />
                  </div>
                  {view.mostNeeded.length > 0 ? (
                    <>
                      <p className="mt-2 font-ui text-[11px] font-extrabold uppercase tracking-[0.08em] text-walnut/60">
                        Most needed ingredients
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2" data-testid="most-needed">
                        {view.mostNeeded.slice(0, 5).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            data-ingredient={n.id}
                            onClick={() => openMarketIngredients(go, n.id)}
                            className="press flex h-12 items-center gap-1.5 rounded-full border border-walnut/15 px-3 font-ui text-[12px] font-extrabold text-walnut-dark card-warm"
                            aria-label={`${INGREDIENTS[n.id].name}: needed by ${n.blocks} dish${n.blocks === 1 ? "" : "es"}. Restock in Market`}
                          >
                            <span aria-hidden>{INGREDIENT_EMOJI[n.id]}</span>
                            {INGREDIENTS[n.id].name}
                            <span className="text-walnut/55">· {n.blocks}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 font-hand text-[12px] text-walnut/55">
                        The number is how many menu dishes are waiting for it. Tap to restock it in
                        the Market.
                      </p>
                    </>
                  ) : s.menuDishes > 0 ? (
                    <p className="mt-2 font-hand text-[13px] text-walnut/65">
                      Every dish on your menu can be made from stock.
                    </p>
                  ) : null}
                </Panel>
              </div>

              {/* All inventory */}
              <div ref={allRef} className="scroll-mt-3" data-testid="inventory-all">
                <Panel className="p-4">
                  <Eyebrow>🧺 All Inventory</Eyebrow>
                  <div
                    className="-mx-4 mt-2 flex gap-2 overflow-x-auto no-scrollbar px-4"
                    role="tablist"
                    aria-label="Filter inventory"
                  >
                    {[{ label: "All", count: view.items.length }, ...groups].map((g) => (
                      <button
                        key={g.label}
                        type="button"
                        role="tab"
                        aria-selected={filter === g.label}
                        onClick={() => setFilter(g.label)}
                        className={cn(
                          "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12px] font-extrabold",
                          filter === g.label
                            ? "wood border-walnut-dark/50 text-ivory"
                            : "card-warm border-walnut/15 text-walnut-dark",
                        )}
                      >
                        {g.label} <span className="opacity-70 tabular-nums">{g.count}</span>
                      </button>
                    ))}
                  </div>
                  <label className="mt-2 flex items-center justify-end gap-2 font-ui text-[12px] font-extrabold text-walnut/70">
                    Sort by
                    <select
                      id="inventory-sort"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as InventorySort)}
                      className="h-12 rounded-[12px] border border-walnut/20 bg-ivory px-3 font-ui text-[13px] font-extrabold text-walnut-dark"
                    >
                      {INVENTORY_SORTS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.id === "status" ? "Status (needs attention first)" : o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-2 space-y-2" data-testid="inventory-list">
                    {list.length > 0 ? (
                      list.map((item) => (
                        <StockCard
                          key={item.ingredientId}
                          item={item}
                          go={go}
                          onOpen={setSelectedId}
                        />
                      ))
                    ) : (
                      <p className="py-2 text-center font-hand text-[14px] text-walnut/60">
                        {view.items.length === 0
                          ? "Nothing in stock yet."
                          : `No ${filter.toLowerCase()} in stock.`}
                      </p>
                    )}
                  </div>
                </Panel>
              </div>

              {/* Stock analytics */}
              <Panel className="p-4">
                <Eyebrow>📊 Stock analytics</Eyebrow>
                <div className="mt-2 grid grid-cols-2 gap-2" data-testid="inventory-analytics">
                  {[
                    { label: "Stock value", value: formatUsd(analytics.stockValue) },
                    {
                      label: "Ingredients stocked",
                      value: `${analytics.stocked} / ${analytics.ingredientCount}`,
                    },
                    { label: "Fridge usage", value: `${Math.round(analytics.fridgeUsage * 100)}%` },
                    {
                      label: "Waste (all time)",
                      value: formatUsd(analytics.wasteValue),
                      sub:
                        analytics.lastDayWasteValue === null
                          ? `${formatQuantity(analytics.wasteQuantity)} units spoiled`
                          : `Last day ${formatUsd(analytics.lastDayWasteValue)}`,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="min-w-0 rounded-[14px] border border-walnut/10 bg-ivory/60 px-2.5 py-2"
                    >
                      <p className="truncate font-ui text-[10px] font-extrabold uppercase tracking-[0.06em] text-walnut/60">
                        {stat.label}
                      </p>
                      <p className="truncate font-display text-[16px] font-black leading-tight text-walnut-dark">
                        {stat.value}
                      </p>
                      {stat.sub ? (
                        <p className="truncate font-hand text-[12px] leading-tight text-walnut/60">
                          {stat.sub}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Where to go next */}
              <div className="grid gap-2">
                <RestockButton go={go} className="w-full" />
                <KButton full size="sm" variant="cream" className="h-12" onClick={toEquipment}>
                  Upgrade Refrigerator →
                </KButton>
                <KButton
                  full
                  size="sm"
                  variant="ghost"
                  className="h-12"
                  onClick={() => go(BUSINESS_TAB_SCREEN.overview)}
                >
                  View Business Performance →
                </KButton>
              </div>
            </>
          )}
          <p className="px-4 pb-2 text-center font-hand text-[14px] text-walnut/45">
            Inventory shows what you have. Buy ingredients and supplies in the Market; upgrade or
            repair the fridge in Business → Equipment.
          </p>
        </div>
      </div>

      {selected ? (
        <DetailSheet item={selected} go={go} onClose={() => setSelectedId(null)} />
      ) : null}
      <BottomNav active="inventory" go={go} />
    </div>
  );
}
