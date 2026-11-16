/**
 * Dessert Run's gallery (developer 2026-11-16): pixel-art desserts on a 28 x 28 grid of cubes, fixed by tier.
 * Every cell holds a colour index into the dessert's own `keys` (or -1 for no cube).
 *
 * The look follows the mosaics of Colony Flow (the developer's reference): big flat fields of one colour, a thin
 * dark outline, a one-cube light edge on the lit (top left) side and a one-cube dark edge on the other, and a
 * few hand-placed details. No random speckle. A picture is a list of regions painted in order; the outline and
 * the light and dark edges are worked out from the regions, so every dessert shades the same way.
 */
export const GRID = 28;

/** The cube colours: vivid, with a plum outline and a warm cream for lit edges. */
export const RUN_PALETTE = {
  outline: "#5B4660",
  cream: "#FFE4B0",
  gold: "#F7AA3A",
  goldDark: "#DB8426",
  chip: "#7C4630",
  chipLight: "#A5643F",
  dough: "#F6C46C",
  doughDark: "#DC9B46",
  pink: "#FF86B0",
  pinkDark: "#E85A86",
  red: "#FF4B43",
  redDark: "#DE2B3D",
  yellow: "#FFD84F",
  green: "#5CC44D",
  blue: "#5B83F2",
  crust: "#F1B25F",
  crustDark: "#D58B40",
} as const;
export type RunColorKey = keyof typeof RUN_PALETTE;

export type DessertId = "cookie" | "donut" | "cupcake" | "tart";
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
  private empty(x: number, y: number) {
    return !inside(x, y) || this.g[at(x, y)]! < 0;
  }
  /** Every cube with an empty neighbour becomes the outline; then every region gets its light and dark edges. */
  finish() {
    const outline = this.k("outline");
    const edge: number[] = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (
          this.g[at(x, y)]! >= 0 &&
          (this.empty(x - 1, y) ||
            this.empty(x + 1, y) ||
            this.empty(x, y - 1) ||
            this.empty(x, y + 1))
        )
          edge.push(at(x, y));
    for (const i of edge) this.g[i] = outline;
    // The light edge follows the silhouette only (the outline or the outside); the dark edge also marks where a
    // region sits on one painted before it, which reads as a soft shadow.
    const outOnly = (x: number, y: number) =>
      !inside(x, y) || this.g[at(x, y)]! < 0 || this.g[at(x, y)] === outline;
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
        if (id === 0 || this.g[i] === outline) continue;
        const r = this.regions[id - 1]!;
        if (this.g[i] !== this.k(r.base)) continue;
        const lit = outOnly(x - 1, y) || outOnly(x, y - 1);
        const shade = lowerOrOut(id, x + 1, y) || lowerOrOut(id, x, y + 1);
        if (lit && !shade && r.light) next[i] = this.k(r.light);
        else if (shade && !lit && r.dark) next[i] = this.k(r.dark);
      }
    this.g.set(next);
  }
  /** Sets one cube of a named colour, only on a cube that is already there and not the outline. */
  dot(x: number, y: number, name: RunColorKey) {
    if (inside(x, y) && this.g[at(x, y)]! >= 0 && this.g[at(x, y)] !== this.k("outline"))
      this.g[at(x, y)] = this.k(name);
  }
  blob(cells: ReadonlyArray<readonly [number, number]>, name: RunColorKey) {
    for (const [x, y] of cells) this.dot(x, y, name);
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
  const p = new Painter(["outline", "cream", "gold", "goldDark", "chip", "chipLight"]);
  const bite = disc(22.4, 6.2, 3.7);
  const edge = wavy(
    CX,
    CY + 0.2,
    (a) => 12.2 + 0.3 * Math.sin(5 * a + 0.6) + 0.2 * Math.sin(9 * a + 1.4),
  );
  p.paint({
    has: (x, y) => edge(x, y) && !bite(x, y),
    base: "gold",
    light: "cream",
    dark: "goldDark",
  });
  p.finish();
  // chocolate chips: little blocks with a lighter top-left cube, placed by hand
  const chips: Array<[number, number, number, number]> = [
    [7, 8, 3, 2], [13, 5, 2, 2], [17, 10, 3, 2], [9, 13, 2, 3], [15, 14, 3, 2], [5, 17, 3, 2],
    [20, 15, 2, 3], [11, 19, 3, 2], [17, 20, 2, 2], [7, 21, 2, 2], [13, 9, 2, 2], [22, 20, 2, 2],
  ]; // prettier-ignore
  for (const [x, y, w, h] of chips)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) p.dot(x + i, y + j, i === 0 && j === 0 ? "chipLight" : "chip");
  return p.g;
}

