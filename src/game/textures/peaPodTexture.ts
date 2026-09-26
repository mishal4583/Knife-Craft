/**
 * PEA_POD_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.peapod()` (source line 8140, the intact glossy pod) AND
 * `PAINT.peapod()` ("PEA POD, OPENED", source line 7356, the split
 * hollow wall with plump round peas resting on it). The source
 * composites these as two full-body sprites with a time-based alpha
 * fade production has no equivalent for; baked into one canvas instead —
 * intact pod drawn full, then — ONLY once `hasCut` is true — the real
 * opened-pod interior painted on top clipped to an inset taper, so the
 * glossy shell survives at the edge while a cut opens onto the actual
 * ported peas. See kiwiTexture.ts's own doc for why `hasCut` defaulting
 * to false (an uncut whole stays 100% skin) matters and where the flag
 * comes from.
 */
import { traceTaperPath, type TaperPaintOpts } from "./carrotTexture";

const SKIN_INSET_FRAC = 0.32; // a thin pod: a fixed-px inset would swallow the whole cavity, so this scales with rBig

// The stem + tendril curl (cosmetic overhang, source pixel constants
// unscaled) reaches past rx — see cornTexture.ts's own doc for why
// growing the canvas to fit it would be wasted memory: PreparationScene's
// piece-rendering pipeline crops every piece, including the whole uncut
// ingredient, to the COLLISION silhouette's own rx/rBig bounds, so the
// tendril is painted (faithful to the source) but never reaches the screen.
export function peaPodTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintPeaPodTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
  opts: TaperPaintOpts = {},
  hasCut = false,
  // `overhangGone` — see PreparationScene.ts's TaperRenderer.paint own
  // doc. Independent of `hasCut` above (which here drives the "opened
  // pod" reveal, not "has been cut"). True once `this.cuts.length > 0`;
  // gates the stem+tendril below so it actually sheds on the first cut.
  overhangGone = false,
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = (pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, pad, opts);
  };

  const skin = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  skin.addColorStop(0, "#9ECB5E");
  skin.addColorStop(0.28, "#84BA46");
  skin.addColorStop(0.66, "#6EA537");
  skin.addColorStop(1, "#4F8127");
  ctx.fillStyle = skin;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  for (let i = 0; i < 7; i++) {
    // peas pushing at the shell: swelling, not outline
    const x = cx - rx * 0.74 + i * ((rx * 1.48) / 6);
    const sw = ctx.createRadialGradient(
      x - rBig * 0.2,
      cy - rBig * 0.28,
      rBig * 0.06,
      x,
      cy,
      rBig * 0.98,
    );
    sw.addColorStop(0, "rgba(206,232,150,0.42)");
    sw.addColorStop(0.6, "rgba(180,214,116,0.16)");
    sw.addColorStop(1, "rgba(180,214,116,0)");
    ctx.fillStyle = sw;
    ctx.beginPath();
    ctx.ellipse(x, cy, rBig * 0.86, rBig * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(46,74,22,0.13)"; // the crease where two peas meet
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.12, cy + rBig * 0.1, rBig * 0.1, rBig * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 70; i++) {
    // fine pale speckle
    const h1 = ((i * 7919) % 97) / 97;
    const h2 = ((i * 6151) % 89) / 89;
    ctx.fillStyle = `rgba(232,246,196,${(0.1 + 0.16 * h2).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(
      cx + (h1 - 0.5) * rx * 1.9,
      cy + (h2 - 0.5) * rBig * 1.6,
      0.8 + 1.2 * h1,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const sheen = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig * 0.2);
  sheen.addColorStop(0, "rgba(255,255,230,0.42)");
  sheen.addColorStop(0.5, "rgba(255,255,230,0.10)");
  sheen.addColorStop(1, "rgba(255,255,230,0)");
  ctx.fillStyle = sheen;
  sil(0);
  ctx.fill();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,238,0.55)"; // long specular down the crown
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.72, cy - rBig * 0.56);
  ctx.quadraticCurveTo(cx - rx * 0.05, cy - rBig * 0.8, cx + rx * 0.7, cy - rSmall * 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(38,64,18,0.34)"; // ventral seam
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.88, cy + rBig * 0.6);
  ctx.quadraticCurveTo(cx, cy + rBig * 0.82, cx + rx * 0.88, cy + rSmall * 0.56);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(40,68,20,0.46)";
  ctx.lineWidth = 1.6;
  sil(0);
  ctx.stroke();

  if (!overhangGone) {
    const bx = cx - rx * 0.99; // stem, then the tendril curl
    const by = cy - rBig * 0.18;
    ctx.strokeStyle = "#6E9438";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx + 4, by);
    ctx.quadraticCurveTo(bx - 16, by - 6, bx - 30, by - 12);
    ctx.stroke();
    ctx.strokeStyle = "#8FB255";
    ctx.lineWidth = 3;
    for (const d of [-0.55, 0.0, 0.5]) {
      // dried sepal wisps at the joint
      ctx.beginPath();
      ctx.moveTo(bx - 26, by - 11);
      ctx.quadraticCurveTo(bx - 34 + d * 8, by - 11 + d * 16, bx - 40 + d * 14, by - 8 + d * 30);
      ctx.stroke();
    }
    ctx.strokeStyle = "#7FA646";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const a0 = -0.4;
    const rr = 20;
    const px = bx - 30;
    const py = by - 10;
    ctx.moveTo(px, py);
    for (let s = 1; s <= 46; s++) {
      // the spiral tendril
      const a = a0 + s * 0.3;
      const r = rr * (1 - s / 52);
      ctx.lineTo(bx - 42 + Math.cos(a) * r, by + 6 + Math.sin(a) * r);
    }
    ctx.stroke();
  }

  if (!hasCut) return; // uncut: 100% intact glossy pod — no split interior showing yet

  // --- "PEA POD, OPENED": the real split-pod interior — hollow wall +
  // plump peas — windowed to an inset taper so the glossy shell survives
  // around the edge ---
  const insetRBig = rBig * (1 - SKIN_INSET_FRAC);
  const insetRSmall = Math.max(2, rSmall * (1 - SKIN_INSET_FRAC * 0.6));
  ctx.save();
  ctx.beginPath();
  traceTaperPath(ctx, cx, cy, rx, insetRBig, insetRSmall, buttRound, tipRound, 0, opts);
  ctx.clip();

  const wall = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  wall.addColorStop(0, "#A8C96A");
  wall.addColorStop(0.34, "#C4DE8C");
  wall.addColorStop(0.72, "#B7D67C");
  wall.addColorStop(1, "#8FB755");
  ctx.fillStyle = wall;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  const cav = ctx.createLinearGradient(cx, cy - rBig * 0.9, cx, cy + rBig * 0.9);
  cav.addColorStop(0, "rgba(96,132,52,0.42)");
  cav.addColorStop(0.3, "rgba(214,236,166,0.30)");
  cav.addColorStop(0.74, "rgba(198,226,146,0.24)");
  cav.addColorStop(1, "rgba(88,124,46,0.40)");
  ctx.fillStyle = cav;
  sil(0);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    // the peas: plump, touching, slightly irregular
    const x = cx - rx * 0.74 + i * ((rx * 1.48) / 6);
    const jit = ((i * 7919) % 13) / 13 - 0.5;
    const r = rBig * (0.72 + 0.07 * (((i * 6151) % 11) / 11));
    const py2 = cy + jit * rBig * 0.1;
    ctx.fillStyle = "rgba(70,100,34,0.28)"; // seat shadow under each pea
    ctx.beginPath();
    ctx.ellipse(x + 2, py2 + r * 0.34, r * 0.94, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    const pg = ctx.createRadialGradient(
      x - r * 0.34,
      py2 - r * 0.4,
      r * 0.08,
      x + r * 0.1,
      py2 + r * 0.16,
      r * 1.16,
    );
    pg.addColorStop(0, "#E4F4B4");
    pg.addColorStop(0.34, "#C6E483");
    pg.addColorStop(0.74, "#A6CC5C");
    pg.addColorStop(1, "#7FA83C");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(x, py2, r, r * 0.98, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(96,130,44,0.34)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, py2, r, r * 0.98, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,232,0.55)"; // tiny specular
    ctx.beginPath();
    ctx.ellipse(x - r * 0.34, py2 - r * 0.4, r * 0.2, r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(226,240,182,0.75)"; // attachment stalk to the wall
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, py2 + r * 0.72);
    ctx.quadraticCurveTo(x + r * 0.9, cy + rBig * 0.74, x + r * 1.15, cy + rBig * 0.86);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(240,250,206,0.60)"; // lit inner lip along the top edge
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.9, cy - rBig * 0.72);
  ctx.quadraticCurveTo(cx, cy - rBig * 0.92, cx + rx * 0.9, cy - rSmall * 0.7);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(62,96,30,0.46)";
  ctx.lineWidth = 1.6;
  sil(0);
  ctx.stroke();
  ctx.restore();
}
