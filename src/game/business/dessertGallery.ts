/**
 * Dessert Run's gallery (developer 2026-11-16): mosaic pictures on a 28 x 28 grid of cubes, fixed by tier.
 * Every cell holds a colour index into the dessert's own `keys` (or -1 for no cube).
 *
 * Built the way the developer's reference mosaics (Colony Flow, a lily pad on water) are built:
 *  - the WHOLE plate is filled: a two-tone background (a light field and a darker one under a wavy line) with a few
 *    white splash clusters, and the dessert sits on it with a dark outline one cube thick. The background and the
 *    outline are layers a waiter has to peel before the dessert inside can be reached;
 *  - 8 to 9 vivid colours; each shape has a base, a darker shade on the lower right and a light edge on the upper left;
 *  - colours form clusters, never lone cubes (sprinkles and glints come in pairs or bars);
 *  - the outline, the light edge and the dark edge are worked out from the regions, so every picture shades alike.
 */
export const GRID = 28;

/** The cube colours: clean and saturated, with a dark navy outline and a warm cream for lit edges and splashes. */
export const RUN_PALETTE = {
  outline: "#2E2A40",
  cream: "#FFF1D2",
  gold: "#FFB32B",
  goldDark: "#EC8A1B",
  chip: "#7B4529",
  chipLight: "#A56840",
  dough: "#F9C46B",
  doughDark: "#E39A3F",
  pink: "#FF78A8",
  pinkDark: "#E5487F",
  red: "#F2473E",
  redDark: "#C92B3A",
  yellow: "#FFD84A",
  green: "#19D774",
  blue: "#2F95F0",
  cyan: "#48CCF6",
  mint: "#74E5C4",
  teal: "#2FC3A0",
  butter: "#FFE48D",
  butterDark: "#FFC84F",
  lilac: "#C3AEFA",
  lilacDark: "#9A86EC",
  crust: "#F2B160",
} as const;
export type RunColorKey = keyof typeof RUN_PALETTE;

export type DessertId = "cookie" | "donut" | "cupcake" | "cone";
export type DessertTier = 1 | 2 | 3 | 4;
export type Dessert = {
  id: DessertId;
  name: string;
  short: string;
  tier: DessertTier;
  /** Colour names, by cube colour index. Colour 0 is always the outline. */
  keys: readonly RunColorKey[];
  build: () => Int8Array;
};

/* ---------- a small painter ---------- */

/** The middle of every picture, in cells. */
const CX = GRID / 2;
const CY = GRID / 2;
/** The board is a disc that fills the plate's well. */
const BOARD_R = 12.6;
const at = (x: number, y: number) => y * GRID + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID;

type Region = {
  has: (x: number, y: number) => boolean;
  base: RunColorKey;
  /** Colour of the one-cube edge on the lit side (top and left); none = keep the base. */
  light?: RunColorKey;
  /** Colour of the one-cube edge on the shaded side (bottom and right). */
  dark?: RunColorKey;
};

