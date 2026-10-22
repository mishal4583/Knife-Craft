import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A shop item's picture (market/ShopCard): a warm, softly lit market stall
 * behind the item. The products are drawn with emoji (there is no per-item
 * art). `crate` piles the item in a wooden produce crate with a checked cloth
 * (ingredients, developer 2026-10-22); otherwise it stands on a lit display.
 * `children` sits in the top-right corner (the stock / owned pill), `sign` is
 * a small chalkboard ("Fresh Produce").
 */
export function ShopItemArt({
  icon,
  children,
  className,
  crate = false,
  sign,
}: {
  icon: ReactNode;
  children?: ReactNode;
  className?: string;
  crate?: boolean;
  sign?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "shop-stage",
        crate && "shop-stage--crate",
        children ? "shop-stage--badge" : null,
        className,
      )}
      data-testid="shop-item-art"
    >
      {children ? <div className="absolute right-1.5 top-1.5 z-10">{children}</div> : null}
      {crate ? (
        <>
          <span className="shop-stage__pile" aria-hidden>
            <span className="shop-stage__pile-a">{icon}</span>
            <span className="shop-stage__pile-b">{icon}</span>
            <span className="shop-stage__pile-c">{icon}</span>
          </span>
          <span className="shop-stage__item shop-stage__item--front" aria-hidden>
            {icon}
          </span>
          <span className="shop-stage__crate" aria-hidden />
          <span className="shop-stage__cloth" aria-hidden />
        </>
      ) : (
        <span className="shop-stage__item" aria-hidden>
          {icon}
        </span>
      )}
      {sign ? (
        <span className="shop-stage__sign" aria-hidden>
          {sign}
        </span>
      ) : null}
    </div>
  );
}

/** The dark green "1.29 KG / IN STOCK" pill on a picture. */
export function StockPill({ amount, label }: { amount: string; label: string }) {
  return (
    <span className="shop-stock-pill" data-testid="stock-pill">
      <span className="shop-stock-pill__crate" aria-hidden>
        🧺
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-ui text-[11px] font-black uppercase">{amount}</span>{" "}
        <span className="font-ui text-[9px] font-extrabold uppercase tracking-wide opacity-90">
          {label}
        </span>
      </span>
    </span>
  );
}
