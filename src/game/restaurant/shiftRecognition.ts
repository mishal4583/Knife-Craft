/**
 * SHIFT RECOGNITION (Chef Pride audit remediation, Batch 2, developer 2026-11-23): what the Level Complete "shift card" says about the service that just ended.
 *
 * Everything here is read from real play and is never estimated:
 *   - orders, accuracy and perfect cuts come from the plates the player actually served (App's service tallies);
 *   - WASTE comes from the fridge itself: the stock already expired (what closing would throw out) plus what was thrown out earlier today with "Throw Out Expired".
 *     Before the fridge-and-freshness level the game has no spoilage at all, so nothing is claimed ("not tracked" is `null`, never a zero).
 *     "Zero wasted" is shown ONLY when both of those numbers are exactly zero;
 *   - the performance tier is a plain reading of the service's average plate accuracy on the game's own grade ladder (CutEvaluator GRADE_THRESHOLDS);
 *   - "personal improvements" are named only against a real earlier mark (a first service sets the mark; it is not a record).
 *
 * Pure: no clock, no random, no wallet, no ledger, no save write. The caller decides where the words go.
 */
import { INGREDIENTS } from "../definitions";
import type { SaveData } from "../SaveManager";
import {
  CLEAN_FROM,
  MASTERFUL_FROM,
  type ChefRecord,
  type RecordNews,
  type ServiceStats,
} from "./chefRecord";
import { advanceBusinessDay } from "../business/businessCalendar";
import { clearExpiredStock } from "../business/SpoilageManager";
import { isSystemLive } from "./restaurantProgression";
import { dareProgressText, type DareView } from "./skillChallenges";

/** The fridge's side of a shift: units spoiled (already expired now, or thrown out earlier today) and the names of what is expired now. */
export type ShiftWaste = {
  /** Units of stock spoiled: expired in the fridge now + thrown out earlier today. Whole number, never negative. */
  quantity: number;
  /** Names of the ingredients that are expired in the fridge right now (the ones thrown out earlier today are not named: the save only keeps their quantity). */
  names: string[];
  /** True when some of it was already thrown out earlier today (so a zero can never be claimed over it). */
  thrownOutEarlier: boolean;
};

/**
 * The waste of the shift, or null when the game does not track spoilage at this level (a null is "say nothing", never "zero").
 * `levelNumber` is the level number the Closing Time screen uses for its own preview.
 */
export function shiftWaste(save: SaveData, levelNumber: number): ShiftWaste | null {
  if (!isSystemLive("fridge-freshness", levelNumber)) return null; // not live: nothing to report
  // The same sweep the Closing Time screen previews (restaurantDay.closingPreview): stock expired by tomorrow.
  const swept = clearExpiredStock(
    save.business.inventory,
    advanceBusinessDay(save.business.calendar).businessDay,
  );
  const acc = save.business.finance?.dailyAccumulator;
  const earlier =
    typeof acc?.discardedQuantity === "number" && Number.isFinite(acc.discardedQuantity)
      ? Math.max(0, acc.discardedQuantity)
      : 0;
  const now = Math.max(0, Number.isFinite(swept.spoiledQuantity) ? swept.spoiledQuantity : 0);
  const total = now + earlier;
  return {
    // A fraction of a unit still spoiled something: round up, so a real spoilage never reads as zero.
    quantity: total > 0 ? Math.max(1, Math.ceil(total - 1e-9)) : 0,
    names: swept.spoiledIngredientIds.map((id) => INGREDIENTS[id]?.name ?? String(id)),
    thrownOutEarlier: earlier > 0,
  };
}

/** True ONLY when the spoilage data confirms nothing was wasted. */
export const isZeroWaste = (w: ShiftWaste | null): boolean => !!w && w.quantity === 0;

/**
 * Did the business day that is about to close waste nothing? The Zero Waste dare reads THIS (audit F4, developer 2026-11-23), the same figures the shift card reads:
 * the stock that is expired now and would be thrown out at closing, PLUS everything thrown out earlier today (Throw Out Expired, a purchase that cleared old stock of what it
 * bought). So removing spoiled food before closing cannot make a wasteful day clean. Where the game does not track spoilage yet (before the fridge-and-freshness stage) there
 * is nothing to waste, so the day is waste-free, exactly as it was before. Call it with the save BEFORE the day closes (closing resets the day's discards).
 */
