/**
 * Dessert Run's gallery (developer 2026-11-16): hand-made desserts on a 24 x 24 grid of cubes, fixed by
 * tier. Every cell holds a colour index into the dessert's own `keys` (or -1 for no cube). The mosaics are
 * drawn by code; the picture of the plate is the only art behind them.
 */
export const GRID = 24;

/** The game's ten cube colours. Waiters wear the same ten. */
export const RUN_PALETTE = {
  red: "#D8453C",
  pink: "#F4A3B5",
  orange: "#E7892F",
  yellow: "#F5D463",
  green: "#5BA845",
  choc: "#6A3F28",
  milk: "#A8683F",
  tan: "#DDAE6C",
  cream: "#FFF1D6",
  blue: "#4B58AA",
} as const;
export type RunColorKey = keyof typeof RUN_PALETTE;

export type DessertId = "cookie" | "donut" | "tart" | "pancake";
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

const blank = () => new Int8Array(GRID * GRID).fill(-1);

function hash(x: number, y: number, s = 0): number {
  let h =
    (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(s + 1, 83492791)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

function setCell(g: Int8Array, x: number, y: number, k: number) {
  if (x >= 0 && y >= 0 && x < GRID && y < GRID) g[y * GRID + x] = k;
}

function buildCookie(): Int8Array {
  const g = blank();
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - 12;
      const dy = y + 0.5 - 12;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const R = 10.8 + 0.45 * Math.sin(5 * a + 0.6);
      if (Math.hypot(x + 0.5 - 19.2, y + 0.5 - 4.8) < 3.3) continue; // the bite
      if (r <= R) g[y * GRID + x] = r > R - 1.7 ? 0 : 1;
    }
  const chips: Array<[number, number]> = [
    [6, 8], [10, 5], [14, 9], [8, 13], [13, 14], [5, 12],
    [16, 13], [10, 17], [17, 17], [12, 9], [7, 17], [14, 5],
  ]; // prettier-ignore
  for (const [x, y] of chips)
    for (const [ox, oy] of [
      [0, 0],
      [1, 0],
      [0, 1],
    ] as const) {
      const i = (y + oy) * GRID + x + ox;
      if (g[i] === 1) g[i] = 2;
    }
  return g;
}

function buildDonut(): Int8Array {
  const g = blank();
  let sprinkle = 0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - 12;
      const dy = y + 0.5 - 12;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const Ro = 10.9 + 0.35 * Math.sin(4 * a);
      if (r < 3.7 || r > Ro) continue;
      let k = 0;
      const Ri = 8.7 + 1.0 * Math.sin(3 * a + 0.7) + 0.6 * Math.sin(7 * a);
      if (r <= Ri && r >= 4.4) {
        k = 1;
        if (hash(x, y) % 9 === 0) k = 2 + (sprinkle++ % 4); // sprinkles, the four colours in turn
      }
      g[y * GRID + x] = k;
    }
  return g;
}

function buildTart(): Int8Array {
  const g = blank();
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const r = Math.hypot(x + 0.5 - 12, y + 0.5 - 12);
      if (r <= 11.2) g[y * GRID + x] = r > 9.3 ? 0 : 1;
    }
  for (let i = 0; i < 7; i++) {
    const a = (i * 2 * Math.PI) / 7 - Math.PI / 2;
    const bx = Math.round(12 + 6.6 * Math.cos(a));
    const by = Math.round(12 + 6.6 * Math.sin(a));
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) setCell(g, bx + dx, by + dy, 2);
    setCell(g, bx - 1, by - 1, 3);
    setCell(g, bx + 1, by - 1, 5);
    const m = a + Math.PI / 7;
    setCell(g, Math.round(12 + 8.4 * Math.cos(m)), Math.round(12 + 8.4 * Math.sin(m)), 5);
  }
  for (let y = 10; y <= 13; y++)
    for (let x = 10; x <= 13; x++)
      if (!((x === 10 || x === 13) && (y === 10 || y === 13))) setCell(g, x, y, 4);
  return g;
}

function buildPancake(): Int8Array {
  const g = blank();
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - 12;
      const dy = y + 0.5 - 12;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (r > 11) continue;
      let k = r > 9.2 ? 0 : 1;
      if (r < 7.4 + 1.5 * Math.sin(3 * a + 0.5) + 0.9 * Math.sin(5 * a + 2)) k = 2;
      g[y * GRID + x] = k;
    }
  for (let y = 10; y <= 13; y++) for (let x = 10; x <= 13; x++) setCell(g, x, y, 3); // butter
  for (const [x, y] of [
    [8, 8],
    [15, 8],
    [7, 14],
    [16, 14],
    [12, 16],
    [12, 7],
    [9, 11],
    [15, 12],
  ] as const)
    setCell(g, x, y, 4); // blueberries
  for (const [x, y] of [
    [8, 17],
    [15, 17],
    [11, 5],
  ] as const) {
    setCell(g, x, y, 5);
    setCell(g, x + 1, y, 5);
    setCell(g, x, y + 1, 5);
    setCell(g, x + 1, y + 1, 5);
  } // strawberries
  return g;
}

export const DESSERTS: Record<DessertId, Dessert> = {
  cookie: {
    id: "cookie",
    name: "Chocolate Chip Cookie",
    short: "Cookie",
    tier: 1,
    keys: ["orange", "tan", "choc"],
    build: buildCookie,
  },
  donut: {
    id: "donut",
    name: "Pink Glazed Donut",
    short: "Donut",
    tier: 1,
    keys: ["tan", "pink", "cream", "yellow", "green", "blue"],
    build: buildDonut,
  },
  tart: {
    id: "tart",
    name: "Strawberry Tart",
    short: "Tart",
    tier: 2,
    keys: ["tan", "yellow", "red", "pink", "blue", "green"],
    build: buildTart,
  },
  pancake: {
    id: "pancake",
    name: "Pancakes with Syrup",
    short: "Pancakes",
    tier: 3,
    keys: ["orange", "tan", "milk", "yellow", "blue", "red"],
    build: buildPancake,
  },
};

export const DESSERT_ORDER: readonly DessertId[] = ["cookie", "donut", "tart", "pancake"];

/** The desserts a tier serves, in rotation. A higher tier may also serve a lower tier's easiest dessert. */
export const DESSERTS_BY_TIER: Record<DessertTier, readonly DessertId[]> = {
  1: ["cookie", "donut"],
  2: ["donut", "tart"],
  3: ["tart", "pancake"],
  4: ["pancake"],
};
