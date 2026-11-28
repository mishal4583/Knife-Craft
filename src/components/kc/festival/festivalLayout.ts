/**
 * WHERE EVERYTHING SITS on the festival's two stages (developer 2026-11-27: upright first, like Royal Cooking; every screen also has a landscape
 * layout). Numbers are stage units: the upright stage is 540 wide and 960-1200 tall (a tall phone is filled, never framed), the landscape stage is
 * 960 x 540. Every tap target is big enough for 48 px at the smallest window the game is tested at (festival-save-qa checks it from these numbers).
 *
 * THE STALL (developer 2026-11-27, the concept image): one continuous wooden workstation. The drink machines stand on a ledge at the back of the
 * counter with the fryers and the bin below them, the grill and the assembly board are in the middle and the ingredient pans stand on the front
 * shelf. The landscape boxes follow the concept's proportions (its 1823 x 863, centred: x = (px - 145) * 0.626).
 * Developer 2026-11-28 (a marked-up screenshot), landscape: the power-ups moved to the top bar beside Pause.
 *
 * LANDSCAPE, SORTED (developer 2026-11-28, a picture of the whole screen: "make the festival stall exactly like this sorted and organised"): the
 * drinks, the fryers with the bin and the Sauce Station stand in three rows at the left; the grill over the board of plates in the middle; every
 * pan in one wooden tray at the right, three by three, with the fries, the plate stand and the table things under them. EVERY FOOD, DRINK AND
 * PLATE HAS ITS OWN PLACE AT EVERY STAGE: what a stage has not got yet stands there locked (`lockedSlots`), so nothing ever moves. The boxes
 * are measured on the developer's picture (1819 x 865); the stage is as wide as the window, from 960 units up to the picture's own shape.
 */
import { DRINKS } from "../../../game/festival/burger";
import type { FoodId } from "../../../game/festival/types";

export type Rect = readonly [x: number, y: number, w: number, h: number];

export const PORTRAIT = { w: 540, h: 960, maxH: 1200 } as const;
export const WIDE = { w: 960, h: 540, maxW: 1136 } as const;
/** The smallest scale each stage is shown at (a 320 x 568 phone; a 740 x 360 phone on its side). */
export const SMALLEST_SCALE = { portrait: 320 / 540, wide: 360 / 540 } as const;

/** A place on the grill: the box a finger taps, and the painted ring its food lies on. */
export type GrillSpot = { tap: Rect; food: Rect };

export type StallProp = {
  art: "mayo" | "napkins" | "salt-pepper" | "spatula" | "tongs" | "box" | "planter";
  box: Rect;
};

/** A place this stage does not use yet (landscape): what will stand there. Never tapped. */
export type LockedSlot =
  | { kind: "tray" | "drink"; item: FoodId; rect: Rect }
  | { kind: "plate"; number: number; rect: Rect; face: Rect };

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
  /** The ledges' lips (upright: one the drink machines stand on; landscape: under the drinks and under the fryers, at the left only). */
  ledges: readonly Rect[];
  /** Upright: the front shelf the pans stand on. Landscape: none (the pans lie in `pantry`). */
  shelf: Rect | null;
  /** Landscape: the wooden tray of pans, and the Sauce Station's rack. */
  pantry: Rect | null;
  sauces: Rect | null;
  lockedSlots: readonly LockedSlot[];
  /** The little wooden rack the power-ups sit in (upright: on the front of the counter; landscape: in the top bar, beside Pause). */
  rack: Rect;
  /** The stand of clean plates under the pans (landscape only; never tapped). */
  plateStand: Rect | null;
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
  /** The wooden board under the plates (its picture's box). */
  board: Rect;
  /** Each plate's place to tap, and the box its picture is drawn in: inside the board's flat middle, clear of its rim. */
  plates: readonly Rect[];
  plateFaces: readonly Rect[];
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

/** The flat wood inside the board picture's rim and front edge, as parts of the picture (measured on station-board.webp). */
export const BOARD_SURFACE = { left: 0.085, right: 0.915, top: 0.1, bottom: 0.805 } as const;
/** Where the plate itself lies inside a plate's drawing box, as parts of it (festival.css: .fest-dish). */
export const DISH_IN_FACE = { left: 0.05, top: 0.4, width: 0.9, height: 0.56 } as const;

/**
 * The drawing box of each plate: the plates lie in two rows and two columns on the board's flat surface, with the same room round each. A plate
 * whose tap box takes the whole width (two stacked) or sits in the middle (the third of three) lies in the middle.
 */