class Painter {
  readonly g = new Int8Array(GRID * GRID).fill(-1);
  /** Which region (1 = first painted) holds a cell; 0 = none. */
  readonly rid = new Uint8Array(GRID * GRID);
  readonly regions: Region[] = [];
  constructor(readonly keys: readonly RunColorKey[]) {}
  k(name: RunColorKey): number {
    const i = this.keys.indexOf(name);
    if (i < 0) throw new Error(`colour ${name} is not in this dessert`);
    return i;
  }
  /** Paints a region over what is there. */
  paint(region: Region) {
    this.regions.push(region);
    const id = this.regions.length;
    const k = this.k(region.base);
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (region.has(x, y)) {
          this.g[at(x, y)] = k;
          this.rid[at(x, y)] = id;
        }
  }
  /** The two-tone board: a light field, and a darker one under a wavy line. */
  board(light: RunColorKey, dark: RunColorKey, wave: (x: number) => number) {
    const on = disc(CX, CY, BOARD_R);
    this.paint({ has: on, base: light });
    this.paint({ has: (x, y) => on(x, y) && y + 0.5 > wave(x + 0.5), base: dark });
  }
  /**
   * Every cube of the dessert (regions after the board) that touches the board or the outside gets the outline;
   * then each dessert region gets its light edge (upper left) and dark edge (lower right).
   */
  finish(subjectFrom = 3) {
    const outline = this.k("outline");
    const isSubject = (x: number, y: number) =>
      inside(x, y) && this.g[at(x, y)]! >= 0 && this.rid[at(x, y)]! >= subjectFrom;
    const edge: number[] = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (
          isSubject(x, y) &&
          (!isSubject(x - 1, y) ||
            !isSubject(x + 1, y) ||
            !isSubject(x, y - 1) ||
            !isSubject(x, y + 1))
        )
          edge.push(at(x, y));
    for (const i of edge) this.g[i] = outline;
    // The light edge follows the outline; the dark edge also marks where a region sits on one painted before it.
    const outOnly = (x: number, y: number) => !inside(x, y) || this.g[at(x, y)] === outline;
    const lowerOrOut = (id: number, x: number, y: number) => {
      if (outOnly(x, y)) return true;
      const r = this.rid[at(x, y)]!;
      return r > 0 && r < id;
    };
    const next = this.g.slice();
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        const i = at(x, y);
        const id = this.rid[i]!;
        if (id < subjectFrom || this.g[i] === outline) continue;
        const r = this.regions[id - 1]!;
        if (this.g[i] !== this.k(r.base)) continue;
        const lit = outOnly(x - 1, y) || outOnly(x, y - 1);
        const shade = lowerOrOut(id, x + 1, y) || lowerOrOut(id, x, y + 1);
        if (lit && !shade && r.light) next[i] = this.k(r.light);
        else if (shade && !lit && r.dark) next[i] = this.k(r.dark);
      }
    this.g.set(next);
  }
  private cube(x: number, y: number) {
    return inside(x, y) && this.g[at(x, y)]! >= 0 && this.g[at(x, y)] !== this.k("outline");
  }
  /** A run of cubes of one colour, 2 or more, on cubes that are there (never a lone cube). */
  bar(x: number, y: number, len: number, vertical: boolean, name: RunColorKey) {
    for (let i = 0; i < len; i++)
      if (!this.cube(x + (vertical ? 0 : i), y + (vertical ? i : 0))) return;
    for (let i = 0; i < len; i++)
      this.g[at(x + (vertical ? 0 : i), y + (vertical ? i : 0))] = this.k(name);
  }
  /** A filled block of one colour. */
  block(x: number, y: number, w: number, h: number, name: RunColorKey) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!this.cube(x + i, y + j)) return;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.g[at(x + i, y + j)] = this.k(name);
  }
}

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
/** A shape whose radius changes with the angle. */
const wavy = (cx: number, cy: number, radius: (a: number) => number) => (x: number, y: number) => {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return Math.hypot(dx, dy) <= radius(Math.atan2(dy, dx));
};

/* ---------- the desserts ---------- */

function buildCookie(): Int8Array {
  const p = new Painter([
    "outline",
    "cream",
    "gold",
    "goldDark",
    "chip",
    "chipLight",
    "cyan",
    "blue",
  ]);
  p.board("cyan", "blue", (x) => 19.6 + 1.5 * Math.sin(x * 0.42 + 0.6));
  const bite = disc(20.4, 6.4, 3.1);
  const edge = wavy(
    13.6,
    13.4,
    (a) => 9.5 + 0.28 * Math.sin(5 * a + 0.6) + 0.18 * Math.sin(9 * a + 1.4),
  );
  p.paint({
    has: (x, y) => edge(x, y) && !bite(x, y),
    base: "gold",
    light: "cream",
    dark: "goldDark",
  });
  p.finish();
  // chocolate chips: blocks with a lighter top-left cube, placed by hand
  const chips: Array<[number, number, number, number]> = [
    [8, 8, 3, 2], [13, 6, 2, 2], [17, 11, 3, 2], [9, 13, 2, 3], [14, 14, 3, 2],
    [7, 18, 3, 2], [18, 17, 2, 3], [12, 19, 3, 2], [11, 10, 2, 2],
  ]; // prettier-ignore
  for (const [x, y, w, h] of chips) {
    p.block(x, y, w, h, "chip");
    p.block(x, y, 1, 1, "chipLight");
  }
  // white splashes on the water
  for (const [x, y, len] of [
    [5, 21, 3],
    [19, 22, 3],
    [11, 24, 2],
    [23, 16, 2],
    [5, 9, 2],
  ] as const)
    p.bar(x, y, len, false, "cream");
  return p.g;
}

