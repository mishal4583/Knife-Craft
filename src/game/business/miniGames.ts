import type { SaveData } from "../SaveManager";
import { restaurantSystem } from "../restaurant/restaurantProgression";
import { isPracticeOpen } from "../restaurant/fridgeCheck";
import { CAR_PARK_FIRST_LEVEL, carParkDue, isCarParkOpen } from "./carPark";
import { CRATE_FIRST_LEVEL } from "./crateDispatch";
import { DESSERT_RUN_FIRST_LEVEL } from "./dessertRun";
import { INSPECTION_FIRST_LEVEL, isInspectionOpen, pendingInspections } from "./deliveryInspection";
import { unpackLocked } from "./deliveryFlow";
import {
  FRIDGE_SORT_FIRST_LEVEL,
  isFridgeSortOpen,
  piecesWaiting,
  roundFor as fridgeSortRound,
} from "./fridgeSort";
import {
  SAUCE_FIRST_LEVEL,
  canOfferRoundsAd,
  isSauceStationOpen,
  roundsAllowed,
  roundsLeft,
} from "./sauceStation";
import {
  STOCKROOM_FIRST_LEVEL,
  isStockroomOpen,
  setsWaiting,
  roundFor as stockroomRound,
} from "./stockroomSort";

/**
 * THE MINI-GAMES SHELF (developer 2026-11-17: "every mini-game inside the home kitchen screen, each one available to
 * play according to its level"). One list, read by the Kitchen's Mini-games sheet: each game's logo, the level it
 * opens at, and a short line saying what is waiting. Pure: it reads the save and moves nothing, and it opens nothing
 * a game's own rules keep shut:
 *   - the games that work on the real stock (Check the delivery, Fridge Sort, Stock the shelves) are ready only while
 *     something waits, as everywhere else, so the shelf can never be used to farm a round;
 *   - the Sauce Station is ready while today's rounds last, the Car Park while today's lot is still open (its Hype is
 *     once a business day);
 *   - the Fridge Check, Dessert Run and Kitchen Dispatch are free play with no reward.
 */
export type MiniGameId =
  | "inspection"
  | "fridge-sort"
  | "sauce"
  | "stockroom"
  | "fridge-check"
  | "car-park"
  | "dessert-run"
  | "kitchen-dispatch";

export type MiniGameState = "locked" | "ready" | "resting";