function facesOn([x, y, w, h]: Rect, taps: readonly Rect[]): Rect[] {
  const sx = x + w * BOARD_SURFACE.left;
  const sw = w * (BOARD_SURFACE.right - BOARD_SURFACE.left);
  const sy = y + h * BOARD_SURFACE.top;
  const sh = h * (BOARD_SURFACE.bottom - BOARD_SURFACE.top);
  const dishW = sw * 0.46;
  const dishH = sh * 0.4;
  const faceW = dishW / DISH_IN_FACE.width;
  const faceH = dishH / DISH_IN_FACE.height;
  const middle = taps.reduce((n, [tx, , tw]) => n + tx + tw / 2, 0) / Math.max(1, taps.length);
  return taps.map(([tx, ty, tw, th], i): Rect => {
    const lower = taps.length === 2 && tw > w / 2 ? i === 1 : ty + th / 2 > y + h / 2;
    const off = tx + tw / 2 - middle;
    const centred = tw > w / 2 || (taps.length === 3 && i === 2) || Math.abs(off) < 1;
    const cx = sx + sw * (centred ? 0.5 : off < 0 ? 0.255 : 0.745);
    const dishTop = sy + sh * (lower ? 0.545 : 0.055);
    return [cx - faceW / 2, dishTop - faceH * DISH_IN_FACE.top, faceW, faceH];
  });
}

export type Counts = {
  atOnce: number;
  grill: number;
  plates: number;
  trays: number;
  /** The pans' foods in the kitchen's own order: landscape gives each its fixed place; `layout.trays` follows this order. */
  trayItems: readonly FoodId[];
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
    ledges: [[0, rowY + 86, 540, 18]],
    shelf: [0, trayTop - 4, 540, trayBottom - trayTop + 8],
    pantry: null,
    sauces: null,
    lockedSlots: [],
    rack: [88, down(868), 364, 90],
    plateStand: null,
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
    plateFaces: facesOn(board, platesOn(board, counts.plates)),
    trays,
    powers: row(3, 0, PORTRAIT.w, down(872), 108, 82, 12),
  };
}

/** The developer's picture the landscape boxes are measured on. */
const PICTURE = { w: 1819, h: 865 } as const;

/** The landscape stage's width for a window: the window's own shape, from 960 up to the picture's. */
export const wideWidth = (width: number, height: number): number =>
  height > 0
    ? Math.round(Math.min(WIDE.maxW, Math.max(WIDE.w, (WIDE.h * width) / height)))
    : WIDE.w;

/** Where each pan lies in the picture (x, y, width, height): three rows of three, and the fries under them. */
const PANS: Partial<Record<FoodId, Rect>> = {
  bun: [992, 361, 258, 120],
  patty: [1254, 361, 258, 120],
  chicken: [1516, 361, 258, 120],
  veggie: [992, 482, 258, 120],
  cheese: [1254, 482, 258, 120],
  lettuce: [1516, 482, 258, 120],
  tomato: [992, 603, 258, 119],
  onion: [1254, 603, 258, 119],
  pickles: [1516, 603, 258, 119],
  fries: [1190, 726, 214, 134],
};
/** The Sauce Station's bottles. */
const SAUCES: Partial<Record<FoodId, Rect>> = {
  ketchup: [102, 724, 142, 134],
  mustard: [246, 724, 142, 134],
};
/** Every food with a place in the landscape stall (a new festival's food needs one: festival-save-qa C1). */
export const WIDE_PLACES: readonly FoodId[] = [
  ...Object.keys(PANS),
  ...Object.keys(SAUCES),
] as FoodId[];

