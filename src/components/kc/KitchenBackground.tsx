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
import { useRef, type CSSProperties } from "react";
import type { KitchenSkinId } from "@/game/kitchen/kitchenUpgradeTypes";
import {
  ambientAlignX,
  ambientAlignY,
  ambientPictureSize,
  coverRect,
  kitchenAmbientFor,
} from "@/game/kitchen/kitchenAmbient";
import { useBoxSize } from "@/components/kc/restaurantMap/restaurantMapWide";
import { KitchenAmbient } from "@/components/kc/KitchenAmbient";
import { landscapeKitchenArt } from "@/game/landscapeArt";
import { useLandscape } from "@/components/kc/game/layoutMode";

/** Exported for Phase 5's restoration reveal (RestorationReveal.tsx), which shows two of them. */
export const KITCHEN_SKIN_SRC: Record<KitchenSkinId, string> = {
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
  ambient = false,
}: {
  skin: KitchenSkinId;
  /** A small preview: loads the 240px copy, lazily. The full-screen backdrop loads eagerly at high priority (it's the first thing a returning player sees). */
  thumb?: boolean;
  /** The Kitchen's life (developer 2026-11-26): steam, lamps, a beam of sun, a glint, a slow push-in, laid over the painting. Only the Kitchen home turns it on. */
  ambient?: boolean;
}) {
  // A wide window shows the kitchen's own landscape painting (developer 2026-11-20): the portrait skin cover-cropped there was zoomed and soft.
  const landscape = useLandscape();
  const wide = landscape && !thumb;
  const live = ambient && !thumb;
  const boxRef = useRef<HTMLDivElement>(null);
  const vp = useBoxSize(boxRef, live);
  const layout = wide ? "wide" : "tall";
  const picture = (
    <img
      key={wide ? `${skin}-land` : skin}
      src={
        thumb
          ? KITCHEN_SKIN_THUMB_SRC[skin]
          : wide
            ? landscapeKitchenArt(skin)
            : KITCHEN_SKIN_SRC[skin]
      }
      alt="The player's café kitchen"
      width={thumb ? 240 : wide ? 1920 : 1080}
      height={thumb ? 427 : wide ? 1080 : 1920}
      loading={thumb ? "lazy" : "eager"}
      decoding="async"
      fetchPriority={thumb ? "low" : "high"}
      // the live kitchen keeps its tall painting to the right (the stove clear of the buttons: ambientAlignX), also before it has been measured
      className={`absolute inset-0 h-full w-full object-cover ${live && !wide ? "object-right" : ""}`}
    />
  );
  if (!live) return picture;
  // The picture and its life share ONE stage the size of the painting's own `object-cover` box, so a point in percent of the picture stays on the same pixel of the painting in any window.
  const alignX = ambientAlignX(layout);
  const alignY = ambientAlignY(layout, vp.h);
  const rect =
    vp.w > 0 && vp.h > 0 ? coverRect(vp, ambientPictureSize(layout), alignX, alignY) : null;
  const origin = kitchenAmbientFor(skin, layout).origin;
  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden" data-testid="kitchen-bg-box">
      <div
        className="ka-stage absolute"
        style={
          {
            ...(rect
              ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
              : { inset: 0 }),
            "--ox": `${origin.x}%`,
            "--oy": `${origin.y}%`,
          } as unknown as CSSProperties
        }
      >
        {picture}
        {rect ? <KitchenAmbient skin={skin} layout={layout} /> : null}
      </div>
    </div>
  );
}
