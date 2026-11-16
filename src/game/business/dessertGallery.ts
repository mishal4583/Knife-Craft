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
} as const;
export type RunColorKey = keyof typeof RUN_PALETTE;

export type DessertId = "cookie" | "donut" | "cupcake" | "cone";
export type DessertTier = 1 | 2 | 3 | 4;
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
/** The board is a disc that fills the plate's well. */
const BOARD_R = 12.6;
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
    this.paint(disc(CX, CY, BOARD_R), (x, y) => {
      const t =
        ((x + 0.5 - CX) * 0.5 + (y + 0.5 - CY) * 0.86) / BOARD_R +
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
    const board = disc(CX, CY, BOARD_R);
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
      if (f < 0) continue;
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
  const R = 9.7;
  const bite = disc(19.9, 7.0, 2.4);
  const body = wavy(14, 13.7, (a) => R + 0.22 * Math.sin(5 * a + 0.6));
  p.paint(
    (x, y) => body(x, y) && !bite(x, y),
    (x, y) => {
      const dx = (x + 0.5 - 14) / R;
      const dy = (y + 0.5 - 13.7) / R;
      const d2 = Math.min(1, dx * dx + dy * dy);
      const v =
        light(dx * 0.9, dy * 0.9, Math.sqrt(1 - d2 * 0.8)) + 0.05 * Math.sin(x * 0.9 + y * 0.5);
      if (v > 0.92 && d2 > 0.42) return "cream";
      return v > 0.64 ? "yellow" : v > 0.42 ? "gold" : v > 0.14 ? "orange" : "orangeDark";
    },
    true,
  );
  p.outline();
  // chocolate chips: a chunk with a lit top and left, well inside the cookie
  for (const [x, y, w, h] of [
    [10, 7, 4, 3],
    [17, 6, 4, 3],
    [20, 12, 4, 3],
    [7, 12, 4, 3],
    [13, 12, 4, 3],
    [11, 18, 4, 3],
    [18, 17, 4, 3],
    [7, 18, 3, 3],
  ] as const)
    // prettier-ignore
    p.chip(x, y, w, h, "chipLight", "chip");
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
  const cy = 13.7;
  const Rin = 3.3;
  const outer = wavy(CX, cy, (a) => 10.3 + 0.22 * Math.sin(4 * a + 0.5));
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
    (x, y) => ring(x, y, Rin, 10.3, ["dough1", "dough", "doughDark"]),
    true,
  );
  const icing = wavy(
    CX,
    cy,
    (a) => 8.4 + 0.9 * Math.sin(3 * a + 0.7) + 0.4 * Math.sin(6 * a + 2.2),
  );
  p.paint(
    (x, y) => icing(x, y) && !disc(CX, cy, 4.8)(x, y),
    (x, y) => ring(x, y, 4.8, 8.8, ["pinkLight", "pink", "pinkDark"]),
    true,
  );
  p.outline();
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
  return p;
}

const GROUPS_CUPCAKE: GroupDef[] = [
  { tones: ["outline"] },
  { tones: ["cream", "pale"] },
  { tones: ["pinkLight", "pink", "pinkDark"], rep: "pink" },
  { tones: ["blue", "blueDark"], rep: "blue" },
  { tones: ["red", "redDark"], rep: "red" },
  { tones: ["butter1", "butter2", "butter3"], rep: "butter2" },
];

function paintCupcake(): Painter {
  const p = new Painter(GROUPS_CUPCAKE);
  p.board(["butter1", "butter2", "butter3"], 0.6);
  p.cloud(6.2, 21.8, 1.1);
  p.cloud(21.8, 22.4, 1.15);
  // the paper cup: wide stripes
  p.paint(
    (x, y) => y >= 17 && y <= 24 && Math.abs(x + 0.5 - CX) <= 8.6 - (y - 17) * 0.5,
    (x) => (Math.floor((x - 4) / 2) % 2 === 0 ? "cream" : "blue"),
    true,
  );
  // three frosting tiers, then the cherry, each a lit dome
  const tier = (cy: number, rx: number, ry: number) =>
    p.paint(
      ellipse(CX, cy, rx, ry),
      (x, y) =>
        pick(dome(x, y, CX, cy, rx, ry) ?? 0, ["pinkLight", "pink", "pinkDark"], 0.55, 0.22),
      true,
    );
  tier(14.8, 9.4, 3.8);
  tier(11.5, 7.0, 3.4);
  tier(8.5, 4.7, 3.0);
  p.paint(
    disc(CX, 5.3, 2.8),
    (x, y) => ((dome(x, y, CX, 5.3, 2.8, 2.8) ?? 0) > 0.45 ? "red" : "redDark"),
    true,
  );
  p.outline();
  p.bar(12, 4, 2, false, "cream");
  for (const [x, y, c] of [
    [8, 14, "blue"],
    [12, 15, "cream"],
    [17, 14, "blue"],
    [10, 11, "cream"],
    [16, 11, "blue"],
    [13, 8, "cream"],
    [19, 15, "cream"],
  ] as const)
    // prettier-ignore
    p.bar(x, y, 2, false, c);
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
  // the waffle cone, point down, with a grid of darker bars
  p.paint(
    (x, y) => y >= 12 && y <= 25 && Math.abs(x + 0.5 - CX) <= (6.6 * (25.4 - y)) / 11.4 + 0.5,
    (x, y) => {
      const lit = (x + 0.5 - CX) / 7;
      const base: RunColorKey = lit < -0.3 ? "coneLight" : lit < 0.35 ? "cone" : "coneDark";
      return ((x - y + 40) >> 1) % 2 === 0 ? (base === "coneLight" ? "cone" : "coneDark") : base;
    },
    true,
  );
  // two scoops of strawberry with a ruffled skirt, lit domes
  const scoop = disc(CX, 9.6, 5.5);
  const skirt = ellipse(CX, 13.4, 6.6, 2.0);
  p.paint(
    (x, y) => scoop(x, y) || skirt(x, y),
    (x, y) => {
      const v = Math.max(
        dome(x, y, CX, 9.6, 5.5, 5.5) ?? -9,
        (dome(x, y, CX, 13.4, 6.6, 2.0) ?? -9) - 0.12,
      );
      return pick(v, ["pinkLight", "pink", "pinkDark"], 0.58, 0.24);
    },
    true,
  );
  p.outline();
  for (const [x, y, v, c] of [
    [9, 8, 0, "cream"],
    [16, 7, 1, "red"],
    [12, 10, 0, "red"],
    [17, 11, 0, "cream"],
    [8, 12, 1, "red"],
    [13, 13, 0, "cream"],
  ] as const)
    // prettier-ignore
    p.bar(x, y, 2, v === 1, c);
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
};

export const DESSERT_ORDER: readonly DessertId[] = ["cookie", "donut", "cupcake", "cone"];

/** The desserts a tier serves, in rotation. A higher tier may also serve a lower tier's easiest dessert. */
export const DESSERTS_BY_TIER: Record<DessertTier, readonly DessertId[]> = {
  1: ["cookie", "donut"],
  2: ["donut", "cupcake"],
  3: ["cupcake", "cone"],
  4: ["donut", "cupcake"],
};
