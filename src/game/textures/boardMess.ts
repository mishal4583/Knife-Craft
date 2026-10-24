import type { DebrisPiece } from "../boardDebris";

/**
 * BOARD MESS — paints the cutting debris and the cleaning cloth (developer
 * 2026-10-24: "make the ingredient leftover while cutting more realistic …
 * juicy … let it spill … use a realistic cloth"). Canvas 2D only, so the
 * pieces get real gradients, wet sheen and soft shadows; the scene keeps one
 * CanvasTexture for all the debris and one for the cloth. Presentation only,
 * deterministic (every shape comes from the piece's own `seed`).
 */

/** mulberry32 — the same tiny generator boardDebris uses, for a piece's own shape. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
const css = (c: number, a = 1, k = 1) => {
  const [r, g, b] = rgb(c);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgba(${f(r)},${f(g)},${f(b)},${a})`;
};

/** A soft closed blob through `pts` (quadratic curves through the midpoints). */
function blob(ctx: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[]): void {
  const n = pts.length;
  const mid = (i: number) => {
    const a = pts[i % n]!;
    const b = pts[(i + 1) % n]!;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  ctx.beginPath();
  const m0 = mid(0);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]!;
    const m = mid(i);
    ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  ctx.closePath();
}

/** An irregular outline around (0, 0): `n` points at radius r × (1 ± jitter), squashed by `sy`. */
function outline(r: () => number, n: number, rad: number, jitter: number, sy: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = rad * (1 - jitter + r() * jitter * 2);
    return { x: Math.cos(a) * k, y: Math.sin(a) * k * sy };
  });
}

/**
 * One debris piece at (x, y), `s` px across, faded by `alpha`. The board is
 * seen at a low angle, so round things are drawn a little flattened.
 */
export function paintDebrisPiece(
  ctx: CanvasRenderingContext2D,
  p: DebrisPiece,
  x: number,
  y: number,
  s: number,
  alpha: number,
): void {
  if (alpha <= 0.02 || s <= 0) return;
  const r = seeded(p.seed || 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.min(1, alpha);
  switch (p.kind) {
    case "juice":
      // The body is in the scene's wet layer (paintPoolBody); this is its sheen.
      paintPoolSheen(ctx, p, s);
      break;
    case "drop":
      paintDrop(ctx, p.color, s);
      break;
    case "cube":
      paintCube(ctx, p, r, s);
      break;
    case "seed":
      paintSeed(ctx, p, s);
      break;
    case "skin":
      paintPeel(ctx, p, r, s);
      break;
    case "leaf":
      paintLeaf(ctx, p, r, s);
      break;
    case "crumb":
      paintCrumbs(ctx, p, r, s);
      break;
    default:
      paintChunk(ctx, p, r, s);
  }
  ctx.restore();
}

/** A pool's outline (its own seed), with the smear the cloth dragged it along. */
function poolShapes(p: DebrisPiece, s: number) {
  const r = seeded(p.seed || 1);
  const pts = outline(r, 13, s * 0.8, 0.28, 0.62);
  const smear: { dx: number; dy: number; sx: number; sy: number; a: number }[] = [];
  if (Math.hypot(p.smearU, p.smearV) > 0.002)
    for (let i = 5; i >= 1; i--) {
      const k = i / 5;
      smear.push({
        dx: -p.smearU * s * 18 * k,
        dy: -p.smearV * s * 10 * k,
        sx: 1 - k * 0.3,
        sy: 1 - k * 0.45,
        a: 0.35 * (1 - k * 0.6),
      });
    }
  return { pts, smear, r };
}

/**
 * A juice pool's BODY, painted opaque into the scene's wet layer: overlapping
 * pools merge into one puddle when that layer is laid on the board at the
 * juice's own transparency (the scene does that), instead of stacking.
 */
export function paintPoolBody(
  ctx: CanvasRenderingContext2D,
  p: DebrisPiece,
  x: number,
  y: number,
  s: number,
  alpha: number,
): void {
  if (alpha <= 0.02 || s <= 0) return;
  const { pts, smear } = poolShapes(p, s);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.rot * 0.25);
  for (const m of smear) {
    ctx.save();
    ctx.translate(m.dx, m.dy);
    ctx.scale(m.sx, m.sy);
    blob(ctx, pts);
    ctx.globalAlpha = alpha * m.a;
    ctx.fillStyle = css(p.color);
    ctx.fill();
    ctx.restore();
  }
  blob(ctx, pts);
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(-s * 0.15, -s * 0.12, s * 0.05, 0, 0, s * 0.9);
  g.addColorStop(0, css(p.color, 1, 1.1));
  g.addColorStop(1, css(p.color, 1, 0.8));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** A juice pool's SHEEN, on top of the merged wet layer: the glossy highlights and bits of pulp. */
function paintPoolSheen(ctx: CanvasRenderingContext2D, p: DebrisPiece, s: number) {
  const { r } = poolShapes(p, s);
  ctx.rotate(p.rot * 0.25);
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, -s * 0.2, s * 0.26, s * 0.07, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.2, -s * 0.06, s * 0.06, s * 0.03, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * s * 0.45;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.6, s * 0.05, s * 0.03, a, 0, Math.PI * 2);
    ctx.fillStyle = css(p.color, 0.55, 1.15);
    ctx.fill();
  }
}