function buildDonut(): Int8Array {
  const p = new Painter([
    "outline",
    "cream",
    "dough",
    "doughDark",
    "pink",
    "pinkDark",
    "blue",
    "mint",
    "teal",
  ]);
  p.board("mint", "teal", (x) => 19.8 + 1.4 * Math.sin(x * 0.4 + 2.0));
  const outer = wavy(CX, 13.6, (a) => 9.9 + 0.22 * Math.sin(4 * a + 0.5));
  const hole = disc(CX, 13.6, 3.2);
  p.paint({
    has: (x, y) => outer(x, y) && !hole(x, y),
    base: "dough",
    light: "cream",
    dark: "doughDark",
  });
  const icing = wavy(
    CX,
    13.6,
    (a) => 8.0 + 0.9 * Math.sin(3 * a + 0.7) + 0.4 * Math.sin(6 * a + 2.2),
  );
  p.paint({
    has: (x, y) => icing(x, y) && !disc(CX, 13.6, 4.5)(x, y),
    base: "pink",
    light: "cream",
    dark: "pinkDark",
  });
  p.finish();
  // sprinkles come in pairs, a glossy streak in a bar
  for (const [x, y, v, c] of [
    [9, 8, 0, "blue"],
    [17, 7, 1, "cream"],
    [20, 11, 0, "blue"],
    [19, 18, 1, "blue"],
    [13, 20, 0, "cream"],
    [8, 17, 1, "cream"],
    [10, 11, 0, "cream"],
    [16, 20, 0, "blue"],
  ] as const)
    // prettier-ignore
    p.bar(x, y, 2, v === 1, c);
  p.bar(8, 12, 3, true, "cream");
  for (const [x, y, len] of [
    [5, 21, 3],
    [19, 22, 3],
    [11, 24, 2],
    [5, 7, 2],
    [22, 8, 2],
  ] as const)
    p.bar(x, y, len, false, "cream");
  return p.g;
}

function buildCupcake(): Int8Array {
  const p = new Painter([
    "outline",
    "cream",
    "pink",
    "pinkDark",
    "blue",
    "red",
    "redDark",
    "butter",
    "butterDark",
  ]);
  p.board("butter", "butterDark", (x) => 20.4 + 1.3 * Math.sin(x * 0.38 + 1.2));
  // the paper cup
  p.paint({
    has: (x, y) => y >= 17 && y <= 24 && Math.abs(x + 0.5 - CX) <= 8.6 - (y - 17) * 0.5,
    base: "blue",
    light: "cream",
    dark: "blue",
  });
  // three frosting tiers, then the cherry
  const tier = (cy: number, rx: number, ry: number): Region => ({
    has: ellipse(CX, cy, rx, ry),
    base: "pink",
    light: "cream",
    dark: "pinkDark",
  });
  p.paint(tier(14.8, 9.4, 3.8));
  p.paint(tier(11.5, 7.0, 3.4));
  p.paint(tier(8.5, 4.7, 3.0));
  p.paint({ has: disc(CX, 5.3, 2.8), base: "red", light: "cream", dark: "redDark" });
  p.finish();
  // stripes on the cup, after the outline so its edge stays dark
  for (let y = 17; y <= 24; y++)
    for (let x = 0; x < GRID; x++)
      if (
        p.rid[at(x, y)] === 3 &&
        p.g[at(x, y)] === p.k("blue") &&
        Math.floor((x - 4) / 2) % 2 === 0
      )
        p.g[at(x, y)] = p.k("cream");
  for (const [x, y, v, c] of [
    [8, 14, 0, "blue"],
    [12, 15, 0, "cream"],
    [17, 14, 0, "blue"],
    [10, 11, 0, "cream"],
    [16, 11, 0, "blue"],
    [13, 8, 0, "cream"],
    [19, 15, 0, "cream"],
  ] as const)
    // prettier-ignore
    p.bar(x, y, 2, Boolean(v), c);
  for (const [x, y, len] of [
    [5, 21, 3],
    [21, 21, 2],
    [11, 25, 3],
    [5, 7, 2],
    [22, 8, 2],
  ] as const)
    p.bar(x, y, len, false, "cream");
  return p.g;
}

