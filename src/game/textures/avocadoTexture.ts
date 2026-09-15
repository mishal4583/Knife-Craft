/**
 * AVOCADO_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.avocado()` (source line 5652) against the real `taper` geometry.
 * Three layers via inset copies of the silhouette (dark rind → light-green
 * band → pale flesh, the same trick Cucumber's skin/flesh inset uses one
 * layer deeper), off-centre non-radial blotch texture (a radial sunburst
 * read as a citrus fruit and put a phantom socket at the convergence
 * point), and a seed cavity built as a genuine directional hole — an
 * upper-left occlusion crescent, a lower-right lit wall, and a bright lip
 * on the OUTSIDE of the lit edge — never a centred dark focus with an
 * all-round rim, which reads as a lit sphere (the stone still sitting in
 * its socket) rather than an opening.
 */
import { traceTaperPath, type TaperPaintOpts } from "./carrotTexture";

export function avocadoTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

/** Ported from the source's shared `innerGeom(g,d)` — an inset copy of a taper silhouette: rx/rBig shrink by d, rSmall by d*0.6 (floored at 3px), center unchanged. */
function insetTaper(
  rx: number,
  rBig: number,
  rSmall: number,
  d: number,
): { rx: number; rBig: number; rSmall: number } {
  return { rx: rx - d, rBig: rBig - d, rSmall: Math.max(3, rSmall - d * 0.6) };
}

