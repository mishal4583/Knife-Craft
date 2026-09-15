/**
 * PEPPER_TEXTURE — paints the bell pepper into a raw 2D canvas, ported
 * faithfully from the reference ("Lovable") art batch's bellPepper.ts
 * `drawWhole`/`drawCrossSection` (Phaser Graphics -> Canvas2D), painted
 * against the SAME explicit wide-shoulder/tapering/three-lobe vertex
 * polygon PreparationScene.ts clips every piece to
 * (src/game/shapes/pepperShape.ts).
 *
 * This engine has one shared whole-ingredient canvas, not the reference's
 * separate drawWhole/drawCrossSection passes — the reference's cross-
 * section is its own full-size polar ring drawn independently of SIL (a
 * separate render entirely there). Folded into the same canvas here, it
 * has to shrink and mute instead: painted small and at reduced alpha
 * around the pepper's own local center, invisible amid the intact
 * pepper's busy skin/crease/highlight detail but clearly exposed by a
 * cut crop through the center (the same convention apple/strawberry's
 * own pale core already use).
 */
import {
  PEPPER_BOTTOM,
  PEPPER_MAX_HW,
  PEPPER_SIL,
  PEPPER_TOP,
  type Pt,
} from "../shapes/pepperShape";
import { polygonBoundsCenter, polygonTextureSize } from "../ingredientShapes";
import {
  fillPoly,
  groundShadow,
  hex,
  place,
  shrinkToward,
  softHighlight,
  strokePoly,
} from "./polygonCanvas";
import { PAL } from "./foodPalette";

const ORIGIN = polygonBoundsCenter(PEPPER_SIL);

export function pepperTextureSize(scale: number, margin: number): { w: number; h: number } {
  return polygonTextureSize(PEPPER_SIL, scale, margin);
}

/** Closed polygon from a polar radius function — shapeUtils.ts's `polarShape`, ported locally (only the cross-section hint needs it). */
function polarShape(steps: number, r: (a: number) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push({ x: Math.cos(a) * r(a), y: Math.sin(a) * r(a) });
  }
  return out;
}