/** A droplet: a bead of juice with its own tiny highlight. */
function paintDrop(ctx: CanvasRenderingContext2D, color: number, s: number) {
  const rr = Math.max(1.2, s);
  ctx.beginPath();
  ctx.ellipse(0, rr * 0.25, rr * 1.05, rr * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(40,20,10,0.12)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, rr, rr * 0.72, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-rr * 0.3, -rr * 0.3, rr * 0.1, 0, 0, rr);
  g.addColorStop(0, css(color, 0.75, 1.25));
  g.addColorStop(1, css(color, 0.85, 0.7));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-rr * 0.35, -rr * 0.25, rr * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
}

/** A contact shadow under a solid piece. */
function shadow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.ellipse(w * 0.12, h * 0.55, w, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(45,25,10,0.22)";
  ctx.fill();
}

/** A little diced cube: a lit top, two shaded sides and a wet glint. */
function paintCube(ctx: CanvasRenderingContext2D, p: DebrisPiece, r: () => number, s: number) {
  const h = s * 0.5;
  const tilt = (r() - 0.5) * 0.5;
  shadow(ctx, s * 0.75, s * 0.35);
  ctx.rotate(p.rot * 0.6 + tilt);
  const a = { x: -s * 0.5, y: -s * 0.28 };
  const b = { x: s * 0.45, y: -s * 0.36 };
  const c = { x: s * 0.55, y: s * 0.1 };
  const d = { x: -s * 0.4, y: s * 0.18 };
  // Sides (the visible front and right faces).
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(c.x, c.y + h);
  ctx.lineTo(d.x, d.y + h);
  ctx.closePath();
  ctx.fillStyle = css(p.color, 1, 0.68);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + h * 0.9);
  ctx.lineTo(c.x, c.y + h);
  ctx.closePath();
  ctx.fillStyle = css(p.color, 1, 0.52);
  ctx.fill();
  // Top: the cut face, lit, with a translucent sheen.
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  const g = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
  g.addColorStop(0, css(p.color, 1, 1.22));
  g.addColorStop(1, css(p.color, 1, 0.95));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(0.5, s * 0.04);
  ctx.strokeStyle = css(p.color, 0.6, 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-s * 0.08, -s * 0.12, s * 0.16, s * 0.05, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();
}

/** A seed: a small teardrop with a pale centre. */
function paintSeed(ctx: CanvasRenderingContext2D, p: DebrisPiece, s: number) {
  const L = Math.max(1.6, s * 1.2);
  ctx.rotate(p.rot);
  ctx.beginPath();
  ctx.ellipse(L * 0.15, L * 0.3, L * 0.9, L * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(45,25,10,0.15)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-L, 0);
  ctx.quadraticCurveTo(-L * 0.2, -L * 0.62, L * 0.85, -L * 0.05);
  ctx.quadraticCurveTo(L * 0.95, L * 0.1, L * 0.7, L * 0.2);
  ctx.quadraticCurveTo(-L * 0.2, L * 0.6, -L, 0);
  const g = ctx.createRadialGradient(-L * 0.1, -L * 0.15, 0, 0, 0, L);
  g.addColorStop(0, css(p.color, 1, 1.18));
  g.addColorStop(1, css(p.color, 1, 0.72));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-L * 0.2, -L * 0.12, L * 0.3, L * 0.09, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();
}

