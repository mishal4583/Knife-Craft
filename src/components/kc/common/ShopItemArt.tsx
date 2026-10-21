import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A shop item's picture on a lit display stand, so the Market reads like a game
 * shop. The products are drawn with emoji (there is no per-item art); the stage
 * gives them size and weight. `children` sits in the top-right corner (a badge).
 */
export function ShopItemArt({
  icon,
  children,
  className,
}: {
  icon: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("shop-stage", children ? "shop-stage--badge" : null, className)}
      data-testid="shop-item-art"
    >
      <span className="shop-stage__item" aria-hidden>
        {icon}
      </span>
      {children ? <div className="absolute right-1.5 top-1.5">{children}</div> : null}
    </div>
  );
}
