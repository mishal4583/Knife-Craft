import skin01 from "@/assets/kitchen/skin-01.webp";
import skin02 from "@/assets/kitchen/skin-02.webp";
import skin03 from "@/assets/kitchen/skin-03.webp";
import skin04 from "@/assets/kitchen/skin-04.webp";
import skin05 from "@/assets/kitchen/skin-05.webp";
import skin06 from "@/assets/kitchen/skin-06.webp";
import thumb01 from "@/assets/kitchen/thumbs/skin-01.webp";
import thumb02 from "@/assets/kitchen/thumbs/skin-02.webp";
import thumb03 from "@/assets/kitchen/thumbs/skin-03.webp";
import thumb04 from "@/assets/kitchen/thumbs/skin-04.webp";
import thumb05 from "@/assets/kitchen/thumbs/skin-05.webp";
import thumb06 from "@/assets/kitchen/thumbs/skin-06.webp";
import type { KitchenSkinId } from "@/game/kitchen/kitchenUpgradeTypes";

const KITCHEN_SKIN_SRC: Record<KitchenSkinId, string> = {
  "skin-01": skin01,
  "skin-02": skin02,
  "skin-03": skin03,
  "skin-04": skin04,
  "skin-05": skin05,
  "skin-06": skin06,
};

/** 240×427 copies of the same art, for small previews (Restaurant Progress's journey) — ~20 KB each instead of ~300 KB. */
const KITCHEN_SKIN_THUMB_SRC: Record<KitchenSkinId, string> = {
  "skin-01": thumb01,
  "skin-02": thumb02,
  "skin-03": thumb03,
  "skin-04": thumb04,
  "skin-05": thumb05,
  "skin-06": thumb06,
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
export function KitchenBackground({
  skin,
  thumb = false,
}: {
  skin: KitchenSkinId;
  /** A small preview: loads the 240px copy, lazily. The full-screen backdrop loads eagerly at high priority (it's the first thing a returning player sees). */
  thumb?: boolean;
}) {
  return (
    <img
      key={skin}
      src={thumb ? KITCHEN_SKIN_THUMB_SRC[skin] : KITCHEN_SKIN_SRC[skin]}
      alt="The player's café kitchen"
      width={thumb ? 240 : 1080}
      height={thumb ? 427 : 1920}
      loading={thumb ? "lazy" : "eager"}
      decoding="async"
      fetchPriority={thumb ? "low" : "high"}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
