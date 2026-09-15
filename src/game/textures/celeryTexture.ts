/**
 * CELERY_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.celery()` (source line 6081) against the real `taper` geometry.
 * A BUNCH, not one stick: four bundled ribs are each filled as their own
 * tapering band (dark edges, bright glossy core, hard seam against its
 * neighbour) riding the taper (`taperH`/`taperY`, same trick Corn's
 * kernel rows use) rather than stroked as lines on one body, plus a leafy
 * crown past the tip — a per-rib petiole into a two-row fan of rounded,
 * coarsely-toothed leaflets (a back row darker/wider than the front row,
 * so the crown has mass instead of reading as a paper cutout).
 */
import { traceTaperPath, taperY, taperH, type TaperPaintOpts } from "./carrotTexture";

// The leaf crown (cosmetic overhang past the tip, source pixel constants
// unscaled) reaches well past rx — see cornTexture.ts's own doc for why
// growing the canvas to fit it would be wasted memory: PreparationScene's
// piece-rendering pipeline crops every piece, including the whole uncut
// ingredient, to the COLLISION silhouette's own rx/rBig bounds, so the
// crown is painted (faithful to the source) but never reaches the screen.
export function celeryTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

type Rib = [number, number, number]; // [a, b, bow] — the two edge fractions (of half-height) and the bow amount

const RIBS: Rib[] = [
  [-1.0, -0.56, 0.03],
  [-0.46, -0.04, -0.018],
  [0.06, 0.48, 0.022],
  [0.58, 1.0, -0.026],
];

