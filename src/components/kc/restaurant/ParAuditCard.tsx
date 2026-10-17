import { KButton } from "@/components/kc/common/primitives";
import type { SaveData } from "@/game/SaveManager";
import { getSupplyItem, type SupplyId } from "@/game/business/businessSupplies";
import { AUDIT_EVERY, PAR_PER_SEAT, parAuditFor, type AuditRow } from "@/game/restaurant/parAudit";
import { InfoTip } from "@/components/kc/common/InfoTip";

/**
 * The opening card's par audit (parAudit.ts — every AUDIT_EVERY restaurant
 * days from AUDIT_FROM): the tableware and kitchen tools counted against their
 * par, what's short listed with Buy → the exact Market line. Read-only: it
 * never buys or moves anything (the Market does); Inventory stays read-only.
 */
export function ParAuditCard({
  save,
  level,
  onBuy,
}: {
  save: SaveData;
  level: number;
  onBuy: (id: SupplyId, packs: number) => void;
}) {
  const audit = parAuditFor(save, level);
  if (!audit) return null;
  const rows = [...audit.tableware, ...audit.tools];
  const short = rows.filter((r) => r.short > 0);
  return (
    <div
      className="mt-3 rounded-2xl border border-walnut/15 bg-ivory/70 p-2"
      data-testid="par-audit"
      data-short={audit.short}
    >
      <p className="flex items-center gap-1.5 font-ui text-[13px] font-extrabold text-walnut-dark">
        📋 Par audit · Day {audit.day}
        <InfoTip label="About the par audit">
          Every {AUDIT_EVERY} days: {PAR_PER_SEAT} of each piece a seat ({audit.seats} seats) and
          the tools today's dishes need. Broken pieces have already left the stock.
        </InfoTip>
      </p>
      <p className="font-ui text-[12px] leading-snug text-walnut/70">
        🔁 Every {AUDIT_EVERY} days · 💺 {audit.seats} seats × {PAR_PER_SEAT}
      </p>
      {short.length === 0 ? (
        <p className="mt-1 font-ui text-[13px] font-bold text-sage" data-testid="par-ok">
          ✓ Everything is at par ({rows.length} lines counted)
        </p>
      ) : (
        <div className="mt-1 space-y-1">
          {short.map((r) => (
            <AuditLine key={r.id} row={r} onBuy={onBuy} />
          ))}
          <p className="font-ui text-[12px] text-walnut/65">
            {rows.length - short.length} of {rows.length} lines at par.
          </p>
        </div>
      )}
    </div>
  );
}

function AuditLine({
  row,
  onBuy,
}: {
  row: AuditRow;
  onBuy: (id: SupplyId, packs: number) => void;
}) {
  const item = getSupplyItem(row.id);
  const packs = Math.max(1, Math.ceil(row.short / (item?.packSize ?? 1)));
  return (
    <div className="flex items-center gap-2" data-audit-line={row.id}>
      <span className="text-[20px]" aria-hidden>
        {item?.icon ?? "📦"}
      </span>
      <div className="min-w-0 flex-1 font-ui">
        <p className="truncate text-[13px] font-bold text-walnut-dark">
          {item?.name.split(" ·")[0] ?? row.id}
        </p>
        <p className="text-[12px] text-tomato">
          {row.have} of {row.par} · {row.short} short
        </p>
      </div>
      <KButton
        size="sm"
        variant="cream"
        className="min-h-12 shrink-0"
        onClick={() => onBuy(row.id, packs)}
      >
        Buy
      </KButton>
    </div>
  );
}
