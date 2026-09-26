/**
 * APPLE_TEXTURE — paints the apple into a raw 2D canvas, ported faithfully
 * from the reference ("Lovable") art batch's apple.ts `drawWhole`/
 * `drawCrossSection` (Phaser Graphics -> Canvas2D), painted against the
 * SAME explicit two-lobe/stem-depression/calyx-dimple vertex polygon
 * PreparationScene.ts clips every piece to (src/game/shapes/appleShape.ts).
 *
 * This engine has one shared whole-ingredient canvas, not the reference's
 * separate drawWhole/drawCrossSection passes — the reference's pale
 * hourglass core + seed pockets + flesh-grain lines are folded in here as
 * a translucent overlay painted ON TOP of the opaque base skin, the same
 * "small and muted" convention pepperTexture.ts/strawberryTexture.ts's
 * own header docs explain.
 *
 * Discrepancy #1's close-out: `peeled` (mandatory-first, same convention
 * as Onion/Potato/Garlic — see EllipseRenderer.paint's own doc, though
 * Apple is "polygon"-shaped, not "ellipse") swaps the base fill from
 * `PAL.apple` (red skin) to the already-defined-but-previously-unused
 * `PAL.appleFlesh` (pale cream), and drops the skin-only overlays — the
 * red/orange/blush shading washes, the vertical tonal streaks, and the
 * skin speckles — replacing them with a single muted flesh-tone shading
 * pass. The cross-section core/seed-pocket/grain overlay, stem, and stem
 * cavity are untouched either way: those are interior features, not
 * skin, same polygon silhouette regardless of peeled state.
 */
import {
  APPLE_BOTTOM,
  APPLE_MAX_HW,
  APPLE_SIL,
  APPLE_TOP,
  appleHalfWidth,
  appleNoise,
  type Pt,
} from "../shapes/appleShape";
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

const ORIGIN = polygonBoundsCenter(APPLE_SIL);

export function appleTextureSize(scale: number, margin: number): { w: number; h: number } {
  return polygonTextureSize(APPLE_SIL, scale, margin);
}

