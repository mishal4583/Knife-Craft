/**
 * Dessert Run's gallery (developer 2026-11-16 / 17): mosaic pictures on a 28 x 28 grid of cubes, fixed by tier.
 *
 * TWO things per cube, kept apart on purpose:
 *  - its GROUP (what a waiter fetches): 5 to 9 per dessert, so the game stays readable;
 *  - its TONE (what is drawn): a group can hold several tones of one hue (the cookie's four golds, the sky's three
 *    blues), so the picture can be as rich as the developer's reference: smooth light-to-dark shading, a pale
 *    highlight, a warm outline, a blue gradient sky with white clouds, chips with a lit facet.
 *
 * `build()` returns the group of every cell (-1 = no cube); `tones()` the tone index inside that group.
 * The whole plate disc is filled: a gradient board, the dessert on it with an outline one cube thick. The board
 * and the outline are layers a waiter has to peel before the dessert inside can be reached.
 */
export const GRID = 28;

/** Every tone the pictures use. Names run light to dark inside a hue. */
export const RUN_PALETTE = {
  outline: "#3B1E0E",
  cream: "#FFF3CF",
  pale: "#D9F2FF",
  yellow: "#FFD34D",
  gold: "#FFB72E",
  orange: "#F59A22",
  orangeDark: "#E07E17",
  chipLight: "#7E4A28",
  chip: "#5E3218",
  sky1: "#8EE3FF",
  sky2: "#41C4F7",
  sky3: "#1E8EEA",
  dough1: "#FFD98A",
  dough: "#F7BC5B",
  doughDark: "#DB9440",
  pinkLight: "#FFB6CF",
  pink: "#FF7DAA",
  pinkDark: "#E64C80",
  blue: "#3C8DF2",
  blueDark: "#2A62C9",
  mint1: "#9DF0D8",
  mint2: "#5ADDBB",
  mint3: "#2FBE9C",
  redLight: "#FF7B6E",
  red: "#F4483F",
  redDark: "#C72B3A",
  butter1: "#FFF0A8",
  butter2: "#FFDF6B",
  butter3: "#FFC63C",
  coneLight: "#FFD470",
  cone: "#F2A93B",
  coneDark: "#D9822B",
  lilac1: "#E0D4FF",
  lilac2: "#B79EF8",
  lilac3: "#8F77E6",
  leaf: "#6CCB45",
  leafDark: "#3E9A33",
  syrupLight: "#D8581C",
  syrup: "#A8341A",
  syrupDark: "#6E1F12",
} as const;
export type RunColorKey = keyof typeof RUN_PALETTE;

export type DessertId =
  "cookie" | "donut" | "cupcake" | "cone" | "macaron" | "pancakes" | "cakeslice" | "lollipop";
export type DessertTier = 1 | 2 | 3 | 4 | 5 | 6;
export type Dessert = {
  id: DessertId;
  name: string;
  short: string;
  tier: DessertTier;
  /** One colour per group, by group index: the colour of the waiters that fetch it. Group 0 is the outline. */
  keys: readonly RunColorKey[];
  /** The tones of each group, light to dark; a cube's tone is an index into its group's list. */
  toneNames: readonly (readonly RunColorKey[])[];
  /** The group of every cell, -1 = no cube. A fresh array each call (the game takes cubes out of it). */
  build: () => Int8Array;
  /** The tone of every cell inside its group. Shared: never change it. */
  tones: () => Uint8Array;
};

/* ---------- a small painter ---------- */

const CX = GRID / 2;
const CY = GRID / 2;
/**
 * The board fills the plate's well. The screen clips the cubes to that circle (`WELL_R` in dessertRun.ts = `WELL_CELLS` cubes), so a cube that only
 * touches the circle shows as a cut piece, like the reference. The board holds exactly the cubes whose square meets the circle: none is missing (no bare
 * plate at the rim) and none is hidden outside it. `dessert-run-qa` checks both.
 */
export const WELL_CELLS = 175 / 13.5;
/** Where the lit-to-deep gradient of the board ends (the old disc's radius); only the look of the board uses it. */
const GRADIENT_R = 12.6;
const inWell = (x: number, y: number) =>
  Math.hypot(
    Math.max(Math.abs(x + 0.5 - GRID / 2) - 0.5, 0),
    Math.max(Math.abs(y + 0.5 - GRID / 2) - 0.5, 0),
  ) < WELL_CELLS;
const at = (x: number, y: number) => y * GRID + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID;

type GroupDef = { tones: readonly RunColorKey[]; rep?: RunColorKey };

