/**
 * WHERE EVERYTHING SITS on the festival's two stages (developer 2026-11-27: upright first, like Royal Cooking; every screen also has a landscape
 * layout). Numbers are stage units: the upright stage is 540 wide and 960-1200 tall (a tall phone is filled, never framed), the landscape stage is
 * 960 x 540. Every tap target is big enough for 48 px at the smallest window the game is tested at (festival-save-qa checks it from these numbers).
 *
 * THE STALL (developer 2026-11-27, the concept image): one continuous wooden workstation. The drink machines stand on a ledge at the back of the
 * counter with the fryers and the bin below them, the grill and the assembly board are in the middle, the power-ups sit in a small rack, and the
 * ingredient pans stand on the front shelf. The landscape boxes follow the concept's proportions (its 1823 x 863, centred: x = (px - 145) * 0.626).
 */
export type Rect = readonly [x: number, y: number, w: number, h: number];

export const PORTRAIT = { w: 540, h: 960, maxH: 1200 } as const;
export const WIDE = { w: 960, h: 540 } as const;
/** The smallest scale each stage is shown at (a 320 x 568 phone; a 740 x 360 phone on its side). */
export const SMALLEST_SCALE = { portrait: 320 / 540, wide: 360 / 540 } as const;

/** A place on the grill: the box a finger taps, and the painted ring its food lies on. */
export type GrillSpot = { tap: Rect; food: Rect };

export type StallProp = {
  art: "ketchup" | "mustard" | "mayo" | "napkins" | "salt-pepper" | "spatula" | "tongs" | "cup";
  box: Rect;
};

export type FestivalLayout = {
  w: number;
  h: number;
  wide: boolean;
  back: Rect;
  pause: Rect;
  scores: Rect;
  status: Rect;
  rivalSays: Rect;
  /** The festival's own sign, and the chalkboard of the day's special (null where there is no room). */
  sign: Rect | null;
  special: Rect | null;
  /** The hanging lamps: the middle of each shade's foot. */
  lamps: readonly (readonly [number, number])[];
  /** One seat: its order bubble and the customer under it. */
  seats: readonly { bubble: Rect; person: Rect }[];
  /** The y of the counter's front edge. */
  counter: number;
  /** The back ledge's lip (the drink machines stand on it), and the front shelf the pans stand on. */
  ledge: Rect;
  shelf: Rect;
  /** The little wooden rack the power-ups sit in. */
  rack: Rect;
  /** Things that only stand there (never tapped). */
  props: readonly StallProp[];
  hint: Rect;
  drink: readonly Rect[];
  fryer: readonly Rect[];
  bin: Rect;
  /** The grill's picture, its open places, and the rings this stage cannot use yet. */
  grillArt: Rect;
  grill: readonly GrillSpot[];
  locked: readonly Rect[];
  /** The wooden board under the plates. */
  board: Rect;
  plates: readonly Rect[];
  trays: readonly Rect[];
  powers: readonly Rect[];
};

/** `count` boxes of one size in a row, centred in [from, from + width]. */
const row = (
  count: number,
  from: number,
  width: number,
  y: number,
  w: number,
  h: number,
  gap: number,
): Rect[] => {
  const total = count * w + (count - 1) * gap;
  const x = from + (width - total) / 2;
  return Array.from({ length: count }, (_, i) => [x + i * (w + gap), y, w, h] as const);
};

/** The grill picture's four rings (the middle of each, as parts of the picture), in the order they open: the front two first. */
const RINGS: readonly (readonly [number, number])[] = [
  [0.308, 0.525],
  [0.687, 0.526],
  [0.322, 0.232],
  [0.672, 0.232],
];
/** A piece of meat's width as a part of the grill's, and its shape. */
const MEAT_W = 0.31;
const MEAT_ASPECT = 1.33;
/** Where the grill's tap boxes split between the back rings and the front ones. */
const RING_SPLIT = 0.42;

function grillSpots(art: Rect, open: number) {
  const [x, y, w, h] = art;
  const food = ([cx, cy]: readonly [number, number]): Rect => {
    const fw = w * MEAT_W;
    const fh = fw / MEAT_ASPECT;
    return [x + cx * w - fw / 2, y + cy * h - fh / 2, fw, fh];
  };
  const spots = RINGS.map((ring): GrillSpot => {
    const left = ring[0] < 0.5;
    const back = ring[1] < 0.4;
    const split = h * RING_SPLIT;
    return {
      tap: [left ? x : x + w / 2, back ? y : y + split, w / 2, back ? split : h - split],
      food: food(ring),
    };
  });
  return { grill: spots.slice(0, open), locked: spots.slice(open).map((s) => s.food) };
}

