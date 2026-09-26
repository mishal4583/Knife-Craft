/**
 * PARSLEY_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.parsley()` (source line 5545) and its shared `parsleyLeafShape()`
 * builder (source line 4712). Flat-leaf parsley is TRIFID: three
 * narrow-necked lobes fanning from a shared petiole point, each drawn to
 * a point and cut by sharp V teeth, with the sinuses between lobes
 * reaching well back toward the base — deliberately NOT a width profile
 * along one axis (that gives a spiky almond) and NOT three lobes
 * radiating with a wide-enough fan that they merge into one mass. Every
 * leaflet gets its own deterministic seed (a sine-hash, never
 * `Math.random()`) so no two are the same shape, then a fit-shrink loop
 * keeps the drawn blade inside its own collision ellipse (PARSLEY_LEAVES,
 * definitions.ts) so chop/chiffonade clipping keeps working unchanged.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { PARSLEY_LEAVES } from "../definitions";

// [light, mid, dark] per leaflet, cycling — ported verbatim from PAINT.parsley's TONES.
const TONES: readonly [string, string, string][] = [
  ["#8CC964", "#66A845", "#4A8331"],
  ["#84C25B", "#5F9F3E", "#43792B"],
  ["#95D06D", "#6EB04C", "#4F8A35"],
  ["#7FBD55", "#5C9A3A", "#3F7429"],
];

export type ParsleyLeafShape = {
  walk: [number, number][];
  axes: { ang: number; len: number }[];
  fit: number;
  bx: number;
  seed: number;
};

/** Deterministic sine-hash, ported verbatim from parsleyLeafShape's `h(k)` — NOT Math.random(). */
function h(seed: number, k: number): number {
  const v = Math.sin(seed * 13.7 + k * 7.31) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** One trifid lobe's outline points (one side), ported verbatim from parsleyLeafShape's `lobeSide()`. */
function lobeSide(
  ang: number,
  len: number,
  halfW: number,
  nOff: number,
  side: number,
): [number, number][] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const N = 30;
  const U0 = 0.22;
  const V = (u: number, at: number, d: number) => d * Math.max(0, 1 - Math.abs(u - at) / 0.08); // sharp V tooth, never a sine ripple
  const prof = (u: number) =>
    u < 0.52 ? 0.24 + 0.76 * Math.pow(u / 0.52, 0.7) : Math.pow(Math.max(0, (1 - u) / 0.48), 0.7);
  const w = (u: number) => {
    const o = side > 0 ? 0 : nOff;
    return halfW * prof(u) * (1 - V(u, 0.44 + o, 0.38) - V(u, 0.7 + o, 0.36) - V(u, 0.9 + o, 0.28));
  };
  const out: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const u = U0 + (1 - U0) * (i / N);
    const ww = w(u) * side;
    out.push([c * len * u - s * ww, s * len * u + c * ww]);
  }
  return out;
}

/**
 * Ported verbatim from parsleyLeafShape() — builds the trifid blade
 * outline and shrink-fits it inside the leaflet's own collision ellipse.
 *
 * `round` (new-ingredient integration pack, 04-shared-patches.md §2) adds
 * Cilantro's ROUND blade variant alongside this untouched trifid path:
 * one continuous polar-form fan (an envelope over an arc, minus gaussian
 * slits cut inward from the margin, times a crenate ripple) instead of
 * three narrow radiating lobes — a cilantro leaflet is one webbed fan
 * blade, which the trifid construction can't express (it always shows
 * three detached fingers with sky between them). Same return contract
 * (`{walk, axes, fit, bx, seed}`) either way, so the caller (paint code,
 * fit loop, centroid, plate clip, chop) needs no branch of its own —
 * parsley's own call sites are completely unaffected since they never
 * pass `round`.
 */