class Painter {
  /** Every tone name in order, and where each sits (group, index inside the group). */
  readonly flat: RunColorKey[] = [];
  private readonly groupOf: number[] = [];
  private readonly indexIn: number[] = [];
  readonly keys: RunColorKey[] = [];
  readonly toneNames: RunColorKey[][] = [];
  /** The tone (flat id) of every cell, -1 = none. */
  readonly t = new Int16Array(GRID * GRID).fill(-1);
  readonly subject = new Uint8Array(GRID * GRID);
  constructor(groups: readonly GroupDef[]) {
    groups.forEach((def, gi) => {
      this.keys.push(def.rep ?? def.tones[0]!);
      this.toneNames.push([...def.tones]);
      def.tones.forEach((name, ti) => {
        this.flat.push(name);
        this.groupOf.push(gi);
        this.indexIn.push(ti);
      });
    });
  }
  f(name: RunColorKey): number {
    const i = this.flat.indexOf(name);
    if (i < 0) throw new Error(`tone ${name} is not in this dessert`);
    return i;
  }
  has(x: number, y: number) {
    return inside(x, y) && this.t[at(x, y)]! >= 0;
  }
  /** Paints every cell the region holds, with the tone it picks for that cell. */
  paint(
    has: (x: number, y: number) => boolean,
    tone: (x: number, y: number) => RunColorKey,
    subject = false,
  ) {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (has(x, y)) {
          this.t[at(x, y)] = this.f(tone(x, y));
          this.subject[at(x, y)] = subject ? 1 : 0;
        }
  }
  /** The board: a gradient from light (top left) to deep (bottom right) in three bands with a soft wobble. */
  board(tones: readonly [RunColorKey, RunColorKey, RunColorKey], phase = 0) {
    this.paint(inWell, (x, y) => {
      const t =
        ((x + 0.5 - CX) * 0.5 + (y + 0.5 - CY) * 0.86) / GRADIENT_R +
        0.13 * Math.sin(0.55 * x + 0.35 * y + phase);
      return t < -0.2 ? tones[0] : t < 0.4 ? tones[1] : tones[2];
    });
  }
  /** A soft white cloud (cream on top, pale below) on the board, cut off flat at the bottom. */
  cloud(cx: number, cy: number, s: number) {
    const parts: Array<[number, number, number]> = [
      [cx - 1.9 * s, cy + 0.7 * s, 1.5 * s],
      [cx - 0.3 * s, cy - 0.2 * s, 2.1 * s],
      [cx + 1.7 * s, cy + 0.5 * s, 1.6 * s],
    ];
    const board = inWell;
    this.paint(
      (x, y) =>
        board(x, y) &&
        y + 0.5 < cy + 2.1 * s &&
        parts.some(([px, py, r]) => Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r),
      (_x, y) => (y + 0.5 < cy + 1.2 * s ? "cream" : "pale"),
    );
  }
  /** Every cube of the dessert that touches the board or the outside becomes the outline. */
  outline() {
    const o = this.f("outline");
    const sub = (x: number, y: number) =>
      inside(x, y) && this.subject[at(x, y)] === 1 && this.t[at(x, y)]! >= 0;
    const edge: number[] = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (sub(x, y) && (!sub(x - 1, y) || !sub(x + 1, y) || !sub(x, y - 1) || !sub(x, y + 1)))
          edge.push(at(x, y));
    for (const i of edge) this.t[i] = o;
    // Close the outline: two outline cubes that only touch at a corner get a joining cube (on the dessert's side),
    // so the outline is one unbroken run of cubes, like the reference, with no diagonal break.
    const isO = (x: number, y: number) => inside(x, y) && this.t[at(x, y)] === o;
    const join: number[] = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (!isO(x, y)) continue;
        for (const [dx, dy] of [
          [1, 1],
          [-1, 1],
        ] as const) {
          if (!isO(x + dx, y + dy) || isO(x + dx, y) || isO(x, y + dy)) continue;
          const a: [number, number] = [x + dx, y];
          const b: [number, number] = [x, y + dy];
          const pick = sub(a[0], a[1]) ? a : sub(b[0], b[1]) ? b : null;
          if (pick) join.push(at(pick[0], pick[1]));
        }
      }
    for (const i of join) this.t[i] = o;
  }
  /** Outline cubes around a region (its own edge, whatever else is painted there), for a picture made of several things stacked. */
  rim(has: (x: number, y: number) => boolean) {
    const o = this.f("outline");
    const edge: number[] = [];
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (has(x, y) && (!has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1)))
          edge.push(at(x, y));
    for (const i of edge) {
      this.t[i] = o;
      this.subject[i] = 1;
    }
  }
  private plain(x: number, y: number) {
    return inside(x, y) && this.t[at(x, y)]! >= 0 && this.t[at(x, y)] !== this.f("outline");
  }
  /** A run of 2 or more cubes of one tone, on cubes that are there (never a lone cube). */
  bar(x: number, y: number, len: number, vertical: boolean, name: RunColorKey) {
    for (let i = 0; i < len; i++)
      if (!this.plain(x + (vertical ? 0 : i), y + (vertical ? i : 0))) return;
    for (let i = 0; i < len; i++)
      this.t[at(x + (vertical ? 0 : i), y + (vertical ? i : 0))] = this.f(name);
  }
  /** A chunk: a block of cubes with a lit top row and left column; cells that are not free are skipped. */
  chip(x: number, y: number, w: number, h: number, light: RunColorKey, dark: RunColorKey) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (this.plain(x + i, y + j))
          this.t[at(x + i, y + j)] = this.f(i === 0 || j === 0 ? light : dark);
  }
  result(): { group: Int8Array; tone: Uint8Array } {
    const group = new Int8Array(GRID * GRID).fill(-1);
    const tone = new Uint8Array(GRID * GRID);
    for (let i = 0; i < this.t.length; i++) {
      const f = this.t[i]!;
      // a cube the plate's round well does not show is not a cube (a plate or a berry may stick out past the rim)
      if (f < 0 || !inWell(i % GRID, Math.floor(i / GRID))) continue;
      group[i] = this.groupOf[f]!;
      tone[i] = this.indexIn[f]!;
    }
    return { group, tone };
  }
}

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const wavy = (cx: number, cy: number, radius: (a: number) => number) => (x: number, y: number) => {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return Math.hypot(dx, dy) <= radius(Math.atan2(dy, dx));
};
/** Light from the top left: how bright a surface with this normal is. */
const light = (nx: number, ny: number, nz: number) => -0.42 * nx - 0.55 * ny + 0.72 * nz;
/** The brightness of a round bump at a cell, or null outside it. */
function dome(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number | null {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  const d2 = dx * dx + dy * dy;
  if (d2 > 1) return null;
  return light(dx * 0.9, dy * 0.9, Math.sqrt(Math.max(0, 1 - d2 * 0.8)));
}
const pick = <T>(v: number, names: readonly [T, T, T], hi: number, lo: number): T =>
  v > hi ? names[0] : v > lo ? names[1] : names[2];

/* ---------- the desserts ---------- */

const GROUPS_COOKIE: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["yellow", "gold", "orange", "orangeDark"], rep: "gold" },
  { tones: ["chipLight", "chip"], rep: "chip" },
  { tones: ["sky1", "sky2", "sky3"], rep: "sky2" },
];

