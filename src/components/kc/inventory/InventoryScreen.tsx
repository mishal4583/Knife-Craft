import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { useUnlockText } from "../navLevel";
import { kitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import { inventoryMenuOf, menuOpensAt, restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { RestaurantAttentionPanel } from "./RestaurantAttentionPanel";
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { BottomNav } from "../Kitchen";
import { useTabOpen } from "../navLevel";
import { Coin, KButton, Panel, ScreenHeader } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { Bar, Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import {
  displayMeasure,
  formatStockAmount,
  inMeasure,
  itemCountText,
  marketUnitLabel,
  pricePerMarketUnit,
} from "@/game/business/measure";
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
import { AmountChip, ItemPic, type TileTone } from "./ItemTile";
import { expiredStockPreview, type DiscardExpiredResult } from "@/game/business/discardExpired";

/** How many tiles each Needs Attention group shows before "View all" (two rows of three). */
const ATTENTION_PREVIEW = 6;

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

/** A stock amount in the player's measure (Settings → Weights): "0.6 lb", "0.27 kg", "1 loaf". */
function qty(item: { ingredientId: IngredientId; quantity: number }): string {
  return formatStockAmount(item.ingredientId, item.quantity, displayMeasure());
}

/** What one Market unit of the item is called in the player's measure: "lb", "kg", "loaf". */
function unitOf(item: { ingredientId: IngredientId }): string {
  return marketUnitLabel(item.ingredientId, displayMeasure());
}

/** An estimate (today's requirement, what's left after service): one decimal, never false precision. */
function approx(n: number, item: { ingredientId: IngredientId }): string {
  const v = inMeasure(item.ingredientId, n, displayMeasure());
  const unit = unitOf(item);
  if (v > 0 && v < 0.05) return `< 0.1 ${unit}`;
  return `${Number(v.toFixed(1)).toLocaleString("en-US")} ${unit}`;
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
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-ui text-[11px] font-extrabold uppercase tracking-[0.06em]",
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
  // First levels: no Market button before the Market opens (Level 7).
  const marketOpen = useTabOpen("shop");
  if (!marketOpen) return null;
  return (
    <KButton
      size="sm"
      variant="copper"
      className={cn("h-12 shrink-0 px-3 text-[12.5px]", className)}
      onClick={() => openMarketIngredients(go, id)}
    >
      {label}
    </KButton>
  );
}

/** An icon stat tile: big picture, big number, a two-word label (developer 2026-10-23). */
function SummaryCard({
  icon,
  label,
  value,
  title,
  testId,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  /** The full sentence (hover / screen readers). */
  title: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      title={title}
      aria-label={`${value} ${label}. ${title}`}
      className="press flex min-h-[64px] min-w-0 items-center gap-2 rounded-[18px] border border-walnut/15 px-2.5 py-2 text-left card-warm"
    >
      <span className="shrink-0 text-[26px] leading-none" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[18px] font-black leading-tight text-walnut-dark tabular-nums">
          {value}
        </span>
        <span className="block truncate font-ui text-[12px] font-extrabold leading-tight text-walnut/65">
          {label}
        </span>
      </span>
    </button>
  );
}

/** The tile tone and badge of a stock status. */
const STATUS_TILE: Record<InventoryStatus, { tone: TileTone; badge: string }> = {
  expired: { tone: "urgent", badge: "🗑️" },
  spoils_today: { tone: "urgent", badge: "🌙" },
  critical: { tone: "urgent", badge: "⛔" },
  low: { tone: "low", badge: "🟠" },
  expiring: { tone: "low", badge: "⏳" },
  healthy: { tone: "ok", badge: "" },
};

/** "0.2 lb" + "1.3 lb" → "0.2 / 1.3 lb". */
function haveOfNeed(have: string, need: string): string {
  return `${have.split(" ")[0]} / ${need}`;
}

/** One Needs Attention item as a picture tile: tap the picture for details, 🛒 to restock. */
function AttentionRow({
  item,
  go,
  onOpen,
}: {
  item: InventoryItemView;
  go: (s: ScreenId) => void;
  onOpen: (id: IngredientId) => void;
}) {
  const need =
    item.todayRequirement !== undefined && (item.status === "critical" || item.status === "low")
      ? item.todayRequirement
      : undefined;
  const amount =
    item.status === "expired"
      ? "🗑️ Expired"
      : item.status === "spoils_today"
        ? "🌙 Tonight"
        : item.status === "expiring"
          ? `⏳ ${item.daysRemaining}d`
          : need !== undefined
            ? haveOfNeed(qty(item), approx(need, item))
            : qty(item);
  const sentence =
    item.status === "expired"
      ? `${qty(item)}, expired — throw it out`
      : item.status === "spoils_today"
        ? `${qty(item)} left, spoils at End Business Day`
        : item.status === "expiring"
          ? `${qty(item)}, ${daysText(item.daysRemaining)}`
          : `${qty(item)} remaining${need !== undefined ? `, today's menu needs ≈ ${approx(need, item)}` : ""}`;
  const t = STATUS_TILE[item.status];
  return (
    <div
      data-attention-item={item.ingredientId}
      data-status={item.status}
      className="flex min-w-0 flex-col items-center gap-1 rounded-[16px] border border-walnut/12 bg-ivory/80 px-1.5 pb-1.5 pt-2 text-center"
    >
      <button
        type="button"
        onClick={() => onOpen(item.ingredientId)}
        className="press flex min-h-12 w-full min-w-0 flex-col items-center gap-1"
        aria-label={`${item.name}: ${INVENTORY_STATUS_META[item.status].label}, ${sentence}. Details`}
        title={`${INVENTORY_STATUS_META[item.status].label} · ${sentence}`}
      >
        <ItemPic
          icon={INGREDIENT_EMOJI[item.ingredientId]}
          tone={t.tone}
          badge={t.badge}
          size={52}
        />
        <span className="line-clamp-2 w-full font-ui text-[12px] font-extrabold leading-tight text-walnut-dark">
          {item.name}
        </span>
        <AmountChip tone={t.tone}>{amount}</AmountChip>
      </button>
      <RestockButton
        go={go}
        id={item.ingredientId}
        label="🛒 Restock"
        className="mt-auto w-full px-1 text-[12px]"
      />
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
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-ui text-[13.5px] font-extrabold text-walnut-dark">
        <span aria-hidden>{group.marker}</span>
        <span className="flex-1">{group.title}</span>
        <span className="rounded-full bg-walnut/10 px-2 tabular-nums">{group.items.length}</span>
      </summary>
      <div className="grid grid-cols-3 gap-2 pb-2">
        {shown.map((item) => (
          <AttentionRow key={item.ingredientId} item={item} go={go} onOpen={onOpen} />
        ))}
        {group.items.length > ATTENTION_PREVIEW ? (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="press col-span-3 h-12 w-full rounded-[12px] font-ui text-[12.5px] font-extrabold text-copper"
          >
            {all ? "Show fewer" : `View all ${group.items.length} →`}
          </button>
        ) : null}
      </div>
    </details>
  );
}

/** An All Inventory card: the picture, name, status, amount, freshness and today's need (developer 2026-10-23). */
function StockCard({
  item,
  go,
  onOpen,
  menuOpensAt = null,
}: {
  item: InventoryItemView;
  go: (s: ScreenId) => void;
  onOpen: (id: IngredientId) => void;
  /** Restaurant build, before the menu opens: its level (there is no menu need yet). */
  menuOpensAt?: number | null;
}) {
  const u = useUnlockText();
  const t = STATUS_TILE[item.status];
  const price = `${formatUsd(pricePerMarketUnit(item.ingredientId, item.unitPrice, displayMeasure()))} / ${unitOf(item)}`;
  const need =
    item.todayRequirement !== undefined
      ? `Today's menu: ≈ ${approx(item.todayRequirement, item)} needed`
      : menuOpensAt !== null
        ? `Your menu opens ${u.when(menuOpensAt)}`
        : "Not on today's menu";
  return (
    <article
      data-inventory-item={item.ingredientId}
      data-status={item.status}
      className="flex min-w-0 flex-col rounded-[18px] border border-walnut/12 bg-ivory/80 p-2"
    >
      <button
        type="button"
        onClick={() => onOpen(item.ingredientId)}
        className="press flex min-h-12 w-full min-w-0 flex-col items-center gap-1 text-center"
        aria-label={`${item.name}: ${qty(item)}, ${price}, ${formatUsd(item.stockValue)} value, ${daysText(item.daysRemaining)}, ${INVENTORY_STATUS_META[item.status].label}. ${need}. Details`}
        title={`${price} · ${formatUsd(item.stockValue)} · ${need}`}
      >
        <ItemPic
          icon={INGREDIENT_EMOJI[item.ingredientId]}
          tone={t.tone}
          badge={t.badge}
          size={54}
        />
        <span className="w-full truncate font-ui text-[13px] font-extrabold leading-tight text-walnut-dark">
          {item.name}
        </span>
        <StatusPill status={item.status} />
        <span className="font-display text-[17px] font-black leading-none text-walnut-dark tabular-nums">
          {qty(item)}
        </span>
        <span className="flex w-full items-center gap-1.5 px-1">
          <span className="min-w-0 flex-1">
            <FreshBar item={item} />
          </span>
          <span className="shrink-0 font-ui text-[12px] font-extrabold text-walnut/65 tabular-nums">
            {item.daysRemaining <= 0 ? "🗑️" : `⏳ ${item.daysRemaining}d`}
          </span>
        </span>
        <span className="font-ui text-[12px] font-bold text-walnut/65" aria-hidden>
          {item.todayRequirement !== undefined
            ? `🍽️ ≈ ${approx(item.todayRequirement, item)}`
            : menuOpensAt !== null
              ? u.badge(menuOpensAt)
              : "🍽️ —"}
        </span>
      </button>
      <RestockButton
        go={go}
        id={item.ingredientId}
        label="🛒 Restock"
        className="mt-1.5 w-full px-1 text-[12px]"
      />
    </article>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-walnut/10 py-1.5 last:border-b-0">
      <span className="font-ui text-[12.5px] font-bold text-walnut/60">{label}</span>
      <span className="text-right font-ui text-[13.5px] font-extrabold text-walnut-dark tabular-nums">
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
  menuOpensAt = null,
}: {
  item: InventoryItemView;
  go: (s: ScreenId) => void;
  onClose: () => void;
  /** Restaurant build, before the menu opens: its level. */
  menuOpensAt?: number | null;
}) {
  const u = useUnlockText();
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
          <ItemPic
            icon={INGREDIENT_EMOJI[item.ingredientId]}
            tone={STATUS_TILE[item.status].tone}
            badge={STATUS_TILE[item.status].badge}
            size={60}
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[20px] font-black leading-tight text-walnut-dark">
              {item.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <StatusPill status={item.status} />
              <span className="font-ui text-[12px] font-bold text-walnut/60">{item.category}</span>
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
          <DetailRow label="In stock">
            {qty(item)}
            {itemCountText(item.ingredientId, item.quantity)
              ? ` (${itemCountText(item.ingredientId, item.quantity)})`
              : ""}
          </DetailRow>
          <div className="border-b border-walnut/10 py-1.5">
            <div className="flex items-baseline justify-between">
              <span className="font-ui text-[12.5px] font-bold text-walnut/60">Freshness</span>
              <span className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                {FRESHNESS_LABEL[item.freshnessState]}
              </span>
            </div>
            <div className="mt-1">
              <FreshBar item={item} />
            </div>
          </div>
          <DetailRow label="Days remaining">{daysText(item.daysRemaining)}</DetailRow>
          <DetailRow label="Average cost">
            {formatUsd(pricePerMarketUnit(item.ingredientId, item.unitPrice, displayMeasure()))} /{" "}
            {unitOf(item)}
          </DetailRow>
          <DetailRow label="Stock value">{formatUsd(item.stockValue)}</DetailRow>
          {item.todayRequirement !== undefined ? (
            <>
              <DetailRow label="Today's requirement">
                ≈ {approx(item.todayRequirement, item)}
              </DetailRow>
              <DetailRow label="After today's service">
                ≈ {approx(item.afterToday ?? 0, item)}
              </DetailRow>
            </>
          ) : null}
        </div>
        <p className="mt-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.08em] text-walnut/60">
          Used by
        </p>
        {item.menuUses.length > 0 ? (
          <ul className="mt-0.5 list-disc pl-5 font-hand text-[15px] leading-snug text-walnut/75">
            {item.menuUses.slice(0, 6).map((d) => (
              <li key={d}>{d}</li>
            ))}
            {item.menuUses.length > 6 ? <li>+{item.menuUses.length - 6} more</li> : null}
          </ul>
        ) : (
          <p className="font-hand text-[15px] text-walnut/65">
            {menuOpensAt !== null ? `🔒 Menu opens ${u.when(menuOpensAt)}` : "Not on today's menu"}
          </p>
        )}
        {item.todayRequirement !== undefined ? (
          <p className="mt-1 flex items-center gap-1.5 font-hand text-[14px] leading-snug text-walnut/55">
            📊 Today's requirement
            <InfoTip label="About today's requirement">
              What today's customers are expected to order, spread over your active menu.
            </InfoTip>
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

/**
 * Throw Out Expired (discardExpired.ts): removes only expired stock now and
 * records it as waste, exactly as End Business Day would. It can't be
 * undone, so the first tap asks; the second does it.
 */
function ThrowOutExpired({
  save,
  throwOutExpired,
}: {
  save: SaveData;
  throwOutExpired: () => DiscardExpiredResult;
}) {
  const preview = expiredStockPreview(save);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  if (preview.count === 0) {
    return done ? (
      <p className="mt-2 font-hand text-[15px] text-olive" aria-live="polite">
        {done}
      </p>
    ) : null;
  }
  const what = `${preview.count} expired item${preview.count === 1 ? "" : "s"}`;
  return (
    <div
      className="mt-2 rounded-[14px] border border-tomato/30 bg-tomato/5 p-2.5"
      data-testid="throw-out-expired"
    >
      {confirming ? (
        <>
          <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
            Throw out {what}? It frees {formatQuantity(preview.quantity)} units of fridge space and
            counts {formatUsd(preview.value)} as waste. This can't be undone.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <KButton
              size="sm"
              variant="ghost"
              className="h-12"
              onClick={() => setConfirming(false)}
            >
              Keep them
            </KButton>
            <KButton
              size="sm"
              variant="copper"
              className="h-12"
              onClick={() => {
                const r = throwOutExpired();
                setConfirming(false);
                if (r.ok)
                  setDone(
                    `🗑 Threw out ${formatQuantity(r.quantity)} units · ${formatUsd(r.value)} waste`,
                  );
              }}
            >
              Yes, throw out
            </KButton>
          </div>
        </>
      ) : (
        <KButton
          full
          size="sm"
          variant="copper"
          className="h-12"
          onClick={() => setConfirming(true)}
        >
          🗑 Throw Out Expired ({preview.count})
        </KButton>
      )}
    </div>
  );
}

export function InventoryScreen({
  go,
  save,
  initialKind = "ingredients",
  throwOutExpired,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  initialKind?: InventoryKind;
  throwOutExpired: () => DiscardExpiredResult;
}) {
  const u = useUnlockText();
  const [kind, setKind] = useState<InventoryKind>(initialKind);
  // Restaurant build (Pass 2 review): stock is measured against the restaurant's
  // menu at its level — none before the menu opens — never the whole catalog.
  const view = useMemo(
    () => inventoryView(save, RESTAURANT_MODE ? inventoryMenuOf(save) : undefined),
    [save],
  );
  const menuOpensAtLevel = RESTAURANT_MODE
    ? menuOpensAt(restaurantLevelOf(save.levelProgress))
    : null;
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
  // First levels: the fridge is upgraded in Restaurant → Equipment (Business, Level 5).
  const restaurantOpen = useTabOpen("business");
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
  const upgradedStockroom = kitchenMapArtStage(save.equippedKitchenUpgradeId) !== "humble";
  const stockArt = (k: InventoryKind) =>
    `${k === "supplies" ? "supplies" : "ingredients"}-stockroom${upgradedStockroom ? "-upgraded" : ""}.webp`;

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
          <section
            className="relative isolate h-[104px] overflow-hidden rounded-[18px] border border-walnut/20 bg-walnut-dark shadow-soft sm:h-[116px] land:!h-[64px]"
            aria-label="Restaurant stockroom"
          >
            <img
              src={`${import.meta.env.BASE_URL}inventory/stockroom-banner.webp`}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full select-none object-cover object-[center_54%]"
              draggable={false}
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-walnut-dark/90 via-walnut-dark/60 to-transparent"
              aria-hidden="true"
            />
            <div className="relative flex h-full max-w-[76%] flex-col justify-center px-3.5 text-ivory sm:px-4">
              <h2 className="font-display text-[17px] font-black leading-tight sm:text-[19px]">
                Restaurant stockroom
              </h2>
              <p className="mt-1 font-ui text-[12px] font-bold text-ivory/90" aria-hidden>
                🥕 🧀 🍞 · 🍽️ 🥡 🧽
              </p>
            </div>
          </section>
          {/* Unified Restaurant: one urgent list for the whole restaurant (read-only, navigation only). */}
          {RESTAURANT_MODE ? <RestaurantAttentionPanel save={save} go={go} /> : null}
          {/* What kind of stock: food (the fridge) or supplies (smallwares, tableware, takeaway) */}
          <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Kind of stock">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kind === k.id}
                data-inventory-kind={k.id}
                title={k.sub}
                onClick={() => {
                  setKind(k.id);
                  setSelectedId(null);
                }}
                className={cn(
                  "press relative isolate flex h-[76px] items-end overflow-hidden rounded-[18px] border-2 bg-walnut-dark px-2.5 pb-1.5 text-left text-ivory shadow-soft",
                  kind === k.id ? "border-gold" : "border-walnut/20 opacity-80",
                )}
              >
                {/* The stockroom picture is the tab (developer 2026-10-23: pictures, less text). */}
                <img
                  src={`${import.meta.env.BASE_URL}inventory/${stockArt(k.id)}`}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 h-full w-full select-none object-cover object-[center_54%]"
                  draggable={false}
                />
                <span
                  className="absolute inset-0 -z-10 bg-gradient-to-t from-walnut-dark/90 via-walnut-dark/35 to-transparent"
                  aria-hidden="true"
                />
                <span className="font-ui text-[14.5px] font-extrabold leading-tight drop-shadow">
                  <span aria-hidden>{k.icon}</span> {k.label}
                </span>
                {kind === k.id ? (
                  <span
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-gold text-[12px] font-black text-walnut-dark"
                    aria-hidden
                  >
                    ✓
                  </span>
                ) : null}
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
                className="press flex min-h-12 w-full items-center gap-2.5 rounded-[16px] border border-walnut/15 px-3 py-2 text-left card-warm"
              >
                <span className="text-[24px] leading-none" aria-hidden>
                  ❄️
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-ui text-[13.5px] font-extrabold text-walnut-dark">
                      Fridge: {s.fridgeShortName}
                    </span>
                    <span className="shrink-0 font-display text-[15px] font-black text-walnut-dark tabular-nums">
                      {formatQuantity(s.used)} / {s.capacity} units
                    </span>
                  </span>
                  <span className="mt-1 block">
                    <Bar fraction={s.capacity > 0 ? s.used / s.capacity : 0} />
                  </span>
                </span>
              </button>

              {/* Summary: pictures and numbers (developer 2026-10-23) */}
              <div className="grid grid-cols-2 gap-2" data-testid="inventory-summary">
                <SummaryCard
                  icon="💰"
                  label="stock value"
                  value={formatUsd(s.stockValue)}
                  title={`${formatQuantity(s.used)} / ${s.capacity} units in the fridge, worth ${formatUsd(s.stockValue)}`}
                  testId="summary-stock"
                  onClick={() => scrollTo(fridgeRef.current)}
                />
                {menuOpensAtLevel === null ? (
                  <SummaryCard
                    icon="⚠️"
                    label="running low"
                    value={String(s.runningLow)}
                    title={`${s.runningLow} item${s.runningLow === 1 ? "" : "s"} below today's menu need`}
                    testId="summary-low"
                    onClick={() => scrollTo(attentionRef.current)}
                  />
                ) : null}
                <SummaryCard
                  icon="⏳"
                  label="expire soon"
                  value={String(s.expiringSoon)}
                  title={`${s.expiringSoon} item${s.expiringSoon === 1 ? "" : "s"} expiring within ${EXPIRING_SOON_DAYS} Business Days`}
                  testId="summary-expiring"
                  onClick={() => scrollTo(attentionRef.current)}
                />
                {menuOpensAtLevel === null ? (
                  <SummaryCard
                    icon="🍽️"
                    label="dishes ready"
                    value={`${s.readyDishes} / ${s.menuDishes}`}
                    title={`${s.readyDishes} of the ${s.menuDishes} dishes on today's menu can be cooked from stock`}
                    testId="summary-ready"
                    onClick={() => scrollTo(readyRef.current)}
                  />
                ) : (
                  <div
                    className="flex min-h-[64px] items-center gap-2 rounded-[18px] border border-walnut/15 px-2.5 py-2 card-warm"
                    data-testid="summary-menu-opens"
                    title="Each level cooks from this fridge"
                  >
                    <span className="text-[26px] leading-none" aria-hidden>
                      🍽️
                    </span>
                    <span className="min-w-0">
                      <span className="block font-ui text-[13px] font-extrabold text-walnut-dark">
                        No menu yet
                      </span>
                      <span className="block font-ui text-[12px] font-bold text-walnut/65">
                        {u.badge(menuOpensAtLevel)}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* Needs attention */}
              <div ref={attentionRef} className="scroll-mt-3">
                <Panel className="p-4">
                  <div data-testid="inventory-attention">
                    <Eyebrow>⚠️ Needs Attention</Eyebrow>
                    <ThrowOutExpired save={save} throwOutExpired={throwOutExpired} />
                    {view.attention.length > 0 ? (
                      <>
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
                          🧺 All stock ↓
                        </KButton>
                      </>
                    ) : (
                      <p className="mt-1 font-hand text-[16px] leading-snug text-olive">
                        ✓ All fresh · today's menu covered
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
                  onEquipment={restaurantOpen ? toEquipment : undefined}
                />
              </div>

              {view.items.length === 0 ? (
                <Panel className="p-4 text-center">
                  <p className="font-hand text-[16px] leading-snug text-walnut/65">
                    Your fridge is empty. Buy ingredients from the Market to start serving Business
                    orders.
                  </p>
                  <RestockButton go={go} label="Go to Market →" className="mt-2 w-full" />
                </Panel>
              ) : null}

              {/* Ready to cook (from the menu's opening in the restaurant build) */}
              <div
                ref={readyRef}
                className={cn("scroll-mt-3", menuOpensAtLevel !== null && "hidden")}
              >
                <Panel className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Eyebrow>🍽 Ready to Cook</Eyebrow>
                    <span
                      className="font-ui text-[12.5px] font-extrabold text-walnut-dark"
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
                      <p className="mt-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.08em] text-walnut/60">
                        Most needed ingredients
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2" data-testid="most-needed">
                        {view.mostNeeded.slice(0, 5).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            data-ingredient={n.id}
                            onClick={() => openMarketIngredients(go, n.id)}
                            className="press flex h-12 items-center gap-1.5 rounded-full border border-walnut/15 px-3 font-ui text-[12.5px] font-extrabold text-walnut-dark card-warm"
                            aria-label={`${INGREDIENTS[n.id].name}: needed by ${n.blocks} dish${n.blocks === 1 ? "" : "es"}. Restock in Market`}
                          >
                            <span aria-hidden>{INGREDIENT_EMOJI[n.id]}</span>
                            {INGREDIENTS[n.id].name}
                            <span className="text-walnut/55">· {n.blocks}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 font-hand text-[13px] text-walnut/55">
                        🍽️ = dishes waiting · tap to restock
                      </p>
                    </>
                  ) : s.menuDishes > 0 ? (
                    <p className="mt-2 font-hand text-[14px] text-walnut/65">
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
                          "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12.5px] font-extrabold",
                          filter === g.label
                            ? "wood border-walnut-dark/50 text-ivory"
                            : "card-warm border-walnut/15 text-walnut-dark",
                        )}
                      >
                        {g.label} <span className="opacity-70 tabular-nums">{g.count}</span>
                      </button>
                    ))}
                  </div>
                  <label className="mt-2 flex items-center justify-end gap-2 font-ui text-[12.5px] font-extrabold text-walnut/70">
                    Sort by
                    <select
                      id="inventory-sort"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as InventorySort)}
                      className="h-12 rounded-[12px] border border-walnut/20 bg-ivory px-3 font-ui text-[13.5px] font-extrabold text-walnut-dark"
                    >
                      {INVENTORY_SORTS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2" data-testid="inventory-list">
                    {list.length > 0 ? (
                      list.map((item) => (
                        <StockCard
                          key={item.ingredientId}
                          item={item}
                          go={go}
                          onOpen={setSelectedId}
                          menuOpensAt={menuOpensAtLevel}
                        />
                      ))
                    ) : (
                      <p className="col-span-2 py-2 text-center font-hand text-[15px] text-walnut/60">
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
                    { icon: "💰", label: "Stock value", value: formatUsd(analytics.stockValue) },
                    {
                      icon: "🥕",
                      label: "Stocked",
                      value: `${analytics.stocked} / ${analytics.ingredientCount}`,
                    },
                    {
                      icon: "❄️",
                      label: "Fridge used",
                      value: `${Math.round(analytics.fridgeUsage * 100)}%`,
                    },
                    {
                      icon: "🗑️",
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
                      <p className="truncate font-ui text-[11px] font-extrabold uppercase tracking-[0.06em] text-walnut/60">
                        <span aria-hidden>{stat.icon}</span> {stat.label}
                      </p>
                      <p className="truncate font-display text-[16.5px] font-black leading-tight text-walnut-dark">
                        {stat.value}
                      </p>
                      {stat.sub ? (
                        <p className="truncate font-hand text-[13px] leading-tight text-walnut/60">
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
                {restaurantOpen ? (
                  <>
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
                  </>
                ) : null}
              </div>
            </>
          )}
          <p className="px-4 pb-2 text-center font-hand text-[15px] text-walnut/45">
            👀 View only · 🛒 buy in Market · ❄️ fridge in Equipment
          </p>
        </div>
      </div>

      {selected ? (
        <DetailSheet
          item={selected}
          go={go}
          onClose={() => setSelectedId(null)}
          menuOpensAt={menuOpensAtLevel}
        />
      ) : null}
      <BottomNav active="inventory" go={go} />
    </div>
  );
}
