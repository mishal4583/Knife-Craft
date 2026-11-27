/**
 * WHERE EVERYTHING SITS on the festival's two stages (developer 2026-11-27: upright first, like Royal Cooking; every screen also has a landscape
 * layout). Numbers are stage units: the upright stage is 540 wide and 960-1200 tall (a tall phone is filled, never framed: the extra height goes
 * above the customers), the landscape stage is 960 x 540. Every tap target is big enough for 48 px at the smallest window the game is tested at
 * (festival-save-qa checks it from these numbers).
 */
export type Rect = readonly [x: number, y: number, w: number, h: number];

export const PORTRAIT = { w: 540, h: 960, maxH: 1200 } as const;
export const WIDE = { w: 960, h: 540 } as const;
/** The smallest scale each stage is shown at (a 320 x 568 phone; a 740 x 360 phone on its side). */
export const SMALLEST_SCALE = { portrait: 320 / 540, wide: 360 / 540 } as const;

/** A place on the grill: the box a finger taps, and the painted ring its food lies on. */
export type GrillSpot = { tap: Rect; food: Rect };

export type FestivalLayout = {
  w: number;
  h: number;
  wide: boolean;
  back: Rect;
  pause: Rect;
  scores: Rect;
  status: Rect;
  rivalSays: Rect;
  /** One seat: its order bubble and the customer under it. */
  seats: readonly { bubble: Rect; person: Rect }[];
  /** The y of the counter's front edge. */
  counter: number;
  hint: Rect;
  drink: readonly Rect[];
  fryer: readonly Rect[];
  bin: Rect;
  /** The grill's picture, its open places, and the rings this event cannot use yet. */
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
  // the extra height of a tall phone goes between the top bar and the customers: the kitchen stays by the thumbs
  const lift = height - PORTRAIT.h;
  const down = (y: number) => y + lift;
  const seatW = 130;
  const gap = counts.atOnce >= 4 ? 4 : 22;
  const seats = row(counts.atOnce, 0, PORTRAIT.w, down(132), seatW, 134, gap).map(
    ([x, y, w, h]) => ({
      bubble: [x, y, w, h] as const,
      person: [x - 5, down(246), w + 10, 126] as const,
    }),
  );

  // the drink machines, the two fryer baskets and the bin in one row, the groups apart: wider while there are fewer of them
  const inner = 4;
  const box = Math.min(104, Math.floor((532 - counts.drinks * inner - 16) / (counts.drinks + 3)));
  const drinksW = counts.drinks * box + (counts.drinks - 1) * inner;
  const fryerW = 2 * box + inner;
  const apart = Math.min(24, (532 - drinksW - fryerW - box) / 2);
  const left = (PORTRAIT.w - drinksW - fryerW - box - 2 * apart) / 2;
  const rowY = down(377);
  const inRow = (x: number): Rect => [x, rowY, box, 98];
  const drink = Array.from({ length: counts.drinks }, (_, i) => inRow(left + i * (box + inner)));
  const fryerX = left + drinksW + apart;
  const fryer = [inRow(fryerX), inRow(fryerX + box + inner)];
  const bin = inRow(fryerX + fryerW + apart);

  const grillArt: Rect = [6, down(481), 262, 202];
  const board: Rect = [274, down(481), 260, 202];

  const rows = counts.trays > 6 ? 2 : 1;
  const first = rows === 2 ? Math.ceil(counts.trays / 2) : counts.trays;
  const trayW = (n: number) => Math.min(104, Math.floor((532 - (n - 1) * 3) / n));
  const trays =
    rows === 2
      ? [
          ...row(first, 0, PORTRAIT.w, down(688), trayW(first), 82, 3),
          ...row(counts.trays - first, 0, PORTRAIT.w, down(773), trayW(first), 82, 3),
        ]
      : row(counts.trays, 0, PORTRAIT.w, down(712), trayW(counts.trays), 118, 3);

  return {
    w: PORTRAIT.w,
    h: height,
    wide: false,
    back: [6, 6, 84, 84],
    pause: [450, 6, 84, 84],
    scores: [96, 6, 348, 86],
    status: [8, 96, 232, 34],
    rivalSays: [246, 93, 288, 37],
    seats,
    counter: down(370),
    // (above the counter's edge, clear of every station)
    hint: [60, down(334), 420, 36],
    drink,
    fryer,
    bin,
    grillArt,
    ...grillSpots(grillArt, counts.grill),
    board,
    plates: platesOn(board, counts.plates),
    trays,
    powers: row(3, 0, PORTRAIT.w, down(862), 150, 90, 20),
  };
}

export function wideLayout(counts: Counts): FestivalLayout {
  // the bubbles are low and wide, so the customers' faces show under them
  const seatW = counts.atOnce >= 4 ? 139 : 168;
  const gap = counts.atOnce >= 4 ? 4 : 24;
  const seats = row(counts.atOnce, 196, 568, 80, seatW, 96, gap).map(([x, y, w, h]) => ({
    bubble: [x, y, w, h] as const,
    person: [x + (w - 124) / 2, 170, 124, 92] as const,
  }));
  const grillArt: Rect = [240, 266, 226, 174];
  const board: Rect = [470, 266, 226, 174];
  const trayW = Math.min(104, Math.floor((950 - (counts.trays - 1) * 3) / counts.trays));
  return {
    w: WIDE.w,
    h: WIDE.h,
    wide: true,
    back: [8, 6, 74, 74],
    pause: [878, 6, 74, 74],
    scores: [222, 6, 516, 70],
    status: [90, 14, 126, 60],
    rivalSays: [746, 12, 126, 62],
    seats,
    counter: 260,
    hint: [300, 230, 360, 32],
    drink: row(counts.drinks, 2, 236, 266, 77, 85, 2),
    fryer: [
      [5, 354, 74, 86],
      [82, 354, 74, 86],
    ],
    bin: [159, 354, 74, 86],
    grillArt,
    ...grillSpots(grillArt, counts.grill),
    board,
    plates: platesOn(board, counts.plates),
    trays: row(counts.trays, 0, WIDE.w, 446, trayW, 90, 3),
    powers: [
      [702, 304, 80, 100],
      [787, 304, 80, 100],
      [872, 304, 80, 100],
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
