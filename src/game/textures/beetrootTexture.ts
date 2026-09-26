/**
 * BEETROOT_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.beetroot()` (source line 7930, opaque purple-red skin) AND
 * "BEETROOT, INTERIOR" `PAINT.beetroot()` (source line 6879, the
 * candy-cane ring flesh). The source composites these as two full-body
 * sprites with a time-based alpha fade production has no equivalent
 * for; baked into one canvas instead — skin drawn full, then — ONLY once
 * `hasCut` is true — the real ringed flesh painted on top clipped to an
 * inset taper, so the skin survives at the edge while a cut opens onto
 * the actual ported rings. See kiwiTexture.ts's own doc for why `hasCut`
 * defaulting to false (an uncut whole stays 100% skin) matters and where
 * the flag comes from.
 */
import { traceTaperPath, type TaperPaintOpts } from "./carrotTexture";

const SKIN_INSET = 16;

// The crown leaves (cosmetic overhang, source pixel constants unscaled)
// reach well past rx — see cornTexture.ts's own doc for why growing the
// canvas to fit it would be wasted memory: PreparationScene's piece-
// rendering pipeline crops every piece, including the whole uncut
// ingredient, to the COLLISION silhouette's own rx/rBig bounds, so the
// crown is painted (faithful to the source) but never reaches the screen.
export function beetrootTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintBeetrootTexture(
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
  // doc. Independent of `hasCut` above (which here means "peeled", driving
  // the ringed-flesh reveal, not "has been cut"). True once
  // `this.cuts.length > 0`; gates the root wisp + leaf crown below so
  // they actually shed on the first cut.
  overhangGone = false,
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = (pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, pad, opts);
  };

  const skin = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - rBig * 0.4,
    rBig * 0.1,
    cx - rx * 0.1,
    cy,
    rBig * 1.55,
  );
  skin.addColorStop(0, "#8E2350");
  skin.addColorStop(0.42, "#651334");
  skin.addColorStop(0.78, "#460B22");
  skin.addColorStop(1, "#2C0512");
  ctx.fillStyle = skin;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  ctx.fillStyle = "rgba(24,3,12,0.16)"; // irregularity via blotches, not geometry
  for (let i = 0; i < 44; i++) {
    const a = i * 2.399963;
    const r = 0.5 + 0.46 * (((i * 7919) % 89) / 89);
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * r * 0.7,
      cy + Math.sin(a) * rBig * r,
      6 + 5 * (((i * 104729) % 23) / 23),
      4 + 3 * (((i * 6151) % 17) / 17),
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    // faint growth rings around the shoulder
    const f = 0.24 + i * 0.1;
    ctx.strokeStyle = i % 2 ? "rgba(190,120,150,0.13)" : "rgba(24,3,12,0.14)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(
      cx - rx * 0.52,
      cy,
      rx * f * 0.9,
      rBig * f * 1.5,
      0,
      -Math.PI * 0.46,
      Math.PI * 0.46,
    );
    ctx.stroke();
  }
  const gloss = ctx.createRadialGradient(
    cx - rx * 0.44,
    cy - rBig * 0.46,
    2,
    cx - rx * 0.44,
    cy - rBig * 0.46,
    rBig * 0.86,
  );
  gloss.addColorStop(0, "rgba(255,190,215,0.30)");
  gloss.addColorStop(1, "rgba(255,190,215,0)");
  ctx.fillStyle = gloss;
  sil(0);
  ctx.fill(); // the shine a beet's skin actually has
  ctx.restore();

  if (!overhangGone) {
    const tipX = cx + rx * 0.98; // wiry root off the point, past the body
    ctx.strokeStyle = "#3A0A1C";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tipX - 6, cy);
    ctx.quadraticCurveTo(tipX + 22, cy - 4, tipX + 44, cy + 8);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tipX + 14, cy + 1);
    ctx.quadraticCurveTo(tipX + 26, cy + 12, tipX + 30, cy + 22);
    ctx.stroke();

    const bx = cx - rx * 0.86; // crown: stalks + crinkled leaves
    const by = cy;
    const leaves: [number, number, number, number][] = [
      [-0.86, 116, 9, 1],
      [-0.46, 134, 10, 0],
      [-0.1, 142, 11, 1],
      [0.3, 128, 10, 0],
      [0.7, 106, 9, 1],
    ];
    for (const [a, len, w, back] of leaves) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI + a);
      const st = ctx.createLinearGradient(0, 0, len, 0);
      st.addColorStop(0, "#8E1B44");
      st.addColorStop(0.55, "#B32B5C");
      st.addColorStop(1, "#C4416E");
      ctx.strokeStyle = st;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.54, -w * 0.9, len * 0.74, -w * 0.3);
      ctx.stroke();
      ctx.save();
      ctx.translate(len * 0.74, -w * 0.3);
      const blade = new Path2D();
      blade.moveTo(0, 0);
      blade.bezierCurveTo(len * 0.1, -w * 2.4, len * 0.34, -w * 3.0, len * 0.48, -w * 0.9);
      blade.bezierCurveTo(len * 0.4, -w * 0.2, len * 0.44, w * 2.2, len * 0.26, w * 1.8);
      blade.bezierCurveTo(len * 0.14, w * 2.6, len * 0.04, w * 1.2, 0, 0);
      blade.closePath();
      const lg = ctx.createLinearGradient(0, -w * 2, len * 0.4, w * 2);
      if (back) {
        lg.addColorStop(0, "#3E6E28");
        lg.addColorStop(1, "#28501B");
      } else {
        lg.addColorStop(0, "#57903A");
        lg.addColorStop(1, "#356524");
      }
      ctx.fillStyle = lg;
      ctx.fill(blade);
      ctx.strokeStyle = "rgba(22,48,14,0.34)";
      ctx.lineWidth = 1;
      ctx.stroke(blade);
      ctx.strokeStyle = "rgba(178,60,96,0.45)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(len * 0.02, 0);
      ctx.quadraticCurveTo(len * 0.24, w * 0.2, len * 0.44, -w * 0.6);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
  }
  ctx.strokeStyle = "rgba(28,3,12,0.44)";
  ctx.lineWidth = 1.8;
  sil(0);
  ctx.stroke();

  if (!hasCut) return; // uncut: 100% purple-red skin — no ringed flesh showing yet

  // --- "BEETROOT, INTERIOR": the real candy-cane ring flesh, windowed to
  // an inset taper so the skin survives around the edge ---
  ctx.save();
  ctx.beginPath();
  traceTaperPath(
    ctx,
    cx,
    cy,
    rx - SKIN_INSET,
    rBig - SKIN_INSET,
    Math.max(3, rSmall - SKIN_INSET * 0.6),
    buttRound,
    tipRound,
    0,
    opts,
  );
  ctx.clip();

  const fg = ctx.createRadialGradient(
    cx - rx * 0.16,
    cy - rBig * 0.08,
    rBig * 0.05,
    cx - rx * 0.1,
    cy,
    rBig * 1.2,
  );
  fg.addColorStop(0, "#B5305F");
  fg.addColorStop(0.55, "#8E1E44");
  fg.addColorStop(1, "#6B1230");
  ctx.fillStyle = fg;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  const coreX = cx - rx * 0.46;
  const coreY = cy - rBig * 0.04;
  for (let r = 5; r >= 1; r--) {
    const frac = r / 5.3;
    const seed = r * 2.399963 + 2;
    const ring = new Path2D();
    const N = 40;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const w = 1 + 0.05 * Math.sin(4 * a + seed) + 0.03 * Math.sin(7 * a + seed * 1.5);
      const x = coreX + Math.cos(a) * rBig * 0.92 * frac * w;
      const y = coreY + Math.sin(a) * rBig * 0.86 * frac * w;
      if (k) ring.lineTo(x, y);
      else ring.moveTo(x, y);
    }
    ring.closePath();
    ctx.fillStyle = r % 2 ? "rgba(216,120,158,0.55)" : "rgba(120,26,58,0.4)";
    ctx.fill(ring);
  }
  for (let i = 0; i < 50; i++) {
    // fine radiating fibre, restrained
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 73) / 73);
    ctx.strokeStyle = "rgba(60,10,26,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(coreX, coreY);
    ctx.lineTo(coreX + Math.cos(a) * rBig * 0.95 * r, coreY + Math.sin(a) * rBig * 0.88 * r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}
