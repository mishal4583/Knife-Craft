/**
 * PREP_RUSH — Phase 3 (B, developer 2026-10-21): Endless Prep Rush, an
 * optional arcade challenge on its own screen. Ingredients ride a conveyor
 * belt; the player cuts them as they pass.
 *
 * Kept entirely apart from the restaurant: it reads and writes no save
 * state, credits no money, records no ledger entry and touches no
 * achievement, ranking or progression. Its only memory is the best score of
 * this browser session (no save field — the brief's allowance when a saved
 * high score would need one).
 *
 * The rules, all from PREP_RUSH below:
 * - CUT: a swipe across an ingredient cuts it. Through the middle (the
 *   swipe's line passes within CLEAN_OFFSET of the centre, as a fraction of
 *   its radius) is a CLEAN cut; a tap cuts too but is never clean (the main
 *   game's rule: tap is the relaxed mode, swipe the precise one).
 * - Each ingredient is scored exactly once: on the belt -> cut (it hops into
 *   the Prepared bowl) or -> missed (it falls off the belt's end into the
 *   Missed bin). Nothing else can score it.
 * - POINTS: PREPARED per cut, + CLEAN for a clean one, + COMBO_BONUS every
 *   COMBO_EVERY cuts in a row; a miss resets the run.
 * - DIFFICULTY rises in steps every STEP_MS: the belt speeds up and
 *   ingredients come closer together, both capped; the first STEP_MS is
 *   gentle. At most MAX_ON_BELT ingredients at once (a spawn waits if the
 *   belt is full), so it can never flood.
 * - SEQUENCE: a fixed seed, so every run brings the same ingredients in the
 *   same order — a fair, learnable, testable challenge.
 * - END: after DURATION_MS of play (the clock stops while paused) or at
 *   MAX_MISSES misses, whichever comes first.
 */
export const PREP_RUSH = {
  DURATION_MS: 60_000,
  MAX_MISSES: 5,
  SEED: 20261021,
  KINDS: ["tomato", "onion", "orange", "potato"] as const,
  /** Size on the belt, as a fraction of the same ingredient on the cutting board. */
  SIZE_FRAC: 0.42,
  /** Belt speed, in belt-lengths per second: START, + STEP every STEP_MS, never above MAX. */
  SPEED_START: 0.16,
  SPEED_STEP: 0.012,
  SPEED_MAX: 0.28,
  /** Time between ingredients: START, − STEP every STEP_MS, never below MIN. */
  INTERVAL_START_MS: 1500,
  INTERVAL_STEP_MS: 90,
  INTERVAL_MIN_MS: 850,
  STEP_MS: 10_000,
  MAX_ON_BELT: 6,
  CLEAN_OFFSET: 0.28,
  POINTS: { PREPARED: 10, CLEAN: 5, COMBO_EVERY: 5, COMBO_BONUS: 10 },
} as const;

export type RushKind = (typeof PREP_RUSH.KINDS)[number];

export type RushStats = {
  score: number;
  prepared: number;
  clean: number;
  missed: number;
  combo: number;
  bestCombo: number;
};

export const EMPTY_STATS: RushStats = {
  score: 0,
  prepared: 0,
  clean: 0,
  missed: 0,
  combo: 0,
  bestCombo: 0,
};

const level = (ms: number) => Math.floor(Math.max(0, ms) / PREP_RUSH.STEP_MS);

/** Belt speed (belt-lengths per second) after `ms` of play. */
export function speedAt(ms: number): number {
  return Math.min(PREP_RUSH.SPEED_MAX, PREP_RUSH.SPEED_START + PREP_RUSH.SPEED_STEP * level(ms));
}

/** Time to the next ingredient after `ms` of play. */
export function intervalAt(ms: number): number {
  return Math.max(
    PREP_RUSH.INTERVAL_MIN_MS,
    PREP_RUSH.INTERVAL_START_MS - PREP_RUSH.INTERVAL_STEP_MS * level(ms),
  );
}

/**
 * The ingredient sequence: mulberry32 from the fixed seed, never the same
 * kind three times running (a little variety, never a pattern that can't
 * be read). The same seed always gives the same sequence.
 */
export function rushSequence(seed: number = PREP_RUSH.SEED): () => RushKind {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const last: RushKind[] = [];
  return () => {
    let k = PREP_RUSH.KINDS[Math.floor(rand() * PREP_RUSH.KINDS.length)]!;
    if (last.length === 2 && last[0] === k && last[1] === k)
      k = PREP_RUSH.KINDS[(PREP_RUSH.KINDS.indexOf(k) + 1) % PREP_RUSH.KINDS.length]!;
    last.push(k);
    if (last.length > 2) last.shift();
    return k;
  };
}

/** A cut: one ingredient prepared (clean or not). */
export function scoreCut(s: RushStats, clean: boolean): RushStats {
  const combo = s.combo + 1;
  const bonus = combo % PREP_RUSH.POINTS.COMBO_EVERY === 0 ? PREP_RUSH.POINTS.COMBO_BONUS : 0;
  return {
    score: s.score + PREP_RUSH.POINTS.PREPARED + (clean ? PREP_RUSH.POINTS.CLEAN : 0) + bonus,
    prepared: s.prepared + 1,
    clean: s.clean + (clean ? 1 : 0),
    missed: s.missed,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
  };
}

/** A miss: the run resets. */
export function scoreMiss(s: RushStats): RushStats {
  return { ...s, missed: s.missed + 1, combo: 0 };
}

/** The session is over: out of time or out of misses. */
export function rushOver(playedMs: number, s: RushStats): boolean {
  return playedMs >= PREP_RUSH.DURATION_MS || s.missed >= PREP_RUSH.MAX_MISSES;
}

/**
 * Whether a swipe's line (through a and b) is a clean cut of an ingredient
 * of radius `r` at (cx, cy): it must pass within CLEAN_OFFSET × r of the
 * centre. (That it crosses the ingredient at all is the scene's check.)
 */
export function isCleanCut(
  a: { x: number; y: number },
  b: { x: number; y: number },
  cx: number,
  cy: number,
  r: number,
): boolean {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6 || r <= 0) return false;
  const off = Math.abs((cx - a.x) * vy - (cy - a.y) * vx) / len;
  return off <= PREP_RUSH.CLEAN_OFFSET * r;
}

/** True when the segment a→b passes within r of (cx, cy) — "did this stroke cross it". Also used by the Vegetable Avalanche (kitchenChaos.ts). */
export function segmentNear(
  a: { x: number; y: number },
  b: { x: number; y: number },
  cx: number,
  cy: number,
  r: number,
): boolean {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - a.x) * vx + (cy - a.y) * vy) / len2)) : 0;
  return Math.hypot(cx - (a.x + t * vx), cy - (a.y + t * vy)) <= r;
}

let sessionBest = 0;
/** Records a finished run's score; `isNew` when it beat this session's best (a first run with points counts as new). */
export function recordRushScore(score: number): { best: number; isNew: boolean } {
  const isNew = score > sessionBest;
  if (isNew) sessionBest = score;
  return { best: sessionBest, isNew };
}
/** This browser session's best (0 before any run). */
export function rushSessionBest(): number {
  return sessionBest;
}
