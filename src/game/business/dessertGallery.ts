/**
 * Dessert Run's gallery: the 50 desserts of the level list on a 28 x 28 grid of cubes (developer 2026-11-26: "refer these images in order and fix the desserts properly, one by one, proper and
 * clean, realistic and exactly like in the reference").
 *
 * Every dessert is the developer's own reference picture (`docs/planning/reference/dessert-run/`), cut off its plate and shown in the game's cubes: a cube shows its own square of the picture
 * (`public/business/dessertrun/desserts/<id>.webp`, 16 px a cube), so the dessert looks exactly like the reference and the game is unchanged (waiters still fetch one colour of cube at a time).
 * `scripts/make-dessert-art.py` writes the pictures and `dessertLadderArt.ts` (which cubes are the dessert, which colour group each belongs to, a flat tone per cube, the board behind it).
 *
 * TWO things per cube, kept apart on purpose:
 *  - its GROUP (what a waiter fetches): 5 to 9 per dessert. Group 0 is the picture's dark outline, group 1 the board (the plate's checked well, the reference's white and pale blue, or a pastel when
 *    the dessert is too white to tell apart from it), then the dessert's own colour groups;
 *  - its TONE: the flat colour of the cube, drawn when the picture is not there (it has not loaded, or it failed), and the colour of the waiters and the flying cubes.
 *
 * `build()` returns the group of every cell (-1 = no cube), `tones()` the tone index inside that group. The whole plate disc is filled: the board and the outline are layers a waiter has to peel
 * before the dessert inside can be reached.
 */
import { LADDER_ART, LADDER_TONES } from "./dessertLadderArt";

export const GRID = 28;

/** The outline and the boards; every dessert's own flat tones come from `LADDER_TONES`. Each board is a check of its two tones. */
export const RUN_PALETTE = {
  outline: "#3B1E0E",
  plate1: "#EEF5FB",
  plate2: "#DCEAF6",
  sky1: "#8EE3FF",
  sky2: "#41C4F7",
  mint1: "#9DF0D8",
  mint2: "#5ADDBB",
  lilac1: "#E0D4FF",
  lilac2: "#B79EF8",
  vanilla1: "#FFF7DC",
  vanilla2: "#FCE9BA",
  peach1: "#FFE3CF",
  peach2: "#FFC9A3",
  sage1: "#E1F1D2",
  sage2: "#B9DC9F",
  rose1: "#FFE0EA",
  rose2: "#FFBDD2",
  aqua1: "#CBF6F3",
  aqua2: "#8EE3E0",
  ...LADDER_TONES,
} as const;
export type RunColorKey = keyof typeof RUN_PALETTE;

/** The 50 desserts in level order (levels 1 to 10 Intro, 11 to 20 Easy, 21 to 30 Medium, 31 to 40 Hard, 41 to 50 Expert). */
export const DESSERT_LADDER = [
  "cookie",
  "candy",
  "jelly",
  "donut",
  "macaron",
  "cupcake",
  "pancakes",
  "cone",
  "cakeslice",
  "lollipop",
  "eclair",
  "pudding",
  "mousse",
  "cheesecake",
  "tart",
  "swissroll",
  "millefeuille",
  "brownie",
  "croissant",
  "muffin",
  "tiramisu",
  "shortcake",
  "operacake",
  "bakedalaska",
  "croquembouche",
  "bettycake",
  "parfait",
  "pie",
  "churros",
  "waffle",
  "sundae",
  "moltencake",
  "pavlova",
  "bananasplit",
  "creampuff",
  "fruitlayercake",
  "matchaRoll",
  "redvelvet",
  "lemontart",
  "chocolatelava",
  "raspberrymousse",
  "mintchoc",
  "mangomousse",
  "blackforest",
  "fraisier",
  "sachertorte",
  "montblanc",
  "fruitgateau",
  "chocolatedome",
  "granddessert",
] as const;
/** A dessert's id: one of the 50 of the list. */
export type DessertId = (typeof DESSERT_LADDER)[number];
export type DessertTier = 1 | 2 | 3 | 4 | 5 | 6;
export const BAND_NAMES = ["Intro", "Easy", "Medium", "Hard", "Expert"] as const;
/** The deal's difficulty tier (dessertRun.ts RUN_TIERS: lanes, waiter size, hardness window) of each band of ten. */
export const BAND_TIERS: readonly DessertTier[] = [1, 2, 3, 5, 6];
export const bandOf = (level: number) => Math.floor((level - 1) / 10);
export const tierOfLadderLevel = (level: number): DessertTier => BAND_TIERS[bandOf(level)]!;

