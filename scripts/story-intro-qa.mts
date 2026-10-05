/**
 * STORY INTRO QA — the opening intro cinematic (CinematicIntro.tsx over
 * introCinematic.ts) and its SKIP control.
 *
 *  A. Film: the seven painted scenes in order (1, 2, 3A, 3B, 3C, 4, 5), the
 *     short timings (2.6 / 1.8 / 0.8 + 0.8 + 0.9 / 3.5 / 2.4 s + a 0.8 s push
 *     into the tomato = 13.6 s — the player is cutting well inside Playgama's
 *     30 s bounce window), fast montage crossfades, subtle camera moves, the
 *     chef/player dialogue on its beats, SKIP after ~1 s, taps that only step
 *     forward, and the bundled images at their native 941 × 1672 size.
 *  B. Unchanged: FINALE and the 7 milestones (text, thresholds, bits).
 *  C. Save: finishing and skipping both only set story.introDone (no new
 *     field, no progression/credit change), it survives a save/load round
 *     trip, and a skipped intro never triggers a milestone or the finale.
 *  D. Structure: one latched completion path (CinematicIntro `finish` + App
 *     `completeIntro`), one clock, Level 1 mounted underneath, SKIP the only
 *     early exit, the finale overlay unchanged, CSS-only motion with a
 *     reduced-motion fallback, no animation library.
 *
 * The live timeline (real browser, real Level 1) is tools/e2e/introskip.mjs.
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
import { FINALE, MILES, FINALE_AT, type StoryBeat } from "../src/game/story/storyDefinitions.ts";
import {
  INTRO_SCENES,
  INTRO_OUTRO,
  INTRO_SKIP_AFTER_MS,
  introTimeline,
  sceneAt,
  tapTarget,
} from "../src/game/story/introCinematic.ts";
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
const allText = (b: StoryBeat) =>
  [b.kicker, b.title, b.step, ...(b.lines ?? []), b.quote, b.dlg?.say].filter(Boolean).join(" ");
/** Width × height from a lossy WebP's VP8 frame header. */
function webpSize(p: string): [number, number] | null {
  const b = fs.readFileSync(path.join(root, p));
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 12, 16) !== "VP8 ") return null;
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

console.log("A. Film: scenes, timing, dialogue, SKIP, taps, images");
const byId = Object.fromEntries(INTRO_SCENES.map((sc) => [sc.id, sc]));
assert(
  INTRO_SCENES.map((sc) => sc.id).join() === "scene1,scene2,scene3A,scene3B,scene3C,scene4,scene5",
  "A1: seven scenes in order 1 → 2 → 3A → 3B → 3C → 4 → 5 (no Scene 6 image)",
);
const durations = INTRO_SCENES.map((sc) => sc.duration).join();
assert(
  durations === "2600,1800,800,800,900,3500,2400",
  `A2: scene lengths 2.6 / 1.8 / 0.8 / 0.8 / 0.9 / 3.5 / 2.4 s (got ${durations})`,
);
const tl = introTimeline();
assert(
  tl.outroAt === 12800 && tl.total === 12800 + INTRO_OUTRO.ms,
  `A3: Scene 5 ends at 12.8 s, then the outro (got ${tl.outroAt} ms, total ${tl.total} ms)`,
);
assert(
  tl.total >= 13000 && tl.total <= 14000,
  `A4: whole film ${tl.total / 1000} s — playing by ~14 s, well inside the 30 s bounce window`,
);
assert(
  JSON.stringify(tl.sceneStarts) === JSON.stringify([0, 2600, 4400, 5200, 6000, 6900, 10400]),
  `A5: scenes start at 0 / 2.6 / 4.4 / 5.2 / 6.0 / 6.9 / 10.4 s (got ${tl.sceneStarts.join()})`,
);
const montage = [byId.scene3B!, byId.scene3C!].map((sc) => sc.crossfadeMs);
assert(
  montage.every((ms) => ms >= 150 && ms <= 200),
  `A6: montage crossfades 3A → 3B → 3C are fast, 150–200 ms (got ${montage.join()})`,
);
const main = [byId.scene2!, byId.scene3A!, byId.scene4!, byId.scene5!].map((sc) => sc.crossfadeMs);
assert(
  main.every((ms) => ms >= 250 && ms <= 350),
  `A7: the other scene changes crossfade in 250–350 ms (got ${main.join()})`,
);
const hold3C = byId.scene3C!.duration - byId.scene3C!.camera.ms;
assert(
  hold3C >= 300 && hold3C <= 400,
  `A8: Scene 3C holds its last frame ${hold3C} ms before Scene 4`,
);
assert(
  INTRO_SCENES.every(
    (sc) =>
      Math.min(sc.camera.from, sc.camera.to) >= 1 &&
      Math.max(sc.camera.from, sc.camera.to) <= 1.05 &&
      sc.camera.from !== sc.camera.to &&
      sc.camera.ms <= sc.duration,
  ),
  "A9: every scene has a subtle camera move (scale within 1.00–1.05, never past the scene)",
);
assert(
  byId.scene1!.camera.ms === 2000 && byId.scene1!.camera.to > byId.scene1!.camera.from,
  "A10: Scene 1 pushes in slowly for 2 s, then holds 0.6 s",
);
assert(
  byId.scene3B!.lightUp === true &&
    Math.abs(byId.scene3B!.camera.to - byId.scene3B!.camera.from) / byId.scene3B!.camera.ms >
      Math.abs(byId.scene3A!.camera.to - byId.scene3A!.camera.from) / byId.scene3A!.camera.ms,
  "A11: Scene 3B moves faster than 3A and gains a little light",
);
const lines = (id: string) =>
  byId[id]!.lines.map((l) => `${l.speaker ?? "-"}|${l.text}|${l.at}`).join(" / ");
