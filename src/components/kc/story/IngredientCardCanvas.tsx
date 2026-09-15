import { useEffect, useRef } from "react";
import { paintTomatoTexture } from "@/game/textures/tomatoTexture";
import { paintCucumberTexture } from "@/game/textures/cucumberTexture";
import { paintCarrotTexture } from "@/game/textures/carrotTexture";
import { TOMATO_GEOMETRY, CARROT_GEOMETRY, CUCUMBER_GEOMETRY } from "@/game/definitions";

/**
 * The Fresh-Start "your savings" beat's third card paints the REAL
 * tomato, cucumber and carrot side by side in one canvas, through their
 * own production paint functions — ported from knifecraft.html's
 * `paintIng(cv)` (`:11011`), which does the exact same three-way split
 * against `PAINT.tomato/cucumber/carrot`: "the story never invents
 * food." Each ingredient is painted at its own real aspect ratio (the
 * same `*_GEOMETRY` fractions every other ingredient texture uses),
 * scaled to fit its own third of the card — this is a decorative card
 * icon, not a cuttable ingredient, so there's no silhouette/CutGeometry
 * involved.
 */
const CARD_W = 180;
const CARD_H = 64;
const REF_W = 270; // an arbitrary authored-scale reference, purely to get realistic relative proportions before the per-slot fit below

export function IngredientCardCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    const third = CARD_W / 3;
    const margin = 4;
    const fit = (halfW: number, halfH: number) =>
      Math.min((third - margin * 2) / (halfW * 2), (CARD_H - margin * 2) / (halfH * 2));

    // Tomato — slot 0
    {
      const rx0 = TOMATO_GEOMETRY.RX_FRAC * REF_W;
      const ry0 = TOMATO_GEOMETRY.RY_FRAC * REF_W;
      const s = fit(rx0, ry0);
      const rx = rx0 * s;
      const ry = ry0 * s;
      ctx.save();
      ctx.translate(third * 0 + third / 2 - rx - margin, CARD_H / 2 - ry - margin);
      paintTomatoTexture(ctx, rx, ry, margin);
      ctx.restore();
    }
    // Cucumber — slot 1 (capsule: rx/capR play the ellipse renderer's rx/ry slots)
    {
      const rx0 = CUCUMBER_GEOMETRY.RX_FRAC * REF_W;
      const capR0 = CUCUMBER_GEOMETRY.CAP_R_FRAC * REF_W;
      const s = fit(rx0, capR0);
      const rx = rx0 * s;
      const capR = capR0 * s;
      ctx.save();
      ctx.translate(third * 1 + third / 2 - rx - margin, CARD_H / 2 - capR - margin);
      paintCucumberTexture(ctx, rx, capR, margin);
      ctx.restore();
    }
    // Carrot — slot 2 (taper: rBig is the vertical half-extent that must fit the card's height)
    {
      const rx0 = CARROT_GEOMETRY.RX_FRAC * REF_W;
      const rBig0 = CARROT_GEOMETRY.R_BIG_FRAC * REF_W;
      const rSmall0 = CARROT_GEOMETRY.R_SMALL_FRAC * REF_W;
      const s = fit(rx0, rBig0);
      const rx = rx0 * s;
      const rBig = rBig0 * s;
      const rSmall = rSmall0 * s;
      ctx.save();
      ctx.translate(third * 2 + third / 2 - rx - margin, CARD_H / 2 - rBig - margin);
      paintCarrotTexture(
        ctx,
        rx,
        rBig,
        rSmall,
        CARROT_GEOMETRY.BUTT_ROUND,
        CARROT_GEOMETRY.TIP_ROUND,
        margin,
      );
      ctx.restore();
    }
  }, []);

  return <canvas ref={ref} className="h-full w-full object-contain" />;
}
