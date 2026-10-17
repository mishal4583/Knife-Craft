/**
 * STORY LEGACY QA — the late story and "THE LAST PAGE" (developer 2026-10-11,
 * text approved verbatim; decisions 1 and 2). Re-baselined 2026-10-17 to the
 * 150-level campaign (developer redesign 2026-10-15): finale at L75, the four
 * late milestones at 87 / 104 / 117 / 132, THE LAST PAGE at L150, its copy
 * "One hundred and fifty dishes later"; GRAND SERVICE (75) shows at L76, the
 * level after the finale (one event per completion).
 *
 *  T  Text: the four new milestones and the four LEGACY beats exactly as
 *     approved; the narrative never names "Grandma", never reuses FINALE's
 *     frozen lines, never says "We did it."; FINALE itself unchanged.
 *  P  A fresh player 0 → 250: every milestone, the finale at 100 and THE LAST
 *     PAGE at 250 — each exactly once, in order, one event per completion.
 *  C  Catch-up (decision 2): a milestone more than 10 levels behind is marked
 *     silently; at most one banner per completion; never a backlog (saves at
 *     120, 145, 150, 170, 200, 249); the finale and THE LAST PAGE are never
 *     skipped.
 *  O  Once: after it shows (flag saved first), a reload, a replay or another
 *     check never shows it again.
 *  L  Saves that already finished 250 (decision 1): THE LAST PAGE once on
 *     the next load, then never; nothing else is pending.
 *  M  Only story flags change — never credits, the ledger or progress; no new
 *     save field.
 *  W  Wiring: App persists the flag before showing; no ad / Replay Bonus
 *     behind it; the overlay, its way out, the load path, Closing Time held.
 *
 * Run: npx tsx scripts/story-legacy-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  FINALE,
  FINALE_AT,
  LEGACY,
  LEGACY_AT,
  LEGACY_BIT,
  MILES,
  MILES_FULL_MASK,
  RETIRED_CAMPAIGN_COMPLETE_BIT,
  type StoryBeat,
} from "../src/game/story/storyDefinitions.ts";
import {
  CATCHUP_WINDOW,
  applyStoryFlush,
  checkStoryFlush,
  legacyPendingOnLoad,
  type StoryFlushResult,
} from "../src/game/story/StoryManager.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) =>
  fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), p), "utf8");
const allText = (b: StoryBeat) =>
  [b.kicker, b.title, b.step, ...(b.lines ?? []), b.quote, b.dlg?.say, b.btn]
    .filter(Boolean)
    .join(" ");

/** A save with `n` completed levels and the given story flags. */
const saveAt = (n: number, mask = 0, finaleSeen = n >= FINALE_AT): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  credits: 123_456,
  levelProgress: {
    currentLevelId: `level-${Math.min(LEGACY_AT, n + 1)}`,
    highestUnlockedLevelId: `level-${Math.min(LEGACY_AT, n + 1)}`,
    completedLevelIds: Array.from({ length: n }, (_, i) => `level-${i + 1}`),
  },
  story: { introDone: true, milestoneMask: mask, finaleSeen },
});
/** One NEW completion, as App does it: check, save the flags first, return the event. */
function complete(save: SaveData): { save: SaveData; event: StoryFlushResult } {
  const n = save.levelProgress.completedLevelIds.length;
  const next: SaveData = {
    ...save,
    levelProgress: {
      ...save.levelProgress,
      completedLevelIds: [...save.levelProgress.completedLevelIds, `level-${n + 1}`],
    },
  };
  const event = checkStoryFlush(next);
  return { save: applyStoryFlush(next, event), event };
}
const label = (e: StoryFlushResult) =>
  e === null ? null : e.kind === "milestone" ? `m${e.milestone.at}` : e.kind;
/** Plays completions from the save's count up to `to`; returns the events with their levels. */
function playTo(save: SaveData, to: number) {
  let s = save;
  const events: string[] = [];
  while (s.levelProgress.completedLevelIds.length < to) {
    const r = complete(s);
    s = r.save;
    if (r.event) events.push(`${s.levelProgress.completedLevelIds.length}:${label(r.event)}`);
  }
  return { save: s, events };
}
/** Every milestone bit shipped before 2026-10-11 (an existing save that saw them all, pre-250). */
const OLD_SIX = 1 | 2 | 4 | 8 | 16 | 32;