function paintCookie(): Painter {
  const p = new Painter(GROUPS_COOKIE);
  p.board(["sky1", "sky2", "sky3"]);
  p.cloud(6.2, 21.4, 1.2);
  p.cloud(21.8, 22.4, 1.25);
  // A big round cookie with a bite out of the top right, a lit upper left, a crisp darker edge, chunky chips and a few crumbs.
  const R = 10.6;
  const cy = 14.4;
  const bite = disc(20.9, 7.6, 2.7);
  const body = wavy(CX, cy, (a) => R + 0.28 * Math.sin(5 * a + 0.6));
  p.paint(
    (x, y) => body(x, y) && !bite(x, y),
    (x, y) => {
      const dx = (x + 0.5 - CX) / R;
      const dy = (y + 0.5 - cy) / R;
      const d2 = Math.min(1, dx * dx + dy * dy);
      const v =
        light(dx * 0.9, dy * 0.9, Math.sqrt(1 - d2 * 0.8)) + 0.05 * Math.sin(x * 0.9 + y * 0.5);
      if (v > 1.0 && d2 > 0.5) return "cream";
      return v > 0.7 ? "yellow" : v > 0.46 ? "gold" : v > 0.16 ? "orange" : "orangeDark";
    },
    true,
  );
  p.outline();
  // chocolate chips: a chunk with a lit top and left, well inside the cookie
  for (const [x, y, w, h] of [
    [9, 8, 3, 3],
    [14, 6, 3, 2],
    [12, 11, 3, 3],
    [17, 12, 3, 3],
    [7, 14, 3, 2],
    [21, 15, 2, 3],
    [10, 17, 3, 3],
    [15, 18, 3, 3],
    [19, 19, 3, 2],
    [12, 22, 3, 2],
  ] as const)
    // prettier-ignore
    p.chip(x, y, w, h, "chipLight", "chip");
  // pale crumbs on the board, beside the cookie
  for (const [x, y] of [
    [24, 21],
    [2, 10],
  ] as const)
    p.bar(x, y, 2, false, "pale");
  return p;
}
/** True when a cell holds the outline tone. */
const wasOutline = (p: Painter, x: number, y: number) => p.t[at(x, y)] === p.f("outline");

