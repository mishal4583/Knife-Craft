/**
 * STRAWBERRY_TEXTURE — paints the strawberry into a raw 2D canvas, ported
 * faithfully from the reference ("Lovable") art batch's strawberry.ts
 * `drawWhole`/`drawCrossSection` (Phaser Graphics -> Canvas2D), painted
 * against the SAME explicit heart/conical-taper vertex polygon
 * PreparationScene.ts clips every piece to
 * (src/game/shapes/strawberryShape.ts).
 *
 * This engine has one shared whole-ingredient canvas, not the reference's
 * separate drawWhole/drawCrossSection passes — the reference's pale
 * fibrous core + radiating flesh fibres are folded in here as a
 * translucent overlay painted ON TOP of the opaque base skin (not under
 * it — an opaque layer painted after would hide it completely on every
 * piece, cut or not, since a cut is just a crop of this one canvas), the
 * same "small and muted" convention pepperTexture.ts's own header doc
 * explains. The rim seed-dimples the reference's own drawCrossSection
 * separately draws are skipped — SEEDS' own dimples below already cover
 * that same visual, so it isn't duplicated for a single-canvas model.
 */
import {
  STRAWBERRY_BOTTOM,
  STRAWBERRY_MAX_HW,
  STRAWBERRY_SEEDS,
  STRAWBERRY_SIL,
  STRAWBERRY_TOP,
  strawberryHalfWidth,
  strawberryNoise,
  type Pt,
} from "../shapes/strawberryShape";
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

const ORIGIN = polygonBoundsCenter(STRAWBERRY_SIL);

export function strawberryTextureSize(scale: number, margin: number): { w: number; h: number } {
  return polygonTextureSize(STRAWBERRY_SIL, scale, margin);
}

export function paintStrawberryTexture(
  ctx: CanvasRenderingContext2D,
  scale: number,
  margin: number,
): void {
  const { rx, ry } = polygonTextureSize(STRAWBERRY_SIL, scale, margin);
  const cx = rx + margin;
  const cy = ry + margin;
  const w = cx * 2;
  const h = cy * 2;
  const s = scale;

  ctx.clearRect(0, 0, w, h);

  groundShadow(ctx, cx, cy + STRAWBERRY_BOTTOM * s * 0.96, STRAWBERRY_MAX_HW * 0.6 * s, 10 * s);

  fillPoly(ctx, place(STRAWBERRY_SIL, ORIGIN, cx, cy, s), PAL.strawberry);

  // Cross-section-only pale core + radiating fibres — translucent, ON TOP
  // of the base skin (see this file's own header doc for why). Alphas
  // below are pre-multiplied by GROUP_ALPHA directly — fillPoly/
  // strokePoly's own save/restore SETS globalAlpha rather than
  // compounding it, so an outer `ctx.globalAlpha = ...` wrapper around
  // them would silently do nothing (see pepperTexture.ts's own note on
  // this exact bug).
  const GROUP_ALPHA = 0.32;
  const core: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const v = i / 20;
    core.push({
      x: 12 * Math.sin(Math.PI * v) * (1 - v * 0.7),
      y: STRAWBERRY_TOP + 10 + (STRAWBERRY_BOTTOM - STRAWBERRY_TOP - 16) * v,
    });
  }
  for (let i = 20; i >= 0; i--) {
    const v = i / 20;
    core.push({
      x: -12 * Math.sin(Math.PI * v) * (1 - v * 0.7),
      y: STRAWBERRY_TOP + 10 + (STRAWBERRY_BOTTOM - STRAWBERRY_TOP - 16) * v,
    });
  }
  fillPoly(ctx, place(core, ORIGIN, cx, cy, s), PAL.strawberryCore, GROUP_ALPHA * 0.9);
  for (let i = 0; i < 16; i++) {
    const v = 0.1 + 0.8 * (i / 15);
    const hw = strawberryHalfWidth(v);
    const yy = STRAWBERRY_TOP + (STRAWBERRY_BOTTOM - STRAWBERRY_TOP) * v;
    const dir = i % 2 ? 1 : -1;
    strokePoly(
      ctx,
      place(
        [
          { x: dir * 6, y: yy },
          { x: dir * hw * 0.85, y: yy - 4 },
        ],
        ORIGIN,
        cx,
        cy,
        s,
      ),
      PAL.strawberry,
      1.2 * s,
      0.4,
      false,
    );
  }

  fillPoly(
    ctx,
    place(shrinkToward(STRAWBERRY_SIL, 40, 46, 0.08), ORIGIN, cx, cy, s),
    PAL.strawberryDark,
    0.32,
  );
  fillPoly(
    ctx,
    place(shrinkToward(STRAWBERRY_SIL, -30, -26, 0.36), ORIGIN, cx, cy, s),
    PAL.strawberryLight,
    0.4,
  );
  strokePoly(ctx, place(STRAWBERRY_SIL, ORIGIN, cx, cy, s), PAL.strawberryDark, 2.2 * s, 0.5);

  // seeds sit in shallow dimples
  for (const sd of STRAWBERRY_SEEDS) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#9c1f2a";
    ctx.beginPath();
    ctx.ellipse(
      cx + (sd.x + 1 - ORIGIN.x) * s,
      cy + (sd.y + 1.6 - ORIGIN.y) * s,
      8 * s,
      6 * s,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx + (sd.x - ORIGIN.x) * s, cy + (sd.y - ORIGIN.y) * s);
    ctx.rotate(sd.a);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#f3dd9a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.6 * s, 3.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  softHighlight(ctx, cx - 24 * s, cy - 22 * s, 26 * s, 40 * s, 0xfff2e6, 0.5, -0.35);
  softHighlight(ctx, cx + 18 * s, cy + 34 * s, 10 * s, 22 * s, 0xffd8cc, 0.25, 0.3);

  // leafy crown
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.46;
    const len = 40 + 8 * strawberryNoise(i, 8);
    const leaf: Pt[] = [
      { x: 0, y: STRAWBERRY_TOP - 2 },
      { x: Math.cos(a - 0.16) * len * 0.6, y: STRAWBERRY_TOP + Math.sin(a - 0.16) * len * 0.6 },
      { x: Math.cos(a) * len, y: STRAWBERRY_TOP + Math.sin(a) * len },
      { x: Math.cos(a + 0.16) * len * 0.6, y: STRAWBERRY_TOP + Math.sin(a + 0.16) * len * 0.6 },
    ];
    fillPoly(ctx, place(leaf, ORIGIN, cx, cy, s), i % 2 ? PAL.leafDark : PAL.leaf);
  }
  fillPoly(
    ctx,
    place(
      [
        { x: -3, y: STRAWBERRY_TOP - 20 },
        { x: 3, y: STRAWBERRY_TOP - 20 },
        { x: 2, y: STRAWBERRY_TOP - 40 },
        { x: -3, y: STRAWBERRY_TOP - 38 },
      ],
      ORIGIN,
      cx,
      cy,
      s,
    ),
    PAL.leafDark,
  );
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#5f8f4a";
  ctx.beginPath();
  ctx.ellipse(
    cx + -ORIGIN.x * s,
    cy + (STRAWBERRY_TOP - 4 - ORIGIN.y) * s,
    22 * s,
    12 * s,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}
