/**
 * DIRT_ART — paints one stain of the cleaning mini-game onto its own small
 * canvas (a sprite), so scrubbing can wear that stain alone without touching
 * its neighbours. Every kind is drawn from layered shapes the way the mess
 * really looks: a sauce splash has a wet middle, a darker dried rim and
 * droplets thrown to one side; grease is a glossy amber film; a coffee ring
 * is darkest at its edge; crumbs cast tiny shadows; limescale is crusty.
 * Seeded from the stain, so the same stain always looks the same.
 */
import { seeded, type Stain } from "@/game/restaurant/cleaningDirt";

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;

/** How far a stain's paint can reach from its centre (droplets, haze), in scene px. */
export function stainReach(s: Stain): number {
  const long = s.r * s.stretch;
  return Math.ceil(long * (s.kind === "sauce" || s.kind === "puddle" ? 2.1 : 1.6) + 8);
}

/** An irregular closed blob around (0,0): radius r, bumps of `jag`. */
function blob(ctx: Ctx, r: number, rnd: Rnd, jag = 0.22, lobes = 10, squash = 1) {
  const pts: [number, number][] = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
    const rr = r * (1 - jag + rnd() * jag * 2);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * squash]);
  }
  ctx.beginPath();
  const mid = (i: number) => {
    const a = pts[i % lobes]!;
    const b = pts[(i + 1) % lobes]!;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  const start = mid(lobes - 1);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < lobes; i++) {
    const p = pts[i]!;
    const m = mid(i);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

const rgba = (rgb: readonly [number, number, number], a: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

/** A soft dull film under the mess, so a dirty room looks dingy and a clean one bright. */
function haze(ctx: Ctx, r: number, rgb: readonly [number, number, number], a: number) {
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  g.addColorStop(0, rgba(rgb, a));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

function gloss(ctx: Ctx, x: number, y: number, rx: number, ry: number, a: number) {
  ctx.save();
  ctx.fillStyle = `rgba(255, 252, 240, ${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const SAUCES = [
  [168, 44, 22], // tomato
  [190, 120, 30], // curry
  [112, 62, 30], // gravy
] as const;

function sauce(ctx: Ctx, s: Stain, rnd: Rnd) {
  const c = SAUCES[Math.floor(rnd() * SAUCES.length)]!;
  haze(ctx, s.r * 2, [90, 60, 35], 0.12);
  // Droplets thrown to one side.
  const dir = rnd() * Math.PI * 2;
  for (let i = 0; i < 6; i++) {
    const a = dir + (rnd() - 0.5) * 1.1;
    const d = s.r * (1.1 + rnd() * 0.9);
    const rr = s.r * (0.07 + rnd() * 0.14);
    ctx.fillStyle = rgba(c, 0.82);
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, rr * 1.4, rr, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // A teardrop streak pointing back to the splash.
  ctx.save();
  ctx.rotate(dir);
  ctx.fillStyle = rgba(c, 0.7);
  ctx.beginPath();
  ctx.moveTo(s.r * 0.6, -s.r * 0.16);
  ctx.quadraticCurveTo(s.r * 1.6, 0, s.r * 0.6, s.r * 0.16);
  ctx.fill();
  ctx.restore();
  // The splash: wet middle, darker dried rim.
  blob(ctx, s.r, rnd, 0.28, 11);
  const g = ctx.createRadialGradient(-s.r * 0.2, -s.r * 0.2, 0, 0, 0, s.r * 1.2);
  g.addColorStop(0, rgba([c[0] + 30, c[1] + 25, c[2] + 15], 0.88));
  g.addColorStop(0.7, rgba(c, 0.86));
  g.addColorStop(1, rgba([c[0] - 50, c[1] - 25, c[2] - 10], 0.92));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba([c[0] - 70, c[1] - 30, c[2] - 15], 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  gloss(ctx, -s.r * 0.3, -s.r * 0.32, s.r * 0.32, s.r * 0.14, 0.42);
}

function smear(ctx: Ctx, s: Stain, rnd: Rnd) {
  haze(ctx, s.r * 1.6, [110, 85, 55], 0.14);
  ctx.lineCap = "round";
  // Wiped-around film: overlapping arcs of a dirty cloth.
  for (let i = 0; i < 5; i++) {
    const rr = s.r * (0.45 + rnd() * 0.55);
    const a0 = rnd() * Math.PI * 2;
    ctx.strokeStyle = `rgba(${120 + rnd() * 30}, ${88 + rnd() * 20}, ${55 + rnd() * 15}, ${0.22 + rnd() * 0.16})`;
    ctx.lineWidth = s.r * (0.28 + rnd() * 0.25);
    ctx.beginPath();
    ctx.arc((rnd() - 0.5) * s.r * 0.5, (rnd() - 0.5) * s.r * 0.5, rr, a0, a0 + 1.6 + rnd() * 2);
    ctx.stroke();
  }
  // A few drier flecks.
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = `rgba(95, 62, 35, ${0.35 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.arc(
      (rnd() - 0.5) * s.r * 1.6,
      (rnd() - 0.5) * s.r * 1.6,
      0.8 + rnd() * 1.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function coffeeRing(ctx: Ctx, s: Stain, rnd: Rnd) {
  const ring = (x: number, y: number, r: number, a: number) => {
    ctx.fillStyle = `rgba(150, 95, 45, ${0.18 * a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Coffee dries darkest at its edge, and not evenly.
    ctx.lineWidth = Math.max(1.4, r * 0.16);
    ctx.strokeStyle = `rgba(105, 58, 22, ${0.62 * a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    const a0 = rnd() * Math.PI * 2;
    ctx.lineWidth = Math.max(2, r * 0.24);
    ctx.strokeStyle = `rgba(80, 40, 14, ${0.55 * a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a0 + 1.4 + rnd());
    ctx.stroke();
  };
  ring(0, 0, s.r, 1);
  // A second, fainter cup mark overlapping it.
  if (rnd() < 0.6) ring(s.r * 0.6, s.r * 0.35, s.r * 0.9, 0.55);
  // A drip that ran down the cup.
  ctx.fillStyle = "rgba(105, 58, 22, 0.55)";
  ctx.beginPath();
  ctx.arc(-s.r * 0.95, s.r * 0.45, s.r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function crust(ctx: Ctx, s: Stain, rnd: Rnd) {
  haze(ctx, s.r * 1.8, [100, 70, 40], 0.12);
  // Shadow, then the stuck-on lump, then its lit top edge.
  ctx.save();
  ctx.translate(1.4, 1.8);
  blob(ctx, s.r, rnd, 0.3, 9);
  ctx.fillStyle = "rgba(40, 22, 10, 0.4)";
  ctx.fill();
  ctx.restore();
  blob(ctx, s.r, rnd, 0.3, 9);
  const g = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.35, 0, 0, 0, s.r * 1.1);
  g.addColorStop(0, "rgba(214, 160, 92, 0.98)");
  g.addColorStop(0.6, "rgba(168, 108, 52, 0.97)");
  g.addColorStop(1, "rgba(112, 66, 30, 0.97)");
  ctx.fillStyle = g;
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? "92, 50, 20" : "235, 200, 140"}, 0.7)`;
    ctx.beginPath();
    ctx.arc((rnd() - 0.5) * s.r, (rnd() - 0.5) * s.r, 0.6 + rnd() * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function grease(ctx: Ctx, s: Stain, rnd: Rnd) {
  const long = s.r * s.stretch;
  ctx.save();
  ctx.rotate(s.angle);
  ctx.scale(s.stretch, 1);
  haze(ctx, s.r * 1.6, [70, 45, 20], 0.16);
  blob(ctx, s.r, rnd, 0.24, 12);
  ctx.restore();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, long);
  g.addColorStop(0, "rgba(58, 30, 8, 0.82)");
  g.addColorStop(0.55, "rgba(96, 58, 16, 0.66)");
  g.addColorStop(1, "rgba(140, 92, 28, 0.5)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(48, 24, 6, 0.5)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Grease shines: a long highlight and a faint rainbow sheen.
  ctx.save();
  ctx.rotate(s.angle);
  ctx.strokeStyle = "rgba(255, 246, 214, 0.5)";
  ctx.lineWidth = Math.max(1.2, s.r * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-long * 0.55, -s.r * 0.35);
  ctx.quadraticCurveTo(0, -s.r * 0.6, long * 0.45, -s.r * 0.3);
  ctx.stroke();
  ctx.strokeStyle = "rgba(150, 190, 220, 0.22)";
  ctx.lineWidth = Math.max(1, s.r * 0.12);
  ctx.beginPath();
  ctx.moveTo(-long * 0.4, s.r * 0.15);
  ctx.quadraticCurveTo(0, -s.r * 0.05, long * 0.35, s.r * 0.2);
  ctx.stroke();
  ctx.restore();
  // Spatters around the pan.
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const d = long * (0.9 + rnd() * 0.5);
    ctx.fillStyle = "rgba(70, 40, 12, 0.6)";
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * s.r * 1.2, 0.8 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

const CRUMB = [
  [214, 170, 98],
  [186, 130, 64],
  [150, 98, 50],
  [236, 214, 170],
  [118, 68, 30], // toasted
  [84, 50, 24], // burnt
] as const;

function crumbs(ctx: Ctx, s: Stain, rnd: Rnd) {
  // Bigger, darker-edged pieces with a crumb haze, so they read on warm tiles
  // and wood (developer 2026-10-22: "make the crumbs more visible").
  haze(ctx, s.r * 1.4, [96, 70, 40], 0.2);
  const n = 14 + Math.floor(rnd() * 10);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * s.r;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    const size = 1.8 + rnd() * 3.2;
    const sides = 3 + Math.floor(rnd() * 3);
    const rot = rnd() * Math.PI;
    const shape = (ox: number, oy: number) => {
      ctx.beginPath();
      for (let k = 0; k < sides; k++) {
        const t = rot + (k / sides) * Math.PI * 2;
        const rr = size * (0.7 + rnd() * 0.5);
        const px = x + ox + Math.cos(t) * rr;
        const py = y + oy + Math.sin(t) * rr;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    shape(1.2, 1.5);
    ctx.fillStyle = "rgba(30, 18, 8, 0.55)";
    ctx.fill();
    shape(0, 0);
    ctx.fillStyle = rgba(CRUMB[Math.floor(rnd() * CRUMB.length)]!, 1);
    ctx.fill();
    ctx.strokeStyle = "rgba(70, 40, 16, 0.85)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  // Now and then a herb leaf.
  if (rnd() < 0.5) {
    ctx.fillStyle = "rgba(92, 140, 60, 0.85)";
    ctx.beginPath();
    ctx.ellipse(s.r * 0.3, -s.r * 0.2, 2.6, 1.2, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function scuff(ctx: Ctx, s: Stain, rnd: Rnd) {
  ctx.save();
  ctx.rotate(s.angle);
  ctx.scale(s.stretch, 1);
  haze(ctx, s.r * 1.3, [62, 48, 34], 0.42);
  ctx.restore();
  ctx.save();
  ctx.rotate(s.angle);
  ctx.lineCap = "round";
  const long = s.r * s.stretch;
  for (let i = 0; i < 8; i++) {
    const y = (rnd() - 0.5) * s.r * 1.2;
    ctx.strokeStyle = `rgba(38, 26, 16, ${0.5 + rnd() * 0.35})`;
    ctx.lineWidth = 1.4 + rnd() * 2.4;
    ctx.beginPath();
    ctx.moveTo(-long * (0.4 + rnd() * 0.5), y);
    ctx.quadraticCurveTo(
      0,
      y + (rnd() - 0.5) * 6,
      long * (0.4 + rnd() * 0.5),
      y + (rnd() - 0.5) * 4,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function footprint(
  ctx: Ctx,
  s: Stain,
  rnd: Rnd,
  rgb: readonly [number, number, number] = [62, 42, 24],
) {
  ctx.save();
  ctx.rotate(s.angle + Math.PI / 2);
  const L = s.r * s.stretch;
  const W = s.r * 0.62;
  const a = 0.62 + rnd() * 0.2;
  ctx.fillStyle = rgba(rgb, a);
  // Sole and heel of a shoe.
  ctx.beginPath();
  ctx.ellipse(0, -L * 0.28, W, L * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, L * 0.62, W * 0.82, L * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tread: lighter stripes across the sole.
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = 1.1;
  for (let y = -L * 0.66; y < L * 0.15; y += 3.4) {
    ctx.beginPath();
    ctx.moveTo(-W * 0.8, y);
    ctx.lineTo(W * 0.8, y + 1);
    ctx.stroke();
  }
  ctx.restore();
}

function puddle(ctx: Ctx, s: Stain, rnd: Rnd) {
  const big = s.r >= 20;
  const c = [120, 36, 30] as const; // red wine / juice
  ctx.save();
  ctx.scale(s.stretch, 1);
  if (big) haze(ctx, s.r * 1.7, [100, 50, 35], 0.16);
  blob(ctx, s.r, rnd, big ? 0.3 : 0.2, big ? 14 : 8);
  ctx.restore();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r * s.stretch);
  g.addColorStop(0, rgba(c, 0.56));
  g.addColorStop(0.75, rgba(c, 0.64));
  g.addColorStop(1, rgba([90, 22, 20], 0.82));
  ctx.fillStyle = g;
  ctx.fill();
  // The wet edge catches the light.
  ctx.strokeStyle = "rgba(70, 14, 12, 0.6)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  gloss(ctx, -s.r * 0.35, -s.r * 0.35, s.r * 0.45, s.r * 0.12, 0.5);
  gloss(ctx, s.r * 0.25, s.r * 0.2, s.r * 0.16, s.r * 0.06, 0.35);
  if (big) {
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      const d = s.r * s.stretch * (1.1 + rnd() * 0.6);
      ctx.fillStyle = rgba(c, 0.7);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.75, 1.2 + rnd() * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function scale(ctx: Ctx, s: Stain, rnd: Rnd) {
  haze(ctx, s.r * 1.5, [150, 120, 60], 0.18);
  // A crusty ring of limescale with brown streaks.
  blob(ctx, s.r, rnd, 0.32, 10, 0.8);
  ctx.fillStyle = "rgba(176, 138, 66, 0.55)";
  ctx.fill();
  ctx.lineWidth = Math.max(1.6, s.r * 0.22);
  ctx.strokeStyle = "rgba(128, 92, 38, 0.7)";
  ctx.stroke();
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? "110, 78, 30" : "222, 205, 160"}, ${0.5 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.arc(
      (rnd() - 0.5) * s.r * 1.6,
      (rnd() - 0.5) * s.r * 1.3,
      0.6 + rnd() * 1.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(120, 84, 34, 0.45)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const x = (rnd() - 0.5) * s.r;
    ctx.beginPath();
    ctx.moveTo(x, -s.r * 0.2);
    ctx.lineTo(x + (rnd() - 0.5) * 3, s.r * (0.6 + rnd() * 0.5));
    ctx.stroke();
  }
}

function waterSpots(ctx: Ctx, s: Stain, rnd: Rnd) {
  const n = 5 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * s.r;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    const r = 1.6 + rnd() * 3.2;
    // Dried water: a cloudy middle and a bright mineral rim.
    ctx.fillStyle = "rgba(205, 218, 214, 0.42)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(250, 252, 246, 0.9)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.strokeStyle = "rgba(120, 130, 125, 0.35)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, r, 0.2, 1.8);
    ctx.stroke();
  }
  // A dribble mark.
  ctx.strokeStyle = "rgba(225, 235, 230, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s.r * 0.2, -s.r * 0.6);
  ctx.quadraticCurveTo(s.r * 0.1, 0, -s.r * 0.05, s.r * 0.8);
  ctx.stroke();
}

function grime(ctx: Ctx, s: Stain, rnd: Rnd) {
  ctx.save();
  ctx.scale(1.2, 0.85);
  haze(ctx, s.r * 1.3, [58, 52, 36], 0.46);
  ctx.restore();
  // A muddy film with darker patches where it dried (the painted tiles are far larger than a
  // grout grid this size, so drawing grout lines read as hash marks — 2026-10-22).
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.translate((rnd() - 0.5) * s.r * 0.9, (rnd() - 0.5) * s.r * 0.6);
    ctx.fillStyle = `rgba(56, 48, 30, ${0.32 + rnd() * 0.16})`;
    blob(ctx, s.r * (0.45 + rnd() * 0.3), rnd, 0.35, 8);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(48, 42, 28, ${0.45 + rnd() * 0.35})`;
    ctx.beginPath();
    ctx.arc(
      (rnd() - 0.5) * s.r * 1.6,
      (rnd() - 0.5) * s.r * 1.2,
      0.8 + rnd() * 1.8,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

/** One stain painted on its own canvas, centred; `reach` px on each side of the centre. */
export function paintStain(s: Stain): HTMLCanvasElement {
  const reach = stainReach(s);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = reach * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const rnd = seeded(s.seed);
  ctx.translate(reach, reach);
  if (s.kind !== "grease" && s.kind !== "scuff" && s.kind !== "footprint") ctx.rotate(s.angle);
  switch (s.kind) {
    case "sauce":
      sauce(ctx, s, rnd);
      break;
    case "smear":
      smear(ctx, s, rnd);
      break;
    case "coffee-ring":
      coffeeRing(ctx, s, rnd);
      break;
    case "crust":
      crust(ctx, s, rnd);
      break;
    case "grease":
      grease(ctx, s, rnd);
      break;
    case "crumbs":
      crumbs(ctx, s, rnd);
      break;
    case "scuff":
      scuff(ctx, s, rnd);
      break;
    case "footprint":
      footprint(ctx, s, rnd, s.task === "restroom-floor" ? [52, 50, 36] : [62, 42, 24]);
      break;
    case "puddle":
      puddle(ctx, s, rnd);
      break;
    case "scale":
      scale(ctx, s, rnd);
      break;
    case "water-spots":
      waterSpots(ctx, s, rnd);
      break;
    case "grime":
      grime(ctx, s, rnd);
      break;
  }
  return canvas;
}