export type MiniGameEntry = {
  id: MiniGameId;
  name: string;
  /** The logo: a glyph on a coloured tile (the painted logos can replace it later). */
  glyph: string;
  /** The tile's two colours, light to deep. */
  tint: readonly [string, string];
  /** The screen the app opens. */
  screen:
    | "delivery-inspection"
    | "fridge-sort"
    | "sauce-station"
    | "stockroom-sort"
    | "fridge-check"
    | "car-park"
    | "dessert-run"
    | "kitchen-dispatch";
  /** The level it opens at (for the lock label). */
  firstLevel: number;
  open: (save: SaveData, level: number) => boolean;
  /** Short line shown under the name once it is open. */
  line: (save: SaveData, level: number) => { ready: boolean; text: string; waiting?: boolean };
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const MINI_GAMES: readonly MiniGameEntry[] = [
  {
    id: "inspection",
    name: "Check the delivery",
    glyph: "🔎",
    tint: ["#fbe4cf", "#e8a574"],
    screen: "delivery-inspection",
    firstLevel: INSPECTION_FIRST_LEVEL,
    open: (_s, level) => isInspectionOpen(level),
    line: (s, level) => {
      const n = pendingInspections(s, level);
      return n > 0
        ? { ready: true, text: plural(n, "basket waits", "baskets wait"), waiting: true }
        : { ready: false, text: "Nothing to check" };
    },
  },
  {
    id: "fridge-sort",
    name: "Fridge Sort",
    glyph: "🧊",
    tint: ["#e3f2f6", "#8fc4d6"],
    screen: "fridge-sort",
    firstLevel: FRIDGE_SORT_FIRST_LEVEL,
    open: (_s, level) => isFridgeSortOpen(level),
    line: (s, level) => {
      if (!fridgeSortRound(s, level)) return { ready: false, text: "Nothing to unpack" };
      return unpackLocked(s, level)
        ? { ready: true, text: "Check the delivery first" }
        : {
            ready: true,
            text: plural(piecesWaiting(s), "piece waits", "pieces wait"),
            waiting: true,
          };
    },
  },
  {
    id: "sauce",
    name: "Sauce Station",
    glyph: "🥣",
    tint: ["#fbdcc9", "#e58a62"],
    screen: "sauce-station",
    firstLevel: SAUCE_FIRST_LEVEL,
    open: (_s, level) => isSauceStationOpen(level),
    line: (s, level) => {
      const left = roundsLeft(s, level);
      if (left > 0)
        return { ready: true, text: `${left}/${roundsAllowed(s)} rounds left`, waiting: true };
      return canOfferRoundsAd(s, level)
        ? { ready: true, text: "More rounds for an ad" }
        : { ready: false, text: "Done for today" };
    },
  },
  {
    id: "stockroom",
    name: "Stock the shelves",
    glyph: "🗄️",
    tint: ["#f7e3b0", "#d8a24e"],
    screen: "stockroom-sort",
    firstLevel: STOCKROOM_FIRST_LEVEL,
    open: (_s, level) => isStockroomOpen(level),
    line: (s, level) =>
      stockroomRound(s, level)
        ? { ready: true, text: plural(setsWaiting(s), "set waits", "sets wait"), waiting: true }
        : { ready: false, text: "Nothing to stock" },
  },
  {
    id: "fridge-check",
    name: "Fridge Check",
    glyph: "🔍",
    tint: ["#e3f2f6", "#7fb6c9"],
    screen: "fridge-check",
    firstLevel: restaurantSystem("fridge-freshness").firstLevel,
    open: (s, level) => isPracticeOpen(s, level),
    line: () => ({ ready: true, text: "Free play" }),
  },
  {
    id: "car-park",
    name: "Car Park",
    glyph: "🚗",
    tint: ["#dcebfb", "#6f9fd8"],
    screen: "car-park",
    firstLevel: CAR_PARK_FIRST_LEVEL,
    open: (_s, level) => isCarParkOpen(level),
    line: (s, level) =>
      carParkDue(s, level)
        ? { ready: true, text: "Today's lot waits", waiting: true }
        : { ready: false, text: "Cleared today" },
  },
  {
    id: "dessert-run",
    name: "Dessert Run",
    glyph: "🍰",
    tint: ["#fde0ec", "#ee8fb4"],
    screen: "dessert-run",
    firstLevel: DESSERT_RUN_FIRST_LEVEL,
    open: (_s, level) => level >= DESSERT_RUN_FIRST_LEVEL,
    line: () => ({ ready: true, text: "Free play" }),
  },
  {
    id: "kitchen-dispatch",
    name: "Unload the Van",
    glyph: "🚚",
    tint: ["#e4f3d4", "#8cc063"],
    screen: "kitchen-dispatch",
    firstLevel: CRATE_FIRST_LEVEL,
    open: (_s, level) => level >= CRATE_FIRST_LEVEL,
    line: () => ({ ready: true, text: "Free play" }),
  },
];

/** The shelf in the order the games open. */
export const MINI_GAMES_BY_LEVEL: readonly MiniGameEntry[] = [...MINI_GAMES].sort(
  (a, b) => a.firstLevel - b.firstLevel,
);

export type MiniGameView = {
  entry: MiniGameEntry;
  state: MiniGameState;
  /** The line under the name: "Opens at Level N" would be built by the screen from `entry.firstLevel`; here only the open lines. */
  text: string | null;
  /** Something is really waiting to be played (baskets, pieces, rounds, sets, today's lot): the card shows a star. Free play and gated games are not "waiting". */
  waiting: boolean;
};

/** Each game's state for this save: locked (below its level), ready (a tap plays), or resting (open, nothing to play now). */
export function miniGameViews(save: SaveData, level: number): MiniGameView[] {
  return MINI_GAMES_BY_LEVEL.map((entry) => {
    if (!entry.open(save, level)) return { entry, state: "locked", text: null, waiting: false };
    const { ready, text, waiting } = entry.line(save, level);
    return { entry, state: ready ? "ready" : "resting", text, waiting: ready && waiting === true };
  });
}

/** Whether a screen is one of the mini-games on the shelf. */
export const isMiniGameScreen = (screen: string): boolean =>
  MINI_GAMES.some((g) => g.screen === screen);

/** Whether a screen is one of the two games that are only free play, and so need the player's level to open (see `go`). */
export const isFreePlayScreen = (screen: string): screen is "dessert-run" | "kitchen-dispatch" =>
  screen === "dessert-run" || screen === "kitchen-dispatch";

/** The level a free-play game needs, or null for any other screen. */
export const freePlayFirstLevel = (screen: string): number | null =>
  screen === "dessert-run"
    ? DESSERT_RUN_FIRST_LEVEL
    : screen === "kitchen-dispatch"
      ? CRATE_FIRST_LEVEL
      : null;
