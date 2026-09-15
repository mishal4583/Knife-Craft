/**
 * MUSHROOM_TEXTURE — paints the mushroom into a raw 2D canvas, ported
 * faithfully from the reference ("Lovable") art batch's mushroom.ts
 * `drawWhole`/`drawCrossSection` (Phaser Graphics -> Canvas2D, hex numbers
 * -> CSS strings via polygonCanvas.ts's `hex()`), painted against the
 * SAME explicit cap/underside/stem vertex polygon PreparationScene.ts
 * clips every piece to (src/game/shapes/mushroomShape.ts) — see that
 * file's own doc for why this replaced the earlier single-center
 * angular-radius-profile "organic" mushroom. Every `shrinkToward` call
 * below runs in LOCAL design space (matching the reference exactly)
 * BEFORE `place()` — `place()` and `shrinkToward` commute under any
 * affine placement, but doing it in the reference's own order keeps this
 * a literal translation rather than a reinterpretation.
 *
 * This engine has one shared whole-ingredient canvas, not the reference's
 * separate drawWhole/drawCrossSection passes — cross-section-only detail
 * (flesh tone, stem fibres) is folded UNDER the opaque cap/gill/stem
 * paint at reduced prominence, invisible on the intact whole mushroom and
 * exposed only where a cut crops near the center (the same convention
 * every other ingredient here already uses).
 */
import {
  MUSHROOM_CAP_BOTTOM,
  MUSHROOM_CAP_REGION,
  MUSHROOM_CAP_TOP,
  MUSHROOM_CAP_W,
  MUSHROOM_SIL,
  MUSHROOM_STEM_BOTTOM,
  MUSHROOM_STEM_REGION,
  mushroomCapTop,
  mushroomCapUnderside,
  mushroomNoise,
  type Pt,
} from "../shapes/mushroomShape";
import { polygonBoundsCenter, polygonTextureSize } from "../ingredientShapes";
import {
  fillPoly,
  groundShadow,
  place,
  shrinkToward,
  softHighlight,
  strokePoly,
} from "./polygonCanvas";
import { PAL } from "./foodPalette";

const ORIGIN = polygonBoundsCenter(MUSHROOM_SIL);

export function mushroomTextureSize(scale: number, margin: number): { w: number; h: number } {
  return polygonTextureSize(MUSHROOM_SIL, scale, margin);
}

function drawGills(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  const count = 17;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const px = -MUSHROOM_CAP_W * 0.94 + 2 * MUSHROOM_CAP_W * 0.94 * t;
    const edgeY = MUSHROOM_CAP_BOTTOM + 11.5 * Math.sin(Math.PI * t);
    const innerY = MUSHROOM_CAP_BOTTOM + 2 + 2 * Math.sin(Math.PI * t);
    const inner = { x: px * 0.36, y: innerY };
    const seg: Pt[] = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      seg.push({
        x: inner.x + (px - inner.x) * u,
        y: inner.y + (edgeY - inner.y) * Math.pow(u, 0.7),
      });
    }
    strokePoly(ctx, place(seg, ORIGIN, cx, cy, s), PAL.mushroomGillDark, 1.5 * s, 0.5, false);
  }
}

