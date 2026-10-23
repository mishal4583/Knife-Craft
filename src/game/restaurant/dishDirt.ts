/**
 * DISH_DIRT — the dirt on a piece in the sink game (developer 2026-10-23:
 * "cleaning and washing in a satisfying manner … make the dirt in the
 * utensils more realistic"). The same layered stains the room cleaning
 * paints (cleaningDirt `Stain`, dirtArt `paintStain`), chosen for what each
 * piece really collects — a plate: a tomato / curry / gravy splash, a baked-on
 * crust at the rim, a greasy film, crumbs and a fork-drag smear; a bowl: the
 * soup's tide-mark; cutlery: grease and a dried egg crust; a glass: water
 * spots and a lip smudge; a cup: coffee rings — placed only on the piece's
 * own surface (scene 360 × 280). Seeded: the same piece of the same wash
 * always looks the same, the next wash is fresh. Tough stains (crust, grease)
 * take more strokes. Pure; no Math.random.
 */
import type { SupplyId } from "../business/businessSupplies";
import {
  TOUGHNESS,
  seeded,
  strengthToughness,
  type DirtMark,
  type Point,
  type Stain,
  type StainKind,
} from "./cleaningDirt";

/** The sink scene, in the units every piece is drawn and scrubbed in. */
export const DISH_SCENE = { width: 360, height: 280 } as const;
/** The dinner plate in the sink scene (its rim ellipse). */
export const DISH_PLATE = { x: 180, y: 165, rx: 92, ry: 65 } as const;

/** The tableware the sink draws (from the 2026-10 prototype), by supply id. */
export const DISH_ITEMS = [
  { id: "dinner-plates", label: "Dinner plate", shape: "plate" },
  { id: "dinner-forks", label: "Dinner fork", shape: "fork" },
  { id: "dinner-knives", label: "Dinner knife", shape: "knife" },
  { id: "side-plates", label: "Side plate", shape: "small-plate" },
  { id: "soup-bowls", label: "Soup bowl", shape: "bowl" },
  { id: "soup-spoons", label: "Soup spoon", shape: "spoon" },
  { id: "dessert-plates", label: "Dessert plate", shape: "small-plate" },
  { id: "dessert-forks", label: "Dessert fork", shape: "fork" },
  { id: "teaspoons", label: "Teaspoon", shape: "spoon" },
  { id: "steak-knives", label: "Steak knife", shape: "knife" },
  { id: "water-glasses", label: "Water glass", shape: "glass" },
  { id: "highball-glasses", label: "Highball glass", shape: "glass" },
  { id: "coffee-tea-set", label: "Coffee cup & saucer", shape: "cup-set" },
  { id: "water-jugs", label: "Water jug", shape: "jug" },
  { id: "salt-pepper", label: "Salt & pepper shakers", shape: "shakers" },
] as const;
export type DishShape = (typeof DISH_ITEMS)[number]["shape"];

/** Which picture a sink line uses: the known tableware, then by its name (a plate by default). */
export function dishShapeFor(id: SupplyId, name: string = id): DishShape {
  const known = DISH_ITEMS.find((t) => t.id === id);
  if (known) return known.shape;
  const n = name.toLowerCase();
  if (/glass|tumbler|goblet/.test(n)) return "glass";
  if (/fork/.test(n)) return "fork";
  if (/knife|knives/.test(n)) return "knife";
  if (/spoon/.test(n)) return "spoon";
  if (/bowl/.test(n)) return "bowl";
  if (/cup|mug|saucer/.test(n)) return "cup-set";
  if (/jug|pitcher|carafe/.test(n)) return "jug";
  if (/shaker|salt|pepper/.test(n)) return "shakers";
  if (/side|dessert|bread|small/.test(n)) return "small-plate";
  return "plate";
}

