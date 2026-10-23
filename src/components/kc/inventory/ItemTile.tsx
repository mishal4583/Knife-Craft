import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TileTone = "urgent" | "low" | "ok" | "none";

const PLATE: Record<TileTone, string> = {
  urgent: "border-tomato/45 shadow-[0_0_0_3px_rgba(200,80,60,0.12)]",
  low: "border-copper/45 shadow-[0_0_0_3px_rgba(190,120,50,0.12)]",
  ok: "border-olive/35",
  none: "border-walnut/15 opacity-70",
};

const AMOUNT: Record<TileTone, string> = {
  urgent: "bg-tomato/12 text-tomato",
  low: "bg-copper/15 text-copper",
  ok: "bg-sage/20 text-olive",
  none: "bg-walnut/8 text-walnut/60",
};

/**
 * An item's picture for Inventory (developer 2026-10-23: "show pictures of
 * what needs restocking"): the item's emoji on a warm round plate, with an
 * optional corner badge (⛔ / 🟠 / 🗑️ …). The game has no per-item art; the
 * same emoji are the Market cards' pictures.
 */
export function ItemPic({
  icon,
  tone = "ok",
  badge,
  size = 56,
}: {
  icon: string;
  tone?: TileTone;
  badge?: string | undefined;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border-2 bg-[radial-gradient(circle_at_50%_30%,#fffaf0,#f3dfb8_70%,#e7c995)]",
        PLATE[tone],
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.56) }}
    >
      <span className="leading-none drop-shadow-[0_2px_1px_rgba(60,30,10,0.25)]">{icon}</span>
      {badge ? (
        <span className="absolute -right-1 -top-1 grid h-[22px] min-w-[22px] place-items-center rounded-full border border-walnut/15 bg-ivory px-0.5 text-[12px] leading-none shadow-soft">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

/** The amount chip under a tile's name: "0 / 0.3 lb", "Empty", "12". */
export function AmountChip({ tone = "ok", children }: { tone?: TileTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full break-words rounded-full px-2 py-0.5 font-ui text-[12px] font-black tabular-nums leading-tight",
        AMOUNT[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * A picture tile: plate, short name (two lines at most), amount chip and an
 * optional action word ("Restock ›"). The whole tile is one button (≥ 48 px);
 * `label` is its full accessible name (the long sentence lives there).
 */
export function ItemTile({
  icon,
  name,
  amount,
  tone = "ok",
  badge,
  action,
  label,
  onClick,
  className,
  children,
}: {
  icon: string;
  name: string;
  amount?: ReactNode;
  tone?: TileTone;
  badge?: string | undefined;
  action?: string | undefined;
  label: string;
  onClick: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "press flex min-h-[124px] w-full min-w-0 flex-col items-center gap-1 rounded-[16px] border border-walnut/12 bg-ivory/80 px-1.5 pb-1.5 pt-2 text-center shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]",
        className,
      )}
    >
      <ItemPic icon={icon} tone={tone} badge={badge} />
      <span className="line-clamp-2 w-full font-ui text-[12px] font-extrabold leading-tight text-walnut-dark">
        {name}
      </span>
      {amount !== undefined ? <AmountChip tone={tone}>{amount}</AmountChip> : null}
      {children}
      {action ? (
        <span className="mt-auto font-ui text-[11.5px] font-extrabold text-copper">{action}</span>
      ) : null}
    </button>
  );
}