export function paintAvocadoTexture(
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
  const sil = (rrx: number, rrBig: number, rrSmall: number, pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rrx, rrBig, rrSmall, buttRound, tipRound, pad, opts);
  };

  const skin = ctx.createLinearGradient(cx - rx, cy - rBig, cx + rx * 0.55, cy + rBig);
  skin.addColorStop(0, "#3A5A2C");
  skin.addColorStop(0.48, "#2C4621");
  skin.addColorStop(1, "#1E3216");
  ctx.fillStyle = skin;
  sil(rx, rBig, rSmall, 0);
  ctx.fill();

  const inner = insetTaper(rx, rBig, rSmall, 12); // thin dark rind, then a light-green layer under it
  const core = insetTaper(rx, rBig, rSmall, 27); // the layering the reference actually shows
  ctx.save();
  sil(rx, rBig, rSmall, 0);
  ctx.clip(); // insurance — inset flesh never paints outside the skin

  const bandG = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  bandG.addColorStop(0, "#9FC163");
  bandG.addColorStop(1, "#7FA44A");
  ctx.fillStyle = bandG;
  sil(inner.rx, inner.rBig, inner.rSmall, 0);
  ctx.fill();

  const fx = cx - rx * 0.16;
  const fy = cy;
  const fg = ctx.createRadialGradient(fx, fy, rx * 0.05, fx, fy, rx * 0.92);
  fg.addColorStop(0, "#F8F5B6");
  fg.addColorStop(0.46, "#EFF2A4");
  fg.addColorStop(0.8, "#D3E188");
  fg.addColorStop(1, "#B4CE72");
  ctx.fillStyle = fg;
  sil(core.rx, core.rBig, core.rSmall, 0);
  ctx.fill();

  ctx.save();
  sil(core.rx, core.rBig, core.rSmall, 0);
  ctx.clip();
  // Texture is BLOTCHES, not radial streaks — a radial sunburst converging
  // on the body centre read as citrus and put a phantom pit socket at the
  // convergence point. Off-centre, non-radial, barely there.
  for (let i = 0; i < 22; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 7919) % 83) / 83);
    ctx.fillStyle = i % 2 ? "rgba(186,208,124,0.10)" : "rgba(248,246,196,0.09)";
    ctx.beginPath();
    ctx.ellipse(
      fx + Math.cos(a) * rx * 0.62 * r,
      fy + Math.sin(a) * rBig * 0.66 * r,
      9 + 7 * (((i * 104729) % 31) / 31),
      6 + 5 * (((i * 6151) % 23) / 23),
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const hl = ctx.createLinearGradient(cx - rx * 0.7, cy - rBig, cx + rx * 0.2, cy + rBig * 0.4);
  hl.addColorStop(0, "rgba(255,255,236,0.20)");
  hl.addColorStop(0.62, "rgba(255,255,236,0.05)");
  hl.addColorStop(1, "rgba(255,255,236,0)");
  ctx.fillStyle = hl;
  sil(core.rx, core.rBig, core.rSmall, 0);
  ctx.fill();

  // SEED CAVITY — a genuine directional opening. The body is lit
  // upper-left, so: occlusion is a CRESCENT hugging the upper-left rim
  // only, the lit wall is the opposing crescent down-right, and the flesh
  // keeps a thin bright lip on the OUTSIDE of the down-right edge — the
  // near rim of the bowl standing above the cavity floor. Depth stays
  // MODEST: a big luminance drop makes an object, not an absence.
  const px = cx - rx * 0.3;
  const py = cy + rBig * 0.04;
  const prx = rx * 0.34;
  const pry = rBig * 0.4;
  const pit = () => {
    const p = new Path2D();
    p.ellipse(px, py, prx, pry, -0.14, 0, Math.PI * 2);
    return p;
  };
  const bowl = ctx.createLinearGradient(
    px - prx * 0.8,
    py - pry * 0.8,
    px + prx * 0.8,
    py + pry * 0.8,
  );
  bowl.addColorStop(0, "#DCCB82");
  bowl.addColorStop(0.55, "#EDE09B");
  bowl.addColorStop(1, "#F7EDB0");
  ctx.fillStyle = bowl;
  ctx.fill(pit());

  ctx.save();
  ctx.clip(pit());
  const occl = ctx.createRadialGradient(
    px + prx * 0.62,
    py + pry * 0.62,
    prx * 0.2,
    px + prx * 0.62,
    py + pry * 0.62,
    prx * 1.95,
  );
  occl.addColorStop(0, "rgba(104,86,22,0)");
  occl.addColorStop(0.58, "rgba(104,86,22,0)");
  occl.addColorStop(1, "rgba(104,86,22,0.40)");
  ctx.fillStyle = occl;
  ctx.fill(pit()); // upper-left crescent only
  const wall = ctx.createRadialGradient(
    px - prx * 0.58,
    py - pry * 0.58,
    prx * 0.2,
    px - prx * 0.58,
    py - pry * 0.58,
    prx * 1.9,
  );
  wall.addColorStop(0, "rgba(255,252,214,0)");
  wall.addColorStop(0.7, "rgba(255,252,214,0)");
  wall.addColorStop(1, "rgba(255,252,214,0.50)");
  ctx.fillStyle = wall;
  ctx.fill(pit()); // lit far wall, down-right
  ctx.restore();

  ctx.save(); // even-odd: paint the flesh OUTSIDE the socket
  const lip = new Path2D();
  lip.rect(cx - rx * 2, cy - rBig * 3, rx * 4, rBig * 6);
  lip.ellipse(px, py, prx, pry, -0.14, 0, Math.PI * 2);
  ctx.clip(lip, "evenodd");
  const lipG = ctx.createRadialGradient(
    px - prx * 0.7,
    py - pry * 0.7,
    prx * 0.2,
    px - prx * 0.7,
    py - pry * 0.7,
    prx * 1.72,
  );
  lipG.addColorStop(0, "rgba(255,255,232,0)");
  lipG.addColorStop(0.94, "rgba(255,255,232,0)");
  lipG.addColorStop(1, "rgba(255,255,232,0.55)");
  ctx.fillStyle = lipG;
  ctx.fill(pit());
  ctx.restore();

  const edge = ctx.createLinearGradient(px - prx, py - pry, px + prx * 0.6, py + pry * 0.6);
  edge.addColorStop(0, "rgba(112,94,26,0.34)");
  edge.addColorStop(0.62, "rgba(112,94,26,0.08)");
  edge.addColorStop(1, "rgba(112,94,26,0)"); // no outline on the lit side
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.6;
  ctx.stroke(pit());
  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = "rgba(16,28,10,0.38)";
  ctx.lineWidth = 1.8;
  sil(rx, rBig, rSmall, 0);
  ctx.stroke();
}