/** Whether (x, y) is on the piece (scene units). */
export function inDishSurface(x: number, y: number, shape: DishShape): boolean {
  if (shape === "plate") {
    const nx = (x - DISH_PLATE.x) / (DISH_PLATE.rx - 7);
    const ny = (y - DISH_PLATE.y) / (DISH_PLATE.ry - 7);
    return nx * nx + ny * ny <= 0.96;
  }
  if (shape === "small-plate" || shape === "bowl") {
    const rx = shape === "small-plate" ? 63 : 60;
    const ry = shape === "small-plate" ? 44 : 40;
    return ((x - 180) / rx) ** 2 + ((y - 165) / ry) ** 2 <= 1;
  }
  if (shape === "fork") {
    const inTines =
      y >= 100 && y <= 132 && [166, 173, 180, 187].some((left) => x >= left && x <= left + 5);
    const inHead = y >= 126 && y <= 151 && x >= 163 && x <= 197;
    const inHandle = y >= 145 && y <= 229 && x >= 176 && x <= 184;
    const handleEnd = ((x - 180) / 6) ** 2 + ((y - 220) / 9) ** 2 <= 1;
    return inTines || inHead || inHandle || handleEnd;
  }
  if (shape === "knife") {
    const bladeHalfWidth =
      y < 147
        ? 3 + Math.max(0, y - 100) * (11 / 47)
        : y < 157
          ? 14 + (y - 147) * 0.2
          : Math.max(8, 16 - (y - 157) * 1.3);
    const inBlade = y >= 100 && y <= 163 && Math.abs(x - 180) <= bladeHalfWidth;
    const inHandle = y >= 160 && y <= 228 && x >= 174 && x <= 186;
    const handleEnd = ((x - 180) / 7) ** 2 + ((y - 222) / 8) ** 2 <= 1;
    return inBlade || inHandle || handleEnd;
  }
  if (shape === "spoon") {
    const spoonBowl = ((x - 180) / 14) ** 2 + ((y - 117) / 17) ** 2 <= 1;
    const handle = y >= 130 && y <= 222 && x >= 176 && x <= 184;
    const handleEnd = ((x - 180) / 5) ** 2 + ((y - 221) / 8) ** 2 <= 1;
    return spoonBowl || handle || handleEnd;
  }
  if (shape === "glass") {
    const rim = y >= 103 && y <= 117 && x >= 157 && x <= 203;
    const bodyHalfWidth = 22 - Math.max(0, y - 112) * 0.055;
    const body = y >= 112 && y <= 207 && Math.abs(x - 180) <= bodyHalfWidth;
    const base = y >= 205 && y <= 219 && x >= 163 && x <= 197;
    return rim || body || base;
  }
  if (shape === "cup-set") {
    const cup = y >= 128 && y <= 178 && x >= 150 && x <= 210;
    const handle = ((x - 211) / 12) ** 2 + ((y - 145) / 18) ** 2 <= 1 && x >= 205;
    const saucer = ((x - 180) / 46) ** 2 + ((y - 194) / 13) ** 2 <= 1;
    return cup || handle || saucer;
  }
  const jugBody = y >= 110 && y <= 207 && x >= 148 && x <= 209;
  const jugNeck = y >= 101 && y <= 126 && x >= 163 && x <= 197;
  const jugHandle = ((x - 211) / 13) ** 2 + ((y - 157) / 25) ** 2 <= 1 && x >= 205;
  if (shape === "jug") return jugBody || jugNeck || jugHandle;
  const leftShaker = y >= 128 && y <= 190 && x >= 148 && x <= 174;
  const leftCap = y >= 117 && y <= 134 && x >= 153 && x <= 170;
  const rightShaker = y >= 128 && y <= 190 && x >= 186 && x <= 212;
  const rightCap = y >= 117 && y <= 134 && x >= 190 && x <= 207;
  return leftShaker || leftCap || rightShaker || rightCap;
}

/** The sponge's reach on each piece (scene px): wide on a plate, narrow on a fork. */
export const DISH_BRUSH: Record<DishShape, number> = {
  plate: 24,
  "small-plate": 20,
  bowl: 20,
  fork: 13,
  knife: 13,
  spoon: 13,
  glass: 15,
  "cup-set": 17,
  jug: 17,
  shakers: 14,
};

/**
 * How much the sink zooms in on a piece so thin ones are worth scrubbing (a
 * fork fills the basin, a plate already does). Visual only: hits are tested
 * in scene units.
 */
