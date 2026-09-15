import skin01 from "@/assets/kitchen/skin-01.webp";
import skin02 from "@/assets/kitchen/skin-02.webp";
import skin03 from "@/assets/kitchen/skin-03.webp";
import skin04 from "@/assets/kitchen/skin-04.webp";
import skin05 from "@/assets/kitchen/skin-05.webp";
import skin06 from "@/assets/kitchen/skin-06.webp";
import type { KitchenSkinId } from "@/game/kitchen/kitchenUpgradeTypes";

const KITCHEN_SKIN_SRC: Record<KitchenSkinId, string> = {
  "skin-01": skin01,
  "skin-02": skin02,
  "skin-03": skin03,
  "skin-04": skin04,
  "skin-05": skin05,
  "skin-06": skin06,
};

/**
 * KITCHEN_BACKGROUND — the Kitchen screen's environment layer only. The
 * six portrait images ARE the visual progression (no decoration logic
 * here, see the phase brief) — this component's only job is picking the
 * right asset for the player's progression and rendering it as a full,
 * uncropped-aspect, non-stretched room backdrop that the existing Kitchen
 * UI already layers itself on top of.
 *
 * `key={skin}` forces React to swap the actual <img> element (not just
 * its src) when the skin changes, so a threshold crossing is a clean,
 * immediate swap — no half-loaded/flashing intermediate state.
 */
export function KitchenBackground({ skin }: { skin: KitchenSkinId }) {
  return (
    <img
      key={skin}
      src={KITCHEN_SKIN_SRC[skin]}
      alt="The player's café kitchen"
      width={1080}
      height={1920}
      loading="lazy"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
