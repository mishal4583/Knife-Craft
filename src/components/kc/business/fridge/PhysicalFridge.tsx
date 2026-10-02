import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { purchaseUnitFor } from "@/game/business/businessPricing";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import { INGREDIENT_GROUPS } from "@/game/business/inventoryAnalytics";
import type { IngredientId } from "@/game/definitions";
import type {
  FridgeAttentionReason,
  FridgeItem,
  FridgeView,
  FridgeZone,
} from "@/game/business/fridgeView";
import "./PhysicalFridge.css";

const TABS = ["All", ...INGREDIENT_GROUPS.map((g) => g.label)];

const REASON_TEXT: Record<FridgeAttentionReason, string> = {
  expired: "Expired",
  "spoils-tonight": "Spoils tonight",
  expiring: "Use soon",
  low: "Low for today",
};

function qty(id: IngredientId, quantity: number): string {
  return `${formatQuantity(quantity)} ${purchaseUnitFor(id)}`;
}

function daysText(daysLeft: number): string {
  if (daysLeft <= 0) return "Expired";
  if (daysLeft === 1) return "Spoils tonight";
  return `${daysLeft} days left`;
}

/**
 * A shelf row that pans sideways only when its items overflow. Touch pans
 * natively (vertical swipes still scroll the page — `touch-action: pan-x
 * pan-y`); a mouse can drag it. A drag never counts as a tap on an item.
 * The fades and the "›" cue show only when there is more to see.
 */
function PanRow({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 2,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    for (const child of Array.from(el.children)) ro?.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [children]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    if (d.moved) ref.current.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      // Swallow the click that ends a drag so it never opens an item.
      const swallow = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    }
  };

  return (
    <div
      className={cn(
        "kcf-pan",
        edges.left && "kcf-pan--more-left",
        edges.right && "kcf-pan--more-right",
      )}
      data-overflow={edges.left || edges.right ? "true" : "false"}
    >
      <div
        ref={ref}
        className="kcf-pan__track no-scrollbar"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {children}
      </div>
      {edges.right ? (
        <span className="kcf-pan__cue" aria-hidden>
          ›
        </span>
      ) : null}
    </div>
  );
}

function ItemLabel({
  item,
  selected,
  onSelect,
  compact,
}: {
  item: FridgeItem;
  selected: boolean;
  onSelect: (id: IngredientId) => void;
  compact?: boolean;
}) {
  const warn = item.attention !== null;
  return (
    <button
      type="button"
      data-fridge-item={item.id}
      aria-pressed={selected}
      aria-label={`${item.name}: ${qty(item.id, item.quantity)}, ${daysText(item.daysLeft)}`}
      onClick={() => onSelect(item.id)}
      className={cn(
        "kcf-item press",
        compact && "kcf-item--compact",
        warn && "kcf-item--warn",
        item.daysLeft <= 0 && "kcf-item--expired",
        selected && "kcf-item--selected",
      )}
    >
      <span className="kcf-item__icon" aria-hidden>
        {INGREDIENT_EMOJI[item.id]}
      </span>
      {compact ? null : <span className="kcf-item__name">{item.name}</span>}
      <span className="kcf-item__qty">
        {formatQuantity(item.quantity)}
        <small> {purchaseUnitFor(item.id)}</small>
      </span>
      <span className="kcf-item__fresh" aria-hidden>
        <span style={{ width: `${Math.max(4, Math.round(item.freshness * 100))}%` }} />
      </span>
      <span className="kcf-item__days">{item.daysLeft <= 0 ? "exp" : `${item.daysLeft}d`}</span>
    </button>
  );
}

function Zone({
  zone,
  items,
  selected,
  onSelect,
  filtered,
}: {
  zone: FridgeZone;
  items: FridgeItem[];
  selected: IngredientId | null;
  onSelect: (id: IngredientId) => void;
  filtered: boolean;
}) {
  const door = zone.place === "door";
  const labels = items.map((item) => (
    <ItemLabel
      key={item.id}
      item={item}
      compact={door}
      selected={selected === item.id}
      onSelect={onSelect}
    />
  ));
  return (
    <section
      className={cn("kcf-zone", `kcf-zone--${zone.place}`)}
      data-fridge-zone={zone.id}
      aria-label={`${zone.label}: ${items.length} item${items.length === 1 ? "" : "s"}`}
    >
      <p className="kcf-zone__label">
        <span aria-hidden>{zone.icon}</span> {zone.label}
        {items.length > 0 ? <span className="kcf-zone__count">{items.length}</span> : null}
      </p>
      {items.length === 0 ? (
        <p className="kcf-zone__empty">{filtered ? "—" : door ? "Empty" : "Empty shelf"}</p>
      ) : door ? (
        <div className="kcf-zone__bin">{labels}</div>
      ) : (
        <PanRow label={`${zone.label} items`}>{labels}</PanRow>
      )}
    </section>
  );
}