function buildCone(): Int8Array {
  const p = new Painter([
    "outline",
    "cream",
    "gold",
    "goldDark",
    "pink",
    "pinkDark",
    "red",
    "lilac",
    "lilacDark",
  ]);
  p.board("lilac", "lilacDark", (x) => 20.2 + 1.4 * Math.sin(x * 0.4 + 0.2));
  // the waffle cone, point down
  p.paint({
    has: (x, y) => y >= 14 && y <= 25 && Math.abs(x + 0.5 - CX) <= (7.2 * (25.4 - y)) / 11.4 + 0.5,
    base: "gold",
    light: "cream",
    dark: "goldDark",
  });
  // two scoops of strawberry, the lower one wider, with a ruffled skirt
  const scoop = disc(CX, 10.2, 6.0);
  const skirt = ellipse(CX, 14.4, 7.2, 2.2);
  p.paint({
    has: (x, y) => scoop(x, y) || skirt(x, y),
    base: "pink",
    light: "cream",
    dark: "pinkDark",
  });
  p.finish();
  // the waffle grid: diagonal bars of the darker gold
  for (let y = 14; y <= 25; y++)
    for (let x = 0; x < GRID; x++)
      if (p.rid[at(x, y)] === 3 && p.g[at(x, y)] === p.k("gold") && ((x - y + 40) >> 1) % 2 === 0)
        p.g[at(x, y)] = p.k("goldDark");
  // sprinkles in pairs
  for (const [x, y, v, c] of [
    [9, 8, 0, "cream"],
    [16, 7, 1, "red"],
    [12, 10, 0, "red"],
    [17, 11, 0, "cream"],
    [8, 12, 1, "red"],
    [13, 13, 0, "cream"],
  ] as const)
    p.bar(x, y, 2, v === 1, c);
  for (const [x, y, len] of [
    [6, 19, 3],
    [19, 19, 3],
    [11, 23, 2],
    [6, 6, 2],
    [20, 5, 2],
  ] as const)
    p.bar(x, y, len, false, "cream");
  return p.g;
}

export const DESSERTS: Record<DessertId, Dessert> = {
  cookie: {
    id: "cookie",
    name: "Chocolate Chip Cookie",
    short: "Cookie",
    tier: 1,
    keys: ["outline", "cream", "gold", "goldDark", "chip", "chipLight", "cyan", "blue"],
    build: buildCookie,
  },
  donut: {
    id: "donut",
    name: "Pink Glazed Donut",
    short: "Donut",
    tier: 1,
    keys: ["outline", "cream", "dough", "doughDark", "pink", "pinkDark", "blue", "mint", "teal"],
    build: buildDonut,
  },
  cupcake: {
    id: "cupcake",
    name: "Cherry Cupcake",
    short: "Cupcake",
    tier: 2,
    keys: [
      "outline",
      "cream",
      "pink",
      "pinkDark",
      "blue",
      "red",
      "redDark",
      "butter",
      "butterDark",
    ],
    build: buildCupcake,
  },
  cone: {
    id: "cone",
    name: "Strawberry Ice Cream",
    short: "Ice cream",
    tier: 3,
    keys: ["outline", "cream", "gold", "goldDark", "pink", "pinkDark", "red", "lilac", "lilacDark"],
    build: buildCone,
  },
};

export const DESSERT_ORDER: readonly DessertId[] = ["cookie", "donut", "cupcake", "cone"];

/** The desserts a tier serves, in rotation. A higher tier may also serve a lower tier's easiest dessert. */
export const DESSERTS_BY_TIER: Record<DessertTier, readonly DessertId[]> = {
  1: ["cookie", "donut"],
  2: ["donut", "cupcake"],
  3: ["cupcake", "cone"],
  4: ["cone"],
};