assert(
  lines("scene4") ===
    "CHEF|You spent your savings on this?|300 / YOU|Every last bit.|1600 / CHEF|Then we’d better make it count.|2300",
  `A12: Scene 4 dialogue on its beats (0.3 / 1.6 / 2.3 s): ${lines("scene4")}`,
);
assert(
  lines("scene5") ===
    "CHEF|I’ll handle the cooking.|250 / CHEF|You handle the prep.|1100 / CHEF|Let’s get to work.|1900",
  `A13: Scene 5 dialogue on its beats (0.25 / 1.1 / 1.9 s) — the chef cooks, you prep`,
);
assert(
  byId.scene1!.lines.length > 0 && byId.scene1!.lines.every((l) => !l.speaker),
  "A14: Scene 1 carries the keys/last-wish narration as subtitles",
);
assert(
  byId.scene3A!.lines.length + byId.scene3B!.lines.length + byId.scene3C!.lines.length === 0,
  "A15: the montage is pictures only (no subtitles slowing it down)",
);
const lastLine = byId.scene5!.lines.at(-1)!;
assert(
  INTRO_SCENES.every((sc) =>
    sc.lines.every(
      (l, i) =>
        l.at < l.until &&
        l.until <= sc.duration &&
        (i === 0 || l.at >= sc.lines[i - 1]!.until) &&
        (l === lastLine || l.until <= sc.duration - 200),
    ),
  ),
  "A16: subtitles never overlap and leave before their scene's crossfade (the last line rides the outro)",
);
assert(
  INTRO_SCENES.flatMap((sc) => sc.lines).every((l) => l.until - l.at >= 300),
  "A17: every subtitle shows at least 0.3 s",
);
assert(INTRO_SKIP_AFTER_MS === 1000, `A18: SKIP appears after ${INTRO_SKIP_AFTER_MS} ms`);
assert(
  INTRO_OUTRO.fadeDelayMs === 250 &&
    INTRO_OUTRO.ms === 800 &&
    /scale\(\d/.test(INTRO_OUTRO.transform) &&
    INTRO_OUTRO.origin === byId.scene5!.camera.origin,
  "A19: outro pushes into the tomato after Scene 5 and fades into Level 1 0.25 s later",
);
let t = 0;
let taps = 0;
let tapOk = true;
for (let next = tapTarget(tl, t); next !== null; next = tapTarget(tl, t)) {
  if (next <= t || next > tl.outroAt) tapOk = false;
  t = next;
  if (++taps > 100) break;
}
assert(
  tapOk && t === tl.outroAt && taps > INTRO_SCENES.length,
  `A20: taps step forward one line/scene at a time (${taps} taps) and never end the film — only SKIP does`,
);
assert(
  sceneAt(tl, 0) === 0 &&
    sceneAt(tl, 6899) === 4 &&
    sceneAt(tl, 6900) === 5 &&
    sceneAt(tl, tl.total) === 6,
  "A21: the clock maps time to the right scene (and stays on Scene 5 through the outro)",
);
const cinematic = read("src/components/kc/story/CinematicIntro.tsx");
const files: Record<string, string> = {};
for (const m of cinematic.matchAll(/import (scene\w+) from "@\/assets\/story\/([\w-]+\.webp)";/g))
  files[m[1]!] = m[2]!;
assert(
  Object.keys(files).sort().join() === "scene1,scene2,scene3A,scene3B,scene3C,scene4,scene5",
  `A22: all seven scene images are imported into the bundle (${Object.values(files).join(", ")})`,
);
const sizes = Object.values(files).map((f) => webpSize(`src/assets/story/${f}`));
assert(
  sizes.every((sz) => sz && sz[0] === 941 && sz[1] >= 1671 && sz[1] <= 1672),
  `A23: every image is the supplied artwork at its native ~941 × 1672 (${sizes.map((sz) => sz?.join("×")).join(", ")})`,
);
assert(
  /object-cover/.test(cinematic) && !/object-fill|object-contain/.test(cinematic),
  "A24: images fill the frame keeping their aspect ratio (object-cover, never stretched)",
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
const app = read("src/App.tsx");
assert(
  /function finish\(reason: StoryEndReason\) \{\s*if \(doneRef\.current\) return;\s*doneRef\.current = true;/.test(
    cinematic,
  ),
  "D1: CinematicIntro has one latched completion path for finish and skip",
);
assert(
  /finish\("skipped"\)/.test(cinematic) && /finish\("finished"\)/.test(cinematic),
  "D2: both 'finished' (end of the outro) and 'skipped' go through finish()",
);
assert(
  (cinematic.match(/requestAnimationFrame\(tick\)/g) ?? []).length === 2 &&
    !/setTimeout|setInterval/.test(cinematic),
  "D3: one clock (a single rAF loop) drives every scene, subtitle and transition — no loose timers",
);
assert(
  /aria-label="Skip intro"/.test(cinematic) &&
    (cinematic.match(/stopPropagation/g) ?? []).length === 1 &&
    /right-1 top-1/.test(cinematic) &&
    /\{view\.skip && !view\.outro \?/.test(cinematic),
  "D4: SKIP is a small top-right control, the only thing that stops a tap, shown only after ~1 s",
);
assert(
  /MIN_TAP_MS = 250/.test(cinematic) &&
    /tapTarget\(timeline, elapsedRef\.current\)/.test(cinematic),
  "D5: taps advance the film one step (ignored for 250 ms after a step appears)",
);
assert(
  /PauseManager\.subscribe/.test(cinematic) && /kc-cine-paused/.test(cinematic),
  "D6: a platform pause freezes the clock and every animation",
);
assert(
  /\{showIntro \? <CinematicIntro onDone=\{completeIntro\} \/> : null\}/.test(app),
  "D7: App plays the cinematic over the already-mounted game, ending in completeIntro",
);
// The finale's exit changed on purpose (developer decision #21: "BACK TO
// THE KITCHEN" goes to Kitchen home); scripts/story-pause-qa.mts and
// tools/e2e/finale.mjs cover it.
assert(
  /<StoryOverlay sequence=\{FINALE\} onDone=\{finishFinale\} \/>/.test(app) &&
    /function finishFinale\(\) \{\s*setStoryEvent\(null\);\s*levelAbandoned\(\);\s*setSessionMode\("campaign"\);\s*go\("kitchen"\);\s*\}/.test(
      app,
    ) &&
    !/aria-label="Skip|>\s*SKIP|>\s*Skip/.test(read("src/components/kc/story/StoryOverlay.tsx")),
  "D8: the finale overlay has no Skip button and ends on the Kitchen home screen",
);
assert(
  /function completeIntro\(\) \{\s*if \(introCompletedRef\.current\) return;\s*introCompletedRef\.current = true;\s*setShowIntro\(false\);\s*const current = saveRef\.current;\s*if \(current && !current\.story\.introDone\) persist\(markIntroDone\(current\)\);/.test(
    app,
  ),
  "D9: App completes the intro once, from the latest save, with one write",
);
const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
assert(
  !Object.keys(pkg.dependencies).some((d) =>
    /framer|motion|gsap|lottie|anime|react-spring/.test(d),
  ),
  "D10: no animation library dependency",
);
const css = read("src/styles.css");
assert(
  /@keyframes kc-cine-camera/.test(css) &&
    /@keyframes kc-cine-push/.test(css) &&
    /prefers-reduced-motion: reduce\)\s*\{\s*\.kc-cine-camera/.test(css),
  "D11: CSS-only camera/crossfade/push with a reduced-motion fallback",
);
assert(
  !/filter:|blur\(|saturate\(|contrast\(|hue-rotate/.test(
    css.slice(css.indexOf("Intro cinematic"), css.indexOf("@utility no-scrollbar")),
  ),
  "D12: no colour filters, blur or HDR on the artwork",
);

console.log(
  failures === 0 ? "\nSTORY INTRO QA: ALL PASS" : `\nSTORY INTRO QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