export function paintMushroomTexture(
  ctx: CanvasRenderingContext2D,
  scale: number,
  margin: number,
): void {
  const { rx, ry } = polygonTextureSize(MUSHROOM_SIL, scale, margin);
  const cx = rx + margin;
  const cy = ry + margin;
  const w = cx * 2;
  const h = cy * 2;
  const s = scale;

  ctx.clearRect(0, 0, w, h);

  groundShadow(ctx, cx, cy + MUSHROOM_STEM_BOTTOM * s, MUSHROOM_CAP_W * 0.8 * s, 12 * s);

  // Cross-section-only flesh tone, painted first so it only ever shows
  // through a cut crop, never on the intact whole mushroom's own opaque
  // cap/gill/stem layers painted over it below.
  fillPoly(ctx, place(MUSHROOM_SIL, ORIGIN, cx, cy, s), PAL.mushroomFlesh, 0.9);

  // stem
  fillPoly(ctx, place(MUSHROOM_STEM_REGION, ORIGIN, cx, cy, s), PAL.mushroomStem);
  fillPoly(
    ctx,
    place(shrinkToward(MUSHROOM_STEM_REGION, 30, 30, 0.12), ORIGIN, cx, cy, s),
    PAL.mushroomStemShade,
    0.55,
  );
  fillPoly(
    ctx,
    place(shrinkToward(MUSHROOM_STEM_REGION, -26, 10, 0.3), ORIGIN, cx, cy, s),
    0xfff7e8,
    0.28,
  );
  strokePoly(
    ctx,
    place(MUSHROOM_STEM_REGION, ORIGIN, cx, cy, s),
    PAL.mushroomGillDark,
    1.6 * s,
    0.35,
  );
  // stem fibres (cross-section detail, subtle on the whole stem)
  for (let i = -2; i <= 2; i++) {
    strokePoly(
      ctx,
      place(
        [
          { x: i * 9, y: MUSHROOM_CAP_BOTTOM + 8 },
          { x: i * 11, y: MUSHROOM_STEM_BOTTOM - 8 },
        ],
        ORIGIN,
        cx,
        cy,
        s,
      ),
      PAL.mushroomStemShade,
      1.4 * s,
      0.35,
      false,
    );
  }

  // underside + gills (drawn before the cap so the cap edge overlaps them)
  fillPoly(
    ctx,
    place([...mushroomCapUnderside(), ...mushroomCapTop().slice().reverse()], ORIGIN, cx, cy, s),
    PAL.mushroomGill,
  );
  drawGills(ctx, cx, cy, s);
  fillPoly(
    ctx,
    place(
      [
        ...mushroomCapTop().map((p) => ({ x: p.x, y: p.y })),
        ...mushroomCapTop()
          .slice()
          .reverse()
          .map((p) => ({ x: p.x, y: p.y + 4 })),
      ],
      ORIGIN,
      cx,
      cy,
      s,
    ),
    PAL.mushroomGillDark,
    0.35,
  );

  // cap
  fillPoly(
    ctx,
    place(MUSHROOM_CAP_REGION.slice(0, mushroomCapTop().length + 2), ORIGIN, cx, cy, s),
    PAL.mushroomCap,
  );
  fillPoly(ctx, place(mushroomCapTop(), ORIGIN, cx, cy, s), PAL.mushroomCap);
  // darker perimeter
  strokePoly(
    ctx,
    place(mushroomCapTop(), ORIGIN, cx, cy, s),
    PAL.mushroomCapDark,
    5 * s,
    0.5,
    false,
  );
  // directional shading (lower-right heavier)
  fillPoly(
    ctx,
    place(shrinkToward(mushroomCapTop(), 48, -10, 0.1), ORIGIN, cx, cy, s),
    PAL.mushroomCapDark,
    0.2,
  );
  // sunlit crown
  fillPoly(
    ctx,
    place(shrinkToward(mushroomCapTop(), -26, -34, 0.42), ORIGIN, cx, cy, s),
    PAL.mushroomCapLight,
    0.55,
  );
  softHighlight(ctx, cx - 30 * s, cy - 44 * s, 42 * s, 20 * s, 0xfff7e8, 0.55, -0.42);

  // organic surface variation
  ctx.save();
  ctx.fillStyle = "#8a6440";
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 7; i++) {
    const t = 0.12 + 0.76 * (i / 6);
    const px = (-MUSHROOM_CAP_W + 2 * MUSHROOM_CAP_W * t) * 0.9;
    const py =
      MUSHROOM_CAP_BOTTOM +
      (MUSHROOM_CAP_TOP - MUSHROOM_CAP_BOTTOM) * Math.pow(Math.sin(Math.PI * t), 0.62) * 0.55;
    ctx.beginPath();
    ctx.ellipse(
      cx + (px - ORIGIN.x) * s,
      cy + (py + 6 * mushroomNoise(t * 6, 3) - ORIGIN.y) * s,
      16 * s,
      7 * s,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}