console.log("T. Text (approved verbatim)");
{
  const added = MILES.filter((m) => m.at > FINALE_AT);
  assert(
    added.map((m) => `${m.at}|${m.bit}|${m.kicker}|${m.line}`).join("\n") ===
      [
        "87|128|A NAME IN TOWN|Strangers come in asking for the house dish by name now.",
        "104|256|THE NEXT GENERATION|A young cook asked to learn from me today. I remember asking the same.",
        "117|512|ONE OF THE BEST|The city guide put us on its list. The first page.",
        "132|1024|THE OLD RECIPE BOOK|I found their old recipe book in the cellar. The last page is blank.",
      ].join("\n"),
    "T1: the four new milestones exactly as approved",
  );
  assert(
    LEGACY.map(allText).join(" | ") ===
      "Every recipe they ever wrote is in here. Except the last page. | One hundred and fifty dishes later, you know what belongs on it. | It isn’t a recipe. It’s this room. Full, every night. | THE LAST PAGE They asked you to keep it alive. You did more than that. BACK TO THE KITCHEN" &&
      LEGACY.map((b) => b.hold ?? "btn").join() === "4200,4400,4600,btn" &&
      LEGACY.every((b) => b.tint === "sThrive") &&
      LEGACY.map((b) => b.art ?? "-").join() === "keys,-,dining,dining",
    "T2: THE LAST PAGE — four beats exactly as approved, existing art only",
  );
  const story = [...LEGACY.map(allText), ...MILES.map((m) => `${m.kicker} ${m.line}`)].join(" ");
  assert(
    !/grandma/i.test(story) &&
      !/We did it/i.test(story) &&
      !/You built this\./.test(LEGACY.map(allText).join(" ")) &&
      !/They would be proud\./.test(LEGACY.map(allText).join(" ")),
    "T3: no “Grandma”, no “We did it.”, none of the finale's frozen lines",
  );
  assert(
    FINALE_AT === 75 &&
      FINALE.map(allText).join(" | ") ===
        "You came here to keep a promise. You stayed because you wanted to. | Years ago, this place was almost forgotten. Today, it’s the best restaurant in town. | You didn’t just inherit your grandparent’s restaurant. You built this. | THE RESTAURANT LIVES ON They would be proud. BACK TO THE KITCHEN" &&
      FINALE.map((b) => `${b.tint}:${b.veil ?? ""}:${b.art ?? ""}:${b.hold ?? "btn"}`).join() ===
        "sThrive:::4200,sThrive:::4400,sThrive:true:dining:4600,sThrive:true:dining:btn",
    "T4: the finale (Level 75) unchanged (text, art, timings, gate)",
  );
}

console.log("P. A fresh player, 0 → 150");
{
  const run = playTo(saveAt(0, 0, false), LEGACY_AT);
  assert(
    run.events.join() ===
      "10:m10,13:m13,32:m32,45:m45,67:m67,75:finale,76:m75,87:m87,104:m104,117:m117,132:m132,150:legacy" &&
      run.save.story.finaleSeen &&
      run.save.story.milestoneMask === (MILES_FULL_MASK | LEGACY_BIT),
    "P1: every milestone, the finale at 75 and THE LAST PAGE at 150 — once each, in order (GRAND SERVICE the level after the finale)",
    run.events,
  );
}

console.log("C. Catch-up (returning players)");
{
  const at = (n: number, mask = OLD_SIX) => playTo(saveAt(n, mask), LEGACY_AT);
  const r120 = at(76);
  assert(
    r120.events.join() === "87:m87,104:m104,117:m117,132:m132,150:legacy",
    "C1: a save at 76 (all shipped milestones seen) gets each new one on time, once",
    r120.events,
  );
  const r145 = at(93);
  assert(
    r145.events[0] === "94:m87" && r145.events.filter((e) => e.endsWith("m87")).length === 1,
    "C2: a save at 93 — 87 is 6 levels behind, inside the window: shown once on the next completion",
    r145.events,
  );
  const r150 = at(98);
  const first150 = complete(saveAt(98, OLD_SIX));
  assert(
    first150.event === null &&
      (first150.save.story.milestoneMask & 128) !== 0 &&
      r150.events.join() === "104:m104,117:m117,132:m132,150:legacy",
    "C3: a save at 98 — 87 is 11 behind: marked silently, never shown",
    r150.events,
  );
  const first170 = complete(saveAt(110, OLD_SIX));
  assert(
    label(first170.event) === "m104" && (first170.save.story.milestoneMask & 128) !== 0,
    "C4: two reached at once (a save at 110): only the newest in-window one shows; the older is marked",
  );
  const r200 = at(128);
  assert(
    r200.events.join() === "132:m132,150:legacy",
    "C5: a save at 128 gets no backlog — 87/104/117 marked silently; only 132 and THE LAST PAGE",
    r200.events,
  );
  const r249 = at(LEGACY_AT - 1);
  assert(
    r249.events.join() === "150:legacy" &&
      r249.save.story.milestoneMask === (MILES_FULL_MASK | LEGACY_BIT),
    "C6: a save at 149 gets THE LAST PAGE at 150 and nothing else (132 marked silently)",
    r249.events,
  );
  // Never silence the finale or THE LAST PAGE, however far behind.
  const noFinale = complete(saveAt(100, OLD_SIX, false));
  const farLegacy = checkStoryFlush(saveAt(LEGACY_AT, 0));
  assert(
    noFinale.event?.kind === "finale" && farLegacy?.kind === "legacy" && CATCHUP_WINDOW === 10,
    "C7: the finale (unseen at 100) and THE LAST PAGE are never skipped by the catch-up rule",
  );
  // Every completion shows at most one event.
  let s = saveAt(0, 0, false);
  let most = 0;
  for (let i = 0; i < LEGACY_AT; i++) {
    const before = s.story.milestoneMask;
    const r = complete(s);
    s = r.save;
    most = Math.max(most, r.event ? 1 : 0);
    if (r.event?.kind === "milestone" && (before & r.event.milestone.bit) !== 0) most = 99;
  }
  assert(most === 1, "C8: never more than one story event per completion, never a repeat");
}

