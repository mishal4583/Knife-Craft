/**
 * MANGO_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.mango()` (source line 7800, glossy tri-tone skin + stem/leaf)
 * AND `PAINT.mango()` (source line 6957, the real gold flesh + flat
 * fibrous-rimmed pit) against the real `ovoid` `ellipse` geometry
 * (shoulder narrower than the belly — see MANGO_GEOMETRY's own doc in
 * definitions.ts). As with Kiwi/Pomegranate, both source sprites are
 * composited with a time-based alpha fade production has no equivalent
 * for; baked into one canvas — skin drawn full, then — ONLY once `hasCut`
 * is true — the real flesh+pit painted on top clipped to an inset disc,
 * so the skin survives at the edge while a cut opens onto the actual
 * ported flesh. See kiwiTexture.ts's own doc for why `hasCut` defaulting
 * to false (an uncut whole stays 100% skin) matters and where the flag
 * comes from.
 */
import { traceEllipsePath, type EllipseModOpts } from "../ingredientShapes";

const SKIN_INSET = 14;

export function mangoTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintMangoTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  opts: EllipseModOpts = {},
  // Mango is not peelable — this slot exists only so the call site can
  // share EllipseRenderer.paint's one (ctx,rx,ry,margin,opts,peeled,
  // hasCut) signature with every other ellipse ingredient.
  _peeled?: boolean,
  hasCut = false,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = new Path2D();
  traceEllipsePath(sil, cx, cy, rx, ry, 0, opts);
  const insetSil = new Path2D();
  traceEllipsePath(insetSil, cx, cy, rx - SKIN_INSET, ry - SKIN_INSET, 0, opts);
  const rBig = ry; // production's ovoid ellipse has no separate rBig; the source's own rBig===ry for mango

  // --- SKIN.mango: glossy tri-tone skin, full body ---
  const skin = ctx.createLinearGradient(
    cx - rx * 0.35,
    cy - ry * 0.98,
    cx + rx * 0.25,
    cy + ry * 1.0,
  );
  skin.addColorStop(0, "#E99C2A");
  skin.addColorStop(0.2, "#F3B72D");
  skin.addColorStop(0.46, "#F8C934");
  skin.addColorStop(0.68, "#F2C935");
  skin.addColorStop(0.86, "#C9C63C");
  skin.addColorStop(1, "#7FB53C");
  ctx.fillStyle = skin;
  ctx.fill(sil);

  ctx.save();
  ctx.clip(sil);
  const green = ctx.createRadialGradient(
    cx - rx * 0.06,
    cy + ry * 0.88,
    rx * 0.05,
    cx - rx * 0.02,
    cy + ry * 0.8,
    rx * 1.05,
  );
  green.addColorStop(0, "rgba(96,162,44,0.94)");
  green.addColorStop(0.45, "rgba(126,178,50,0.52)");
  green.addColorStop(1, "rgba(150,186,60,0)");
  ctx.fillStyle = green;
  ctx.fill(sil); // the unripe blush: a band across the bottom third

  const flank = ctx.createRadialGradient(
    cx + rx * 0.92,
    cy - ry * 0.1,
    rx * 0.06,
    cx + rx * 0.8,
    cy - ry * 0.05,
    rx * 0.95,
  );
  flank.addColorStop(0, "rgba(196,116,20,0.34)");
  flank.addColorStop(0.6, "rgba(200,124,24,0.14)");
  flank.addColorStop(1, "rgba(200,124,24,0)");
  ctx.fillStyle = flank;
  ctx.fill(sil); // the turning-away right flank

  for (let i = 0; i < 70; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 7919) % 89) / 89);
    ctx.fillStyle = i % 3 ? "rgba(255,250,220,0.14)" : "rgba(176,110,24,0.12)";
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rx * 0.86 * r,
      cy + Math.sin(a) * ry * 0.86 * r,
      1.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const sheen = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.44,
    4,
    cx - rx * 0.26,
    cy - ry * 0.36,
    rx * 0.72,
  );
  sheen.addColorStop(0, "rgba(255,252,214,0.46)");
  sheen.addColorStop(0.5, "rgba(255,246,190,0.16)");
  sheen.addColorStop(1, "rgba(255,246,190,0)");
  ctx.fillStyle = sheen;
  ctx.fill(sil);
  ctx.restore();

  const sx = cx - rx * 0.24; // stem + one leaf, past the silhouette
  const sy = cy - ry * 0.94;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#8A7524";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(sx, sy + 8);
  ctx.quadraticCurveTo(sx - 7, sy - 24, sx + 2, sy - 46);
  ctx.stroke();
  ctx.strokeStyle = "rgba(232,214,128,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx - 2, sy + 6);
  ctx.quadraticCurveTo(sx - 9, sy - 24, sx - 1, sy - 44);
  ctx.stroke();
  const lx = sx + 2;
  const ly = sy - 44;
  const leaf = new Path2D();
  leaf.moveTo(lx, ly);
  leaf.bezierCurveTo(lx - 44, ly - 32, lx - 112, ly - 26, lx - 142, ly + 14);
  leaf.bezierCurveTo(lx - 100, ly + 32, lx - 38, ly + 24, lx, ly);
  const lg = ctx.createLinearGradient(lx - 142, ly - 24, lx - 10, ly + 22);
  lg.addColorStop(0, "#33701D");
  lg.addColorStop(0.45, "#4F972A");
  lg.addColorStop(1, "#74B837");
  ctx.fillStyle = lg;
  ctx.fill(leaf);
  ctx.strokeStyle = "rgba(28,64,16,0.50)";
  ctx.lineWidth = 1.6;
  ctx.stroke(leaf);
  ctx.save();
  ctx.clip(leaf);
  ctx.strokeStyle = "rgba(206,232,168,0.55)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(lx - 4, ly + 1);
  ctx.quadraticCurveTo(lx - 74, ly - 8, lx - 140, ly + 13);
  ctx.stroke();
  ctx.strokeStyle = "rgba(184,220,150,0.34)";
  ctx.lineWidth = 1.2;
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const bx = lx - 4 - 136 * t;
    const by = ly + 1 + 11 * t - 9 * Math.sin(t * Math.PI);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 16, by - 16 - 6 * Math.sin(t * Math.PI));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 14, by + 15);
    ctx.stroke();
  }
  ctx.restore();

  if (!hasCut) return; // uncut: 100% glossy skin — no flesh or pit showing yet

  // --- PAINT.mango: the real gold flesh + flat fibrous-rimmed pit,
  // windowed to an inset disc so the skin survives around the edge ---
  ctx.save();
  ctx.clip(insetSil);
  const fg = ctx.createRadialGradient(cx - rx * 0.1, cy - ry * 0.06, rx * 0.08, cx, cy, rx * 0.92);
  fg.addColorStop(0, "#FDDD7E");
  fg.addColorStop(0.55, "#FBC24A");
  fg.addColorStop(1, "#F0A227");
  ctx.fillStyle = fg;
  ctx.fill(sil);
  ctx.save();
  ctx.clip(sil);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 79) / 79);
    ctx.fillStyle = i % 2 ? "rgba(230,150,50,0.10)" : "rgba(255,232,170,0.10)";
    ctx.beginPath();
    ctx.ellipse(
      cx - rx * 0.18 + Math.cos(a) * rx * 0.6 * r,
      cy + Math.sin(a) * rBig * 0.62 * r,
      8,
      5,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // Flat and wide (ratio ~2.9:1), not avocado's near-circle.
  const px = cx - rx * 0.04;
  const py = cy;
  const prx = rx * 0.3;
  const pry = rBig * 0.24;
  const pit = () => {
    const p = new Path2D();
    p.ellipse(px, py, prx, pry, -0.06, 0, Math.PI * 2);
    return p;
  };
  const bowl = ctx.createLinearGradient(
    px - prx * 0.8,
    py - pry * 0.8,
    px + prx * 0.8,
    py + pry * 0.8,
  );
  bowl.addColorStop(0, "#C9A25C");
  bowl.addColorStop(0.55, "#D9B76E");
  bowl.addColorStop(1, "#E7CD8C");
  ctx.fillStyle = bowl;
  ctx.fill(pit());
  ctx.save();
  ctx.clip(pit());
  const occl = ctx.createRadialGradient(
    px + prx * 0.6,
    py + pry * 0.6,
    prx * 0.2,
    px + prx * 0.6,
    py + pry * 0.6,
    prx * 1.9,
  );
  occl.addColorStop(0, "rgba(90,64,20,0)");
  occl.addColorStop(0.6, "rgba(90,64,20,0)");
  occl.addColorStop(1, "rgba(90,64,20,0.36)");
  ctx.fillStyle = occl;
  ctx.fill(pit());
  const wall = ctx.createRadialGradient(
    px - prx * 0.58,
    py - pry * 0.58,
    prx * 0.2,
    px - prx * 0.58,
    py - pry * 0.58,
    prx * 1.9,
  );
  wall.addColorStop(0, "rgba(255,246,214,0)");
  wall.addColorStop(0.7, "rgba(255,246,214,0)");
  wall.addColorStop(1, "rgba(255,246,214,0.46)");
  ctx.fillStyle = wall;
  ctx.fill(pit());
  ctx.strokeStyle = "rgba(150,108,40,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const a = i * ((Math.PI * 2) / 20);
    const ex = px + Math.cos(a) * prx;
    const ey = py + Math.sin(a) * pry;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(a) * 5, ey + Math.sin(a) * 5);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(120,86,30,0.30)";
  ctx.lineWidth = 1.4;
  ctx.stroke(pit());
  ctx.restore();
  ctx.restore();
}