const GROUPS_DONUT: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["dough1", "dough", "doughDark"], rep: "dough" },
  { tones: ["pinkLight", "pink", "pinkDark"], rep: "pink" },
  { tones: ["blue"] },
  { tones: ["mint1", "mint2", "mint3"], rep: "mint2" },
];

function paintDonut(): Painter {
  const p = new Painter(GROUPS_DONUT);
  p.board(["mint1", "mint2", "mint3"], 1.7);
  p.cloud(6.2, 21.6, 1.2);
  p.cloud(21.8, 22.2, 1.25);
  // A big donut: a puffy ring of dough, pink icing with a wavy drip edge, a small hole, and a spread of sprinkles.
  const cy = 14.2;
  const Rin = 3.4;
  const outer = wavy(CX, cy, (a) => 11.1 + 0.12 * Math.sin(4 * a + 0.5));
  const ring = (
    x: number,
    y: number,
    r0: number,
    r1: number,
    names: readonly [RunColorKey, RunColorKey, RunColorKey],
  ) => {
    const dx = x + 0.5 - CX;
    const dy = y + 0.5 - cy;
    const r = Math.hypot(dx, dy);
    const phi = Math.min(1, Math.max(0, (r - r0) / (r1 - r0))) * Math.PI;
    const v = light((-Math.cos(phi) * dx) / r, (-Math.cos(phi) * dy) / r, Math.sin(phi));
    return pick(v, names, 0.6, 0.22);
  };
  p.paint(
    (x, y) => outer(x, y) && !disc(CX, cy, Rin)(x, y),
    (x, y) => ring(x, y, Rin, 11.1, ["dough1", "dough", "doughDark"]),
    true,
  );
  const icing = wavy(
    CX,
    cy,
    (a) => 9.2 + 0.9 * Math.sin(3 * a + 0.7) + 0.5 * Math.sin(7 * a + 2.2),
  );
  p.paint(
    (x, y) => icing(x, y) && !disc(CX, cy, 4.5)(x, y),
    (x, y) => ring(x, y, 4.5, 9.6, ["pinkLight", "pink", "pinkDark"]),
    true,
  );
  p.outline();
  // sprinkles: runs of two cubes on the icing, in three colours
  for (const [x, y, v, c] of [
    [8, 7, 0, "blue"],
    [13, 5, 1, "cream"],
    [18, 6, 0, "blue"],
    [21, 9, 1, "cream"],
    [6, 12, 1, "blue"],
    [22, 14, 0, "cream"],
    [7, 17, 0, "cream"],
    [21, 19, 1, "blue"],
    [10, 21, 1, "blue"],
    [17, 22, 0, "cream"],
    [13, 9, 0, "cream"],
    [16, 8, 1, "blue"],
    [9, 11, 1, "cream"],
    [19, 12, 0, "blue"],
    [10, 19, 0, "cream"],
    [18, 19, 1, "cream"],
  ] as const)
    // prettier-ignore
    p.bar(x, y, 2, v === 1, c);
  return p;
}

const GROUPS_CUPCAKE: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream"] },
  { tones: ["pinkLight", "pink", "pinkDark"], rep: "pink" },
  { tones: ["blue", "blueDark"], rep: "blue" },
  { tones: ["redLight", "red", "redDark"], rep: "red" },
  { tones: ["butter1", "butter2", "butter3"], rep: "butter2" },
  { tones: ["leaf", "leafDark"], rep: "leaf" },
];

