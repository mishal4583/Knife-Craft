/**
 * STORY INTRO QA — the re-paced opening intro and its "Skip story" button.
 *
 *  A. Pacing: 14 beats (4 + 4 + 6), timed holds 7.6 s / 6.0 s / 7.9 s =
 *     21.5 s (was 38.7 s), exactly two button beats (OPEN THE RESTAURANT,
 *     READY), the new copy, and the same story shape (grandparent, decline,
 *     keys + last wish, reopening, chef cooks / you prep, Level 1).
 *  B. Unchanged: FINALE and the 7 milestones (text, thresholds, bits).
 *  C. Save: finishing and skipping both only set story.introDone (no new
 *     field, no progression/credit change), it survives a save/load round
 *     trip, and a skipped intro never triggers a milestone or the finale.
 *  D. Structure: one idempotent completion path (StoryOverlay `finish` +
 *     App `completeIntro`), per-beat advancing, button beats not bypassed by
 *     screen taps, Skip only on the intro overlay, no animation library.
 *
 * Run: npx tsx scripts/story-intro-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import {
  OPENING,
  FRESH,
  CHEF,
  FINALE,
  MILES,
  FINALE_AT,
  type StoryBeat,
} from "../src/game/story/storyDefinitions.ts";
import { shouldRunIntro, markIntroDone, checkStoryFlush } from "../src/game/story/StoryManager.ts";
import { SaveManager, DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const timed = (beats: StoryBeat[]) =>
  beats.filter((b) => !b.btn).reduce((s, b) => s + (b.hold ?? 3000), 0);
const allText = (b: StoryBeat) =>
  [b.kicker, b.title, b.step, ...(b.lines ?? []), b.quote, b.dlg?.say].filter(Boolean).join(" ");

console.log("A. Pacing and copy");
const INTRO = [...OPENING, ...FRESH, ...CHEF];
assert(
  OPENING.length === 4 && FRESH.length === 4 && CHEF.length === 6,
  `A1: 4 + 4 + 6 beats (got ${OPENING.length} + ${FRESH.length} + ${CHEF.length})`,
);
assert(timed(OPENING) === 7600, `A2: Part 1 timed 7.6 s (got ${timed(OPENING)} ms) — target 7–8 s`);
assert(timed(FRESH) === 6000, `A3: Part 2 timed 6.0 s (got ${timed(FRESH)} ms) — target 6–7 s`);
assert(timed(CHEF) === 7900, `A4: Part 3 timed 7.9 s (got ${timed(CHEF)} ms) — target 6–8 s`);
const total = timed(INTRO);
assert(
  total >= 20000 && total <= 22500,
  `A5: whole intro timed ${total / 1000} s (was 38.7 s) — within the 20–25 s target with room for the two button taps`,
);
assert(
  INTRO.every((b) => b.btn || (b.hold ?? 0) >= 1000),
  "A6: every timed beat holds at least 1 s (readable, not flashed)",
);
const buttons = INTRO.filter((b) => b.btn).map((b) => b.btn);
assert(
  JSON.stringify(buttons) === JSON.stringify(["OPEN THE RESTAURANT", "READY"]),
  `A7: exactly two button beats: ${buttons.join(", ")}`,
);
assert(
  OPENING[3]!.btn === "OPEN THE RESTAURANT" && FRESH[3]!.btn === "READY",
  "A8: the buttons end Part 1 and Part 2",
);
const text = INTRO.map(allText).join(" | ");
for (const line of [
  "For generations, this little restaurant was ours.",
  "Your grandparent built it from the ground up.",
  "The kitchen grew quiet.",
  "The tables stayed empty.",
  "Before they were gone, they placed the keys in your hand.",
  "They had one last wish.",
  "Keep it alive.",
  "You never planned to run a restaurant.",
  "But some promises are worth keeping.",
  "The place is still standing.",
  "Now it needs someone willing to bring it back to life.",
  "Counters clean. Dust gone. The kitchen feels alive again.",
  "A few repairs. A little work. Enough to open the doors.",
  "You put almost everything you had into this place.",
  "Not much.",
  "But it’s a start.",
  "You spent your savings on this?",
  "Every last bit.",
  "Then we’d better not waste it.",
  "I’ll handle the cooking. You handle the prep.",
  "Let’s bring this place back.",
  "FIRST PREP",
  "The first order is waiting.",
  "Let’s get to work.",
]) {
  assert(text.includes(line), `A9: intro says "${line}"`);
}
assert(
  OPENING[2]!.art === "bedside" && OPENING[3]!.art === "keys",
  "A10: the bedside/keys artwork still carries the last-wish beats",
);
assert(
  FRESH.map((b) => b.step ?? b.kicker).join() === "A FRESH START,CLEAN,SMALL REPAIRS,YOUR SAVINGS",
  "A11: Fresh Start still runs A FRESH START → CLEAN → SMALL REPAIRS → YOUR SAVINGS",
);
assert(
  JSON.stringify(FRESH[3]!.cards) === JSON.stringify(["board", "knife", "ing"]),
  "A12: the savings beat still shows the board, knife and ingredients cards",
);
const speakers = CHEF.filter((b) => b.dlg)
  .map((b) => b.dlg!.who)
  .join();
assert(
  speakers === "CHEF,YOU,CHEF,CHEF,CHEF",
  `A13: chef/player exchange (${speakers}); the chef cooks, you prep`,
);
assert(
  CHEF[5]!.kicker === "LEVEL 1" && CHEF[5]!.title === "FIRST PREP" && !CHEF[5]!.btn,
  "A14: the last beat is LEVEL 1 · FIRST PREP and leads straight into Level 1",
);

console.log("B. Finale and milestones unchanged");
assert(FINALE_AT === 100, "B1: finale still at 100 completed levels");
assert(
  FINALE.length === 4 && FINALE[3]!.btn === "BACK TO THE KITCHEN",
  "B2: finale still 4 beats ending on BACK TO THE KITCHEN",
);
assert(
  FINALE.map(allText).join(" | ") ===
    "You came here to keep a promise. You stayed because you wanted to. | Years ago, this place was almost forgotten. Today, it’s the best restaurant in town. | You didn’t just inherit your grandparent’s restaurant. You built this. | THE RESTAURANT LIVES ON They would be proud.",
  "B3: finale text identical",
);
assert(
  FINALE.map((b) => b.hold ?? "btn").join() === "4200,4400,4600,btn",
  "B4: finale timings identical",
);
assert(
  MILES.map((m) => `${m.at}:${m.bit}:${m.kicker}`).join() ===
    "10:1:THE ROOM COMES BACK,20:2:WORD GETS AROUND,45:4:SOMETHING WORTH KEEPING,70:8:THE LAST WISH,110:16:THE KITCHEN GROWS,120:32:GRAND SERVICE,250:64:CAMPAIGN COMPLETE",
  "B5: milestone thresholds, bits and titles identical",
);
assert(
  MILES[0]!.line === "It’s starting to feel like a real restaurant again." &&
    MILES[6]!.line.startsWith("All 250 levels mastered."),
  "B6: milestone lines unchanged",
);

console.log("C. Save behavior (finish and skip are the same state)");
const fresh: SaveData = structuredClone(DEFAULT_SAVE);
assert(shouldRunIntro(fresh), "C1: a new save runs the intro");
const done = markIntroDone(fresh);
const changed = Object.keys(done).filter(
  (k) =>
    JSON.stringify((done as Record<string, unknown>)[k]) !==
    JSON.stringify((fresh as Record<string, unknown>)[k]),
);
assert(
  JSON.stringify(changed) === '["story"]' &&
    done.story.introDone &&
    done.story.milestoneMask === 0 &&
    !done.story.finaleSeen,
  `C2: completing/skipping changes only story.introDone (changed: ${changed.join()})`,
);
assert(
  Object.keys(done).length === Object.keys(fresh).length &&
    Object.keys(done.story).join() === "introDone,milestoneMask,finaleSeen",
  "C3: no new save field",
);
assert(
  done.credits === fresh.credits &&
    JSON.stringify(done.levelProgress) === JSON.stringify(fresh.levelProgress) &&
    done.economyLedger.length === 0,
  "C4: no credits, no level completion, no ledger entry",
);
assert(!shouldRunIntro(done), "C5: the intro never runs again once introDone");
assert(
  checkStoryFlush(done) === null,
  "C6: a skipped/finished intro triggers no milestone or finale (0 levels completed)",
);
await SaveManager.save(done);
const reloaded = await SaveManager.load();
assert(
  reloaded.story.introDone === true && !shouldRunIntro(reloaded),
  "C7: introDone survives a save/load round trip",
);
const veteran = {
  ...structuredClone(DEFAULT_SAVE),
  story: { introDone: true, milestoneMask: 3, finaleSeen: false },
};
assert(
  !shouldRunIntro(veteran) && markIntroDone(veteran).story.milestoneMask === 3,
  "C8: an existing introDone save never sees the intro and keeps its milestones",
);

console.log("D. Structure");
const overlay = read("src/components/kc/story/StoryOverlay.tsx");
const app = read("src/App.tsx");
assert(
  /function finish\(reason: StoryEndReason\) \{\s*if \(doneRef\.current\) return;\s*doneRef\.current = true;/.test(
    overlay,
  ),
  "D1: StoryOverlay has one latched completion path for finish and skip",
);
assert(
  /finish\("skipped"\)/.test(overlay) && /finish\("finished"\)/.test(overlay),
  "D2: both 'finished' and 'skipped' go through finish()",
);
assert(
  /setIndex\(\(i\) => \(i === from \? i \+ 1 : i\)\)/.test(overlay),
  "D3: advancing is tied to the beat it came from (a timer + tap or a double tap moves one beat)",
);
assert(/if \(beat\.btn\) return;/.test(overlay), "D4: screen taps never bypass a button beat");
assert(/MIN_TAP_MS = 250/.test(overlay), "D5: a tap right after a beat appears is ignored");
assert(
  !/stopPropagation\(\)\}?\s*>\s*<div\s+className="h-\[64px\]/.test(overlay) &&
    (overlay.match(/stopPropagation/g) ?? []).length === 1,
  "D6: taps on the dialogue advance too (only the Skip button stops propagation)",
);
assert(
  /\{skippable \? \(/.test(overlay) &&
    /Skip story/.test(overlay) &&
    /h-12 min-w-12/.test(overlay) &&
    /right-3 top-3/.test(overlay),
  "D7: Skip story is a 48 px top-right button shown only when skippable",
);
assert(
  /<StoryOverlay sequence=\{STORY_INTRO_SEQUENCE\} skippable onDone=\{completeIntro\} \/>/.test(
    app,
  ),
  "D8: only the intro overlay is skippable",
);
assert(
  /<StoryOverlay sequence=\{FINALE\} onDone=\{\(\) => setStoryEvent\(null\)\} \/>/.test(app),
  "D9: the finale overlay has no Skip button and is otherwise unchanged",
);
assert(
  /function completeIntro\(\) \{\s*if \(introCompletedRef\.current\) return;\s*introCompletedRef\.current = true;\s*setShowIntro\(false\);\s*const current = saveRef\.current;\s*if \(current && !current\.story\.introDone\) persist\(markIntroDone\(current\)\);/.test(
    app,
  ),
  "D10: App completes the intro once, from the latest save, with one write",
);
const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
assert(
  !Object.keys(pkg.dependencies).some((d) =>
    /framer|motion|gsap|lottie|anime|react-spring/.test(d),
  ),
  "D11: no animation library dependency",
);
const css = read("src/styles.css");
assert(
  /@keyframes kc-story-rise/.test(css) && /prefers-reduced-motion: reduce/.test(css),
  "D12: CSS-only story transitions with a reduced-motion fallback",
);

console.log(
  failures === 0 ? "\nSTORY INTRO QA: ALL PASS" : `\nSTORY INTRO QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