/**
 * The physical refrigerator at the top of Business → Inventory: an open
 * reach-in whose shelves, crisper drawers and door bins are filled from the
 * save (fridgeView.ts). Display and navigation only — the parent passes
 * `onRestock` (→ Market → Ingredients) and `onEquipment` (→ Business →
 * Equipment, where upgrades and repairs are bought); nothing here moves
 * money, stock or the save.
 */
export function PhysicalFridge({
  view,
  onRestock,
  onEquipment,
}: {
  view: FridgeView;
  onRestock: (id?: IngredientId) => void;
  onEquipment: () => void;
}) {
  const [tab, setTab] = useState("All");
  const [selectedId, setSelectedId] = useState<IngredientId | null>(null);
  const filtered = tab !== "All";
  const zones = useMemo(
    () =>
      view.zones.map((z) => ({
        zone: z.zone,
        items: filtered ? z.items.filter((i) => i.group === tab) : z.items,
      })),
    [view.zones, filtered, tab],
  );
  const selected = view.items.find((i) => i.id === selectedId) ?? null;
  const cabinet = zones.filter((z) => z.zone.place === "shelf");
  const drawers = zones.filter((z) => z.zone.place === "drawer");
  const door = zones.filter((z) => z.zone.place === "door");
  const full = view.available <= 0;
  const select = (id: IngredientId) => setSelectedId((cur) => (cur === id ? null : id));
  const detailRef = useRef<HTMLDivElement>(null);
  // Bring the tapped item's details into view (they sit under the fridge).
  useEffect(() => {
    if (!selectedId) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selectedId]);

  return (
    <div
      className={cn("kcf", `kcf--${view.tier.id}`)}
      data-testid="physical-fridge"
      data-tier={view.tier.id}
    >
      {/* Header: model, capacity, temperature, upgrade */}
      <div className="kcf-head">
        <div className="kcf-head__model">
          <p className="kcf-head__name">❄️ {view.tier.name}</p>
          <p className="kcf-head__meta" data-testid="fridge-capacity">
            {formatQuantity(view.used)} / {view.capacity} units
            <span aria-hidden> · </span>
            <span
              data-testid="fridge-cooling"
              className={cn(view.maintenance !== "OPERATIONAL" && "kcf-head__warn")}
            >
              {view.maintenance === "OPERATIONAL" ? "❄️ " : "⚠ "}
              {view.cooling}
            </span>
          </p>
          <div
            className={cn("kcf-cap", full && "kcf-cap--full")}
            role="meter"
            aria-label="Fridge space used"
            aria-valuemin={0}
            aria-valuemax={view.capacity}
            aria-valuenow={view.used}
          >
            <span style={{ width: `${Math.round(view.usage * 100)}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="kcf-head__upgrade press"
          onClick={onEquipment}
          data-testid="fridge-upgrade"
        >
          {view.maintenance !== "OPERATIONAL"
            ? view.maintenance === "BROKEN"
              ? "Repair →"
              : "Service →"
            : view.nextTier
              ? "Upgrade →"
              : "Equipment →"}
          <small>
            {view.maintenance !== "OPERATIONAL"
              ? `Condition ${view.condition}/100`
              : view.nextTier
                ? `${view.nextTier.capacity} units · ${formatUsd(view.nextTier.price)}`
                : "Top model"}
          </small>
        </button>
      </div>

      {/* Tier ladder: production names and capacities */}
      <ol className="kcf-tiers" aria-label="Refrigerator models">
        {view.tiers.map((t) => (
          <li
            key={t.id}
            className={cn(
              "kcf-tiers__step",
              t.rank === view.tier.rank && "kcf-tiers__step--current",
              t.rank < view.tier.rank && "kcf-tiers__step--past",
            )}
            aria-current={t.rank === view.tier.rank ? "true" : undefined}
          >
            <span className={cn("kcf-mini", `kcf-mini--${t.rank}`)} aria-hidden>
              {Array.from({ length: t.rank + 1 }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            <span className="kcf-tiers__name">{t.name.replace(" Refrigerator", "")}</span>
            <span className="kcf-tiers__cap">{t.capacity}</span>
          </li>
        ))}
      </ol>

      {/* Category tabs */}
      <div className="kcf-tabs no-scrollbar" role="tablist" aria-label="Show in the fridge">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={cn("kcf-tab press", tab === t && "kcf-tab--active")}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* The open fridge */}
      <div className="kcf-unit">
        <div className="kcf-cabinet">
          <span className="kcf-cabinet__light" aria-hidden />
          {cabinet.map((z) => (
            <Zone
              key={z.zone.id}
              zone={z.zone}
              items={z.items}
              selected={selectedId}
              onSelect={select}
              filtered={filtered}
            />
          ))}
          <div className="kcf-drawers">
            {drawers.map((z) => (
              <Zone
                key={z.zone.id}
                zone={z.zone}
                items={z.items}
                selected={selectedId}
                onSelect={select}
                filtered={filtered}
              />
            ))}
          </div>
        </div>
        <div className="kcf-door" data-testid="fridge-door">
          {door.map((z) => (
            <Zone
              key={z.zone.id}
              zone={z.zone}
              items={z.items}
              selected={selectedId}
              onSelect={select}
              filtered={filtered}
            />
          ))}
          {/* Decorative: never takes a tap, never covers an item. */}
          <span className="kcf-door__handle" aria-hidden data-testid="fridge-handle" />
        </div>
      </div>

      {view.unknown.length > 0 ? (
        <p className="kcf-unknown" data-testid="fridge-unknown">
          Unrecognised stock (not shown on the shelves): {view.unknown.join(", ")}
        </p>
      ) : null}

      {/* Secondary details for the tapped item */}
      {selected ? (
        <div ref={detailRef} className="kcf-detail" data-testid="fridge-detail" aria-live="polite">
          <div className="kcf-detail__head">
            <span className="kcf-detail__icon" aria-hidden>
              {INGREDIENT_EMOJI[selected.id]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="kcf-detail__name">
                {selected.name} · {qty(selected.id, selected.quantity)}
              </p>
              <p
                className={cn(
                  "kcf-detail__fresh",
                  selected.attention && selected.attention !== "low" && "kcf-detail__fresh--warn",
                )}
              >
                {selected.state.replace("_", " ").toLowerCase()} · {daysText(selected.daysLeft)} ·{" "}
                {formatUsd(selected.value)} in stock
              </p>
            </div>
            <button
              type="button"
              className="kcf-detail__close press"
              aria-label="Close details"
              onClick={() => setSelectedId(null)}
            >
              ✕
            </button>
          </div>
          <p className="kcf-detail__line">
            Paid {formatUsd(selected.unitCost)}/{purchaseUnitFor(selected.id)} on average ·{" "}
            {selected.group}
          </p>
          <p className="kcf-detail__line">
            {selected.usedIn.length > 0
              ? `Used in ${selected.usedIn.length} menu dish${selected.usedIn.length === 1 ? "" : "es"}: ${selected.usedIn.slice(0, 3).join(", ")}${selected.usedIn.length > 3 ? ` +${selected.usedIn.length - 3} more` : ""}`
              : "Not used by today's menu"}
          </p>
          <button
            type="button"
            className="kcf-btn press"
            onClick={() => onRestock(selected.id)}
            data-testid="fridge-detail-restock"
          >
            Buy more in the Market →
          </button>
        </div>
      ) : null}

      {/* Needs attention */}
      <div className="kcf-attention" data-testid="fridge-attention">
        <p className="kcf-attention__title">
          {view.attention.length > 0 ? "⚠ Needs attention" : "✓ Nothing needs attention"}
          {view.attention.length > 0 ? (
            <span className="kcf-zone__count">{view.attention.length}</span>
          ) : null}
        </p>
        {view.attention.length > 0 ? (
          <PanRow label="Items that need attention">
            {view.attention.map((a) => (
              <button
                key={a.id}
                type="button"
                data-attention={a.id}
                className={cn("kcf-att press", `kcf-att--${a.reason}`)}
                onClick={() => setSelectedId(a.id)}
              >
                <span aria-hidden>{INGREDIENT_EMOJI[a.id]}</span>
                <span className="kcf-att__text">
                  <strong>{a.name}</strong>
                  <em>
                    {REASON_TEXT[a.reason]} · {qty(a.id, a.quantity)}
                  </em>
                </span>
              </button>
            ))}
          </PanRow>
        ) : null}
        <button
          type="button"
          className="kcf-btn press"
          onClick={() => onRestock(view.attention[0]?.id)}
          data-testid="fridge-restock"
        >
          📦 Restock in the Market →
        </button>
      </div>
    </div>
  );
}