/** A strip of peel curling up off the board: a thick curved band, lighter on its inside. */
function paintPeel(ctx: CanvasRenderingContext2D, p: DebrisPiece, r: () => number, s: number) {
  ctx.rotate(p.rot);
  const bend = 0.6 + r() * 0.9;
  const w = Math.max(1.6, s * 0.28);
  const curve = () => {
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, 0);
    ctx.quadraticCurveTo(0, -s * bend * 0.6, s * 0.9, s * 0.05);
  };
  ctx.save();
  ctx.translate(s * 0.08, w * 0.9);
  curve();
  ctx.lineWidth = w * 1.2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(45,25,10,0.16)";
  ctx.stroke();
  ctx.restore();
  curve();
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.strokeStyle = css(p.color, 1, 0.9);
  ctx.stroke();
  ctx.lineWidth = w * 0.45;
  ctx.strokeStyle = css(p.color, 0.9, 1.3);
  ctx.translate(0, w * 0.18);
  curve();
  ctx.stroke();
}

/** A herb leaf: three soft lobes, a darker midrib and a little shine. */
function paintLeaf(ctx: CanvasRenderingContext2D, p: DebrisPiece, r: () => number, s: number) {
  ctx.rotate(p.rot * 2);
  shadow(ctx, s * 0.7, s * 0.3);
  const lobes = 3;
  for (let i = 0; i < lobes; i++) {
    const a = -0.9 + i * 0.9 + (r() - 0.5) * 0.3;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.38, s * 0.3, s * 0.42, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -s * 0.8, 0, 0);
    g.addColorStop(0, css(p.color, 1, 1.18));
    g.addColorStop(1, css(p.color, 1, 0.8));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s * 0.7);
    ctx.lineWidth = Math.max(0.5, s * 0.05);
    ctx.strokeStyle = css(p.color, 0.8, 0.6);
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.1, s * 0.45);
  ctx.lineWidth = Math.max(0.6, s * 0.06);
  ctx.strokeStyle = css(p.color, 1, 0.7);
  ctx.stroke();
}

/** A few crumbs scattered together. */
function paintCrumbs(ctx: CanvasRenderingContext2D, p: DebrisPiece, r: () => number, s: number) {
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * s * 3;
    const y = (r() - 0.5) * s * 1.6;
    const k = Math.max(0.9, s * (0.5 + r() * 0.6));
    ctx.save();
    ctx.translate(x, y);
    blob(ctx, outline(r, 6, k, 0.35, 0.8));
    ctx.fillStyle = css(p.color, 1, 0.8 + r() * 0.4);
    ctx.fill();
    ctx.restore();
  }
}

/** An irregular chunk (onion, flesh): a shaded lump with a shadow and a pale cut edge. */
function paintChunk(ctx: CanvasRenderingContext2D, p: DebrisPiece, r: () => number, s: number) {
  ctx.rotate(p.rot);
  shadow(ctx, s * 0.65, s * 0.32);
  const pts = outline(r, 7, s * 0.6, 0.35, 0.7);
  blob(ctx, pts);
  const g = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s * 0.7);
  g.addColorStop(0, css(p.color, 1, 1.15));
  g.addColorStop(1, css(p.color, 1, 0.75));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(0.5, s * 0.06);
  ctx.strokeStyle = css(p.color, 0.7, 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-s * 0.15, -s * 0.15, s * 0.18, s * 0.06, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
}

/**
 * The kitchen towel, folded (developer 2026-10-24: "a realistic cloth"):
 * off-white cotton with a woven texture, two red stripes, a fold with its
 * shadow and soft frayed edges. `w` × `h` px; painted once.
 */
