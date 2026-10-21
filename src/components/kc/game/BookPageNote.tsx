import { useEffect } from "react";
import { AudioManager } from "@/game/AudioManager";
import { VARIANT_MEMORIES, memoryFor, type PresentationTier } from "@/game/signatureDishes";
import { VARIANTS, withArticle, type VariantId } from "@/game/specialVariants";
import { TierBadge, TIER_STYLE } from "../signature/TierBadge";
import { cn } from "@/lib/utils";

/**
 * BOOK_PAGE_NOTE — Phase 4 (A7, developer 2026-10-21): a small recipe-book
 * page on the order's completion card (serve card / Order Complete), ONLY
 * when this dish wrote something new into the family recipe book: its first
 * page (Homemade), a new tier (Chef's Special, Grandma's Signature —
 * signatureDishes.tierMilestone), or a special variant met for the first time
 * this visit. One short memory. It is part of the card, not a stage of its
 * own: no extra tap, nothing to skip, nothing that can hold the order up. It
 * pays nothing and saves nothing: the tier milestones come from the saved
 * best crossing a threshold, which can happen once per recipe, so a replay
 * never shows the same page again.
 */
export function BookPageNote({
  emoji,
  recipeId,
  tier,
  variant,
}: {
  emoji: string;
  recipeId: string;
  tier: PresentationTier | null;
  variant: VariantId | null;
}) {
  useEffect(() => {
    AudioManager.playChime();
  }, []);
  // A service recipe's emoji is its cuisine's flag, which some systems draw as
  // two letters ("IT"): show a plate instead.
  const picture = /\p{Regional_Indicator}/u.test(emoji) ? "🍽️" : emoji;

  return (
    <div
      className="anim-pop mt-2 flex items-start gap-2.5 rounded-[16px] border border-gold/40 bg-gold/10 px-2.5 py-2 text-left"
      data-testid="book-note"
      data-tier={tier ?? ""}
      data-variant={variant ?? ""}
    >
      <span
        className={cn(
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border card-warm text-[24px] leading-none",
          tier ? TIER_STYLE[tier].frame : "border-walnut/15",
        )}
        aria-hidden="true"
      >
        {picture}
        {variant ? (
          <span className="absolute -right-1.5 -top-1.5 text-[15px]">
            {VARIANTS[variant].emoji}
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block font-ui text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-copper">
          📖{" "}
          {tier === "homemade"
            ? "A new page in the recipe book"
            : tier
              ? "The recipe book remembers"
              : "A special ingredient"}
        </span>
        {tier ? <TierBadge tier={tier} className="mt-0.5" /> : null}
        {tier ? (
          <span className="mt-0.5 block font-hand text-[14.5px] leading-snug text-walnut-dark/80">
            {memoryFor(recipeId, tier)}
          </span>
        ) : null}
        {variant ? (
          <span
            className="mt-0.5 block font-hand text-[14px] leading-snug text-walnut/75"
            data-testid="book-note-variant"
          >
            Made with {withArticle(VARIANTS[variant].name)} — {VARIANT_MEMORIES[variant]}
          </span>
        ) : null}
      </span>
    </div>
  );
}
