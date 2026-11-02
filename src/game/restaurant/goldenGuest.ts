/**
 * GOLDEN GUEST (spec 2026-11-02): a VIP walks onto the Second Floor about every four minutes while the player is looking at it.
 * Tap in time and the VIP pays a burst onto the Pickup Counter; a rewarded ad makes it three times as much.
 *
 * Deterministic (no Math.random for money): the clock is cut into 4-minute SLOTS; each slot has one VIP whose arrival second and
 * place on the floor come from an integer hash of the slot number, so a reload or a second device shows the same VIP, and a slot
 * can be paid once (`goldenSlot` in the floor's saved state). Pure functions of the time you pass in.
 *
 *   burst = max(1 minute of the floor's income, 2 % of the goal the player is saving for)   (the ad adds twice that)
 */
import type { SaveData } from "../SaveManager";
import { floorGoals } from "./floorGoal";
import {
  addGoldenBonus,
  floorEarnings,
  floorPerHour,
  isSecondFloorOpen,
  secondFloorOf,
  type FloorResult,
} from "./secondFloor";

export const GOLDEN_SLOT_MS = 240_000;
export const GOLDEN_VISIBLE_MS = 12_000;
/** Earliest and latest arrival inside a slot (ms from its start). */
const EARLIEST_MS = 15_000;
const SPREAD_MS = 200_000;

const hash = (n: number, salt: number) => {
  let h = Math.imul((n ^ salt) >>> 0, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
};

export type GoldenGuest = {
  slot: number;
  /** When the VIP arrives and leaves (epoch ms). */
  arriveAt: number;
  leaveAt: number;
  /** Where they stand on the floor, in percent of the map. */
  x: number;
  y: number;
};

/** The VIP of the slot `slot` (every slot has one). */
export function goldenOfSlot(slot: number): GoldenGuest {
  const arriveAt = slot * GOLDEN_SLOT_MS + EARLIEST_MS + (hash(slot, 11) % SPREAD_MS);
  return {
    slot,
    arriveAt,
    leaveAt: arriveAt + GOLDEN_VISIBLE_MS,
    x: 14 + (hash(slot, 23) % 64),
    y: 36 + (hash(slot, 37) % 22),
  };
}

/** The VIP on the floor right now, or null. */
export function goldenAt(now: number): GoldenGuest | null {
  const g = goldenOfSlot(Math.floor(now / GOLDEN_SLOT_MS));
  return now >= g.arriveAt && now < g.leaveAt ? g : null;
}

export type GoldenAmounts = { burst: number; adExtra: number };

/** What this VIP pays: the burst for the tap, and the extra a rewarded ad adds. */
export function goldenAmounts(save: SaveData, reachedLevel: number, now: number): GoldenAmounts {
  if (!isSecondFloorOpen(reachedLevel)) return { burst: 0, adExtra: 0 };
  const floor = secondFloorOf(save);
  if (Object.keys(floor.stations).length === 0) return { burst: 0, adExtra: 0 };
  const funds = save.credits + floorEarnings(save, now);
  const goals = floorGoals(save, reachedLevel);
  const target =
    goals.find((g) => g.price > funds) ?? [...goals].sort((a, b) => b.price - a.price)[0];
  const byRate = Math.floor(floorPerHour(save) / 60);
  const byGoal = Math.floor(((target?.price ?? 0) * 2) / 100);
  const burst = Math.max(byRate, byGoal);
  return { burst, adExtra: burst * 2 };
}

/** Can this VIP still be paid (not already claimed on this save)? */
export function goldenAvailable(save: SaveData, slot: number): boolean {
  const claimed = secondFloorOf(save).goldenSlot;
  return claimed === undefined || slot > claimed;
}

/**
 * The player tapped the VIP of `slot` in time: the burst lands on the Pickup Counter (no wallet movement yet). Refused when the VIP
 * is not on the floor now, or was already paid.
 */
export function claimGolden(
  save: SaveData,
  slot: number,
  reachedLevel: number,
  now: number,
): FloorResult {
  const g = goldenAt(now);
  if (!g || g.slot !== slot || !goldenAvailable(save, slot))
    return { ok: false, reason: "nothing" };
  const { burst } = goldenAmounts(save, reachedLevel, now);
  if (burst <= 0) return { ok: false, reason: "nothing" };
  const next = addGoldenBonus(save, burst, slot);
  if (next === save) return { ok: false, reason: "nothing" };
  return { ok: true, save: next, amount: burst };
}