export function paintPepperTexture(
  ctx: CanvasRenderingContext2D,
  scale: number,
  margin: number,
): void {
  const { rx, ry } = polygonTextureSize(PEPPER_SIL, scale, margin);
  const cx = rx + margin;
  const cy = ry + margin;
  const w = cx * 2;
  const h = cy * 2;
  const s = scale;

  ctx.clearRect(0, 0, w, h);

  groundShadow(ctx, cx, cy + PEPPER_BOTTOM * s, PEPPER_MAX_HW * 0.78 * s, 12 * s);

  fillPoly(ctx, place(PEPPER_SIL, ORIGIN, cx, cy, s), PAL.pepper);

  // Cross-section-only hollow ring + placenta ribs + seeds — scaled down
  // and muted (see this file's own header doc for why). Every alpha below
  // is pre-multiplied by the 0.4 group factor directly — fillPoly's own
  // save/restore SETS globalAlpha rather than compounding it, so wrapping
  // these calls in an outer `ctx.globalAlpha = 0.4` would silently do
  // nothing (a real bug caught by comparing the rendered canvas against
  // this file's own "small and muted" intent).
  const GROUP_ALPHA = 0.24;
  const inner = polarShape(120, (a) => 29 * (1 + 0.07 * Math.cos(4 * a + 0.4)));
  fillPoly(ctx, place(inner, ORIGIN, cx, cy, s), PAL.pepperFlesh, GROUP_ALPHA * 0.7);
  fillPoly(
    ctx,
    place(shrinkToward(inner, 0, 0, 0.16), ORIGIN, cx, cy, s),
    PAL.pepperCavity,
    GROUP_ALPHA * 0.75,
  );
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const rib: Pt[] = [
      { x: 0, y: 0 },
      { x: Math.cos(a) * 16, y: Math.sin(a) * 16 },
      { x: Math.cos(a + 0.22) * 25, y: Math.sin(a + 0.22) * 25 },
      { x: Math.cos(a - 0.22) * 25, y: Math.sin(a - 0.22) * 25 },
    ];
    fillPoly(ctx, place(rib, ORIGIN, cx, cy, s), PAL.pepperFlesh, GROUP_ALPHA * 0.85);
    ctx.save();
    ctx.fillStyle = "#f2e6a8";
    ctx.globalAlpha = GROUP_ALPHA * 0.9;
    for (let k = 0; k < 4; k++) {
      const rr = 10 + k * 3;
      const aa = a + (k % 2 ? 0.16 : -0.16);
      ctx.beginPath();
      ctx.ellipse(
        cx + (Math.cos(aa) * rr - ORIGIN.x) * s,
        cy + (Math.sin(aa) * rr - ORIGIN.y) * s,
        3.4 * s,
        2.7 * s,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // shadowed right-lower flank
  fillPoly(
    ctx,
    place(shrinkToward(PEPPER_SIL, 52, 40, 0.08), ORIGIN, cx, cy, s),
    PAL.pepperDark,
    0.28,
  );
  // sunlit upper-left mass
  fillPoly(
    ctx,
    place(shrinkToward(PEPPER_SIL, -40, -34, 0.34), ORIGIN, cx, cy, s),
    PAL.pepperLight,
    0.42,
  );
  strokePoly(ctx, place(PEPPER_SIL, ORIGIN, cx, cy, s), PAL.pepperDark, 2.4 * s, 0.55);

  // vertical lobe creases
  for (const lobeCx of [-38, 10, 46]) {
    const seg: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const yy = PEPPER_TOP + 10 + (PEPPER_BOTTOM - PEPPER_TOP - 26) * t;
      seg.push({ x: lobeCx * (0.55 + 0.6 * Math.sin(Math.PI * (0.25 + 0.6 * t))), y: yy });
    }
    strokePoly(ctx, place(seg, ORIGIN, cx, cy, s), PAL.pepperDark, 2.6 * s, 0.3, false);
    strokePoly(
      ctx,
      place(
        seg.map((p) => ({ x: p.x + 5, y: p.y })),
        ORIGIN,
        cx,
        cy,
        s,
      ),
      PAL.pepperLight,
      2 * s,
      0.22,
      false,
    );
  }

  softHighlight(ctx, cx - 34 * s, cy - 18 * s, 34 * s, 62 * s, 0xfaf5e2, 0.6, -0.22);
  softHighlight(ctx, cx + 40 * s, cy + 18 * s, 12 * s, 40 * s, 0xf7c9a8, 0.3, 0.12);

  // Stem cavity + stem. PreparationScene crops every displayed piece to
  // PEPPER_SIL's own outline (see traceIngredientSilhouette) — the
  // reference's own stem pokes well above the silhouette's top bound (a
  // real pepper's stem does stick out past the shoulders), which reads
  // fine in the reference's own unclipped Graphics draw but would be
  // silently cropped away entirely here. Kept inside the notch's own
  // cleft instead (the cleft reaches down to about local y=-48 at dead
  // center — see pepperShape.ts's `top` array), shorter/more contained
  // than the reference, the same fix already used for the mushroom stem.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = hex(PAL.pepperDark);
  ctx.beginPath();
  ctx.ellipse(cx + -ORIGIN.x * s, cy + (-30 - ORIGIN.y) * s, 26 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  fillPoly(
    ctx,
    place(
      [
        { x: -6, y: -22 },
        { x: 6, y: -22 },
        { x: 5, y: -34 },
        { x: 2, y: -42 },
        { x: -2, y: -42 },
        { x: -5, y: -34 },
      ],
      ORIGIN,
      cx,
      cy,
      s,
    ),
    PAL.pepperStem,
  );
  strokePoly(
    ctx,
    place(
      [
        { x: -1, y: -40 },
        { x: 0, y: -20 },
      ],
      ORIGIN,
      cx,
      cy,
      s,
    ),
    0x2f5522,
    1.6 * s,
    0.4,
    false,
  );
}
