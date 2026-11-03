import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A Business Supply's painted picture (developer 2026-11-03: the supply emoji did not match the names, e.g. a wavy dash for the whisk).
 * The 62 pictures are small WebP files in `public/business/supplies/<supply id>.webp`, built by `scripts/make-market-assets.py`.
 * It sizes itself in `em`, so it takes the place of the emoji wherever the emoji sat (the Market card, an inventory tile, a chip).
 * If a picture cannot load, the old emoji (`fallback`) is shown, so nothing is ever blank.
 */
const supplyIconUrl = (id: string): string =>
  `${import.meta.env.BASE_URL}business/supplies/${id}.webp`;

export function SupplyIcon({
  id,
  fallback,
  className,
}: {
  id: string;
  fallback: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={supplyIconUrl(id)}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      data-supply-icon={id}
      onError={() => setFailed(true)}
      className={cn("inline-block h-[1.15em] w-[1.15em] object-contain align-[-0.2em]", className)}
    />
  );
}