/** The plates on the board's box: two stacked, three as two and one, four as two and two. */
function platesOn([x, y, w, h]: Rect, count: number): Rect[] {
  const ph = (h - 6) / 2;
  const pw = (w - 6) / 2;
  const top = y + 2;
  const low = y + 4 + ph;
  if (count <= 2) {
    const stacked: Rect[] = [
      [x + 2, top, w - 4, ph],
      [x + 2, low, w - 4, ph],
    ];
    return stacked.slice(0, count);
  }
  const four: Rect[] = [
    [x + 2, top, pw, ph],
    [x + 4 + pw, top, pw, ph],
    [x + 2, low, pw, ph],
    [x + 4 + pw, low, pw, ph],
  ];
  if (count === 3) return [four[0]!, four[1]!, [x + (w - pw) / 2, low, pw, ph]];
  return four.slice(0, count);
}

export type Counts = {
  atOnce: number;
  grill: number;
  plates: number;
  trays: number;
  drinks: number;
};

/** The upright stage's height for a window: the window's own shape, between 960 and 1200. */
export const portraitHeight = (width: number, height: number): number =>
  width > 0
    ? Math.round(Math.min(PORTRAIT.maxH, Math.max(PORTRAIT.h, (PORTRAIT.w * height) / width)))
    : PORTRAIT.h;

export function portraitLayout(counts: Counts, height: number = PORTRAIT.h): FestivalLayout {
  // a tall phone's extra height goes between the top bar and the customers, and part of it to a roomier workstation
  const lift = height - PORTRAIT.h;
  const extra = Math.min(70, Math.floor(lift * 0.35));
  const down = (y: number) => y + lift;
  const up = (y: number) => y + lift - extra;
  const grow = Math.round(extra * 0.55);

  const seatW = 130;
  const gap = counts.atOnce >= 4 ? 4 : 22;
  const seats = row(counts.atOnce, 0, PORTRAIT.w, up(134), seatW, 126, gap).map(([x, y, w, h]) => ({
    bubble: [x, y, w, h] as const,
    person: [x - 5, up(250), w + 10, 124] as const,
  }));

  // the drink machines, the two fryer baskets and the bin in one row, the groups apart: wider while there are fewer of them
  const inner = 4;
  const box = Math.min(104, Math.floor((532 - counts.drinks * inner - 16) / (counts.drinks + 3)));
  const drinksW = counts.drinks * box + (counts.drinks - 1) * inner;
  const fryerW = 2 * box + inner;
  const apart = Math.min(24, (532 - drinksW - fryerW - box) / 2);
  const left = (PORTRAIT.w - drinksW - fryerW - box - 2 * apart) / 2;
  const rowY = up(374);
  const inRow = (x: number): Rect => [x, rowY, box, 104];
  const drink = Array.from({ length: counts.drinks }, (_, i) => inRow(left + i * (box + inner)));
  const fryerX = left + drinksW + apart;
  const fryer = [inRow(fryerX), inRow(fryerX + box + inner)];
  const bin = inRow(fryerX + fryerW + apart);

  const kitchenY = up(482);
  const kitchenH = 202 + grow;
  const grillArt: Rect = [6, kitchenY, 250, kitchenH];
  const board: Rect = [260, kitchenY, 276, kitchenH];

  // the pans on the front shelf, one row or two
  const trayTop = kitchenY + kitchenH + 6;
  const trayBottom = down(866);
  const rows = counts.trays > 6 ? 2 : 1;
  const first = rows === 2 ? Math.ceil(counts.trays / 2) : counts.trays;
  const trayW = (n: number) => Math.min(120, Math.floor((532 - (n - 1) * 3) / n));
  const half = Math.floor((trayBottom - trayTop - 4) / 2);
  const tall = Math.min(118, trayBottom - trayTop - 16);
  const trays =
    rows === 2
      ? [
          ...row(first, 0, PORTRAIT.w, trayTop, trayW(first), half, 3),
          ...row(counts.trays - first, 0, PORTRAIT.w, trayTop + half + 4, trayW(first), half, 3),
        ]
      : row(
          counts.trays,
          0,
          PORTRAIT.w,
          trayTop + Math.floor((trayBottom - trayTop - tall) / 2),
          trayW(counts.trays),
          tall,
          3,
        );

  // room for the sign only on a tall phone, between the top bar and the order bubbles
  const signH = Math.min(112, lift - extra - 10);
  return {
    w: PORTRAIT.w,
    h: height,
    wide: false,
    back: [6, 6, 84, 84],
    pause: [450, 6, 84, 84],
    scores: [96, 6, 348, 86],
    status: [8, 96, 232, 34],
    rivalSays: [246, 93, 288, 37],
    sign: signH >= 60 ? [270 - signH, 136, signH * 2, signH] : null,
    special: null,
    lamps:
      signH >= 60
        ? [
            [34, 150 + signH * 0.8],
            [506, 150 + signH * 0.8],
          ]
        : [],
    seats,
    counter: up(370),
    ledge: [0, rowY + 86, 540, 18],
    shelf: [0, trayTop - 4, 540, trayBottom - trayTop + 8],
    rack: [88, down(868), 364, 90],
    props: [],
    // (above the counter's edge, clear of every station)
    hint: [60, up(336), 420, 34],
    drink,
    fryer,
    bin,
    grillArt,
    ...grillSpots(grillArt, counts.grill),
    board,
    plates: platesOn(board, counts.plates),
    trays,
    powers: row(3, 0, PORTRAIT.w, down(872), 108, 82, 12),
  };
}

