// The game's own Playgama analytics events (Bridge analytics.send,
// scripts/playgama-telemetry-qa.mts) in a real browser, restaurant build, the
// Bridge's mock platform:
//   1. A new player who skips the intro sends intro_completed { skipped: true }
//      and progression_started for Level 1 { world, step_index: 1 }.
//   2. After 35 s on the cutting board one performance_sample arrives with every
//      required field, real frame times and a sensible FPS.
//   3. Playing Level 1 through sends progression_completed with duration_sec.
//   4. Every event carries game_version; no event name holds a digit.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, sleep, clickButton, GAME_URL } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => {
  // Spy on analytics.send once the Bridge has initialized (as pgbridge does for sendMessage).
  window.__events = [];
  let real;
  Object.defineProperty(window, "bridge", {
    configurable: true,
    get() {
      return real;
    },
    set(b) {
      real = b;
      const init = b.initialize.bind(b);
      b.initialize = (...args) =>
        init(...args).then((r) => {
          const a = b.analytics;
          const proto = a && Object.getPrototypeOf(a);
          const target = proto && typeof proto.send === "function" ? proto : a;
          const send = target.send;
          target.send = function (name, data) {
            window.__events.push([name, data]);
            return send.call(this, name, data);
          };
          return r;
        });
    },
  });
});
await page.goto(GAME_URL, { waitUntil: "networkidle0", timeout: 90000 });
await sleep(3000);
await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]')?.click());
await page.waitForSelector("canvas", { timeout: 30000 }).catch(() => null);
await sleep(1500);
const events = () => page.evaluate(() => window.__events);

let ev = await events();
const intro = ev.find(([n]) => n === "intro_completed");
const started = ev.find(([n]) => n === "progression_started");
check(
  "1 skipping the intro: intro_completed { skipped: true } and progression_started for Level 1",
  intro?.[1]?.skipped === true && started?.[1]?.step_index === 1 && !!started?.[1]?.world,
  { intro, started },
);

await sleep(35000);
ev = await events();
const sample = ev.find(([n]) => n === "performance_sample")?.[1];
const required = [
  "target_fps", "window_ms", "active_ms", "frame_count", "fps_avg", "fps_p10",
  "frame_time_p50_ms", "frame_time_p95_ms", "frame_time_p99_ms", "frame_time_max_ms",
  "frames_over_50ms", "frames_over_100ms", "frames_over_250ms", "frames_over_500ms",
  "frames_over_1000ms",
];
check(
  "2 after 35 s on the board: one performance_sample with every field, real frames, FPS > 0",
  !!sample &&
    required.every((k) => typeof sample[k] === "number") &&
    sample.frame_count > 100 &&
    sample.fps_avg > 0 &&
    sample.active_ms > 5000 &&
    ev.filter(([n]) => n === "performance_sample").length === 1,
  sample,
);

const played = await playToReport(page, { maxMs: 120000 });
// Level 1 is a service: Continue → Serve → Finish Level (as every restaurant level).
await clickButton(page, /^Continue$/);
await sleep(900);
if (/ORDER READY/i.test(await page.evaluate(() => document.body.innerText))) {
  await clickButton(page, /^Serve to /);
  await sleep(900);
}
await clickButton(page, /^Finish Level$/);
await sleep(1500);
ev = await events();
const done = ev.find(([n]) => n === "progression_completed");
check(
  "3 Level 1 played through: progression_completed { step_index: 1, duration_sec }",
  played.ok && done?.[1]?.step_index === 1 && typeof done?.[1]?.duration_sec === "number",
  { played: played.ok, done },
);
check(
  "4 every event carries game_version; no name holds a digit",
  ev.length > 0 &&
    ev.every(([n, d]) => typeof d?.game_version === "string" && /^[a-z_]+$/.test(n)),
  [...new Set(ev.map(([n]) => n))],
);
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `PG ANALYTICS E2E: ${failed.length} FAILURE(S)` : "PG ANALYTICS E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
