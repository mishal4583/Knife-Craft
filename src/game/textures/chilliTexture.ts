/**
 * CHILLI_TEXTURE — ported from the KNIFECRAFT-NEW-INGREDIENTS package's
 * `PAINT_ADDITIONS.chilli()` against the real `taper` geometry
 * (CHILLI_GEOMETRY in definitions.ts — Eggplant's own `spine` bow, see
 * that geometry's own doc). A glossy pod: value range across the body
 * (lit flank over shaded underside), one segmented specular streak along
 * the bow, and the crooked stalk + five-pointed calyx painted past the
 * butt — the package's own "keepOverhang" case (04-shared-patches.md
 * §1). No dedicated overhang code path exists to patch in production:
 * PreparationScene's piece-rendering pipeline already crops every piece,
 * including the whole uncut ingredient, to the collision silhouette's
 * own rx/rBig bounds (see cornTexture.ts's own doc on why its stalk stub
 * and turnipTexture.ts's leaf stalks are painted-but-invisible the exact
 * same way) — so the calyx/stalk are painted here, faithfully, for the
 * same harmless "invisible past the crop, correct if that ever changes"
 * reason those two already are, not a new mechanism.
 */
import { traceTaperPath, taperH, taperY, type TaperPaintOpts } from "./carrotTexture";

export function chilliTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintChilliTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
  opts: TaperPaintOpts = {},
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const taperCurve = opts.taperCurve ?? 1;
  const spine = opts.spine ?? 0;
  const spineRx = opts.spineRx ?? rx;
  const h = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, taperCurve);
  const y = (x: number) => taperY(x, cx, cy, spine, spineRx);
  const sil = (pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, pad, opts);
  };

  const sk = ctx.createLinearGradient(cx, cy - rBig * 1.1, cx, cy + rBig * 1.3);
  sk.addColorStop(0, "#8CC62E");
  sk.addColorStop(0.24, "#6FAF1E");
  sk.addColorStop(0.58, "#4E8E14");
  sk.addColorStop(0.84, "#356D0E");
  sk.addColorStop(1, "#234E0A");
  ctx.fillStyle = sk;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();

  const along = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy); // the tip darkens and dries
  along.addColorStop(0, "rgba(96,150,28,0.20)");
  along.addColorStop(0.55, "rgba(255,255,255,0)");
  along.addColorStop(1, "rgba(28,58,8,0.40)");
  ctx.fillStyle = along;
  sil(0);
  ctx.fill();

  const N = 40; // the specular: segmented, along the bow
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = cx - rx * 0.86 + 1.68 * rx * t * 0.86;
    const hh = h(x);
    if (hh <= 0) continue;
    const yy = y(x) - hh * 0.46;
    // gloss, not a painted line: the streak thins toward the tip and breaks twice along the way
    const brk = Math.sin(t * 7.4) > -0.55 ? 1 : 0;
    if (!brk) continue;
    const w = hh * 0.3 * (1 - 0.45 * t);
    ctx.fillStyle = `rgba(232,250,196,${(0.34 - 0.22 * t).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, yy, w * 1.9, w * 0.52, 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    // faint length creases down the shaded flank
    const f = 0.24 + i * 0.16;
    ctx.strokeStyle = "rgba(40,78,14,0.16)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const x = cx - rx * 0.84 + 1.66 * rx * (k / 24) * 0.84;
      const hh = h(x);
      if (hh <= 0) continue;
      const yy = y(x) + hh * f;
      if (k) ctx.lineTo(x, yy);
      else ctx.moveTo(x, yy);
    }
    ctx.stroke();
  }

  // The flesh is a thin inner core confined to the mid-body — a pod is
  // ~4cm thick at most, so a generous inset (or one that reaches the
  // fine tip) turns the whole chili pale and it stops reading as one.
  ctx.beginPath();
  traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, -30, opts);
  const fg = ctx.createLinearGradient(cx - rx, cy, cx + rx * 0.7, cy); // fades out at both ends
  fg.addColorStop(0, "rgba(196,222,140,0)");
  fg.addColorStop(0.3, "rgba(196,222,140,0.85)");
  fg.addColorStop(0.62, "rgba(178,208,118,0.75)");
  fg.addColorStop(1, "rgba(163,193,105,0)");
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.restore();

  // CALYX + STALK, past the butt: paint only (see this file's own doc —
  // production crops every piece, including the uncut whole, to the
  // collision silhouette's own rx/rBig bounds, same as Corn's stub).
  const bx = cx - rx * 0.94;
  const by = y(cx - rx * 0.92);
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(-2.05); // continues the body's line, tipping up and back
  const stalk = ctx.createLinearGradient(0, 0, 0, -120);
  stalk.addColorStop(0, "#41701A");
  stalk.addColorStop(0.55, "#5B8A26");
  stalk.addColorStop(1, "#9FAE62");
  ctx.strokeStyle = stalk;
  ctx.lineCap = "round";
  ctx.lineWidth = 17; // thick where it leaves the shoulder
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-4, -34, 10, -62);
  ctx.stroke();
  ctx.lineWidth = 10; // thinner and kinked past the bend
  ctx.beginPath();
  ctx.moveTo(10, -62);
  ctx.quadraticCurveTo(26, -88, 52, -102);
  ctx.stroke();
  ctx.strokeStyle = "rgba(206,228,152,0.34)"; // a lit edge up the stalk
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.bezierCurveTo(-9, -46, 13, -80, 41, -100);
  ctx.stroke();
  const cal = ctx.createLinearGradient(-26, -26, 26, 26);
  cal.addColorStop(0, "#7FB030");
  cal.addColorStop(0.6, "#578A1C");
  cal.addColorStop(1, "#375F10");
  ctx.fillStyle = cal;
  for (let i = 0; i < 5; i++) {
    // the collar: five short pointed lobes
    const a = -1.5 + i * 0.62;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(15, 10, 6, 26);
    ctx.quadraticCurveTo(-5, 13, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#568A1E";
  ctx.beginPath();
  ctx.ellipse(0, 4, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,74,14,0.36)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(26,54,8,0.46)";
  ctx.lineWidth = 1.8;
  sil(0);
  ctx.stroke();
}