export function paintCeleryTexture(
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
  const edge = (x: number, f: number) => y(x) + f * h(x);
  const sil = (pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, pad, opts);
  };

  const body = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  body.addColorStop(0, "#CFE39C");
  body.addColorStop(0.42, "#AECB72");
  body.addColorStop(1, "#7E9C48");
  ctx.fillStyle = body;
  sil(0);
  ctx.fill();

  const innerRBig = rBig - 7;
  const innerRSmall = Math.max(3, rSmall - 7 * 0.6);
  const ig = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  ig.addColorStop(0, "#ECF4CC");
  ig.addColorStop(0.48, "#D6E5A2");
  ig.addColorStop(1, "#A8C06E");
  ctx.save();
  sil(0);
  ctx.clip();
  ctx.fillStyle = ig;
  ctx.beginPath();
  traceTaperPath(ctx, cx, cy, rx - 7, innerRBig, innerRSmall, buttRound, tipRound, 0, opts);
  ctx.fill();

  // Ribs ride the taper, as corn's kernel rows do — a band at a flat
  // fraction of rBig would run outside the narrow end and get bitten off
  // by the clip, reading as stripes printed on a stick. Each rib also
  // BOWS slightly and by a different amount, because ribs in a real bunch
  // splay. The bands leave a GAP between them, seamed on both edges.
  RIBS.forEach(([a, b, bow], k) => {
    const band = new Path2D();
    const x0 = cx - rx * 0.995;
    const x1 = cx + rx * 0.995;
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const x = x0 + (x1 - x0) * (i / N);
      const s = Math.sin((i / N) * Math.PI);
      const yy = edge(x, a + bow * s);
      if (i) band.lineTo(x, yy);
      else band.moveTo(x, yy);
    }
    for (let i = N; i >= 0; i--) {
      const x = x0 + (x1 - x0) * (i / N);
      const s = Math.sin((i / N) * Math.PI);
      band.lineTo(x, edge(x, b + bow * s));
    }
    band.closePath();
    const yA = edge(cx, a);
    const yB = edge(cx, b);
    const rg = ctx.createLinearGradient(cx, yA, cx, yB);
    const dark = k < 2 ? "#93B45C" : "#84A44F";
    rg.addColorStop(0, dark);
    rg.addColorStop(0.28, "#C6DE90");
    rg.addColorStop(0.46, "#E6F3BC");
    rg.addColorStop(0.66, "#C2DA8A");
    rg.addColorStop(1, dark);
    ctx.fillStyle = rg;
    ctx.fill(band);

    ctx.save();
    ctx.clip(band); // specular streak, tight along the crown
    const gl = ctx.createLinearGradient(cx, yA + (yB - yA) * 0.3, cx, yA + (yB - yA) * 0.62);
    gl.addColorStop(0, "rgba(255,255,240,0)");
    gl.addColorStop(0.5, "rgba(255,255,240,0.55)");
    gl.addColorStop(1, "rgba(255,255,240,0)");
    ctx.fillStyle = gl;
    ctx.fill(band);
    ctx.restore();

    ctx.strokeStyle = "rgba(96,126,54,0.55)"; // both seams: the groove either side of it
    ctx.lineWidth = 2.2;
    [a, b].forEach((f) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = x0 + (x1 - x0) * (i / N);
        const s = Math.sin((i / N) * Math.PI);
        const yy = edge(x, f + bow * s);
        if (i) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    });

    // STRINGS — the fibres that run the length of a rib. Faint and INSIDE
    // the band, a few per rib, so a rib reads as fibrous celery rather
    // than a gel band.
    ctx.save();
    ctx.clip(band);
    for (let s2 = 0; s2 < 3; s2++) {
      const f = a + (b - a) * (0.26 + s2 * 0.24 + ((k * 7 + s2 * 13) % 5) / 70);
      ctx.strokeStyle = s2 === 1 ? "rgba(255,255,236,0.34)" : "rgba(118,148,68,0.26)";
      ctx.lineWidth = s2 === 1 ? 1.6 : 1.2;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = x0 + (x1 - x0) * (i / N);
        const sn = Math.sin((i / N) * Math.PI);
        const yy = edge(x, f + bow * sn) + Math.sin(i * 0.9 + k) * 0.6;
        if (i) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  });

  const base = ctx.createLinearGradient(cx - rx, cy, cx - rx * 0.34, cy);
  base.addColorStop(0, "rgba(252,252,228,0.82)");
  base.addColorStop(1, "rgba(252,252,228,0)");
  ctx.fillStyle = base;
  sil(0);
  ctx.fill(); // blanched butt, wide end
  ctx.fillStyle = "rgba(96,124,52,0.05)"; // fine grain, subordinate
  for (let i = 0; i < 90; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 79) / 79);
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * 0.9 * r,
      cy + Math.sin(a) * rBig * 0.8 * r,
      5,
      0.9,
      0.04,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(88,116,48,0.42)";
  ctx.lineWidth = 1.8;
  sil(0);
  ctx.stroke();

  // LEAF TOPS — cosmetic, past the silhouette: coarse, shallow toothing
  // over three rounded lobes (a celery leaflet, not holly), and a darker/
  // wider back row behind a lighter front row so the crown has mass
  // instead of reading as a paper cutout. Each rib carries its own
  // petiole out of the stalk (drawn before the blades) rather than every
  // blade hinging from one bald point.
  const tipX = cx + rx * 0.9;
  RIBS.forEach(([a, b, bow], k) => {
    const mid = (a + b) / 2;
    const sx = cx + rx * 0.93;
    const sy = edge(sx, mid + bow * 0.3);
    const ex = tipX + 30 + k * 6;
    const ey = cy + mid * 42 - 6;
    const wid = 7.5 - Math.abs(mid) * 2.2;
    const p = new Path2D();
    p.moveTo(sx, sy - wid);
    p.quadraticCurveTo((sx + ex) / 2 + 6, sy - wid * 0.7 + (ey - sy) * 0.34, ex, ey - wid * 0.42);
    p.lineTo(ex, ey + wid * 0.42);
    p.quadraticCurveTo((sx + ex) / 2 + 6, sy + wid * 0.7 + (ey - sy) * 0.34, sx, sy + wid);
    p.closePath();
    const pg = ctx.createLinearGradient(sx, sy - wid, sx, sy + wid);
    pg.addColorStop(0, "#6E9C42");
    pg.addColorStop(0.42, "#9CC663");
    pg.addColorStop(1, "#4F7A31");
    ctx.fillStyle = pg;
    ctx.fill(p);
    ctx.strokeStyle = "rgba(58,90,34,0.45)";
    ctx.lineWidth = 1.3;
    ctx.stroke(p);
  });

  const blade = (len: number, wid: number, ph: number): Path2D => {
    const p = new Path2D();
    const M = 34;
    const w = (t: number) =>
      wid * Math.sin(Math.pow(t, 0.9) * Math.PI) * (1 + 0.34 * Math.sin(t * Math.PI * 2.6));
    p.moveTo(0, 0);
    for (let s = 1; s <= M; s++) {
      const t = s / M;
      p.lineTo(w(t) * (1 + 0.08 * Math.sin(t * 10 + ph)), -t * len);
    }
    for (let s = M; s >= 1; s--) {
      const t = s / M;
      p.lineTo(-w(t) * (1 + 0.08 * Math.sin(t * 10 + ph * 1.6 + 2.1)), -t * len);
    }
    p.closePath();
    return p;
  };
  const ROWS: { back: number; leaves: [number, number, number][] }[] = [
    {
      back: 1,
      leaves: [
        [-1.3, 116, -38],
        [-0.8, 134, -20],
        [-0.26, 142, -2],
        [0.3, 130, 19],
        [0.84, 109, 36],
      ],
    },
    {
      back: 0,
      leaves: [
        [-1.02, 99, -29],
        [-0.5, 120, -13],
        [0.02, 128, 3],
        [0.5, 113, 20],
        [1.04, 91, 33],
        [-0.18, 80, -40],
        [0.22, 76, 40],
      ],
    },
  ];
  ROWS.forEach((row) =>
    row.leaves.forEach(([rot, len, dy], i) => {
      ctx.save();
      ctx.translate(tipX, cy + dy);
      ctx.rotate(rot + Math.PI / 2);
      ctx.strokeStyle = row.back ? "#6D9448" : "#8FB45C";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -len * 0.3);
      ctx.stroke(); // petiole
      ctx.translate(0, -len * 0.28);
      const bl = blade(len * 0.78, len * 0.34, i * 1.7 + row.back * 0.9);
      const lg = ctx.createLinearGradient(-len * 0.4, 0, len * 0.4, -len * 0.6);
      if (row.back) {
        lg.addColorStop(0, "#2F6522");
        lg.addColorStop(0.6, "#3C7628");
        lg.addColorStop(1, "#2A5C1E");
      } else {
        lg.addColorStop(0, i % 2 ? "#59993A" : "#4E8C31");
        lg.addColorStop(0.55, "#68A648");
        lg.addColorStop(1, "#3C7528");
      }
      ctx.fillStyle = lg;
      ctx.fill(bl);
      if (!row.back) {
        ctx.strokeStyle = "rgba(34,72,22,0.34)";
        ctx.lineWidth = 1.1;
        ctx.stroke(bl);
      }
      if (!row.back) {
        ctx.strokeStyle = "rgba(198,226,152,0.50)"; // midrib
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len * 0.64);
        ctx.stroke();
      }
      ctx.restore();
    }),
  );
}
