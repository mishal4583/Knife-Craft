import { cn } from "@/lib/utils";
import { TIER_INFO, type PresentationTier } from "@/game/signatureDishes";

/**
 * Phase 4 (A3): a dish's presentation tier as a stamp — Homemade (sage),
 * Chef's Special (copper), Grandma's Signature (gold). Words only, never a
 * number (the Recipe Book's own rule).
 */
export const TIER_STYLE: Record<
  PresentationTier,
  { badge: string; frame: string; ribbon: string }
> = {
  homemade: {
    badge: "bg-sage/25 text-olive border-olive/30",
    frame: "border-walnut/15",
    ribbon: "bg-sage/80 text-ivory",
  },
  "chefs-special": {
    badge: "bg-copper/18 text-copper border-copper/40",
    frame: "border-copper/45 ring-1 ring-copper/20",
    ribbon: "bg-[linear-gradient(170deg,var(--color-gold),var(--color-copper))] text-ivory",
  },
  "grandmas-signature": {
    badge: "bg-gold/30 text-walnut-dark border-gold/70 shadow-[0_0_0_2px_rgba(216,168,78,0.18)]",
    frame: "border-gold/80 ring-2 ring-gold/40",
    ribbon: "bg-[linear-gradient(170deg,#f6d77a,#d8a84e)] text-walnut-dark",
  },
};

export function TierBadge({ tier, className }: { tier: PresentationTier; className?: string }) {
  const info = TIER_INFO[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-[3px] font-ui text-[11px] font-extrabold uppercase tracking-[0.06em]",
        TIER_STYLE[tier].badge,
        className,
      )}
      data-tier={tier}
    >
      <span aria-hidden="true">{info.icon}</span>
      {info.name}
    </span>
  );
}
