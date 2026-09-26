/**
 * PEAR_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.pear()` (source line 5859) against the real `taper` geometry.
 * Skin is a yellow-green wash with russet freckles (deterministic golden
 * angle, never rng); an inset flesh layer carries a granular grit
 * speckle and a five-seed rosette core AT THE BODY (crown) END — the
 * widest part, where a pear's core actually sits (a wider spread reads
 * as a kiwi); the stem is a short nub on the neck's tip, kept short so it
 * reads as growing from the fruit rather than lying next to it.
 *
 * Discrepancy #1's close-out: `peeled` (mandatory-first, same convention
 * as Onion/Potato/Garlic — see TaperRenderer.paint's own doc on why this
 * slot is typed `hasCut` but means "peeled" for an ingredient with its
 * own Peel technique) swaps the outer skin for the SAME pale flesh
 * gradient the inset layer below already uses, and drops the
 * yellow-green rind fill + russet freckles entirely — the interior
 * (grit, core, seeds, stem) is untouched either way.
 */
import { traceTaperPath, type TaperPaintOpts } from "./carrotTexture";

export function pearTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

/** Ported from the source's shared `innerGeom(g,d)` — see avocadoTexture.ts's own copy of this helper for the exact port rationale. */
function insetTaper(
  rx: number,
  rBig: number,
  rSmall: number,
  d: number,
): { rx: number; rBig: number; rSmall: number } {
  return { rx: rx - d, rBig: rBig - d, rSmall: Math.max(3, rSmall - d * 0.6) };
}

export function paintPearTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
  opts: TaperPaintOpts = {},
  peeled = false,
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = (rrx: number, rrBig: number, rrSmall: number, pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rrx, rrBig, rrSmall, buttRound, tipRound, pad, opts);
  };

  const fg = ctx.createRadialGradient(
    cx - rx * 0.26,
    cy - rBig * 0.22,
    rx * 0.06,
    cx - rx * 0.1,
    cy,
    rx * 0.98,
  );
  fg.addColorStop(0, "#FCFAE2");
  fg.addColorStop(0.52, "#F5F1D2");
  fg.addColorStop(1, "#E3DDB4");

  if (!peeled) {
    const skin = ctx.createLinearGradient(cx - rx * 0.4, cy - rBig, cx + rx * 0.5, cy + rBig);
    skin.addColorStop(0, "#CFDA69");
    skin.addColorStop(0.44, "#B3C74C");
    skin.addColorStop(1, "#8A9E33");
    ctx.fillStyle = skin;
  } else {
    // Peeled: no yellow-green rind at all — the pale flesh gradient below
    // IS the outer surface now, same tone the inset layer already uses.
    ctx.fillStyle = fg;
  }
  sil(rx, rBig, rSmall, 0);
  ctx.fill();

  const flesh = insetTaper(rx, rBig, rSmall, 10);
  ctx.save();
  sil(rx, rBig, rSmall, 0);
  ctx.clip();
  ctx.fillStyle = fg;
  sil(flesh.rx, flesh.rBig, flesh.rSmall, 0);
  ctx.fill();

  ctx.save();
  sil(flesh.rx, flesh.rBig, flesh.rSmall, 0);
  ctx.clip();
  ctx.fillStyle = "rgba(196,186,132,0.16)"; // grit: pear flesh is granular, not smooth
  for (let i = 0; i < 150; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 89) / 89);
    ctx.beginPath();
    ctx.arc(
      cx - rx * 0.12 + Math.cos(a) * rx * 0.8 * r,
      cy + Math.sin(a) * rBig * 0.82 * r,
      1.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // CORE — at the body end (left), the widest part, which is where a
  // pear's core actually sits. Five seeds in a compact rosette; a wider
  // spread reads as a kiwi.
  const px = cx - rx * 0.34;
  const py = cy + rBig * 0.02;
  const core = new Path2D();
  core.ellipse(px, py, rx * 0.2, rBig * 0.34, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(226,216,158,0.55)";
  ctx.fill(core);
  ctx.strokeStyle = "rgba(160,150,96,0.32)";
  ctx.lineWidth = 1.4;
  ctx.stroke(core);
  for (let i = 0; i < 5; i++) {
    const a = -1.1 + i * ((Math.PI * 2) / 5.6);
    const rr = rBig * 0.17;
    const sx = px + Math.cos(a) * rx * 0.085;
    const sy = py + Math.sin(a) * rr;
    const sg = ctx.createLinearGradient(sx - 4, sy - 5, sx + 4, sy + 5);
    sg.addColorStop(0, "#6B5228");
    sg.addColorStop(1, "#3E2F14");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 6.4, 4.2, a * 0.5 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  ctx.save();
  sil(rx, rBig, rSmall, 0);
  ctx.clip();
  if (!peeled) {
    for (let i = 0; i < 64; i++) {
      // russet freckles, on the SKIN only — gone once peeled
      const a = i * 2.399963;
      const r = 0.62 + 0.36 * (((i * 7919) % 53) / 53);
      const x = cx + Math.cos(a) * rx * 0.86 * r;
      const y = cy + Math.sin(a) * rBig * 0.88 * r;
      ctx.fillStyle = i % 3 ? "rgba(146,116,44,0.26)" : "rgba(184,152,64,0.20)";
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + 1.7 * (((i * 104729) % 19) / 19), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const hl = ctx.createLinearGradient(cx - rx * 0.8, cy - rBig, cx + rx * 0.3, cy + rBig * 0.5);
  hl.addColorStop(0, "rgba(255,255,228,0.22)");
  hl.addColorStop(0.58, "rgba(255,255,228,0.04)");
  hl.addColorStop(1, "rgba(255,255,228,0)");
  ctx.fillStyle = hl;
  sil(rx, rBig, rSmall, 0);
  ctx.fill();
  ctx.restore();

  const tipX = cx + rx * 0.98; // stem: a short nub on the neck's tip
  ctx.strokeStyle = "#6A4C24";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tipX - 6, cy - rSmall * 0.12);
  ctx.quadraticCurveTo(tipX + 16, cy - rSmall * 0.5, tipX + 26, cy - rSmall * 1.1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(214,182,132,0.5)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(tipX - 4, cy - rSmall * 0.2);
  ctx.quadraticCurveTo(tipX + 15, cy - rSmall * 0.56, tipX + 24, cy - rSmall * 1.1);
  ctx.stroke();
  // Unpeeled: a greenish rind edge. Peeled: a neutral tan edge — no green
  // skin left to tint it.
  ctx.strokeStyle = peeled ? "rgba(150,130,90,0.36)" : "rgba(84,98,26,0.40)";
  ctx.lineWidth = 1.8;
  sil(rx, rBig, rSmall, 0);
  ctx.stroke();
}
