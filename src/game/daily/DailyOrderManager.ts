/**
 * DAILY_ORDER_MANAGER — pure logic, mirroring LevelManager.ts's own
 * convention ("pure logic, caller persists"). Daily Order is NOT a new
 * content system: it always points at a level already in LEVELS
 * (levelDefinitions.ts) that the player has already unlocked through
 * ordinary campaign play, run through the exact same Preparation flow
 * every other level uses. What's new is only: (1) which level is
 * "featured" today, deterministic and identical for every player on the
 * same calendar day, and (2) a small once-per-day bonus on top of
 * whatever that level would normally pay, tracked via
 * SaveData.dailyOrder.
 *
 * No energy/lives system, no FOMO: missing a day never locks anything —
 * the level itself stays completable normally at any time, the ONLY
 * thing tied to "today" is whether the small bonus has already been
 * claimed. A broken streak just resets the streak counter, a flavor
 * number, never a gate.
 */
import { getLevels, isUnlocked } from "../levels/LevelManager";
import type { LevelProgress } from "../levels/LevelManager";
import type { LevelDefinition } from "../levels/levelTypes";
import type { DailyOrderProgress } from "../SaveManager";

/** The flat once-a-day bonus, paid on top of the level's own normal reward.coins — never a percentage, never scaled by performance. */
export const DAILY_ORDER_BONUS_COINS = 50;

/** Local "YYYY-MM-DD" — a calendar day, not a timestamp, so this never depends on time-of-day or timezone drift mattering beyond "which day is it". */
export function dailyKeyFor(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The day immediately before `key` ("YYYY-MM-DD" in, same shape out) — used only to decide whether a streak continues or resets. */
function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() - 1);
  return dailyKeyFor(dt);
}

/**
 * A simple deterministic string hash — same input always produces the
 * same non-negative integer, no external RNG/seed library needed for
 * "pick the same featured level for everyone on the same day".
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Today's featured level — deterministic per calendar day, drawn ONLY
 * from levels the player has already unlocked (never spoils/skips ahead
 * of real campaign progress). Falls back to the first level if somehow
 * nothing is unlocked yet (never happens in practice — Level 1 is always
 * unlocked), so this never returns undefined.
 */
export function pickDailyLevel(progress: LevelProgress, date: Date): LevelDefinition {
  const levels = getLevels();
  const unlocked = levels.filter((l) => isUnlocked(l, progress));
  const pool = unlocked.length > 0 ? unlocked : levels;
  const index = hashString(dailyKeyFor(date)) % pool.length;
  return pool[index]!;
}

export function hasClaimedToday(daily: DailyOrderProgress, date: Date): boolean {
  return daily.lastClaimedDate === dailyKeyFor(date);
}

/**
 * Marks today's bonus claimed and advances the streak — called once,
 * the moment a Daily Order session completes (see App.tsx's
 * recordDailyResult). Streak continues only if the last claim was
 * exactly yesterday; any bigger gap (including never having claimed
 * before) starts a fresh streak of 1, never blocks the claim itself.
 */
export function claimDaily(daily: DailyOrderProgress, date: Date): DailyOrderProgress {
  const today = dailyKeyFor(date);
  if (daily.lastClaimedDate === today) return daily; // already claimed — idempotent, no double-award
  const continuesStreak = daily.lastClaimedDate === previousDayKey(today);
  return { lastClaimedDate: today, streak: continuesStreak ? daily.streak + 1 : 1 };
}