export const dayIsWasteFree = (save: SaveData, levelNumber: number): boolean => {
  const w = shiftWaste(save, levelNumber);
  return w === null || w.quantity === 0;
};

/** The "Wasted" tile of the shift card, or null when spoilage is not tracked. */
export function wasteTile(w: ShiftWaste | null): { value: string; label: string } | null {
  return w ? { value: String(w.quantity), label: "Wasted" } : null;
}

/** The note under the tiles: genuine zero waste, or what spoiled. Null when spoilage is not tracked. */
export function wasteNote(w: ShiftWaste | null): string | null {
  if (!w) return null;
  if (w.quantity === 0) return "♻ Zero waste: nothing spoiled";
  if (w.names.length > 0) return `🗑️ Spoiled: ${w.names.join(", ")}`;
  return "🗑️ Thrown out earlier today";
}

export type ShiftTierId = "masterful" | "excellent" | "good" | "steady" | "learning";
export type ShiftTier = { id: ShiftTierId; title: string; emoji: string };

/**
 * The performance tier of a service, from its average plate accuracy (the game's grade ladder: 95 Masterful, 85 Clean, 70 Honest, 50 Rustic). Null when no plate was served.
 * The wording is warm at every level: a lower tier never shames, it says what the next shift is for.
 */
export function shiftTier(service: Pick<ServiceStats, "orders" | "accuracy">): ShiftTier | null {
  if (!(service.orders > 0)) return null;
  const a = Number.isFinite(service.accuracy) ? service.accuracy : 0;
  if (a >= MASTERFUL_FROM) return { id: "masterful", title: "A Masterful Shift!", emoji: "🏅" };
  if (a >= CLEAN_FROM) return { id: "excellent", title: "Excellent Work, Chef!", emoji: "⭐" };
  if (a >= 70) return { id: "good", title: "Good Shift, Chef", emoji: "👍" };
  if (a >= 50) return { id: "steady", title: "Steady Hands, Chef", emoji: "🔪" };
  return { id: "learning", title: "Every Shift Teaches", emoji: "📖" };
}

/**
 * What this service beat, against a real earlier mark only (the record BEFORE this service is applied):
 *   - accuracy up on the last service, or the best yet (chefRecord.serviceNews says it; the wording stays there);
 *   - more perfect cuts in one service than ever before.
 * A first service has nothing to beat, so it reports nothing.
 */
export function perfectsNews(before: ChefRecord, service: ServiceStats): RecordNews[] {
  if (before.services <= 0 || before.bestServicePerfects <= 0) return [];
  const p = Math.max(0, Math.floor(service.perfects));
  return p > before.bestServicePerfects
    ? [{ kind: "perfects", text: `Most perfect cuts in a service: ${p}` }]
    : [];
}

/** The dare a player has taken and not yet won, as the shift card tells it ("Perfect Chef · 2 of 3 plates"); null when no dare is under way. */
export function shiftDare(view: DareView | null): { title: string; progress: string } | null {
  if (!view || view.status !== "accepted") return null;
  return { title: view.dare.title, progress: dareProgressText(view) };
}

/**
 * Everything the Level Complete shift card shows about the service, in one value (App holds it with the Level Complete notice).
 * `perfects` is null when NO hand-cut run was recorded (every plate was the Prep Cook's, or the tally began after a reload): the card then shows "-", never a made-up 0.
 */
export type ShiftCard = Omit<ServiceStats, "perfects"> & {
  perfects: number | null;
  /** True when the Prep Cook cooked at least one plate of this service (the card says its perfect cuts are the player's own). */
  cook: boolean;
  /** Real improvements, dares won, prestige and title lines (each shown once). */
  news: string[];
  tier: ShiftTier | null;
  waste: ShiftWaste | null;
  dare: { title: string; progress: string } | null;
};

// ── The shift tally ──────────────────────────────────────────────────────────