export const DISH_ZOOM: Record<DishShape, number> = {
  plate: 1,
  "small-plate": 1.25,
  bowl: 1.3,
  fork: 1.7,
  knife: 1.7,
  spoon: 1.7,
  glass: 1.5,
  "cup-set": 1.25,
  jug: 1.3,
  shakers: 1.55,
};

/** The order pieces come to the sink: the big satisfying ones first, cutlery last. */
export const DISH_ORDER: Record<DishShape, number> = {
  plate: 0,
  bowl: 1,
  "small-plate": 2,
  "cup-set": 3,
  glass: 4,
  jug: 5,
  shakers: 6,
  knife: 7,
  fork: 8,
  spoon: 9,
};

/** Clean enough: past this share the last specks wipe themselves (as the room cleaning). */
export const DISH_CLEAN_THRESHOLD = 0.9;

type Recipe = { kind: StainKind; r: [number, number]; stretch?: [number, number]; n: number };

/** What each piece collects (kinds, size range in scene px, how many). */
const RECIPES: Record<DishShape, Recipe[]> = {
  plate: [
    { kind: "sauce", r: [13, 20], n: 2 },
    { kind: "crust", r: [8, 12], n: 1 },
    { kind: "grease", r: [9, 12], stretch: [2.2, 3.2], n: 1 },
    { kind: "crumbs", r: [10, 14], n: 1 },
    { kind: "smear", r: [7, 10], stretch: [2, 2.8], n: 1 },
  ],
  "small-plate": [
    { kind: "sauce", r: [10, 14], n: 1 },
    { kind: "crumbs", r: [9, 12], n: 1 },
    { kind: "smear", r: [6, 8], stretch: [1.8, 2.4], n: 1 },
    { kind: "crust", r: [6, 8], n: 1 },
  ],
  bowl: [
    { kind: "coffee-ring", r: [16, 20], n: 1 },
    { kind: "crust", r: [7, 10], n: 1 },
    { kind: "grease", r: [7, 9], stretch: [2, 2.6], n: 1 },
    { kind: "crumbs", r: [7, 9], n: 1 },
  ],
  fork: [
    { kind: "sauce", r: [5, 7], n: 2 },
    { kind: "grease", r: [4, 5], stretch: [2.4, 3.2], n: 1 },
    { kind: "crust", r: [4, 5], n: 1 },
  ],
  knife: [
    { kind: "grease", r: [4, 6], stretch: [2.6, 3.4], n: 1 },
    { kind: "sauce", r: [5, 7], n: 1 },
    { kind: "smear", r: [4, 6], stretch: [2, 2.6], n: 1 },
    { kind: "crust", r: [3, 4], n: 1 },
  ],
  spoon: [
    { kind: "sauce", r: [6, 8], n: 1 },
    { kind: "coffee-ring", r: [7, 9], n: 1 },
    { kind: "crust", r: [3, 4], n: 1 },
    { kind: "grease", r: [3, 4], stretch: [2.4, 3], n: 1 },
  ],
  glass: [
    { kind: "water-spots", r: [8, 11], n: 2 },
    { kind: "smear", r: [5, 7], stretch: [1.6, 2.2], n: 1 },
    { kind: "coffee-ring", r: [9, 12], n: 1 },
  ],
  "cup-set": [
    { kind: "coffee-ring", r: [11, 15], n: 2 },
    { kind: "smear", r: [5, 7], stretch: [1.8, 2.4], n: 1 },
    { kind: "water-spots", r: [7, 9], n: 1 },
  ],
  jug: [
    { kind: "water-spots", r: [8, 11], n: 2 },
    { kind: "scale", r: [8, 10], n: 1 },
    { kind: "smear", r: [5, 7], stretch: [1.8, 2.4], n: 1 },
  ],
  shakers: [
    { kind: "grime", r: [6, 8], n: 2 },
    { kind: "crumbs", r: [6, 8], n: 1 },
    { kind: "smear", r: [4, 6], stretch: [1.6, 2], n: 1 },
  ],
};

