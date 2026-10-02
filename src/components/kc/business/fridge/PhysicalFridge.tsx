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
  FridgeZoneId,
} from "@/game/business/fridgeView";
import "./PhysicalFridge.css";

const TABS = ["All", ...INGREDIENT_GROUPS.map((g) => g.label)];

const REASON_TEXT: Record<FridgeAttentionReason, string> = {
  expired: "Expired",
  "spoils-tonight": "Spoils tonight",
  expiring: "Use soon",
  low: "Low for today",
};

/** One row inside a compartment: a shelf, or a row of crisper drawers. */
type Row = { shelf: FridgeZoneId } | { drawers: FridgeZoneId[] };
type Layout = { leftDoor: FridgeZoneId[]; compartments: Row[][]; rightDoor: FridgeZoneId[] };

/**
 * Where each zone sits in each model, after the design references:
 * Basic — one compartment, the door open on the right;
 * Commercial — two compartments, both doors open;
 * Professional — three compartments, both outer doors open.
 * Dairy is always on a top shelf, raw meat and fish below it, produce in
 * the crisper drawers, butter and aromatics in the door bins.
 */
const LAYOUTS: Record<string, Layout> = {
  "basic-refrigerator": {
    leftDoor: [],
    compartments: [
      [
        { shelf: "dairy" },
        { shelf: "vegetables" },
        { shelf: "protein" },
        { drawers: ["fruit-drawer", "greens-drawer"] },
      ],
    ],
    rightDoor: ["door-butter", "door-aromatics"],
  },
  "commercial-refrigerator": {
    leftDoor: ["door-butter"],
    compartments: [
      [{ shelf: "dairy" }, { shelf: "protein" }, { drawers: ["greens-drawer"] }],
      [{ shelf: "vegetables" }, { drawers: ["fruit-drawer"] }],
    ],
    rightDoor: ["door-aromatics"],
  },
  "professional-refrigerator": {
    leftDoor: ["door-butter"],
    compartments: [
      [{ shelf: "dairy" }, { shelf: "protein" }],
      [{ shelf: "vegetables" }],
      [{ shelf: "greens-drawer" }, { drawers: ["fruit-drawer"] }],
    ],
    rightDoor: ["door-aromatics"],
  },
};

function qty(id: IngredientId, quantity: number): string {
  return `${formatQuantity(quantity)} ${purchaseUnitFor(id)}`;
}

function daysText(daysLeft: number): string {
  if (daysLeft <= 0) return "Expired";
  if (daysLeft === 1) return "Spoils tonight";
  return `${daysLeft} days left`;
}

/** How many pieces the crate shows: a hint of how full it is, from the real quantity. */
function pileSize(quantity: number): number {
  if (quantity < 2) return 1;
  if (quantity < 5) return 2;
  return 3;
}

/**
 * Content that pans sideways only when it is wider than its frame. Touch
 * pans natively (vertical swipes still scroll the page — `touch-action:
 * pan-x pan-y`); a mouse can drag it. A drag never counts as a tap. The
 * fades, the "›" cue and the hint show only when there is more to see.
 */