/**
 * What the shift card counts, kept in memory by App for the service on screen. It is its OWN tally: the service star rating keeps its own (App's `serviceScoresRef`) and
 * never reads this. Session only (a reload mid-service starts it again from the plates served after it). One entry per served order (an order is counted once, whatever
 * calls in), scores of the plates really served and paid (a replay never counts), and the perfect cuts of the runs the player cut BY HAND.
 */
export type ShiftTally = {
  levelId: string;
  plates: { id: string; score: number }[];
  /** Hand-cut runs reported (a shared batch run counts once) and the perfect cuts they landed. */
  handRuns: number;
  handPerfects: number;
  /** Runs the Prep Cook did: they have no perfect cuts of their own and add none. */
  cookRuns: number;
};

export const EMPTY_SHIFT_TALLY: ShiftTally = {
  levelId: "",
  plates: [],
  handRuns: 0,
  handPerfects: 0,
  cookRuns: 0,
};

const fresh = (levelId: string): ShiftTally => ({ ...EMPTY_SHIFT_TALLY, plates: [], levelId });
const inLevel = (t: ShiftTally, levelId: string): ShiftTally =>
  t.levelId === levelId ? t : fresh(levelId);

/** One served, paid plate. The same order id twice is one plate; a bad score or no id is ignored. */
export function tallyPlate(
  t: ShiftTally,
  levelId: string,
  plate: { id: string; score: number },
): ShiftTally {
  if (!plate.id || typeof plate.score !== "number" || !Number.isFinite(plate.score)) return t;
  const base = inLevel(t, levelId);
  if (base.plates.some((p) => p.id === plate.id)) return base;
  const score = Math.min(100, Math.max(0, plate.score));
  return { ...base, plates: [...base.plates, { id: plate.id, score }] };
}

/** One finished run's stats: a hand-cut run adds its perfect cuts, a Prep Cook run adds none and only marks that the cook worked. */
export function tallyRun(
  t: ShiftTally,
  levelId: string,
  run: { perfects: number; byCook?: boolean },
): ShiftTally {
  const base = inLevel(t, levelId);
  if (run.byCook) return { ...base, cookRuns: base.cookRuns + 1 };
  const perfects = Number.isFinite(run.perfects) ? Math.max(0, Math.floor(run.perfects)) : 0;
  return { ...base, handRuns: base.handRuns + 1, handPerfects: base.handPerfects + perfects };
}

/** The service as the tally recorded it, or null when no plate was recorded for this level (no card is made up). */
export function shiftService(
  t: ShiftTally,
  levelId: string,
): { orders: number; accuracy: number; perfects: number | null; cook: boolean } | null {
  if (t.levelId !== levelId || t.plates.length === 0) return null;
  const sum = t.plates.reduce((a, p) => a + p.score, 0);
  return {
    orders: t.plates.length,
    accuracy: Math.round(sum / t.plates.length),
    perfects: t.handRuns > 0 ? t.handPerfects : null,
    cook: t.cookRuns > 0,
  };
}

/** The big-number tiles of the card: Orders, Accuracy, Perfects, and Wasted only when the fridge tracks spoilage. */
export function shiftStats(shift: ShiftCard): { value: string; label: string }[] {
  const waste = wasteTile(shift.waste);
  return [
    { value: String(shift.orders), label: "Orders" },
    { value: `${shift.accuracy}%`, label: "Accuracy" },
    // Nothing was recorded by hand: a dash, never a zero the player did not earn.
    { value: shift.perfects === null ? "-" : String(shift.perfects), label: "Perfects" },
    ...(waste ? [waste] : []),
  ];
}

/** The note lines of the card, in order: what was beaten, titles and dares (news), the Prep Cook note, the waste line, the dare under way. */
export function shiftNotes(shift: ShiftCard): string[] {
  const waste = wasteNote(shift.waste);
  return [
    ...shift.news.map((n) => `★ ${n}`),
    ...(shift.cook ? ["🔪 Perfects count your own cuts only"] : []),
    ...(waste ? [waste] : []),
    ...(shift.dare
      ? [`⚔ Dare: ${shift.dare.title}${shift.dare.progress ? ` · ${shift.dare.progress}` : ""}`]
      : []),
  ];
}