export function paintAppleTexture(
  ctx: CanvasRenderingContext2D,
  scale: number,
  margin: number,
  peeled = false,
): void {
  const { rx, ry } = polygonTextureSize(APPLE_SIL, scale, margin);
  const cx = rx + margin;
  const cy = ry + margin;
  const w = cx * 2;
  const h = cy * 2;
  const s = scale;

  ctx.clearRect(0, 0, w, h);

  groundShadow(ctx, cx, cy + APPLE_BOTTOM * s, APPLE_MAX_HW * 0.74 * s, 12 * s);

  fillPoly(ctx, place(APPLE_SIL, ORIGIN, cx, cy, s), peeled ? PAL.appleFlesh : PAL.apple);

  // Cross-section-only pale hourglass core + seed pockets + flesh grain —
  // translucent, on top of the base skin (see this file's own header
  // doc). The core fill's alpha is pre-multiplied by GROUP_ALPHA directly
  // — fillPoly's own save/restore SETS globalAlpha rather than
  // compounding it, so wrapping it in an outer `ctx.globalAlpha = ...`
  // would silently do nothing (see pepperTexture.ts's own note on this
  // exact bug). The seed-pocket loop below sets no globalAlpha of its
  // own, so it correctly inherits GROUP_ALPHA from this outer save().
  const GROUP_ALPHA = 0.3;
  ctx.save();
  ctx.globalAlpha = GROUP_ALPHA;
  const core: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const v = i / 24;
    const cw = 6 + 20 * Math.pow(Math.sin(Math.PI * v), 2.2);
    core.push({ x: cw, y: APPLE_TOP + 14 + (APPLE_BOTTOM - APPLE_TOP - 26) * v });
  }
  for (let i = 24; i >= 0; i--) {
    const v = i / 24;
    const cw = 6 + 20 * Math.pow(Math.sin(Math.PI * v), 2.2);
    core.push({ x: -cw, y: APPLE_TOP + 14 + (APPLE_BOTTOM - APPLE_TOP - 26) * v });
  }
  fillPoly(ctx, place(core, ORIGIN, cx, cy, s), PAL.appleCore, GROUP_ALPHA * 0.85);
  for (const [sx, sy, rot] of [
    [-13, 4, -0.5],
    [13, 4, 0.5],
    [0, 22, 0],
  ] as const) {
    ctx.save();
    ctx.translate(cx + (sx - ORIGIN.x) * s, cy + (sy - ORIGIN.y) * s);
    ctx.rotate(rot);
    ctx.fillStyle = "#5b3a22";
    ctx.beginPath();
    ctx.ellipse(0, 0, 9 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Flesh grain — kept short (reaching only ~55% of the way to the skin,
  // not the reference's own near-edge reach) and muted by GROUP_ALPHA:
  // full-length near-opaque rays read as a odd starburst radiating clean
  // through the skin rather than a subtle cut-face texture.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    strokePoly(
      ctx,
      place(
        [
          { x: Math.cos(a) * 22, y: 6 + Math.sin(a) * 18 },
          { x: Math.cos(a) * 40, y: 6 + Math.sin(a) * 34 },
        ],
        ORIGIN,
        cx,
        cy,
        s,
      ),
      PAL.appleCore,
      1.4 * s,
      GROUP_ALPHA * 0.5,
      false,
    );
  }
  ctx.restore();

  if (!peeled) {
    fillPoly(
      ctx,
      place(shrinkToward(APPLE_SIL, 48, 44, 0.07), ORIGIN, cx, cy, s),
      PAL.appleDark,
      0.34,
    );
    fillPoly(
      ctx,
      place(shrinkToward(APPLE_SIL, -34, -28, 0.3), ORIGIN, cx, cy, s),
      PAL.appleLight,
      0.38,
    );
    fillPoly(
      ctx,
      place(shrinkToward(APPLE_SIL, -22, 30, 0.55), ORIGIN, cx, cy, s),
      PAL.appleBlush,
      0.18,
    );
    strokePoly(ctx, place(APPLE_SIL, ORIGIN, cx, cy, s), PAL.appleDark, 2.2 * s, 0.5);

    // vertical tonal streaks — the skin's own color variation
    for (let i = -3; i <= 3; i++) {
      const seg: Pt[] = [];
      for (let k = 0; k <= 12; k++) {
        const v = 0.12 + 0.74 * (k / 12);
        seg.push({
          x: i * 15 * (0.4 + 0.9 * Math.sin(Math.PI * v)),
          y: APPLE_TOP + (APPLE_BOTTOM - APPLE_TOP) * v,
        });
      }
      strokePoly(
        ctx,
        place(seg, ORIGIN, cx, cy, s),
        i < 0 ? PAL.appleLight : PAL.appleDark,
        3 * s,
        0.14,
        false,
      );
    }
    // skin speckles
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#f0b45c";
    for (let i = 0; i < 22; i++) {
      const v = 0.12 + 0.76 * ((i * 0.37) % 1);
      const hw = appleHalfWidth(v);
      const px = ((appleNoise(i, 21) + 1) / 2) * 1.7 * hw - hw * 0.85;
      ctx.beginPath();
      ctx.ellipse(
        cx + (px - ORIGIN.x) * s,
        cy + (APPLE_TOP + (APPLE_BOTTOM - APPLE_TOP) * v - ORIGIN.y) * s,
        2.4 * s,
        2.4 * s,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  } else {
    // Peeled: no red/orange skin shading left — a single muted flesh-tone
    // shading pass (same shrinkToward shadow region as the dark-skin wash
    // above) plus the plain flesh-colored outline, so the form still
    // reads with depth instead of going flat.
    fillPoly(
      ctx,
      place(shrinkToward(APPLE_SIL, 48, 44, 0.07), ORIGIN, cx, cy, s),
      PAL.appleCore,
      0.3,
    );
    strokePoly(ctx, place(APPLE_SIL, ORIGIN, cx, cy, s), PAL.appleCore, 2.2 * s, 0.5);
  }

  softHighlight(ctx, cx - 30 * s, cy - 26 * s, 34 * s, 40 * s, 0xfff4e2, 0.6, -0.4);

  // stem cavity + stem
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#a02a2b";
  ctx.beginPath();
  ctx.ellipse(
    cx + (-1 - ORIGIN.x) * s,
    cy + (APPLE_TOP + 12 - ORIGIN.y) * s,
    34 * s,
    12 * s,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
  strokePoly(
    ctx,
    place(
      [
        { x: 0, y: APPLE_TOP + 12 },
        { x: 3, y: APPLE_TOP - 4 },
        { x: 1, y: APPLE_TOP - 22 },
      ],
      ORIGIN,
      cx,
      cy,
      s,
    ),
    PAL.stemWood,
    5 * s,
    1,
    false,
  );
}
