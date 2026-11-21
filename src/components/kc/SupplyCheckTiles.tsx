import { cn } from "@/lib/utils";
import { getSupplyItem } from "@/game/business/businessSupplies";
import type { SupplyCheckRow } from "@/game/restaurant/serviceSupplies";
import { SupplyIcon } from "@/components/kc/common/SupplyIcon";

/**
 * "Next service · cutlery & supplies" of Daily Maintenance as picture tiles (developer 2026-11-21: "add proper assets to this and make it digitalized"), the
 * look of the freshness watch (`FreshnessWatch.tsx`): every plate, fork, glass and bag is its painted Market picture (`public/business/supplies/`, the 62
 * `SupplyIcon`s) on a round plate, with the have / need count and a bar. A row that is short is a big tile with its Restock button (red when the service
 * cannot start without it, gold when it is only for the menu guests); a row that is covered is a small ready chip. Same rows, same actions as before.
 */

type Parts = { name: string; size: string; tags: string[] };

/** "Dinner plates · 10½ in · for menu guests" -> name "Dinner plates", size "10½ in", tag "Menu guests". */
function supplyParts(label: string): Parts {
  const out: Parts = { name: "", size: "", tags: [] };
  const rest: string[] = [];
  for (const part of label.split(" · ")) {
    if (/^for menu guests$/i.test(part)) out.tags.push("Menu guests");
    else if (/^takeaway$/i.test(part)) out.tags.push("Takeaway");
    else if (/^\d+ tables?$/i.test(part)) out.tags.push(part);
    else rest.push(part);
  }
  out.name = rest[0] ?? label;
  out.size = rest.slice(1).join(" · ");
  return out;
}

function Picture({ id, className }: { id: string; className?: string }) {
  const item = getSupplyItem(id);
  return (
    <span className={cn("relative grid place-items-center", className)}>
      <span
        aria-hidden="true"
        className="absolute inset-[3%] rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.95),rgba(240,222,186,0.7)_58%,rgba(220,190,140,0.25)_74%,transparent_76%)]"
      />
      <span className="relative grid h-[74%] w-[74%] place-items-center text-[40px] drop-shadow-[0_4px_4px_rgba(60,35,15,0.3)]">
        <SupplyIcon
          id={id}
          fallback={item?.icon ?? "📦"}
          className="!h-full !w-full !align-baseline"
        />
      </span>
    </span>
  );
}