export function paintCloth(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const r = seeded(0xc10f);
  ctx.clearRect(0, 0, w, h);
  const pad = Math.max(2, w * 0.04);
  // Soft, slightly irregular towel outline (a folded towel is never a perfect rectangle).
  const edge = (t: number, a: number, b: number) => a + (b - a) * t;
  const pts: { x: number; y: number }[] = [];
  const n = 9;
  for (let i = 0; i < n; i++)
    pts.push({ x: edge(i / n, pad, w - pad), y: pad + (r() - 0.5) * pad });
  for (let i = 0; i < n; i++)
    pts.push({ x: w - pad + (r() - 0.5) * pad, y: edge(i / n, pad, h - pad) });
  for (let i = 0; i < n; i++)
    pts.push({ x: edge(i / n, w - pad, pad), y: h - pad + (r() - 0.5) * pad });
  for (let i = 0; i < n; i++)
    pts.push({ x: pad + (r() - 0.5) * pad, y: edge(i / n, h - pad, pad) });
  blob(ctx, pts);
  ctx.save();
  ctx.clip();
  // Cotton base, a little warmer towards the fold.
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#f7f1e6");
  base.addColorStop(0.55, "#efe6d6");
  base.addColorStop(1, "#e6dbc8");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Two red stripes across the towel, a thin one beside a broad one.
  const stripe = (x: number, sw: number) => {
    ctx.fillStyle = "rgba(176,44,56,0.88)";
    ctx.fillRect(x, 0, sw, h);
  };
  stripe(w * 0.62, w * 0.07);
  stripe(w * 0.73, w * 0.025);
  stripe(w * 0.18, w * 0.025);
  // The weave: fine alternating threads both ways.
  const step = Math.max(1.5, w / 110);
  for (let y = 0; y < h; y += step) {
    ctx.fillStyle = `rgba(120,95,70,${0.05 + r() * 0.05})`;
    ctx.fillRect(0, y, w, step * 0.45);
  }
  for (let x = 0; x < w; x += step) {
    ctx.fillStyle = `rgba(255,255,255,${0.06 + r() * 0.08})`;
    ctx.fillRect(x, 0, step * 0.4, h);
  }
  // The fold: a soft shadow line and its highlight, a third of the way down.
  const fy = h * 0.36;
  const fold = ctx.createLinearGradient(0, fy - h * 0.12, 0, fy + h * 0.12);
  fold.addColorStop(0, "rgba(90,60,35,0)");
  fold.addColorStop(0.45, "rgba(90,60,35,0.22)");
  fold.addColorStop(0.55, "rgba(255,255,255,0.35)");
  fold.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fold;
  ctx.fillRect(0, fy - h * 0.12, w, h * 0.24);
  // Puffy cloth: darker towards the edges, lighter in the middle.
  const puff = ctx.createRadialGradient(w * 0.45, h * 0.45, h * 0.1, w * 0.5, h * 0.5, w * 0.7);
  puff.addColorStop(0, "rgba(255,255,255,0.18)");
  puff.addColorStop(1, "rgba(90,60,35,0.28)");
  ctx.fillStyle = puff;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Frayed threads along the short edges.
  ctx.strokeStyle = "rgba(225,212,190,0.9)";
  ctx.lineWidth = Math.max(0.6, w / 260);
  for (let y = pad * 1.5; y < h - pad; y += step * 1.6) {
    ctx.beginPath();
    ctx.moveTo(pad * 0.9, y);
    ctx.lineTo(pad * 0.9 - pad * (0.3 + r() * 0.5), y + (r() - 0.5) * step);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - pad * 0.9, y);
    ctx.lineTo(w - pad * 0.9 + pad * (0.3 + r() * 0.5), y + (r() - 0.5) * step);
    ctx.stroke();
  }
  // The folded-over flap: the top layer of the towel with a soft rolled edge
  // and the shadow it casts on the layer under it, so it reads as cloth.
  blob(ctx, pts);
  ctx.save();
  ctx.clip();
  const flap = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h * 0.5);
    ctx.bezierCurveTo(w * 0.7, h * 0.6, w * 0.35, h * 0.46, 0, h * 0.6);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = "rgba(70,45,25,0.45)";
  ctx.shadowBlur = h * 0.08;
  ctx.shadowOffsetY = h * 0.04;
  flap();
  ctx.fillStyle = "#f6efe2";
  ctx.fill();
  ctx.restore();
  flap();
  ctx.save();
  ctx.clip();
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  top.addColorStop(0, "#fbf6ec");
  top.addColorStop(0.75, "#f1e8d8");
  top.addColorStop(1, "#e2d5bf");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(176,44,56,0.9)";
  ctx.fillRect(w * 0.64, 0, w * 0.07, h);
  ctx.fillRect(w * 0.75, 0, w * 0.025, h);
  ctx.fillRect(w * 0.2, 0, w * 0.025, h);
  for (let y = 0; y < h * 0.62; y += step) {
    ctx.fillStyle = `rgba(120,95,70,${0.05 + r() * 0.05})`;
    ctx.fillRect(0, y, w, step * 0.45);
  }
  for (let x = 0; x < w; x += step) {
    ctx.fillStyle = `rgba(255,255,255,${0.07 + r() * 0.08})`;
    ctx.fillRect(x, 0, step * 0.4, h * 0.62);
  }
  // A crease across the flap.
  ctx.strokeStyle = "rgba(120,90,60,0.22)";
  ctx.lineWidth = Math.max(1, h * 0.025);
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.22);
  ctx.quadraticCurveTo(w * 0.45, h * 0.3, w * 0.9, h * 0.18);
  ctx.stroke();
  ctx.restore();
  // The rolled edge catches the light.
  ctx.beginPath();
  ctx.moveTo(w, h * 0.5);
  ctx.bezierCurveTo(w * 0.7, h * 0.6, w * 0.35, h * 0.46, 0, h * 0.6);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, h * 0.03);
  ctx.stroke();
  ctx.restore();
}