console.log("O. Once");
{
  const r = complete(saveAt(LEGACY_AT - 1, MILES_FULL_MASK & ~RETIRED_CAMPAIGN_COMPLETE_BIT));
  const reloaded = JSON.parse(JSON.stringify(r.save)) as SaveData;
  assert(
    r.event?.kind === "legacy" &&
      checkStoryFlush(r.save) === null &&
      checkStoryFlush(reloaded) === null &&
      !legacyPendingOnLoad(reloaded),
    "O1: THE LAST PAGE's flag is saved before it shows — a dismissal, reload or another check never repeats it",
  );
  // A replay of the last level adds no completed level, so nothing new can fire.
  assert(
    checkStoryFlush({ ...reloaded }) === null &&
      reloaded.levelProgress.completedLevelIds.length === LEGACY_AT,
    "O2: replaying Level 150 never replays the ending",
  );
}

console.log("L. Saves that already finished the campaign (decision 1)");
{
  const old = saveAt(LEGACY_AT, OLD_SIX | RETIRED_CAMPAIGN_COMPLETE_BIT);
  assert(
    legacyPendingOnLoad(old),
    "L1: an old save at 150 (saw the old banner) has THE LAST PAGE pending",
  );
  const shown = applyStoryFlush(old, { kind: "legacy" });
  const reloaded = JSON.parse(JSON.stringify(shown)) as SaveData;
  assert(
    !legacyPendingOnLoad(reloaded) &&
      checkStoryFlush(reloaded) === null &&
      reloaded.story.milestoneMask === (MILES_FULL_MASK | LEGACY_BIT),
    "L2: shown once on load, then never again (repeated launches); nothing else left pending",
  );
  assert(
    !legacyPendingOnLoad(saveAt(LEGACY_AT - 1, OLD_SIX)) &&
      !legacyPendingOnLoad({ ...old, story: { ...old.story, introDone: false } }),
    "L3: nothing pending before 150, or before the intro is done",
  );
}

console.log("M. Money and save shape");
{
  const before = saveAt(LEGACY_AT - 1, OLD_SIX);
  before.economyLedger = [{ id: "x", category: "completion-reward", amount: 500, at: 1 } as never];
  const r = complete(before);
  const strip = (s: SaveData) => ({ ...s, story: null, levelProgress: null });
  assert(
    r.save.credits === before.credits &&
      JSON.stringify(r.save.economyLedger) === JSON.stringify(before.economyLedger) &&
      JSON.stringify(strip(r.save)) === JSON.stringify(strip(before)),
    "M1: story flushes change only story flags — never credits, the ledger or anything else",
  );
  assert(
    Object.keys(DEFAULT_SAVE.story).join() === "introDone,milestoneMask,finaleSeen",
    "M2: no new save field (story stays introDone, milestoneMask, finaleSeen)",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    (
      app.match(
        /const finalSave = applyStoryFlush\(nextSave, flush\);\s*persist\(finalSave\);\s*if \(flush\) setStoryEvent\(flush\);/g,
      ) ?? []
    ).length === 2,
    "W1: both completion paths save the flags before showing the story",
  );
  assert(
    /flush\?\.kind === "finale" \|\| flush\?\.kind === "legacy",\s*\);/.test(app) &&
      /<StoryOverlay sequence=\{LEGACY\} onDone=\{finishLegacy\} \/>/.test(app) &&
      /function finishLegacy\(\) \{\s*setStoryEvent\(null\);\s*levelAbandoned\(\);\s*setSessionMode\("campaign"\);\s*go\("kitchen"\);\s*\}/.test(
        app,
      ),
    "W2: no ad or Replay Bonus behind THE LAST PAGE; its overlay; its button lands on the Kitchen",
  );
  assert(
    /if \(legacyPendingOnLoad\(synced\)\) \{\s*synced = applyStoryFlush\(synced, \{ kind: "legacy" \}\);\s*setStoryEvent\(\{ kind: "legacy" \}\);/.test(
      app,
    ) &&
      /storyEvent\?\.kind !== "finale" &&\s*storyEvent\?\.kind !== "legacy"/.test(app) &&
      /levelRewardNotice && \(!storyEvent \|\| storyEvent\.kind === "milestone"\)/.test(app) &&
      /milestoneNoticeQueue\[0\] &&\s*!storyEvent &&\s*!levelRewardNotice/.test(app),
    "W3: the load path (flag saved first), Closing Time held, then Level Complete, then the Family Legacy banner",
  );
}

console.log(failures ? `\nSTORY LEGACY QA: ${failures} FAILURE(S)` : "\nSTORY LEGACY QA: ALL PASS");
process.exit(failures ? 1 : 0);