function Pan({
  label,
  className,
  hint,
  children,
}: {
  label: string;
  className?: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
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
  const overflow = edges.left || edges.right;

  return (
    <div
      className={cn(
        "kcf-pan",
        className,
        edges.left && "kcf-pan--more-left",
        edges.right && "kcf-pan--more-right",
      )}
      data-overflow={overflow ? "true" : "false"}
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
      {hint && overflow ? (
        <p className="kcf-pan__hint" aria-hidden>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A crate of food on a shelf or in a drawer, with its label card attached. */
function Crate({
  item,
  selected,
  onSelect,
}: {
  item: FridgeItem;
  selected: boolean;
  onSelect: (id: IngredientId) => void;
}) {
  const warn = item.attention !== null;
  const emoji = INGREDIENT_EMOJI[item.id];
  return (
    <button
      type="button"
      data-fridge-item={item.id}
      aria-pressed={selected}
      aria-label={`${item.name}: ${qty(item.id, item.quantity)}, ${daysText(item.daysLeft)}`}
      onClick={() => onSelect(item.id)}
      className={cn(
        "kcf-item press",
        warn && "kcf-item--warn",
        item.daysLeft <= 0 && "kcf-item--expired",
        selected && "kcf-item--selected",
      )}
    >
      <span className={cn("kcf-pile", `kcf-pile--${pileSize(item.quantity)}`)} aria-hidden>
        {Array.from({ length: pileSize(item.quantity) }, (_, i) => (
          <span key={i}>{emoji}</span>
        ))}
      </span>
      <span className="kcf-crate" aria-hidden />
      <span className="kcf-tag">
        <span className="kcf-tag__name">{item.name}</span>
        <span className="kcf-tag__row">
          <span className="kcf-tag__qty">
            {formatQuantity(item.quantity)}
            <small> {purchaseUnitFor(item.id)}</small>
          </span>
          <span className="kcf-tag__days">{item.daysLeft <= 0 ? "exp" : `${item.daysLeft}d`}</span>
        </span>
        <span className="kcf-tag__fresh" aria-hidden>
          <span style={{ width: `${Math.max(4, Math.round(item.freshness * 100))}%` }} />
        </span>
      </span>
    </button>
  );
}

/** A door-bin item: a jar or pack standing in the bin, its tag in front. */
function BinItem({
  item,
  selected,
  onSelect,
}: {
  item: FridgeItem;
  selected: boolean;
  onSelect: (id: IngredientId) => void;
}) {
  return (
    <button
      type="button"
      data-fridge-item={item.id}
      aria-pressed={selected}
      aria-label={`${item.name}: ${qty(item.id, item.quantity)}, ${daysText(item.daysLeft)}`}
      onClick={() => onSelect(item.id)}
      className={cn(
        "kcf-item kcf-item--compact press",
        item.attention !== null && "kcf-item--warn",
        item.daysLeft <= 0 && "kcf-item--expired",
        selected && "kcf-item--selected",
      )}
    >
      <span className="kcf-bin-item__icon" aria-hidden>
        {INGREDIENT_EMOJI[item.id]}
      </span>
      <span className="kcf-tag kcf-tag--bin">
        <span className="kcf-tag__name">{item.name}</span>
        <span className="kcf-tag__qty">
          {formatQuantity(item.quantity)}
          <small> {purchaseUnitFor(item.id)}</small>
        </span>
        <span className="kcf-tag__fresh" aria-hidden>
          <span style={{ width: `${Math.max(4, Math.round(item.freshness * 100))}%` }} />
        </span>
        <span className="kcf-tag__days">{item.daysLeft <= 0 ? "exp" : `${item.daysLeft}d`}</span>
      </span>
    </button>
  );
}

type ZoneProps = {
  zone: FridgeZone;
  items: FridgeItem[];
  selected: IngredientId | null;
  onSelect: (id: IngredientId) => void;
  filtered: boolean;
};

function Sign({ zone }: { zone: FridgeZone }) {
  return (
    <p className="kcf-sign">
      <span aria-hidden>{zone.icon}</span> {zone.label}
    </p>
  );
}

function Shelf({ zone, items, selected, onSelect, filtered }: ZoneProps) {
  return (
    <section
      className="kcf-zone kcf-zone--shelf"
      data-fridge-zone={zone.id}
      aria-label={`${zone.label}: ${items.length} item${items.length === 1 ? "" : "s"}`}
    >
      <Sign zone={zone} />
      {items.length === 0 ? (
        <p className="kcf-zone__empty">{filtered ? "—" : "Empty shelf"}</p>
      ) : (
        <div className="kcf-zone__items">
          {items.map((item) => (
            <Crate key={item.id} item={item} selected={selected === item.id} onSelect={onSelect} />
          ))}
        </div>
      )}
      <span className="kcf-shelf-glass" aria-hidden />
    </section>
  );
}

function Drawer({ zone, items, selected, onSelect, filtered }: ZoneProps) {
  return (
    <section
      className="kcf-zone kcf-zone--drawer"
      data-fridge-zone={zone.id}
      aria-label={`${zone.label} drawer: ${items.length} item${items.length === 1 ? "" : "s"}`}
    >
      <Sign zone={zone} />
      {items.length === 0 ? (
        <p className="kcf-zone__empty">{filtered ? "—" : "Empty"}</p>
      ) : (
        <div className="kcf-zone__items">
          {items.map((item) => (
            <Crate key={item.id} item={item} selected={selected === item.id} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function Door({
  side,
  zones,
  props,
}: {
  side: "left" | "right";
  zones: FridgeZoneId[];
  props: Omit<ZoneProps, "zone" | "items"> & {
    itemsOf: (id: FridgeZoneId) => FridgeItem[];
    zoneOf: (id: FridgeZoneId) => FridgeZone;
  };
}) {
  return (
    <div className={cn("kcf-door", side === "left" && "kcf-door--left")} data-testid="fridge-door">
      {zones.map((id) => {
        const zone = props.zoneOf(id);
        const items = props.itemsOf(id);
        return (
          <section
            key={id}
            className="kcf-zone kcf-zone--door"
            data-fridge-zone={id}
            aria-label={`${zone.label} door bin: ${items.length} item${items.length === 1 ? "" : "s"}`}
          >
            <p className="kcf-sign kcf-sign--door">{zone.label}</p>
            {items.length === 0 ? (
              <p className="kcf-zone__empty">{props.filtered ? "—" : "Empty"}</p>
            ) : (
              <div className="kcf-zone__bin">
                {items.map((item) => (
                  <BinItem
                    key={item.id}
                    item={item}
                    selected={props.selected === item.id}
                    onSelect={props.onSelect}
                  />
                ))}
              </div>
            )}
            <span className="kcf-bin-lip" aria-hidden />
          </section>
        );
      })}
      {/* Decorative: on the door's own outer edge, never over a bin, never takes a tap. */}
      <span className="kcf-door__handle" aria-hidden data-testid="fridge-handle" />
    </div>
  );
}

/** A small drawing of each model — one, two or three steel doors (Basic is the enamel one). */
export function FridgeMini({ rank, className }: { rank: number; className?: string }) {
  return (
    <span className={cn("kcf-mini", `kcf-mini--${rank}`, className)} aria-hidden>
      {Array.from({ length: rank + 1 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

/**
 * The physical refrigerator at the top of Business → Inventory, drawn after
 * the design references: the current model's appliance standing open, its
 * shelves, crisper drawers and door bins filled from the save
 * (fridgeView.ts). Display and navigation only — the parent passes
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
  const byZone = useMemo(() => {
    const map = new Map<FridgeZoneId, { zone: FridgeZone; items: FridgeItem[] }>();
    for (const z of view.zones)
      map.set(z.zone.id, {
        zone: z.zone,
        items: filtered ? z.items.filter((i) => i.group === tab) : z.items,
      });
    return map;
  }, [view.zones, filtered, tab]);
  const selected = view.items.find((i) => i.id === selectedId) ?? null;
  const full = view.available <= 0;
  const select = (id: IngredientId) => setSelectedId((cur) => (cur === id ? null : id));
  const detailRef = useRef<HTMLDivElement>(null);
  // Bring the tapped item's details into view (they sit under the fridge).
  useEffect(() => {
    if (!selectedId) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selectedId]);

  const layout = LAYOUTS[view.tier.id] ?? LAYOUTS["basic-refrigerator"]!;
  const zoneOf = (id: FridgeZoneId) => byZone.get(id)!.zone;
  const itemsOf = (id: FridgeZoneId) => byZone.get(id)?.items ?? [];
  const zoneProps = (id: FridgeZoneId): ZoneProps => ({
    zone: zoneOf(id),
    items: itemsOf(id),
    selected: selectedId,
    onSelect: select,
    filtered,
  });
  const doorProps = { selected: selectedId, onSelect: select, filtered, itemsOf, zoneOf };
  const steel = view.tier.rank > 0;
  const statusClass = view.maintenance !== "OPERATIONAL" && "kcf-head__warn";

  return (
    <div
      className={cn("kcf", `kcf--${view.tier.id}`)}
      data-testid="physical-fridge"
      data-tier={view.tier.id}
    >
      {/* The model's wooden sign */}
      <div className="kcf-plaque">
        <p className="kcf-plaque__name">{view.tier.name}</p>
        <p className="kcf-plaque__line">{view.tier.description}</p>
      </div>

      {/* Stats bar: space, cooling, upgrade */}
      <div className="kcf-head">
        <div className="kcf-head__model">
          <p className="kcf-head__meta" data-testid="fridge-capacity">
            <span aria-hidden>🧺 </span>
            {formatQuantity(view.used)} / {view.capacity} units
            <span aria-hidden> · </span>
            <span data-testid="fridge-cooling" className={cn(statusClass)}>
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

      {/* Category tabs */}
      <div className="kcf-tabs" role="tablist" aria-label="Show in the fridge">
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

      {/* The open appliance */}
      <Pan
        label={`${view.tier.name}, open`}
        className="kcf-stage"
        hint={steel ? "Swipe to see every door →" : undefined}
      >
        <div className="kcf-unit" data-testid="fridge-unit">
          {steel ? (
            <div className="kcf-topper" aria-hidden>
              <span className="kcf-topper__vent" />
              <span className={cn("kcf-topper__display", statusClass)}>
                ❄ {view.maintenance === "OPERATIONAL" ? "COOL" : "CHECK"}
              </span>
            </div>
          ) : null}
          <div className="kcf-body">
            {layout.leftDoor.length > 0 ? (
              <Door side="left" zones={layout.leftDoor} props={doorProps} />
            ) : null}
            {layout.compartments.map((rows, ci) => (
              <div key={ci} className="kcf-cabinet">
                <span className="kcf-cabinet__light" aria-hidden />
                {rows.map((row) =>
                  "shelf" in row ? (
                    <Shelf key={row.shelf} {...zoneProps(row.shelf)} />
                  ) : (
                    <div key={row.drawers.join()} className="kcf-drawers">
                      {row.drawers.map((id) => (
                        <Drawer key={id} {...zoneProps(id)} />
                      ))}
                    </div>
                  ),
                )}
              </div>
            ))}
            {layout.rightDoor.length > 0 ? (
              <Door side="right" zones={layout.rightDoor} props={doorProps} />
            ) : null}
          </div>
          {steel ? <div className="kcf-kick" aria-hidden /> : null}
        </div>
      </Pan>

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
        <div className="kcf-attention__head">
          <p className="kcf-attention__title">
            {view.attention.length > 0 ? (
              <>
                <span className="kcf-attention__bang" aria-hidden>
                  !
                </span>
                Needs Attention
                <span className="kcf-zone__count">{view.attention.length}</span>
              </>
            ) : (
              "✓ Nothing needs attention"
            )}
          </p>
          <button
            type="button"
            className="kcf-restock press"
            onClick={() => onRestock(view.attention[0]?.id)}
            data-testid="fridge-restock"
          >
            📦 Restock in the Market →
          </button>
        </div>
        {view.attention.length > 0 ? (
          <Pan label="Items that need attention" className="kcf-attention__pan">
            {view.attention.map((a) => {
              const item = view.items.find((i) => i.id === a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  data-attention={a.id}
                  className={cn("kcf-att press", `kcf-att--${a.reason}`)}
                  onClick={() => setSelectedId(a.id)}
                >
                  <span className="kcf-att__icon" aria-hidden>
                    {INGREDIENT_EMOJI[a.id]}
                  </span>
                  <span className="kcf-att__text">
                    <strong>{a.name}</strong>
                    <b>{qty(a.id, a.quantity)}</b>
                    <span className="kcf-att__bar" aria-hidden>
                      <span
                        style={{
                          width: `${Math.max(6, Math.round((item?.freshness ?? 0) * 100))}%`,
                        }}
                      />
                    </span>
                    <em>{REASON_TEXT[a.reason]}</em>
                  </span>
                </button>
              );
            })}
          </Pan>
        ) : null}
      </div>
    </div>
  );
}