function paintCupcake(): Painter {
  const p = new Painter(GROUPS_CUPCAKE);
  p.board(["butter1", "butter2", "butter3"], 0.6);
  // The silhouette, row by row: how many cubes each side of the middle line (a cherry, three frosting swirls that step outward, a cup).
  // prettier-ignore
  const half: Record<number, number> = {
    5: 2, 6: 3, 7: 4, 8: 4, 9: 3,
    10: 5, 11: 5, 12: 6,
    13: 7, 14: 8, 15: 8, 16: 9,
    17: 10, 18: 10, 19: 11, 20: 11,
    21: 9, 22: 9, 23: 8, 24: 7, 25: 6,
  };
  const body = (x: number, y: number) => Math.abs(x + 0.5 - CX) < (half[y] ?? 0);
  // the paper cup: a dark rim, then wide blue and cream stripes (centred, two cubes wide)
  p.paint(
    (x, y) => y >= 21 && body(x, y),
    (x, y) =>
      y === 21 || y === 25
        ? "blueDark"
        : Math.floor((Math.abs(x + 0.5 - CX) + 1) / 2) % 2 === 0
          ? "cream"
          : "blue",
    true,
  );
  // three frosting swirls, each a lit dome; a cream ribbon runs along the lower row of each
  const tier = (rows: readonly [number, number], cy: number, rx: number, ry: number) =>
    p.paint(
      (x, y) => y >= rows[0] && y <= rows[1] && body(x, y),
      (x, y) => {
        const dx = x + 0.5 - CX;
        const w = half[y] ?? 0;
        // the ribbon: the whole lower row, and a swirl that climbs the left side
        if (y === rows[1] && Math.abs(dx) < w - 1.5) return "cream";
        if (y === rows[1] - 1 && dx < -2 && dx > -(w - 2.5)) return "cream";
        if (y === rows[1] - 1 && dx > 2.5) return "pinkDark";
        const v = dome(x, y, CX, cy, rx, ry) ?? light(0, 0.5, 0.4);
        return pick(v, ["pinkLight", "pink", "pinkDark"], 0.8, 0.42);
      },
      true,
    );
  tier([17, 20], 18.6, 11.5, 3.4);
  tier([13, 16], 14.6, 9.5, 3.2);
  tier([10, 12], 11.4, 6.5, 2.6);
  // the cherry
  p.paint(
    (x, y) => y <= 9 && body(x, y),
    (x, y) => {
      const v = dome(x, y, CX, 7.2, 4.0, 2.9) ?? 0;
      return v > 0.6 ? "redLight" : v > 0.3 ? "red" : "redDark";
    },
    true,
  );
  p.outline();
  // sprinkles: runs of two cubes that lie on the frosting
  for (const [x, y, c] of [
    [11, 11, "butter3"],
    [15, 10, "blue"],
    [9, 14, "blue"],
    [13, 14, "butter3"],
    [17, 15, "butter3"],
    [7, 18, "butter3"],
    [11, 17, "blue"],
    [16, 18, "blue"],
    [19, 19, "butter3"],
    [9, 19, "blue"],
  ] as const)
    // prettier-ignore
    p.bar(x, y, 2, false, c);
  // the stem and the leaf, drawn cube by cube (thin, so not outlined)
  const cube = (cells: ReadonlyArray<readonly [number, number]>, name: RunColorKey) =>
    p.paint(
      (x, y) => cells.some(([cx, cy]) => cx === x && cy === y),
      () => name,
    );
  cube(
    [
      [14, 4],
      [15, 3],
      [16, 3],
    ],
    "outline",
  );
  cube(
    [
      [18, 2],
      [19, 2],
      [17, 3],
      [18, 3],
      [19, 3],
      [20, 3],
      [18, 4],
      [19, 4],
    ],
    "leaf",
  );
  cube(
    [
      [19, 3],
      [20, 3],
      [19, 4],
    ],
    "leafDark",
  );
  return p;
}

const GROUPS_CONE: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["coneLight", "cone", "coneDark"], rep: "cone" },
  { tones: ["pinkLight", "pink", "pinkDark"], rep: "pink" },
  { tones: ["red"] },
  { tones: ["lilac1", "lilac2", "lilac3"], rep: "lilac2" },
];

function paintCone(): Painter {
  const p = new Painter(GROUPS_CONE);
  p.board(["lilac1", "lilac2", "lilac3"], 2.4);
  p.cloud(6.2, 21.6, 1.1);
  p.cloud(21.8, 22.4, 1.15);
  // A big waffle cone, point down, with a grid of darker bars, topped by a lit scoop of strawberry with a ruffled skirt and a cherry.
  p.paint(
    (x, y) => y >= 15 && y <= 26 && Math.abs(x + 0.5 - CX) <= (8.2 * (26.4 - y)) / 11.4 + 0.5,
    (x, y) => {
      const lit = (x + 0.5 - CX) / 8;
      const base: RunColorKey = lit < -0.3 ? "coneLight" : lit < 0.35 ? "cone" : "coneDark";
      return ((x - y + 40) >> 1) % 2 === 0 ? (base === "coneLight" ? "cone" : "coneDark") : base;
    },
    true,
  );
  const scoop = disc(CX, 11.0, 6.7);
  const skirt = ellipse(CX, 15.4, 8.6, 2.3);
  p.paint(
    (x, y) => scoop(x, y) || skirt(x, y),
    (x, y) => {
      const v = Math.max(
        dome(x, y, CX, 11.0, 6.7, 6.7) ?? -9,
        (dome(x, y, CX, 15.4, 8.6, 2.3) ?? -9) - 0.12,
      );
      return pick(v, ["pinkLight", "pink", "pinkDark"], 0.58, 0.24);
    },
    true,
  );
  // the cherry on top
  p.paint(
    (x, y) => ellipse(CX, 4.4, 3.2, 3.0)(x, y),
    (x, y) => {
      const v = dome(x, y, CX, 4.4, 3.2, 3.0) ?? 0;
      return v > 0.82 ? "cream" : "red";
    },
    true,
  );
  p.outline();
  // sprinkles on the scoop and the skirt
  for (const [x, y, v, c] of [
    [10, 9, 0, "cream"],
    [16, 9, 1, "red"],
    [12, 11, 0, "red"],
    [18, 12, 0, "cream"],
    [8, 13, 1, "red"],
    [14, 14, 0, "cream"],
    [11, 16, 0, "red"],
    [17, 16, 0, "cream"],
    [20, 14, 1, "red"],
  ] as const)
    // prettier-ignore
    p.bar(x, y, 2, v === 1, c);
  return p;
}

