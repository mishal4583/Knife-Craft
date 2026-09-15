/**
 * STORY_MANAGER — pure logic over story progression, mirroring
 * LevelManager.ts's own documented convention ("pure logic, caller
 * persists"): no I/O of its own, `SaveManager` remains the only thing
 * that touches storage. This module just answers "what should the
 * story do right now" given a `StoryProgress` + the player's own
 * distinct-completed-level count, and returns the SaveData mutation the
 * caller should persist — it never reads or writes a save itself.
 *
 * Ported from knifecraft.html's `boot()`/`flush()`/`newGame()`
 * (`Story` IIFE, `:10772`), adapted from that IIFE's own imperative
 * DOM-sequencing model into small pure functions a React component
 * (StoryOverlay.tsx / MilestoneBanner.tsx) drives instead — see this
 * repo's own "adapt the behavior, don't import the standalone HTML
 * architecture" convention. The actual beat arrays/milestone list are
 * ported verbatim in storyDefinitions.ts; this file is only the
 * decision logic layered on top.
 */
import type { SaveData, StoryProgress } from "../SaveManager";
import { MILES, FINALE_AT, type MilestoneDef } from "./storyDefinitions";

/**
 * Ported from `Story.level() === Save.played()` (`:1914`/`:11208`) —
 * production's own "plates completed, forward-only" counter is
 * `levelProgress.completedLevelIds.length`: it only grows, exactly once
 * per NEWLY completed level (a replay never adds to it, matching the
 * source's own replay-pays-zero law), which is exactly the semantics
 * the source's own `n` needs.
 */
export function playedCount(save: SaveData): number {
  return save.levelProgress.completedLevelIds.length;
}

/** Ported from `boot()`'s own `Store.get(KEY.done) === true ? 'returning' : newGame()` check. */
export function shouldRunIntro(save: SaveData): boolean {
  return !save.story.introDone;
}

/** Ported from `newGame()`'s `Store.set(KEY.done, true)` (called once the intro sequence's last beat finishes). */
export function markIntroDone(save: SaveData): SaveData {
  return { ...save, story: { ...save.story, introDone: true } };
}

export type StoryFlushResult =
  { kind: "finale" } | { kind: "milestone"; milestone: MilestoneDef } | null;

/**
 * Ported from `flush()` (`:11197`) — finale checked first (once, via
 * `finaleSeen`), then the first unfired milestone bit only, forward-only
 * (`n >= m.at`), one result per call. Pure: does NOT mutate `save` or
 * mark anything fired — call `applyFinaleSeen`/`applyMilestoneFired`
 * with the result to get the SaveData to persist, exactly like
 * LevelManager.completeLevel returns a result the caller applies.
 */
export function checkStoryFlush(save: SaveData): StoryFlushResult {
  if (!save.story.introDone) return null; // never during/before the intro sequence
  const n = playedCount(save);
  if (n >= FINALE_AT && !save.story.finaleSeen) return { kind: "finale" };
  for (const m of MILES) {
    if (n >= m.at && !(save.story.milestoneMask & m.bit)) {
      return { kind: "milestone", milestone: m };
    }
  }
  return null;
}

export function applyFinaleSeen(save: SaveData): SaveData {
  return { ...save, story: { ...save.story, finaleSeen: true } };
}

export function applyMilestoneFired(save: SaveData, milestone: MilestoneDef): SaveData {
  return {
    ...save,
    story: { ...save.story, milestoneMask: save.story.milestoneMask | milestone.bit },
  };
}

/** Debug/QA-only report, mirroring the source's own `Story.report()` (`:11212`). Not required for normal play; kept for parity/inspectability. */
export function storyReport(save: SaveData): {
  introDone: boolean;
  milestoneMask: number;
  finaleSeen: boolean;
  level: number;
} {
  return {
    introDone: save.story.introDone,
    milestoneMask: save.story.milestoneMask,
    finaleSeen: save.story.finaleSeen,
    level: playedCount(save),
  };
}

export type { StoryProgress };