export function wideLayout(counts: Counts, width: number = WIDE.w): FestivalLayout {
  const W = Math.min(WIDE.maxW, Math.max(WIDE.w, width));
  const mx = (x: number) => (x * W) / PICTURE.w;
  const my = (y: number) => (y * WIDE.h) / PICTURE.h;
  /** A box measured on the picture, in stage units. */
  const m = (x: number, y: number, w: number, h: number): Rect => [mx(x), my(y), mx(w), my(h)];
  const at = ([x, y, w, h]: Rect) => m(x, y, w, h);

  // the top bar: Back, the count, the two scores, the power-ups right beside Pause
  const back: Rect = [mx(122), 4, 74, 74];
  const pause: Rect = [mx(1503), 4, 74, 74];
  const powersFrom = pause[0] - 6 - (3 * 74 + 2 * 4);
  const status: Rect = [back[0] + 82, 10, mx(200), 60];
  const scoresFrom = status[0] + status[2] + 8;

  // the customers stand between the sign and the chalkboard, the middle one just right of the grill
  const from = mx(378);
  const to = mx(1482);
  const gap = counts.atOnce >= 4 ? 4 : 24;
  const seatW = Math.min(
    counts.atOnce >= 4 ? 139 : 168,
    Math.floor((to - from - (counts.atOnce - 1) * gap) / counts.atOnce),
  );
  const span = counts.atOnce * seatW + (counts.atOnce - 1) * gap;
  const start = Math.min(to - span, Math.max(from, mx(930) - span / 2));
  const seats = row(counts.atOnce, start, span, 71, seatW, 81, gap).map(([x, y, w, h]) => ({
    bubble: [x, y, w, h] as const,
    person: [x + (w - 124) / 2, 142, 124, 88] as const,
  }));

  // the drinks keep their own places, left to right; one not on this stage's menu waits there, locked
  const column = [76, 224, 372] as const;
  const drinkBox = (i: number) => m(column[i]!, 306, 143, 188);
  const drink = Array.from({ length: counts.drinks }, (_, i) => drinkBox(i));

  const grillArt = m(540, 346, 402, 276);
  // the whole board is in view, its front edge just above the bottom of the stage
  const board: Rect = [mx(504), my(624), mx(456), WIDE.h - 3 - my(624)];
  // the plates keep their four places (their tap boxes start just right of the bin, so the two never meet); those this stage has not got
  // wait locked
  const places = platesOn([mx(516), my(622), mx(446), WIDE.h - my(622)], 4);
  const faces = facesOn(board, places);

  const trays = counts.trayItems.map((item) => at((PANS[item] ?? SAUCES[item])!));
  const lockedSlots: LockedSlot[] = [
    ...DRINKS.slice(counts.drinks).map((item, i): LockedSlot => ({
      kind: "drink",
      item,
      rect: drinkBox(counts.drinks + i),
    })),
    ...places.slice(counts.plates).map((rect, i): LockedSlot => ({
      kind: "plate",
      number: counts.plates + i + 1,
      rect,
      face: faces[counts.plates + i]!,
    })),
    ...WIDE_PLACES.filter((item) => !counts.trayItems.includes(item)).map((item): LockedSlot => ({
      kind: "tray",
      item,
      rect: at((PANS[item] ?? SAUCES[item])!),
    })),
  ];

  return {
    w: W,
    h: WIDE.h,
    wide: true,
    back,
    pause,
    scores: [scoresFrom, 3, powersFrom - 8 - scoresFrom, 65],
    status,
    // (the rival's line comes and goes over the chalkboard, clear of the power-ups and the orders)
    rivalSays: [mx(1488) - 8, 82, mx(222) + 12, 62],
    sign: [mx(135), 82, mx(225), 82],
    special: m(1488, 130, 222, 148),
    lamps: [
      [mx(430), 106],
      [mx(1242), 106],
    ],
    seats,
    counter: my(345),
    ledges: [m(0, 488, 505, 10), m(0, 682, 505, 10)],
    shelf: null,
    pantry: m(976, 350, 822, 513),
    sauces: m(98, 690, 346, 170),
    lockedSlots,
    rack: [powersFrom - 4, 0, 3 * 74 + 2 * 4 + 8, 78],
    plateStand: m(998, 728, 176, 132),
    props: [
      { art: "planter", box: m(0, 296, 74, 94) },
      { art: "planter", box: m(1744, 292, 75, 64) },
      { art: "mayo", box: m(390, 722, 50, 118) },
      { art: "napkins", box: m(1416, 742, 78, 100) },
      { art: "salt-pepper", box: m(1506, 766, 72, 74) },
      { art: "spatula", box: m(1580, 752, 52, 88) },
      { art: "tongs", box: m(1612, 752, 52, 88) },
      { art: "box", box: m(1670, 792, 102, 64) },
      { art: "box", box: m(1674, 740, 94, 60) },
    ],
    // (under the customers' chins, over the counter's edge and clear of the grill)
    hint: [W / 2 - 150, 191, 300, 25],
    drink,
    fryer: [m(76, 506, 143, 180), m(224, 506, 143, 180)],
    bin: m(372, 506, 143, 180),
    grillArt,
    ...grillSpots(grillArt, counts.grill),
    board,
    plates: places.slice(0, counts.plates),
    plateFaces: faces.slice(0, counts.plates),
    trays,
    powers: [0, 1, 2].map((i) => [powersFrom + i * 78, 2, 74, 74] as const),
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