/* ---------- the second gallery (developer 2026-11-19: "levels easy to hard, and make the mosaic beautiful": eight pictures instead of four) ---------- */

const GROUPS_MACARON: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["pinkLight", "pink", "pinkDark"], rep: "pink" },
  { tones: ["mint1", "mint2", "mint3"], rep: "mint2" },
  { tones: ["lilac1", "lilac2", "lilac3"], rep: "lilac2" },
];

/** Three macarons stacked, lilac at the bottom, mint in the middle, pink on top: a domed shell, a scalloped cream, a ruffled foot. */
function paintMacaron(): Painter {
  const p = new Painter(GROUPS_MACARON);
  p.board(["mint1", "mint2", "mint3"], 0.9);
  // One macaron is 11 rows: a domed shell (4), the cream (3) and a footed shell (4).
  const macaron = (
    y0: number,
    hw: number,
    tones: readonly [RunColorKey, RunColorKey, RunColorKey],
  ) => {
    const half = [-4.2, -2, -0.8, 0, -1.7, -2.3, -1.7, 0, -0.3, -1.1, -2.6].map((d) => hw + d);
    const has = (x: number, y: number) => {
      const w = half[y - y0];
      return w !== undefined && Math.abs(x + 0.5 - CX) < w;
    };
    p.paint(
      has,
      (x, y) => {
        const r = y - y0;
        const dx = x + 0.5 - CX;
        if (r <= 3) {
          const v = dome(x, y, CX, y0 + 4.4, hw, 4.6) ?? 0.2;
          return v > 0.8 ? tones[0] : v > 0.36 ? tones[1] : tones[2];
        }
        if (r <= 6) return r === 5 && Math.floor(dx + 40) % 3 === 0 ? "pale" : "cream";
        const v = dome(x, y, CX, y0 + 6.4, hw, 4.6) ?? 0.2;
        return r === 10 ? tones[2] : v > 0.62 ? tones[0] : v > 0.2 ? tones[1] : tones[2];
      },
      true,
    );
    p.rim(has);
  };
  macaron(13, 10.4, ["lilac1", "lilac2", "lilac3"]);
  macaron(3, 10.0, ["pinkLight", "pink", "pinkDark"]);
  // a little sparkle on each shell
  for (const [x, y] of [
    [9, 5],
    [10, 6],
    [10, 15],
    [11, 16],
  ] as const)
    p.bar(x, y, 2, false, "cream");
  p.bar(3, 22, 2, false, "pale");
  p.bar(23, 3, 2, true, "pale");
  return p;
}

const GROUPS_PANCAKES: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["dough1", "dough", "doughDark"], rep: "dough" },
  { tones: ["syrupLight", "syrup", "syrupDark"], rep: "syrup" },
  { tones: ["butter1", "butter2", "butter3"], rep: "butter2" },
  { tones: ["blue", "blueDark"], rep: "blue" },
  { tones: ["sky1", "sky2", "sky3"], rep: "sky2" },
];

