/**
 * Dessert Run's gallery (developer 2026-11-16): pixel-art desserts on a 24 x 24 grid of cubes, fixed by tier.
 * Every cell holds a colour index into the dessert's own `keys` (or -1 for no cube). Each picture has a dark
 * outline, two or three tones of every hue (light from the top left) and a few white glints, like the mosaics
 * of the games the developer pointed to (Colony Flow). The pictures are code; the plate is the only art.
 */
export const GRID = 24;

/** The cube colours. A dessert picks 6 to 9 of them; waiters wear the same ones. */
export const RUN_PALETTE = {
  outline: "#3E2433",
  cream: "#FFF6E0",
  white: "#FFFFFF",
  goldLight: "#F8D58E",
  gold: "#E8AA52",
  goldDark: "#BE7A33",
  chip: "#6B3F2A",
  chipLight: "#98593A",
  dough: "#F2C27C",
  doughDark: "#CC8F4B",
  pinkLight: "#FFC6D6",
  pink: "#F68DB0",
  pinkDark: "#D65C8A",
  red: "#E6474C",
  redDark: "#B02B3F",
  yellow: "#FBD761",
  green: "#6CC04A",
  blue: "#5C7CE2",
  blueDark: "#3F58B8",
  crust: "#EDB873",
  crustDark: "#C58443",
} as const;
export type RunColorKey = keyof typeof RUN_PALETTE;

export type DessertId = "cookie" | "donut" | "cupcake" | "tart";
export type DessertTier = 1 | 2 | 3 | 4;
export type Dessert = {
  id: DessertId;
  name: string;
  short: string;
  tier: DessertTier;
  /** Colour names, by cube colour index. */
  keys: readonly RunColorKey[];
  build: () => Int8Array;
};

/* ---------- a tiny painter ---------- */

const C = 11.8; // the middle of every picture (cells; a hair left of 12 so the cube grid looks centred)
const at = (x: number, y: number) => y * GRID + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID;

class Canvas {
  readonly g = new Int8Array(GRID * GRID).fill(-1);
  constructor(readonly keys: readonly RunColorKey[]) {}
  k(name: RunColorKey): number {
    const i = this.keys.indexOf(name);
    if (i < 0) throw new Error(`colour ${name} is not in this dessert`);
    return i;
  }
  set(x: number, y: number, name: RunColorKey) {
    if (inside(x, y)) this.g[at(x, y)] = this.k(name);
  }
  get(x: number, y: number): number {
    return inside(x, y) ? this.g[at(x, y)]! : -1;
  }
  is(x: number, y: number, name: RunColorKey): boolean {
    return this.get(x, y) === this.k(name);
  }
  /** Every cube with an empty 4-neighbour (or the grid edge) becomes the outline colour. */
  outline(name: RunColorKey = "outline") {
    const edge: number[] = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (this.g[at(x, y)]! < 0) continue;
        if (
          this.get(x - 1, y) < 0 ||
          this.get(x + 1, y) < 0 ||
          this.get(x, y - 1) < 0 ||
          this.get(x, y + 1) < 0
        )
          edge.push(at(x, y));
      }
    for (const i of edge) this.g[i] = this.k(name);
  }
}

/** Light from the top left: how bright a surface with this normal is, 0 to 1. */
function light(nx: number, ny: number, nz: number): number {
  return -0.42 * nx - 0.55 * ny + 0.72 * nz;
}
const band = (v: number, hi = 0.66, lo = 0.3): 0 | 1 | 2 => (v > hi ? 0 : v > lo ? 1 : 2);