export function wideLayout(counts: Counts): FestivalLayout {
  // the drink machines stand at the left on the back ledge; the customers take the room to their right
  const drinkW = 76;
  const drink: Rect[] = Array.from({ length: counts.drinks }, (_, i) => [
    6 + i * (drinkW + 3),
    212,
    drinkW,
    112,
  ]);
  const from = Math.max(172, 6 + counts.drinks * (drinkW + 3) + 3);
  const to = 808;
  const gap = counts.atOnce >= 4 ? 4 : 24;
  const seatW = Math.min(
    counts.atOnce >= 4 ? 139 : 168,
    Math.floor((to - from - (counts.atOnce - 1) * gap) / counts.atOnce),
  );
  // two or three customers stand round the middle of the stall, never over the machines
  const span = counts.atOnce * seatW + (counts.atOnce - 1) * gap;
  const start = Math.min(to - span, Math.max(from, WIDE.w / 2 - span / 2));
  const seats = row(counts.atOnce, start, span, 78, seatW, 96, gap).map(([x, y, w, h]) => ({
    bubble: [x, y, w, h] as const,
    person: [x + (w - 124) / 2, 164, 124, 98] as const,
  }));
  const grillArt: Rect = [244, 262, 228, 174];
  const board: Rect = [478, 262, 230, 174];
  const trayW = Math.min(168, Math.floor((950 - (counts.trays - 1) * 4) / counts.trays));
  return {
    w: WIDE.w,
    h: WIDE.h,
    wide: true,
    back: [8, 4, 74, 74],
    pause: [878, 4, 74, 74],
    scores: [222, 4, 516, 70],
    status: [88, 10, 128, 58],
    rivalSays: [744, 10, 128, 62],
    sign: [6, 84, 152, 100],
    special: [820, 92, 132, 122],
    lamps: [
      [184, 124],
      [782, 124],
    ],
    seats,
    counter: 258,
    ledge: [0, 312, 960, 20],
    shelf: [0, 438, 960, 102],
    rack: [710, 322, 248, 110],
    props: [
      // cup stacks beside the drinks, while one machine leaves the room
      ...(counts.drinks === 1
        ? ([
            { art: "cup", box: [90, 262, 36, 56] },
            { art: "cup", box: [122, 268, 34, 50] },
          ] as const)
        : []),
      { art: "napkins", box: [714, 262, 44, 52] },
      { art: "spatula", box: [756, 266, 44, 48] },
      { art: "tongs", box: [788, 266, 44, 48] },
      { art: "ketchup", box: [840, 232, 36, 82] },
      { art: "mustard", box: [868, 232, 36, 82] },
      { art: "mayo", box: [896, 232, 36, 82] },
      { art: "salt-pepper", box: [922, 272, 38, 42] },
    ],
    hint: [300, 230, 360, 30],
    drink,
    fryer: [
      [6, 332, 76, 102],
      [85, 332, 76, 102],
    ],
    bin: [164, 332, 76, 102],
    grillArt,
    ...grillSpots(grillArt, counts.grill),
    board,
    plates: platesOn(board, counts.plates),
    trays: row(counts.trays, 0, WIDE.w, 442, trayW, 96, 4),
    powers: [
      [716, 328, 76, 98],
      [796, 328, 76, 98],
      [876, 328, 76, 98],
    ],
  };
}

/** Every box a finger taps, for the size checks. */
export const tapTargets = (l: FestivalLayout): Rect[] => [
  l.back,
  l.pause,
  ...l.drink,
  ...l.fryer,
  l.bin,
  ...l.grill.map((s) => s.tap),
  ...l.plates,
  ...l.trays,
  ...l.powers,
];