/** A stack of three golden pancakes on a plate, a pat of butter, syrup running down the side, and blueberries. */
function paintPancakes(): Painter {
  const p = new Painter(GROUPS_PANCAKES);
  p.board(["sky1", "sky2", "sky3"], 0.4);
  p.cloud(5.4, 21.4, 1.1);
  p.cloud(22.4, 22.6, 1.1);
  const slab = (cy: number, rx: number) => (x: number, y: number) =>
    ellipse(CX, cy, rx, 2.7)(x, y) ||
    ellipse(CX, cy + 2.4, rx, 2.7)(x, y) ||
    (y >= cy && y <= cy + 2.4 && Math.abs(x + 0.5 - CX) < rx);
  const plate = ellipse(CX, 23.2, 12.2, 2.8);
  p.paint(plate, (_x, y) => (y < 22.4 ? "cream" : "pale"), true);
  p.rim(plate);
  for (const [cy, rx] of [
    [18.3, 10.2],
    [14.6, 9.6],
    [10.9, 9.0],
  ] as const) {
    const has = slab(cy, rx);
    p.paint(
      has,
      (x, y) => {
        const top = y < cy + 1.0;
        const edge = Math.abs(x + 0.5 - CX) > rx - 1.4;
        if (top) return edge ? "dough" : (x + y) % 5 === 0 ? "dough" : "dough1";
        return y > cy + 3.2 ? "doughDark" : edge ? "doughDark" : "dough";
      },
      true,
    );
    p.rim(has);
  }
  const cap = ellipse(CX, 10.2, 7.4, 2.3);
  p.paint(cap, (_x, y) => (y < 9.6 ? "syrupLight" : "syrup"), true);
  for (const [x, len] of [
    [7, 3],
    [10, 5],
    [14, 3],
    [17, 6],
    [20, 4],
  ] as const)
    for (let j = 0; j < len; j++)
      p.paint(
        (cx, cy) => cy === 11 + j && (cx === x || cx === x + 1) && p.has(cx, cy),
        () => (j === len - 1 ? "syrupDark" : "syrup"),
        true,
      );
  const pat = (x: number, y: number) => x >= 12 && x <= 16 && y >= 6 && y <= 9;
  p.paint(pat, (_x, y) => (y === 6 ? "butter1" : y === 9 ? "butter3" : "butter2"), true);
  p.rim(pat);
  for (const [x, y] of [
    [3, 21],
    [23, 20],
    [6, 23],
  ] as const)
    p.paint(
      (cx, cy) => cx >= x && cx <= x + 1 && cy >= y && cy <= y + 1,
      (cx, cy) => (cx === x && cy === y ? "blue" : "blueDark"),
      true,
    );
  return p;
}

const GROUPS_CAKESLICE: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["chipLight", "chip"], rep: "chip" },
  { tones: ["pinkLight", "pink", "pinkDark"], rep: "pink" },
  { tones: ["redLight", "red", "redDark"], rep: "red" },
  { tones: ["leaf", "leafDark"], rep: "leaf" },
  { tones: ["lilac1", "lilac2", "lilac3"], rep: "lilac2" },
];

/** A slice of three-layer chocolate cake with pink cream between the layers, a swirl of cream on top, and a strawberry. */
function paintCakeSlice(): Painter {
  const p = new Painter(GROUPS_CAKESLICE);
  p.board(["lilac1", "lilac2", "lilac3"], 1.2);
  p.cloud(5.4, 21.6, 1.1);
  p.cloud(22.6, 22.6, 1.1);
  const plate = ellipse(CX, 22.4, 11.8, 2.3);
  p.paint(plate, (_x, y) => (y < 22.4 ? "cream" : "pale"), true);
  const body = (x: number, y: number) => x >= 6 && x <= 21 && y >= 11 && y <= 21;
  p.paint(
    body,
    (x, y) => {
      if (y === 11) return "pinkLight";
      if (y <= 13) return x <= 7 ? "chipLight" : "chip";
      if (y === 14) return "pinkLight";
      if (y === 15) return "pink";
      if (y <= 18) return x <= 7 ? "chipLight" : "chip";
      if (y === 19) return "pinkLight";
      if (y === 20) return "pink";
      return x <= 7 ? "chipLight" : "chip";
    },
    true,
  );
  p.paint(
    (x, y) =>
      y >= 8 &&
      y <= 10 &&
      x >= 7 &&
      x <= 20 &&
      (y === 10 || Math.abs(x - 13.5) < 3.8 + (y - 8) * 2.6),
    (_x, y) => (y === 8 ? "cream" : y === 9 ? "pinkLight" : "pale"),
    true,
  );
  p.paint(
    ellipse(13.5, 6.2, 3.7, 3.4),
    (x, y) => {
      const v = dome(x, y, 13.5, 6.2, 3.7, 3.4) ?? 0;
      return v > 0.78 ? "redLight" : v > 0.3 ? "red" : "redDark";
    },
    true,
  );
  p.outline();
  p.paint(
    (x, y) => y === 2 && (x === 13 || x === 14),
    () => "leafDark",
  );
  p.paint(
    (x, y) => y === 3 && x >= 11 && x <= 16,
    (x) => (x < 14 ? "leaf" : "leafDark"),
  );
  for (const [x, y] of [
    [9, 12],
    [14, 12],
    [18, 12],
    [11, 17],
    [17, 17],
    [8, 21],
  ] as const)
    p.bar(x, y, 2, false, x < 12 ? "pale" : "cream");
  return p;
}