/** A dome: a round bump of radii (rx, ry) at (cx, cy); returns the lit value at a cell or null outside. */
function dome(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number | null {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  const d2 = dx * dx + dy * dy;
  if (d2 > 1) return null;
  return light(dx * 0.92, dy * 0.92, Math.sqrt(Math.max(0, 1 - d2 * 0.85)));
}

function hash(x: number, y: number, s = 0): number {
  let h =
    (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(s + 1, 83492791)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/* ---------- the desserts ---------- */

function buildCookie(): Int8Array {
  const p = new Canvas(["outline", "goldLight", "gold", "goldDark", "chip", "chipLight", "cream"]);
  const cx = C;
  const cy = 12.2;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const R = 10.9 + 0.3 * Math.sin(5 * a + 0.6) + 0.2 * Math.sin(9 * a + 1.4);
      if (Math.hypot(x + 0.5 - 18.6, y + 0.5 - 5.4) < 3.1) continue; // the bite
      if (r > R) continue;
      const v = dome(x, y, cx, cy, R, R)!;
      p.set(x, y, (["goldLight", "gold", "goldDark"] as const)[band(v, 0.7, 0.34)]);
    }
  // chocolate chips: a dark block with a lighter top-left cube
  const chips: Array<[number, number]> = [
    [6, 8], [10, 4], [14, 8], [8, 12], [13, 13], [5, 14],
    [16, 12], [10, 17], [15, 17], [11, 8], [7, 18], [13, 4], [18, 14], [4, 10],
  ]; // prettier-ignore
  for (const [x, y] of chips) {
    // a 2 x 2 block, its top-left cube lighter, its bottom-right cube dropped for a rounder chip
    for (const [ox, oy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      if (ox === 1 && oy === 1 && hash(x, y, 4) % 2) continue;
      if (p.get(x + ox, y + oy) >= 1) p.set(x + ox, y + oy, ox + oy === 0 ? "chipLight" : "chip");
    }
  }
  p.outline();
  // a glint on the lit rim
  for (const [x, y] of [
    [5, 5],
    [6, 4],
    [4, 6],
    [7, 4],
  ] as const)
    if (
      p.get(x, y) >= 0 &&
      !p.is(x, y, "outline") &&
      !p.is(x, y, "chip") &&
      !p.is(x, y, "chipLight")
    )
      p.set(x, y, "cream");
  return p.g;
}

function buildDonut(): Int8Array {
  const p = new Canvas([
    "outline",
    "dough",
    "doughDark",
    "pinkLight",
    "pink",
    "pinkDark",
    "cream",
    "blue",
  ]);
  let sprinkle = 0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - C;
      const dy = y + 0.5 - 12.1;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const Ro = 11 + 0.3 * Math.sin(4 * a + 0.5);
      const Rin = 3.7;
      if (r < Rin || r > Ro) continue;
      const u = (r - Rin) / (Ro - Rin);
      const phi = u * Math.PI;
      const rx = dx / r;
      const ry = dy / r;
      const v = light(-Math.cos(phi) * rx * 0.95, -Math.cos(phi) * ry * 0.95, Math.sin(phi));
      // the icing edge drips in waves
      const Ri =
        8.7 + 1.1 * Math.sin(3 * a + 0.7) + 0.7 * Math.sin(7 * a + 2.1) + 0.5 * Math.sin(11 * a);
      if (r <= Ri && r >= Rin + 0.9) {
        p.set(x, y, (["pinkLight", "pink", "pinkDark"] as const)[band(v, 0.62, 0.22)]);
      } else p.set(x, y, v > 0.35 ? "dough" : "doughDark");
    }
  // sprinkles lie on the icing: single cubes, two colours in turn
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if ((p.is(x, y, "pink") || p.is(x, y, "pinkLight")) && hash(x, y, 3) % 8 === 0)
        p.set(x, y, sprinkle++ % 2 ? "blue" : "cream");
  p.outline();
  // the glossy streak on the icing, top left
  for (const [x, y] of [
    [5, 8],
    [5, 9],
    [6, 7],
    [7, 6],
    [8, 5],
    [9, 5],
  ] as const)
    if (p.is(x, y, "pinkLight") || p.is(x, y, "pink")) p.set(x, y, "cream");
  return p.g;
}

function buildCupcake(): Int8Array {
  const p = new Canvas([
    "outline",
    "pinkLight",
    "pink",
    "pinkDark",
    "blue",
    "cream",
    "red",
    "redDark",
  ]);
  // the paper cup: a trapezoid with stripes
  for (let y = 15; y <= 22; y++) {
    const half = 8.3 - (y - 15) * 0.38;
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - C;
      if (Math.abs(dx) > half) continue;
      const stripe = Math.floor((dx + 12) / 1.5) % 2 === 0;
      p.set(x, y, stripe ? "blue" : "cream");
    }
  }
  // the frosting: three round layers, a dome each, lit from the top left
  const layers: Array<[number, number, number, number]> = [
    [C, 12.4, 9.6, 3.6],
    [C, 8.9, 7.0, 3.3],
    [C, 5.9, 4.6, 2.9],
  ];
  layers.forEach(([cx, cy, rx, ry], li) => {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        const v = dome(x, y, cx, cy, rx, ry);
        if (v === null) continue;
        p.set(x, y, (["pinkLight", "pink", "pinkDark"] as const)[band(v, 0.6, 0.24)]);
      }
    // a shadow line where this layer sits on the one below
    if (li > 0)
      for (let x = 0; x < GRID; x++) {
        let bottom = -1;
        for (let y = 0; y < GRID; y++) if (dome(x, y, cx, cy, rx, ry) !== null) bottom = y;
        if (
          bottom >= 0 &&
          p.get(x, bottom + 1) >= 0 &&
          !p.is(x, bottom + 1, "blue") &&
          !p.is(x, bottom + 1, "cream")
        )
          p.set(x, bottom, "pinkDark");
      }
  });
  // sprinkles
  let n = 0;
  for (let y = 6; y < 15; y++)
    for (let x = 0; x < GRID; x++)
      if ((p.is(x, y, "pinkLight") || p.is(x, y, "pink")) && hash(x, y, 9) % 9 === 0)
        p.set(x, y, n++ % 2 ? "blue" : "cream");
  // the cherry
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < GRID; x++) {
      const v = dome(x, y, C, 3.5, 2.8, 2.8);
      if (v === null) continue;
      p.set(x, y, v > 0.45 ? "red" : "redDark");
    }
  p.set(10, 2, "cream");
  p.set(10, 3, "cream");
  p.outline();
  return p.g;
}