/** The bounding box to look for a spot on (scene units). */
const BOUNDS: Record<DishShape, { x: [number, number]; y: [number, number] }> = {
  plate: { x: [100, 260], y: [108, 222] },
  "small-plate": { x: [125, 235], y: [125, 205] },
  bowl: { x: [128, 232], y: [128, 200] },
  fork: { x: [163, 197], y: [100, 225] },
  knife: { x: [166, 194], y: [100, 225] },
  spoon: { x: [166, 194], y: [100, 222] },
  glass: { x: [160, 200], y: [104, 214] },
  "cup-set": { x: [138, 222], y: [120, 205] },
  jug: { x: [150, 208], y: [104, 214] },
  shakers: { x: [148, 212], y: [118, 190] },
};

/** Stays on the piece: the centre and a ring at 60% of the radius must be on it. */
function fits(x: number, y: number, r: number, shape: DishShape): boolean {
  if (!inDishSurface(x, y, shape)) return false;
  const k = Math.max(2, r * 0.6);
  return [
    [k, 0],
    [-k, 0],
    [0, k],
    [0, -k],
  ].every(([dx, dy]) => inDishSurface(x + dx!, y + dy!, shape));
}

/**
 * The stains on one piece for wash `seed` (seeded: same seed, same dirt). Thin
 * cutlery keeps its stains small; every stain sits on the piece.
 */
export function dishStains(shape: DishShape, seed: number): Stain[] {
  const rnd = seeded(seed * 2_654_435 + 97);
  const b = BOUNDS[shape];
  const out: Stain[] = [];
  for (const rec of RECIPES[shape]) {
    for (let k = 0; k < rec.n; k++) {
      const r = rec.r[0] + rnd() * (rec.r[1] - rec.r[0]);
      let spot: Point | null = null;
      for (let tries = 0; tries < 40 && !spot; tries++) {
        const x = b.x[0] + rnd() * (b.x[1] - b.x[0]);
        const y = b.y[0] + rnd() * (b.y[1] - b.y[0]);
        const crowded = out.some((o) => Math.hypot(o.x - x, o.y - y) < (o.r + r) * 0.55);
        if (fits(x, y, r, shape) && !crowded) spot = { x, y };
      }
      if (!spot) continue;
      const thin = shape === "fork" || shape === "knife" || shape === "spoon";
      const strength = (thin ? 0.7 : 0.45) + rnd() * (thin ? 0.3 : 0.55);
      out.push({
        id: out.length,
        kind: rec.kind,
        task: "tables",
        tool: "sponge",
        x: spot.x,
        y: spot.y,
        r,
        stretch: rec.stretch ? rec.stretch[0] + rnd() * (rec.stretch[1] - rec.stretch[0]) : 1,
        // Cutlery stains run along the handle; the rest any way.
        angle: thin ? Math.PI / 2 + (rnd() - 0.5) * 0.4 : rnd() * Math.PI * 2,
        seed: Math.floor(rnd() * 1e9),
        strength,
        toughness: TOUGHNESS[rec.kind] * strengthToughness(strength),
      });
    }
  }
  return out;
}

/** The points the sponge has to pass over (centre + a ring for the bigger ones), all on the piece. */
export function dishMarks(stains: readonly Stain[], shape: DishShape): DirtMark[] {
  return stains.flatMap((s) => {
    const long = s.r * s.stretch;
    const pts: Point[] = [{ x: s.x, y: s.y }];
    if (long > 7) {
      const rx = long * 0.55;
      const ry = s.r * 0.55;
      const n = Math.max(3, Math.round((Math.PI * (rx + ry)) / 12));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const lx = Math.cos(a) * rx;
        const ly = Math.sin(a) * ry;
        pts.push({
          x: s.x + lx * Math.cos(s.angle) - ly * Math.sin(s.angle),
          y: s.y + lx * Math.sin(s.angle) + ly * Math.cos(s.angle),
        });
      }
    }
    return pts
      .filter((p) => inDishSurface(p.x, p.y, shape))
      .map((p) => ({ point: p, task: s.task, tool: s.tool, stain: s.id }));
  });
}

/** The wash seed for one piece: the restaurant's running wash count and the line, so every wash is fresh. */
export function dishSeed(washedTotal: number, id: SupplyId): number {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h ^ (washedTotal * 7_919));
}