const GROUPS_LOLLIPOP: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["redLight", "red", "redDark"], rep: "red" },
  { tones: ["butter1", "butter2", "butter3"], rep: "butter2" },
  { tones: ["leaf", "leafDark"], rep: "leaf" },
  { tones: ["blue", "blueDark"], rep: "blue" },
  { tones: ["lilac1", "lilac2", "lilac3"], rep: "lilac2" },
  { tones: ["pinkLight", "pink", "pinkDark"], rep: "pink" },
  { tones: ["mint1", "mint2", "mint3"], rep: "mint2" },
];

/** A big swirl lollipop: a rainbow spiral wound out from the middle, a glossy highlight, a stick and a bow. */
function paintLollipop(): Painter {
  const p = new Painter(GROUPS_LOLLIPOP);
  p.board(["mint1", "mint2", "mint3"], 2.0);
  p.cloud(5.2, 22.0, 1.1);
  p.cloud(22.6, 22.6, 1.1);
  p.paint(
    (x, y) => (x === 13 || x === 14) && y >= 17 && y <= 25,
    (x) => (x === 13 ? "cream" : "pale"),
    true,
  );
  const cy = 11.6;
  const R = 9.5;
  // five colours wound round the middle in one spiral arm each, every colour lit on its upper left and shaded on its lower right
  const sets: ReadonlyArray<readonly [RunColorKey, RunColorKey, RunColorKey]> = [
    ["redLight", "red", "redDark"],
    ["butter1", "butter2", "butter3"],
    ["leaf", "leaf", "leafDark"],
    ["blue", "blue", "blueDark"],
    ["pinkLight", "pink", "pinkDark"],
  ];
  p.paint(
    disc(CX, cy, R),
    (x, y) => {
      const dx = x + 0.5 - CX;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) / (Math.PI * 2);
      const band = Math.floor((((r / 2.1 - a * 5) % 5) + 10) % 5);
      const lit = -0.6 * dx - 0.5 * dy;
      const set = sets[band]!;
      return lit > 6.2 ? set[0] : lit < -6.4 ? set[2] : set[1];
    },
    true,
  );
  p.outline();
  p.bar(7, 6, 2, false, "cream");
  p.bar(6, 8, 2, true, "cream");
  const bow = (x: number, y: number) =>
    y >= 21 && y <= 23 && ((x >= 9 && x <= 12) || (x >= 15 && x <= 18) || x === 13 || x === 14);
  p.paint(bow, (_x, y) => (y === 21 ? "lilac1" : y === 22 ? "lilac2" : "lilac3"), true);
  p.rim(bow);
  return p;
}

/** Each picture is painted once; `build()` hands out fresh group grids, `tones()` the shared tone grid. */
function dessert(
  id: DessertId,
  name: string,
  short: string,
  tier: DessertTier,
  paint: () => Painter,
): Dessert {
  let made: {
    group: Int8Array;
    tone: Uint8Array;
    keys: RunColorKey[];
    toneNames: RunColorKey[][];
  } | null = null;
  const make = () => {
    if (!made) {
      const p = paint();
      made = { ...p.result(), keys: p.keys, toneNames: p.toneNames };
    }
    return made;
  };
  const probe = make();
  return {
    id,
    name,
    short,
    tier,
    keys: probe.keys,
    toneNames: probe.toneNames,
    build: () => make().group.slice(),
    tones: () => make().tone,
  };
}

export const DESSERTS: Record<DessertId, Dessert> = {
  cookie: dessert("cookie", "Chocolate Chip Cookie", "Cookie", 1, paintCookie),
  donut: dessert("donut", "Pink Glazed Donut", "Donut", 1, paintDonut),
  cupcake: dessert("cupcake", "Cherry Cupcake", "Cupcake", 2, paintCupcake),
  cone: dessert("cone", "Strawberry Ice Cream", "Ice cream", 3, paintCone),
  macaron: dessert("macaron", "Macaron Tower", "Macarons", 1, paintMacaron),
  pancakes: dessert("pancakes", "Maple Pancakes", "Pancakes", 2, paintPancakes),
  cakeslice: dessert("cakeslice", "Strawberry Chocolate Cake", "Cake", 3, paintCakeSlice),
  lollipop: dessert("lollipop", "Rainbow Lollipop", "Lollipop", 4, paintLollipop),
};

export const DESSERT_ORDER: readonly DessertId[] = ["cookie", "donut", "cupcake", "cone"];

/** The desserts a tier serves, in rotation. A higher tier may also serve a lower tier's easiest dessert. */
export const DESSERTS_BY_TIER: Record<DessertTier, readonly DessertId[]> = {
  1: ["cookie", "macaron", "donut"],
  2: ["donut", "cupcake", "pancakes"],
  3: ["pancakes", "cone", "cupcake"],
  4: ["cakeslice", "cone", "pancakes"],
  5: ["cakeslice", "lollipop", "macaron"],
  6: ["lollipop", "cakeslice", "macaron"],
};