export function parsleyLeafShape(
  rx: number,
  ry: number,
  seed: number,
  round = false,
): ParsleyLeafShape {
  if (round) {
    const bxR = -0.62 * rx;
    const TH = 1.15;
    const M = 84;
    const len = 1.2 * rx * (1 + 0.05 * h(seed, 1));
    const SLIT = [-1.1, -0.74, -0.32, 0.32, 0.74, 1.1].map((s, i) => s + 0.035 * h(seed, i + 3));
    const r = (th: number): number => {
      let k = len * (1 - 0.12 * Math.pow(Math.abs(th) / TH, 2.2)); // envelope: broad arc, easing in at the sides
      let cut = 0;
      for (const s of SLIT) {
        const q = (th - s) / 0.066;
        cut += 0.26 * Math.exp(-q * q); // narrow inward slits
      }
      k *= Math.max(0.22, 1 - cut);
      k *= 1 + 0.03 * Math.cos(th * 46 + 0.8 * h(seed, 2)); // crenate margin: rounded bumps, never teeth
      return k;
    };
    const walk: [number, number][] = [[0, 0]];
    for (let i = 0; i <= M; i++) {
      const th = -TH + 2 * TH * (i / M);
      const rr = r(th);
      walk.push([Math.cos(th) * rr, Math.sin(th) * rr]);
    }
    const axes = [0, -0.53, 0.53, -0.92, 0.92, -1.2, 1.2].map((a) => ({ ang: a, len: r(a) }));
    let fitR = 1;
    for (let t = 0; t < 50; t++) {
      let ok = true;
      for (const q of walk) {
        const x = bxR + q[0] * fitR;
        const y = q[1] * fitR;
        if ((x / rx) * (x / rx) + (y / ry) * (y / ry) > 1.06) {
          ok = false;
          break;
        }
      }
      if (ok) break;
      fitR -= 0.02;
    }
    return { walk, axes, fit: fitR, bx: bxR, seed };
  }
  const bx = -0.86 * rx;
  const A = [-0.86, -0.02, 0.82];
  const LEN = [0.76, 1.0, 0.72];
  const walk: [number, number][] = [];
  const axes: { ang: number; len: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const ang = A[k]! + 0.07 * h(seed, k);
    const len = 1.76 * rx * LEN[k]! * (1 + 0.05 * h(seed, k + 9));
    const hw = len * 0.21;
    const nOff = 0.05 * h(seed, k + 20);
    walk.push(...lobeSide(ang, len, hw, nOff, -1), ...lobeSide(ang, len, hw, nOff, 1).reverse());
    axes.push({ ang, len });
  }
  let fit = 1;
  for (let t = 0; t < 50; t++) {
    let ok = true;
    for (const q of walk) {
      const x = bx + q[0] * fit;
      const y = q[1] * fit;
      if ((x / rx) * (x / rx) + (y / ry) * (y / ry) > 1.06) {
        ok = false;
        break;
      }
    }
    if (ok) break;
    fit -= 0.02;
  }
  return { walk, axes, fit, bx, seed };
}

export function parsleyTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function parsleyLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(PARSLEY_LEAVES, scale);
}

export function paintParsleyTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  // Stems first: they pass BEHIND the blades.
  for (const L of leaves) {
    if (!L.stem) continue;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);
    const sg = ctx.createLinearGradient(0, -L.ry, 0, L.ry);
    sg.addColorStop(0, "#9CBB6A");
    sg.addColorStop(0.5, "#6E9440");
    sg.addColorStop(1, "#527431");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  let seed = 0;
  for (const L of leaves) {
    if (L.stem) continue;
    const mySeed = seed++;
    const sh = parsleyLeafShape(L.rx, L.ry, mySeed);
    const t = TONES[sh.seed % TONES.length]!;
    const rx2 = L.rx;
    const ry2 = L.ry;
    const f = sh.fit;
    const bx = sh.bx;

    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    const blade = new Path2D();
    sh.walk.forEach((q, k) => {
      const x = bx + q[0] * f;
      const y = q[1] * f;
      if (k) blade.lineTo(x, y);
      else blade.moveTo(x, y);
    });
    blade.closePath();

    const bg = ctx.createLinearGradient(-rx2 * 0.4, -ry2, rx2 * 0.4, ry2);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.5, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(blade);

    ctx.save();
    ctx.clip(blade);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(38,72,26,0.30)"; // one midvein per lobe, all from the base
    ctx.lineWidth = 1.3;
    for (const a of sh.axes) {
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + Math.cos(a.ang) * a.len * f * 0.88, Math.sin(a.ang) * a.len * f * 0.88);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(44,80,30,0.18)"; // secondaries toward the teeth
    ctx.lineWidth = 0.8;
    for (const a of sh.axes) {
      for (const u of [0.46, 0.72]) {
        const px = bx + Math.cos(a.ang) * a.len * f * u;
        const py = Math.sin(a.ang) * a.len * f * u;
        for (const s2 of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(
            px + Math.cos(a.ang + s2 * 0.9) * a.len * f * 0.16,
            py + Math.sin(a.ang + s2 * 0.9) * a.len * f * 0.16,
          );
          ctx.stroke();
        }
      }
    }
    const hl = ctx.createRadialGradient(
      -rx2 * 0.1,
      -ry2 * 0.42,
      2,
      -rx2 * 0.1,
      -ry2 * 0.42,
      rx2 * 0.7,
    );
    hl.addColorStop(0, "rgba(255,255,238,0.07)");
    hl.addColorStop(1, "rgba(255,255,238,0)");
    ctx.fillStyle = hl;
    ctx.fill(blade);
    ctx.restore();

    ctx.strokeStyle = "rgba(40,74,26,0.32)";
    ctx.lineWidth = 1;
    ctx.stroke(blade);
    ctx.restore();
  }
}