function buildTart(): Int8Array {
  const p = new Canvas([
    "outline",
    "crust",
    "crustDark",
    "yellow",
    "red",
    "redDark",
    "cream",
    "green",
  ]);
  const cy = 12.0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - C;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const R = 11 + 0.35 * Math.sin(18 * a); // the fluted edge
      if (r > R) continue;
      if (r > 8.9) {
        // the crust ring: lit on the top left, shaded on the bottom right
        const lit = -(dx * 0.62 + dy * 0.78) / Math.max(r, 1);
        p.set(x, y, lit > 0.1 ? "crust" : "crustDark");
      } else p.set(x, y, "yellow");
    }
  // a soft gloss on the custard
  for (const [x, y] of [
    [6, 8],
    [7, 7],
    [8, 6],
    [6, 9],
  ] as const)
    if (p.is(x, y, "yellow")) p.set(x, y, "cream");
  // strawberries: six round berries, shaded on the lower right, round a mint leaf
  const berry = new Uint8Array(GRID * GRID);
  const centres: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    centres.push([C + 6.3 * Math.cos(a), cy + 6.3 * Math.sin(a)]);
  }
  for (const [bx, by] of centres)
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (dome(x, y, bx, by, 2.6, 2.6) === null) continue;
        berry[at(x, y)] = 1;
        p.set(x, y, "red");
      }
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (
        berry[at(x, y)] &&
        (!berry[at(x + 1, y)] || !berry[at(x, y + 1)] || !berry[at(x + 1, y + 1)])
      )
        p.set(x, y, "redDark");
  for (const [bx, by] of centres) p.set(Math.floor(bx - 1), Math.floor(by - 1), "cream");
  for (const [x, y] of [
    [11, 10],
    [10, 11],
    [11, 11],
    [12, 11],
    [11, 12],
    [12, 12],
    [13, 12],
    [12, 13],
  ] as const)
    p.set(x, y, "green");
  p.outline();
  return p.g;
}

export const DESSERTS: Record<DessertId, Dessert> = {
  cookie: {
    id: "cookie",
    name: "Chocolate Chip Cookie",
    short: "Cookie",
    tier: 1,
    keys: ["outline", "goldLight", "gold", "goldDark", "chip", "chipLight", "cream"],
    build: buildCookie,
  },
  donut: {
    id: "donut",
    name: "Pink Glazed Donut",
    short: "Donut",
    tier: 1,
    keys: ["outline", "dough", "doughDark", "pinkLight", "pink", "pinkDark", "cream", "blue"],
    build: buildDonut,
  },
  cupcake: {
    id: "cupcake",
    name: "Cherry Cupcake",
    short: "Cupcake",
    tier: 2,
    keys: ["outline", "pinkLight", "pink", "pinkDark", "blue", "cream", "red", "redDark"],
    build: buildCupcake,
  },
  tart: {
    id: "tart",
    name: "Strawberry Tart",
    short: "Tart",
    tier: 3,
    keys: ["outline", "crust", "crustDark", "yellow", "red", "redDark", "cream", "green"],
    build: buildTart,
  },
};

export const DESSERT_ORDER: readonly DessertId[] = ["cookie", "donut", "cupcake", "tart"];

/** The desserts a tier serves, in rotation. A higher tier may also serve a lower tier's easiest dessert. */
export const DESSERTS_BY_TIER: Record<DessertTier, readonly DessertId[]> = {
  1: ["cookie", "donut"],
  2: ["donut", "cupcake"],
  3: ["cupcake", "tart"],
  4: ["tart"],
};