function buildDonut(): Int8Array {
  const p = new Painter(["outline", "cream", "dough", "doughDark", "pink", "pinkDark", "blue"]);
  const outer = wavy(CX, CY, (a) => 12.7 + 0.25 * Math.sin(4 * a + 0.5));
  const hole = disc(CX, CY, 4.5);
  p.paint({
    has: (x, y) => outer(x, y) && !hole(x, y),
    base: "dough",
    light: "cream",
    dark: "doughDark",
  });
  // the icing: a smooth wave round the ring, leaving a thin dough rim at the hole and at the edge
  const icing = wavy(
    CX,
    CY,
    (a) => 10.3 + 1.0 * Math.sin(3 * a + 0.7) + 0.5 * Math.sin(6 * a + 2.2),
  );
  p.paint({
    has: (x, y) => icing(x, y) && !disc(CX, CY, 5.7)(x, y),
    base: "pink",
    light: "cream",
    dark: "pinkDark",
  });
  p.finish();
  // sprinkles and a gloss, placed by hand on the icing
  const sprinkles: Array<[number, number, RunColorKey]> = [
    [8, 9, "blue"], [12, 6, "cream"], [18, 7, "blue"], [21, 11, "cream"], [22, 16, "blue"],
    [19, 21, "cream"], [14, 22, "blue"], [9, 20, "cream"], [6, 14, "blue"], [16, 9, "cream"],
    [10, 17, "cream"], [20, 18, "blue"],
  ]; // prettier-ignore
  for (const [x, y, c] of sprinkles) p.dot(x, y, c);
  p.blob(
    [
      [8, 11],
      [8, 12],
      [9, 9],
      [10, 8],
    ],
    "cream",
  );
  return p.g;
}

function buildCupcake(): Int8Array {
  const p = new Painter(["outline", "cream", "pink", "pinkDark", "blue", "red", "redDark"]);
  // the paper cup: a trapezoid with wide stripes
  p.paint({
    has: (x, y) => {
      if (y < 18 || y > 25) return false;
      return Math.abs(x + 0.5 - CX) <= 9.4 - (y - 18) * 0.55;
    },
    base: "blue",
  });
  // the frosting: three tiers, each lit from the top left
  const tier = (cy: number, rx: number, ry: number): Region => ({
    has: ellipse(CX, cy, rx, ry),
    base: "pink",
    light: "cream",
    dark: "pinkDark",
  });
  p.paint(tier(15.2, 10.4, 3.9));
  p.paint(tier(11.8, 7.6, 3.6));
  p.paint(tier(8.6, 5.2, 3.2));
  p.paint({ has: disc(CX, 5.9, 3.2), base: "red", light: "cream", dark: "redDark" });
  p.finish();
  // stripes on the cup (after the outline, so the edge stays dark)
  for (let y = 18; y <= 25; y++)
    for (let x = 0; x < GRID; x++)
      if (
        p.rid[at(x, y)] === 1 &&
        p.g[at(x, y)] === p.k("blue") &&
        Math.floor((x - 4) / 2) % 2 === 0
      )
        p.g[at(x, y)] = p.k("cream");
  const sprinkles: Array<[number, number, RunColorKey]> = [
    [8, 15, "blue"], [12, 16, "cream"], [17, 15, "blue"], [20, 16, "cream"], [10, 12, "cream"],
    [17, 12, "blue"], [13, 9, "blue"], [15, 13, "cream"], [11, 13, "blue"],
  ]; // prettier-ignore
  for (const [x, y, c] of sprinkles) p.dot(x, y, c);
  return p.g;
}

function buildTart(): Int8Array {
  const p = new Painter([
    "outline",
    "cream",
    "crust",
    "crustDark",
    "yellow",
    "red",
    "redDark",
    "green",
    "blue",
  ]);
  const crust = wavy(CX, CY, (a) => 12.5 + 0.3 * Math.sin(20 * a));
  p.paint({ has: crust, base: "crust", light: "cream", dark: "crustDark" });
  p.paint({ has: disc(CX, CY, 10.2), base: "yellow", light: "cream", dark: "crustDark" });
  const berries: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    const bx = CX + 7.2 * Math.cos(a);
    const by = CY + 7.2 * Math.sin(a);
    berries.push([bx, by]);
    p.paint({ has: disc(bx, by, 2.8), base: "red", light: "cream", dark: "redDark" });
  }
  // a blueberry cluster in the middle
  p.paint({ has: disc(CX, CY, 2.6), base: "blue", light: "cream", dark: "blue" });
  p.finish();
  // each strawberry gets a green leaf cap and a glint
  for (const [bx, by] of berries) {
    const top = Math.round(by - 2.3);
    for (const dx of [-1, 0, 1]) p.dot(Math.floor(bx) + dx, top, "green");
    p.dot(Math.floor(bx), top + 1, "green");
    p.dot(Math.floor(bx) - 1, top + 2, "cream");
  }
  return p.g;
}

export const DESSERTS: Record<DessertId, Dessert> = {
  cookie: {
    id: "cookie",
    name: "Chocolate Chip Cookie",
    short: "Cookie",
    tier: 1,
    keys: ["outline", "cream", "gold", "goldDark", "chip", "chipLight"],
    build: buildCookie,
  },
  donut: {
    id: "donut",
    name: "Pink Glazed Donut",
    short: "Donut",
    tier: 1,
    keys: ["outline", "cream", "dough", "doughDark", "pink", "pinkDark", "blue"],
    build: buildDonut,
  },
  cupcake: {
    id: "cupcake",
    name: "Cherry Cupcake",
    short: "Cupcake",
    tier: 2,
    keys: ["outline", "cream", "pink", "pinkDark", "blue", "red", "redDark"],
    build: buildCupcake,
  },
  tart: {
    id: "tart",
    name: "Strawberry Tart",
    short: "Tart",
    tier: 3,
    keys: ["outline", "cream", "crust", "crustDark", "yellow", "red", "redDark", "green", "blue"],
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
