import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { displayMeasure, formatStockAmount, itemCount } from "@/game/business/measure";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import type { IngredientId } from "@/game/definitions";
import type { FridgeItem, FridgeView, FridgeZone, FridgeZoneId } from "@/game/business/fridgeView";
import "./PhysicalFridge.css";

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

/** A crate's amount in the player's measure (Settings → Weights). */
function qty(id: IngredientId, quantity: number): string {
  return formatStockAmount(id, quantity, displayMeasure());
}

/** The amount on a crate tag: the number, then its unit small. */
function TagQty({ id, quantity }: { id: IngredientId; quantity: number }) {
  const [n, ...unit] = qty(id, quantity).split(" ");
  return (
    <>
      {n}
      <small> {unit.join(" ")}</small>
    </>
  );
}

function daysText(daysLeft: number): string {
  if (daysLeft <= 0) return "Expired";
  if (daysLeft === 1) return "Spoils tonight";
  return `${daysLeft} days left`;
}

/** How many pieces the crate shows: a hint of how full it is, from the real quantity. */
/** 1–3 pieces drawn in a crate: how many whole items it holds (a 0.6 lb crate of tomatoes shows 2). */
function pileSize(id: IngredientId, quantity: number): number {
  const items = itemCount(id, quantity);
  if (items < 1.5) return 1;
  if (items < 2.5) return 2;
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
      <span className={cn("kcf-pile", `kcf-pile--${pileSize(item.id, item.quantity)}`)} aria-hidden>
        {Array.from({ length: pileSize(item.id, item.quantity) }, (_, i) => (
          <span key={i}>{emoji}</span>
        ))}
      </span>
      <span className="kcf-crate" aria-hidden />
      <span className="kcf-tag">
        <span className="kcf-tag__name">{item.name}</span>
        <span className="kcf-tag__row">
          <span className="kcf-tag__qty">
            <TagQty id={item.id} quantity={item.quantity} />
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
          <TagQty id={item.id} quantity={item.quantity} />
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

/** True below the 768 px tablet breakpoint (a phone), following resizes and rotations. */
function useNarrowViewport(): boolean {
  const query = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(() =>
    typeof window === "undefined" || !window.matchMedia ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** One page of the phone view: a door, or one compartment (Unified Restaurant cleanup, task #14). */
type Page =
  | { kind: "door"; side: "left" | "right"; zones: FridgeZoneId[] }
  | { kind: "cabinet"; rows: Row[] };

function pagesOf(layout: Layout): Page[] {
  return [
    ...(layout.leftDoor.length
      ? [{ kind: "door" as const, side: "left" as const, zones: layout.leftDoor }]
      : []),
    ...layout.compartments.map((rows) => ({ kind: "cabinet" as const, rows })),
    ...(layout.rightDoor.length
      ? [{ kind: "door" as const, side: "right" as const, zones: layout.rightDoor }]
      : []),
  ];
}

function zonesOfPage(page: Page): FridgeZoneId[] {
  return page.kind === "door"
    ? page.zones
    : page.rows.flatMap((r) => ("shelf" in r ? [r.shelf] : r.drawers));
}

/**
 * One page at a time, for a phone where the open steel fridge is wider than
 * the screen: "‹ Dairy & Tofu · Meat, Fish & Bread  2 / 5 ›", previous/next
 * buttons and a sideways swipe (a vertical swipe still scrolls the page —
 * `touch-action: pan-y`). A swipe never counts as a tap on an item.
 */
function Pager({
  names,
  index,
  setIndex,
  children,
}: {
  names: string[];
  index: number;
  setIndex: (i: number) => void;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = names.length - 1;
  const turnTo = (i: number) => setIndex(Math.max(0, Math.min(last, i)));
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s0 = start.current;
    start.current = null;
    if (!s0) return;
    const dx = e.clientX - s0.x;
    const dy = e.clientY - s0.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // Swallow the click that ends a swipe so it never opens an item.
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    turnTo(index + (dx < 0 ? 1 : -1));
  };
  return (
    <div className="kcf-pager" data-testid="fridge-pager">
      <div className="kcf-pager__bar">
        <button
          type="button"
          className="kcf-pager__btn press"
          aria-label="Previous compartment"
          disabled={index === 0}
          onClick={() => turnTo(index - 1)}
        >
          ‹
        </button>
        <p className="kcf-pager__title" aria-live="polite">
          <span className="kcf-pager__name" data-testid="fridge-page-name">
            {names[index]}
          </span>
          <span className="kcf-pager__count" data-testid="fridge-page-count">
            {index + 1} / {names.length}
          </span>
        </p>
        <button
          type="button"
          className="kcf-pager__btn press"
          aria-label="Next compartment"
          disabled={index === last}
          onClick={() => turnTo(index + 1)}
        >
          ›
        </button>
      </div>
      <div
        className="kcf-pager__swipe"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (start.current = null)}
      >
        {children}
      </div>
      <p className="kcf-pager__dots" aria-hidden>
        {names.map((n, i) => (
          <span key={n + i} className={cn(i === index && "kcf-pager__dot--on")} />
        ))}
      </p>
    </div>
  );
}

/**
 * The physical refrigerator on the Inventory screen, drawn after the design
 * references: the current model's appliance standing open, its shelves,
 * crisper drawers and door bins filled from the save (fridgeView.ts).
 * Display only. Tapping an item calls `onSelect` (the Inventory screen shows
 * its details); the header's button calls `onEquipment` (Business →
 * Equipment, where upgrades and repairs are bought). Nothing here moves
 * money, stock or the save.
 */
export function PhysicalFridge({
  view,
  selectedId,
  onSelect,
  onEquipment,
}: {
  view: FridgeView;
  selectedId: IngredientId | null;
  onSelect: (id: IngredientId) => void;
  /** Absent before the Restaurant section opens (first levels): no upgrade button then. */
  onEquipment?: (() => void) | undefined;
}) {
  const byZone = useMemo(() => {
    const map = new Map<FridgeZoneId, { zone: FridgeZone; items: FridgeItem[] }>();
    for (const z of view.zones) map.set(z.zone.id, { zone: z.zone, items: z.items });
    return map;
  }, [view.zones]);
  const full = view.available <= 0;

  const layout = LAYOUTS[view.tier.id] ?? LAYOUTS["basic-refrigerator"]!;
  const zoneOf = (id: FridgeZoneId) => byZone.get(id)!.zone;
  const itemsOf = (id: FridgeZoneId) => byZone.get(id)?.items ?? [];
  const zoneProps = (id: FridgeZoneId): ZoneProps => ({
    zone: zoneOf(id),
    items: itemsOf(id),
    selected: selectedId,
    onSelect,
    filtered: false,
  });
  const doorProps = { selected: selectedId, onSelect, filtered: false, itemsOf, zoneOf };
  const steel = view.tier.rank > 0;
  const statusClass = view.maintenance !== "OPERATIONAL" && "kcf-head__warn";

  // Phone view (task #14): below the 768 px tablet breakpoint, a steel model
  // that is wider than its frame shows one door or compartment at a time
  // instead of panning sideways. Tablets and desktops keep the wide, panning
  // appliance. A small toggle switches between the two wherever the fridge
  // doesn't fit. The wide view is measured; it pages only when it overflows.
  const rootRef = useRef<HTMLDivElement>(null);
  const naturalWidth = useRef(0);
  const [overflows, setOverflows] = useState(false);
  const [prefer, setPrefer] = useState<"auto" | "wide" | "paged">("auto");
  const narrow = useNarrowViewport();
  const paged = steel && overflows && (prefer === "paged" || (prefer === "auto" && narrow));
  // Opens on the first compartment (dairy on top), not the door bins.
  const firstCabinet = layout.leftDoor.length > 0 ? 1 : 0;
  const [page, setPage] = useState(firstCabinet);
  const pages = useMemo(() => pagesOf(layout), [layout]);
  const pageNames = pages.map((p) => {
    const labels = zonesOfPage(p).map((id) => zoneOf(id).label);
    return p.kind === "door" ? `Door · ${labels.join(" & ")}` : labels.join(" · ");
  });
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // The wide view: does the appliance overflow its frame? The paged view:
    // would the measured wide appliance fit again (a rotation, a wider frame)?
    const measure = () => {
      if (!steel) return setOverflows(false);
      if (paged) {
        if (root.clientWidth >= naturalWidth.current + 2) setOverflows(false);
        return;
      }
      const unit = root.querySelector<HTMLElement>('[data-testid="fridge-unit"]');
      const track = root.querySelector<HTMLElement>(".kcf-stage .kcf-pan__track");
      if (!unit || !track) return;
      const over = unit.scrollWidth > track.clientWidth + 2;
      if (over) naturalWidth.current = unit.scrollWidth;
      setOverflows(over);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [steel, paged, view]);
  useEffect(() => {
    if (page > pages.length - 1) setPage(firstCabinet);
  }, [page, pages.length, firstCabinet]);
  const current = pages[Math.min(page, pages.length - 1)]!;

  return (
    <div
      ref={rootRef}
      className={cn("kcf", `kcf--${view.tier.id}`, paged && "kcf--paged")}
      data-testid="physical-fridge"
      data-tier={view.tier.id}
      data-paged={paged ? "true" : "false"}
    >
      {/* The model's wooden sign */}
      <div className="kcf-plaque">
        <p className="kcf-plaque__name">❄️ {view.tier.name}</p>
        <p className="kcf-plaque__line">{view.tier.description}</p>
      </div>

      {/* Stats bar: space, cooling, upgrade */}
      <div className="kcf-head">
        <div className="kcf-head__model">
          <p className="kcf-head__meta" data-testid="fridge-capacity">
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
          <p className="kcf-head__free" data-testid="fridge-available">
            {formatQuantity(view.available)} units available
          </p>
        </div>
        {onEquipment ? (
          <button
            type="button"
            className="kcf-head__upgrade press"
            onClick={onEquipment}
            data-testid="fridge-upgrade"
          >
            {view.maintenance !== "OPERATIONAL"
              ? view.maintenance === "BROKEN"
                ? "Repair Refrigerator →"
                : "Service Refrigerator →"
              : view.nextTier
                ? "Upgrade Refrigerator →"
                : "View Equipment →"}
            <small>
              {view.maintenance !== "OPERATIONAL"
                ? `Condition ${view.condition}/100`
                : view.nextTier
                  ? `${view.nextTier.name.replace(" Refrigerator", "")} · ${view.nextTier.capacity} units · ${formatUsd(view.nextTier.price)}`
                  : "Top model"}
            </small>
          </button>
        ) : null}
      </div>

      {/* The open appliance — one page at a time on a phone (task #14) */}
      {paged ? (
        <Pager names={pageNames} index={Math.min(page, pages.length - 1)} setIndex={setPage}>
          <div className="kcf-stage" data-overflow="false">
            <div className="kcf-unit kcf-unit--paged" data-testid="fridge-unit">
              <div className="kcf-topper" aria-hidden>
                <span className="kcf-topper__vent" />
                <span className={cn("kcf-topper__display", statusClass)}>
                  ❄ {view.maintenance === "OPERATIONAL" ? "COOL" : "CHECK"}
                </span>
              </div>
              <div className="kcf-body">
                {current.kind === "door" ? (
                  <Door side={current.side} zones={current.zones} props={doorProps} />
                ) : (
                  <div className="kcf-cabinet">
                    <span className="kcf-cabinet__light" aria-hidden />
                    {current.rows.map((row) =>
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
                )}
              </div>
              <div className="kcf-kick" aria-hidden />
            </div>
          </div>
        </Pager>
      ) : (
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
      )}

      {steel && overflows ? (
        <button
          type="button"
          className="kcf-viewtoggle press"
          data-testid="fridge-view-toggle"
          onClick={() => setPrefer(paged ? "wide" : "paged")}
        >
          {paged ? "Show the whole fridge ⇆" : "One door at a time"}
        </button>
      ) : null}

      {view.unknown.length > 0 ? (
        <p className="kcf-unknown" data-testid="fridge-unknown">
          Unrecognised stock (not shown on the shelves): {view.unknown.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
