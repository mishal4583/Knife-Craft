/**
 * STORY PAUSE QA — developer decisions #21 and #22.
 *
 *  P. PausableCountdown (src/game/story/pausableCountdown.ts) on a fake
 *     clock: fires after the full time when never paused; a pause stops it
 *     and keeps the time left; a resume continues from there; repeated
 *     pause/resume adds up; pause/resume are idempotent; cancel never fires;
 *     it fires once.
 *  W. Wiring: the finale (StoryOverlay) and milestone banners
 *     (MilestoneBanner) time themselves only through usePausableTimeout
 *     (no bare setTimeout), which follows PauseManager; both freeze their
 *     CSS animations with kc-story-paused; the finale ignores taps while
 *     paused.
 *  K. The finale's "BACK TO THE KITCHEN" ends on the Kitchen home screen
 *     (App.finishFinale), and every path that plays the finale has already
 *     paid and saved the level before it shows.
 *
 * Live check (real build, real Bridge pause): tools/e2e/finale.mjs.
 *
 * Run: npx tsx scripts/story-pause-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PausableCountdown, type CountdownClock } from "../src/game/story/pausableCountdown.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
let failures = 0;
function assert(ok: boolean, label: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
}

/** A manual clock: timers fire only when `advance` passes them. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: CountdownClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
  };
  function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  }
  return { clock, advance, pending: () => timers.size };
}

console.log("P. PausableCountdown");
{
  const c = fakeClock();
  let fired = 0;
  const t = new PausableCountdown(4200, () => fired++, c.clock);
  t.resume();
  c.advance(4199);
  const before = fired;
  c.advance(1);
  assert(before === 0 && fired === 1, "P1: never paused, it fires after exactly its time");
}
{
  const c = fakeClock();
  let fired = 0;
  const t = new PausableCountdown(4200, () => fired++, c.clock);
  t.resume();
  c.advance(1000);
  t.pause();
  c.advance(60_000);
  assert(
    fired === 0 && t.remainingMs() === 3200 && c.pending() === 0,
    "P2: a pause stops it and keeps the 3.2 s left (a minute paused fires nothing)",
  );
  t.resume();
  c.advance(3199);
  const early = fired;
  c.advance(1);
  assert(early === 0 && fired === 1, "P3: after the resume it fires once the rest has run");
}
{
  const c = fakeClock();
  let fired = 0;
  const t = new PausableCountdown(3000, () => fired++, c.clock);
  t.resume();
  for (let i = 0; i < 5; i++) {
    c.advance(500);
    t.pause();
    c.advance(10_000);
    t.resume();
  }
  assert(fired === 0 && t.remainingMs() === 500, "P4: five 0.5 s stretches add up to 2.5 s");
  c.advance(500);
  assert(fired === 1, "P5: and the last 0.5 s fires it");
}
{
  const c = fakeClock();
  let fired = 0;
  const t = new PausableCountdown(1000, () => fired++, c.clock);
  t.resume();
  t.resume();
  c.advance(400);
  t.pause();
  t.pause();
  c.advance(400);
  assert(
    t.remainingMs() === 600 && !t.isRunning() && c.pending() === 0,
    "P6: resume and pause are idempotent (no second timer, no double subtraction)",
  );
  t.resume();
  c.advance(600);
  t.resume();
  c.advance(5000);
  assert(fired === 1, "P7: it fires once, and a resume after firing does nothing");
}
{
  const c = fakeClock();
  let fired = 0;
  const t = new PausableCountdown(1000, () => fired++, c.clock);
  t.resume();
  c.advance(500);
  t.cancel();
  t.resume();
  c.advance(5000);
  assert(fired === 0 && c.pending() === 0, "P8: cancel stops it for good");
}
{
  const c = fakeClock();
  let fired = 0;
  const t = new PausableCountdown(1000, () => fired++, c.clock);
  // Paused from the start (the platform paused before the beat appeared).
  c.advance(9000);
  assert(fired === 0, "P9: never resumed, it never starts");
  t.resume();
  c.advance(1000);
  assert(fired === 1, "P10: started late, it still gets its full time");
}

console.log("W. Wiring");
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const overlay = strip(read("src/components/kc/story/StoryOverlay.tsx"));
const banner = strip(read("src/components/kc/story/MilestoneBanner.tsx"));
const hook = strip(read("src/components/kc/story/usePausableTimeout.ts"));
const css = read("src/styles.css");
assert(
  /PauseManager\.subscribe\(\(p\) => \(p \? countdown\.pause\(\) : countdown\.resume\(\)\)\)/.test(
    hook,
  ) &&
    /countdown\.cancel\(\)/.test(hook) &&
    /\[key, ms\]/.test(hook),
  "W1: usePausableTimeout follows PauseManager, re-arms per key and cancels on unmount",
);
assert(
  !/setTimeout|setInterval/.test(overlay) &&
    /usePausableTimeout\(\s*\(\) => advanceFrom\(index\),\s*beat && !beat\.btn \? \(beat\.hold \?\? 3000\) : null,\s*index,\s*\)/.test(
      overlay,
    ),
  "W2: the finale's beats advance only through the pausable timer (button beats arm none)",
);
assert(
  /if \(beat\.btn \|\| paused\) return;/.test(overlay) &&
    /paused && "kc-story-paused"/.test(overlay),
  "W3: while paused the finale ignores taps and freezes its animations",
);
assert(
  !/setTimeout|setInterval/.test(banner) &&
    /usePausableTimeout\(onDismiss, ms, "mount"\)/.test(banner) &&
    /paused && "kc-story-paused"/.test(banner),
  "W4: milestone banners dismiss on the pausable timer and freeze while paused",
);
assert(
  /\.kc-story-paused,\s*\.kc-story-paused \* \{\s*animation-play-state: paused !important;/.test(
    css,
  ),
  "W5: kc-story-paused pauses every animation inside it",
);

console.log("K. Back to the Kitchen");
const app = read("src/App.tsx");
assert(
  /<StoryOverlay sequence=\{FINALE\} onDone=\{finishFinale\} \/>/.test(app) &&
    /function finishFinale\(\) \{\s*setStoryEvent\(null\);\s*levelAbandoned\(\);\s*setSessionMode\("campaign"\);\s*go\("kitchen"\);\s*\}/.test(
      app,
    ),
  'K1: "BACK TO THE KITCHEN" closes the finale and goes to the Kitchen home screen',
);
// Every setStoryEvent(flush) comes right after persist(finalSave): the
// level is paid and saved before the finale can show, so leaving from it
// loses nothing.
const flushes = [
  ...app.matchAll(
    /persist\(finalSave\);\s*(?:[^\n]*\n){0,1}\s*if \(flush\) setStoryEvent\(flush\);/g,
  ),
];
const allFlushes = [...app.matchAll(/setStoryEvent\(flush\)/g)];
assert(
  allFlushes.length === 3 && flushes.length === 3,
  "K2: all three finale paths save the level before the finale shows",
);
assert(
  /if \(isFinale\) return;/.test(app),
  "K3: a level that ends in the finale shows no ad or Replay Bonus offer behind it",
);

console.log(failures ? `\nSTORY PAUSE QA: ${failures} FAILURE(S)` : "\nSTORY PAUSE QA: ALL PASS");
process.exit(failures ? 1 : 0);
