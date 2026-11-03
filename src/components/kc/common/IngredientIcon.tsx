import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An ingredient's painted picture (developer 2026-11-03: several ingredient emoji did not match the names: cauliflower was a broccoli,
 * radish and beetroot were carrots, tofu was a white square, the lime a green dot, five different vegetables shared one leaf).
 * The 57 pictures are small WebP files in `public/business/ingredients/<ingredient id>.webp`, built by `scripts/make-market-assets.py`.
 * It sizes itself in `em`, so it takes the place of the emoji wherever the emoji sat (a Market crate, a fridge pile, an inventory tile,
 * a chip). If a picture cannot load the emoji (`fallback`) is shown, so nothing is ever blank. Text-only places (alert sentences, badges
 * made of strings) keep the emoji.
 */
const ingredientIconUrl = (id: string): string =>
  `${import.meta.env.BASE_URL}business/ingredients/${id}.webp`;

export function IngredientIcon({
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
      src={ingredientIconUrl(id)}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      data-ingredient-icon={id}
      onError={() => setFailed(true)}
      className={cn("inline-block h-[1.15em] w-[1.15em] object-contain align-[-0.2em]", className)}
    />
  );
}
