/**
 * CHICKEN_TEXTURE — ported verbatim from knifecraft.html's actual
 * `PAINT.chicken(c2,g)` (source `:8061`) against the real
 * `shape:'fillet'` geometry (`SILS.fillet`, source `:3362`). No SKIN
 * entry exists for chicken in the source — a boneless breast has no
 * shell — so, unlike every SKIN_KEEP/hasCut ellipse/taper texture file
 * in this project, this painter has no whole/cut split at all: it
 * always paints the one interior, and the pale `face` band a cut opens
 * is a separate, per-piece system (see PreparationScene's own doc on
 * `paintCutFaces`), not baked in here.
 *
 * Restrained on purpose — the reference is a smooth, moist, pale
 * fillet, so the detail work is broad tone plus long flowing fibre,
 * never texture for its own sake. Order: flesh ground, form shading
 * that follows the two rails, muscle fibres fanning from the shoulder
 * to the tip, sparse connective sheen, two soft elongated highlights, a
 * darker perimeter band, and the faintest outline. All variation is
 * hashed off the loop index — no `Math.random` anywhere, so the same
 * fillet renders identically every time.
 */
import { makeFilletRailAt, traceFilletPath, type FilletOpts } from "../ingredientShapes";
import { filletHash } from "./proteinPaintHelpers";

export function chickenTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintChickenTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  opts: FilletOpts = {},
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  const sil = new Path2D();
  traceFilletPath(sil, cx, cy, rx, ry, 0, opts);
  const at = makeFilletRailAt(cx, cy, rx, ry, opts);
  const h = filletHash;

  const base = ctx.createLinearGradient(cx - rx * 0.55, cy - ry, cx + rx * 0.72, cy + ry);
  base.addColorStop(0, "#FBD2C4");
  base.addColorStop(0.34, "#F6BBA9");
  base.addColorStop(0.7, "#EFA391");
  base.addColorStop(1, "#E08D79");
  ctx.fillStyle = base;
  ctx.fill(sil);

  ctx.save();
  ctx.clip(sil);
  // FORM — the shoulder sits proud and the trailing lower edge falls
  // away. Two very soft ramps placed on the rails, not a hard inner
  // shadow and not an obvious radial blob: the light stays diffuse.
  const sh = at(0.26, 0.4);
  const lo = at(0.62, 0.94);
  const dome = ctx.createRadialGradient(sh[0], sh[1], ry * 0.1, sh[0], sh[1], ry * 1.95);
  dome.addColorStop(0, "rgba(255,242,236,0.42)");
  dome.addColorStop(0.52, "rgba(255,236,228,0.16)");
  dome.addColorStop(1, "rgba(255,236,228,0)");
  ctx.fillStyle = dome;
  ctx.fill(sil);
  const fall = ctx.createRadialGradient(lo[0], lo[1], ry * 0.12, lo[0], lo[1], ry * 1.7);
  fall.addColorStop(0, "rgba(198,112,100,0.26)");
  fall.addColorStop(0.6, "rgba(198,112,100,0.10)");
  fall.addColorStop(1, "rgba(198,112,100,0)");
  ctx.fillStyle = fall;
  ctx.fill(sil);
  // FIBRE — long curved strokes that follow the rails from the broad
  // shoulder toward the tip, each one a faint darker furrow with a
  // paler crest beside it. Sixteen, not sixty: at mobile size they must
  // merge into tone rather than read as hair.
  ctx.lineCap = "round";
  for (let k = 0; k < 16; k++) {
    const v0 = 0.07 + k * 0.056 + 0.02 * h(k + 3, 7);
    const v1 = 0.2 + k * 0.04 + 0.03 * h(k + 11, 5);
    const s0 = 0.05 + 0.17 * h(k + 5, 9);
    const s1 = 0.9 + 0.08 * h(k + 7, 11);
    const bend = 0.05 + 0.05 * h(k + 13, 6);
    const lit = k % 3 === 1;
    const run = (col: string, wd: number, dv: number) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const t = i / 28;
        const s = s0 + (s1 - s0) * t;
        const v = Math.max(0, Math.min(1, v0 + (v1 - v0) * t + bend * Math.sin(Math.PI * t) + dv));
        const q = at(s, v);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
    };
    run(`rgba(203,120,106,${(0.1 + 0.06 * h(k + 17, 4)).toFixed(2)})`, 3.2 + 2.0 * h(k + 19, 5), 0);
    run(`rgba(255,235,226,${lit ? 0.18 : 0.11})`, 1.9 + 1.2 * h(k + 23, 4), -0.02);
  }
  // CONNECTIVE — five pale, stretched, very low-opacity slicks near the
  // thicker half. Not marbling: chicken breast is smooth flesh, and
  // anything whiter than this reads as beef fat.
  for (let k = 0; k < 5; k++) {
    const q = at(0.16 + 0.16 * k + 0.05 * h(k + 29, 5), 0.24 + 0.13 * k + 0.06 * h(k + 31, 4));
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-0.22 + 0.16 * h(k + 37, 5));
    ctx.fillStyle = `rgba(255,244,236,${(0.11 + 0.05 * h(k + 41, 4)).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * (0.11 + 0.05 * h(k + 43, 5)), ry * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // HIGHLIGHT — two broad, warm, elongated sheens along the fibre
  // direction. Soft-edged and semi-transparent: a specular dot would
  // turn a moist fillet into a plastic one.
  for (const [s, v, lx, ly, a] of [
    [0.3, 0.3, 0.3, 0.13, 0.28],
    [0.58, 0.52, 0.24, 0.1, 0.18],
  ] as const) {
    const q = at(s, v);
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-0.16);
    const hg = ctx.createRadialGradient(0, 0, 1, 0, 0, rx * lx);
    hg.addColorStop(0, `rgba(255,247,242,${a})`);
    hg.addColorStop(0.55, `rgba(255,244,238,${(a * 0.42).toFixed(3)})`);
    hg.addColorStop(1, "rgba(255,244,238,0)");
    ctx.fillStyle = hg;
    ctx.scale(1, (ry * ly) / (rx * lx));
    ctx.beginPath();
    ctx.arc(0, 0, rx * lx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // PERIMETER — a darker band inside the edge, laid down as wide
  // strokes under the clip so it fades inward instead of printing a
  // line. The rim is what tells the eye this is a thick fillet and not
  // a paper cutout.
  ctx.strokeStyle = "rgba(198,112,100,0.22)";
  ctx.lineWidth = ry * 0.34;
  ctx.stroke(sil);
  ctx.strokeStyle = "rgba(190,104,94,0.20)";
  ctx.lineWidth = ry * 0.15;
  ctx.stroke(sil);
  ctx.restore();
  ctx.strokeStyle = "rgba(196,110,98,0.40)"; // whisper, not a cartoon outline
  ctx.lineWidth = 1.4;
  ctx.stroke(sil);
}