/** Shorter names for the header, where the full name would not fit a narrow phone. */
const SHORT: Partial<Record<DessertId, string>> = {
  donut: "Donut",
  shortcake: "Shortcake",
  fruitlayercake: "Fruit Cake",
  redvelvet: "Red Velvet",
  chocolatelava: "Choc Lava",
  raspberrymousse: "Berry Mousse",
  mintchoc: "Mint Choc",
  mangomousse: "Mango Mousse",
  blackforest: "Black Forest",
  chocolatedome: "Choc Dome",
};

export type Dessert = {
  id: DessertId;
  name: string;
  short: string;
  tier: DessertTier;
  /** The dessert's picture (under the app's base URL): 448 x 448, 16 px a cube, transparent where the board shows. */
  art: string;
  /** One colour per group, by group index: the colour of the waiters that fetch it. Group 0 is the outline, group 1 the board. */
  keys: readonly RunColorKey[];
  /** The flat tones of each group, light to dark (the board: its check's two); a cube's tone is an index into its group's list. */
  toneNames: readonly (readonly RunColorKey[])[];
  /** The group of every cell, -1 = no cube. A fresh array each call (the game takes cubes out of it). */
  build: () => Int8Array;
  /** The tone of every cell inside its group. Shared: never change it. */
  tones: () => Uint8Array;
};

/**
 * The board fills the plate's well. The screen clips the cubes to that circle (`WELL_R` in dessertRun.ts = `WELL_CELLS` cubes), so a cube that only
 * touches the circle shows as a cut piece, like the reference. The board holds exactly the cubes whose square meets the circle: none is missing (no bare
 * plate at the rim) and none is hidden outside it. `dessert-run-qa` checks both.
 */
export const WELL_CELLS = 175 / 13.5;
export const inWell = (x: number, y: number) =>
  Math.hypot(
    Math.max(Math.abs(x + 0.5 - GRID / 2) - 0.5, 0),
    Math.max(Math.abs(y + 0.5 - GRID / 2) - 0.5, 0),
  ) < WELL_CELLS;

/** The two-cube check of the reference's plate. */
export const boardCheck = (x: number, y: number) => ((x >> 1) + (y >> 1)) % 2;
const TONE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

function dessert(id: DessertId, tier: DessertTier): Dessert {
  const art = LADDER_ART[id];
  if (!art) throw new Error(`dessert ${id} has no picture`);
  const board = [`${art.board}1`, `${art.board}2`] as RunColorKey[];
  const keys: RunColorKey[] = ["outline", board[1]!, ...(art.reps as readonly RunColorKey[])];
  const toneNames: RunColorKey[][] = [
    ["outline"],
    board,
    ...art.groups.map((g) => [...g] as RunColorKey[]),
  ];
  /** Every dessert tone of the picture in order, and where each sits (group, index inside the group). */
  const flat: Array<[number, number]> = art.groups.flatMap((g, gi) =>
    g.map((_, ti): [number, number] => [gi + 2, ti]),
  );
  let made: { group: Int8Array; tone: Uint8Array } | null = null;
  const make = () => {
    if (made) return made;
    const group = new Int8Array(GRID * GRID).fill(-1);
    const tone = new Uint8Array(GRID * GRID);
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (!inWell(x, y)) continue;
        const i = y * GRID + x;
        const c = art.rows[y]![x]!;
        if (c === ".") {
          group[i] = 1;
          tone[i] = boardCheck(x, y);
        } else if (c === "#") group[i] = 0;
        else {
          const [g, t] = flat[TONE_CHARS.indexOf(c)]!;
          group[i] = g;
          tone[i] = t;
        }
      }
    made = { group, tone };
    return made;
  };
  return {
    id,
    name: art.name,
    short: SHORT[id] ?? art.name,
    tier,
    art: `business/dessertrun/desserts/${id}.webp`,
    keys,
    toneNames,
    build: () => make().group.slice(),
    tones: () => make().tone,
  };
}

export const DESSERTS = Object.fromEntries(
  DESSERT_LADDER.map((id, n) => [id, dessert(id, tierOfLadderLevel(n + 1))]),
) as Record<DessertId, Dessert>;
