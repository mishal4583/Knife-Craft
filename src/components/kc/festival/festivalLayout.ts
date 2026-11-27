/**
 * WHERE EVERYTHING SITS on the festival's two stages (developer 2026-11-27: upright first, like Royal Cooking; every screen also has a landscape layout).
 * Numbers are stage units: the upright stage is 540 wide and 960-1200 tall (a tall phone is filled, never framed: the extra height goes above the
 * customers), the landscape stage is 960 x 540. Every tap target is big enough for 48 px at the smallest window the game is tested at
 * (festival-config-qa checks it from these numbers).
 */
export type Rect = readonly [x: number, y: number, w: number, h: number];

export const PORTRAIT = { w: 540, h: 960, maxH: 1200 } as const;
export const WIDE = { w: 960, h: 540 } as const;
/** The smallest scale each stage is shown at (a 320 x 568 phone; a 740 x 360 phone on its side). */
export const SMALLEST_SCALE = { portrait: 320 / 540, wide: 360 / 540 } as const;

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
  /** The y where the wooden counter begins. */
  counter: number;
  hint: Rect;
  drink: readonly Rect[];
  fryer: readonly Rect[];
  bin: Rect;
  grillPlate: Rect;
  grill: readonly Rect[];
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

type Counts = { atOnce: number; grill: number; plates: number; trays: number };

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
  const trayRows = counts.trays > 6 ? 2 : 1;
  const first = trayRows === 2 ? Math.ceil(counts.trays / 2) : counts.trays;
  const trayW = (n: number) => Math.min(104, Math.floor((532 - (n - 1) * 3) / n));
  const trays =
    trayRows === 2
      ? [
          ...row(first, 0, PORTRAIT.w, down(678), trayW(first), 84, 3),
          ...row(counts.trays - first, 0, PORTRAIT.w, down(766), trayW(first), 84, 3),
        ]
      : row(counts.trays, 0, PORTRAIT.w, down(704), trayW(counts.trays), 118, 3);
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
    drink: [
      [10, down(378), 88, 84],
      [102, down(378), 88, 84],
    ],
    fryer: [
      [216, down(378), 88, 84],
      [308, down(378), 88, 84],
    ],
    bin: [434, down(378), 96, 84],
    grillPlate: [6, down(467), 528, 102],
    grill: row(counts.grill, 0, PORTRAIT.w, down(469), 122, 98, 8),
    plates: row(counts.plates, 0, PORTRAIT.w, down(573), 124, 100, 6),
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
  const trays: Rect[] = Array.from(
    { length: counts.trays },
    (_, i) => [642 + (i % 3) * 75, 270 + Math.floor(i / 3) * 87, 73, 84] as const,
  );
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
    hint: [200, 486, 436, 40],
    drink: [
      [8, 268, 88, 82],
      [100, 268, 88, 82],
    ],
    fryer: [
      [8, 356, 88, 82],
      [100, 356, 88, 82],
    ],
    bin: [8, 446, 180, 82],
    grillPlate: [198, 267, 438, 96],
    grill: row(counts.grill, 198, 438, 269, 102, 92, 6),
    plates: row(counts.plates, 198, 438, 370, 105, 106, 5),
    trays,
    powers: [
      [872, 270, 80, 80],
      [872, 357, 80, 80],
      [872, 444, 80, 80],
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
  ...l.grill,
  ...l.plates,
  ...l.trays,
  ...l.powers,
];