export function SupplyShortTile({
  row,
  onRestock,
  softLabel = "Optional",
  action = "Restock",
}: {
  row: SupplyCheckRow;
  onRestock: () => void;
  /** The chip of a short row that does not block (menu guests: "Optional"; tonight's close: "Low"). */
  softLabel?: string;
  /** The button's word ("Restock", "Get tool"). */
  action?: string;
}) {
  const p = supplyParts(row.label);
  const blocking = row.blocking;
  const ratio = row.need > 0 ? Math.min(1, row.have / row.need) : 1;
  return (
    <li
      data-testid="supply-tile"
      data-supply={row.id}
      data-short="true"
      data-blocking={blocking ? "true" : "false"}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border-2 bg-gradient-to-b from-ivory to-cream p-2.5",
        blocking
          ? "border-tomato/45 shadow-[0_3px_0_rgba(184,60,48,0.16),0_8px_16px_rgba(60,35,15,0.10)]"
          : "border-gold/55 shadow-[0_3px_0_rgba(200,150,50,0.2),0_8px_16px_rgba(60,35,15,0.10)]",
      )}
    >
      <p
        className={cn(
          "flex w-full items-center gap-1 rounded-full px-2 py-1 font-ui text-[10.5px] font-extrabold leading-none",
          blocking ? "bg-tomato/12 text-tomato" : "bg-gold/25 text-copper",
        )}
      >
        <span aria-hidden="true">{blocking ? "⛔" : "⚠️"}</span>
        <span className="truncate">{blocking ? "Needed" : softLabel}</span>
      </p>
      <Picture id={row.id} className="mx-auto mt-1.5 aspect-square w-full max-w-[112px]" />
      <p className="mt-1 line-clamp-2 min-h-[2.3em] text-center font-display text-[14px] font-black leading-[1.15] text-walnut-dark">
        {p.name}
      </p>
      <p className="truncate text-center font-ui text-[10.5px] font-bold text-walnut/55">
        {[p.size, ...p.tags.filter((t) => t !== "Menu guests")].filter(Boolean).join(" · ") || " "}
      </p>
      <div className="mt-auto pt-1.5">
        <div className="flex items-baseline justify-between font-ui text-[10px] font-extrabold uppercase tracking-wide text-walnut/55">
          <span>Have / need</span>
          <span className={cn("text-[13px] normal-case", blocking ? "text-tomato" : "text-copper")}>
            {row.have} / {row.need}
          </span>
        </div>
        <div
          role="meter"
          aria-label={`${p.name}: ${row.have} of ${row.need}`}
          aria-valuemin={0}
          aria-valuemax={row.need}
          aria-valuenow={row.have}
          className="mt-0.5 h-2 overflow-hidden rounded-full bg-walnut/10 ring-1 ring-inset ring-walnut/10"
        >
          <span
            className={cn("block h-full rounded-full", blocking ? "bg-tomato" : "bg-gold")}
            style={{ width: `${Math.max(6, Math.round(ratio * 100))}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onRestock}
          className={cn(
            "press mt-2 min-h-11 w-full rounded-full px-3 font-ui text-[12px] font-extrabold text-ivory shadow-[0_2px_0_rgba(60,35,15,0.25)]",
            blocking ? "bg-tomato" : "bg-walnut",
          )}
        >
          {action} ›
        </button>
      </div>
    </li>
  );
}

export function SupplyReadyChip({ row }: { row: SupplyCheckRow }) {
  const p = supplyParts(row.label);
  return (
    <li
      data-testid="supply-tile"
      data-supply={row.id}
      data-short="false"
      className="flex min-w-0 items-center gap-2 rounded-2xl border border-sage/45 bg-gradient-to-b from-ivory to-cream p-1.5 pr-2.5 shadow-[0_2px_0_rgba(110,140,90,0.14)]"
    >
      <Picture id={row.id} className="h-[46px] w-[46px] shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-ui text-[12px] font-extrabold leading-tight text-walnut-dark">
          {p.name}
        </span>
        <span className="block truncate font-ui text-[10.5px] font-bold leading-tight text-walnut/55">
          {[p.size, ...p.tags].filter(Boolean).join(" · ") || " "}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-sage/20 px-2 py-1 font-ui text-[11px] font-extrabold text-olive">
        ✓ {row.have}/{row.need}
      </span>
    </li>
  );
}

/** The rows that are short as big tiles, then the covered ones as chips. */
export function SupplyCheckGrid({
  rows,
  onRestock,
  softLabel,
  action,
}: {
  rows: SupplyCheckRow[];
  onRestock: (row: SupplyCheckRow) => void;
  softLabel?: string;
  action?: string;
}) {
  const short = rows.filter((r) => r.missing > 0);
  const ready = rows.filter((r) => r.missing <= 0);
  const key = (r: SupplyCheckRow) => `${r.id}-${r.guest ? "guest" : "service"}`;
  return (
    <div data-testid="supply-grid" className="mt-3 space-y-3">
      {short.length ? (
        <ul className="grid grid-cols-2 gap-2.5 land:grid-cols-4 landx:grid-cols-5">
          {short.map((row) => (
            <SupplyShortTile
              key={key(row)}
              row={row}
              onRestock={() => onRestock(row)}
              {...(softLabel ? { softLabel } : {})}
              {...(action ? { action } : {})}
            />
          ))}
        </ul>
      ) : null}
      {ready.length ? (
        <div>
          <p className="mb-1.5 font-ui text-[10.5px] font-extrabold uppercase tracking-wider text-olive">
            ✓ Ready · {ready.length}
          </p>
          <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 land:grid-cols-3 landx:grid-cols-4">
            {ready.map((row) => (
              <SupplyReadyChip key={key(row)} row={row} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
