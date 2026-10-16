// First-floor staff life (developer 2026-10-16), restaurant build:
//   1. the Restaurant map draws staff at work (data-testid="staff-life"): with the temporary
//      preview on, all six roles the game has (2 cooks, Head Chef, Server, Cleaner, Manager);
//      without it, only the save's hired roles;
//   2. they move (transform changes over time; CSS animations running);
//   3. decorative: aria-hidden, no taps — the map's rooms still open;
//   4. no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = (hiredRoles) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, staff: { hiredRoles } },
    levelProgress: {
      currentLevelId: "level-140",
      highestUnlockedLevelId: "level-140",
      completedLevelIds: Array.from({ length: 139 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
await boot(page, save(["server", "cleaner"]));
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await page.waitForSelector(".restaurant-map-stage", { timeout: 15000 });
await sleep(1500);
const info = await page.evaluate(async () => {
  const layer = document.querySelector('[data-testid="staff-life"]');
  const actors = [...(layer?.querySelectorAll(".floor-actor") ?? [])];
  const where = () => actors.map((a) => getComputedStyle(a).transform).join("|");
  const t0 = where();
  await new Promise((r) => setTimeout(r, 1500));
  return {
    preview: layer?.getAttribute("data-preview") === "true",
    kinds: actors.map((a) => a.getAttribute("data-actor")),
    moved: where() !== t0,
    running: actors.every((a) => a.getAnimations().some((x) => x.playState === "running")),
    hidden: layer?.getAttribute("aria-hidden") === "true",
    taps: layer ? getComputedStyle(layer).pointerEvents : null,
  };
});
await shot(page, "restaurant-staff-life-390");
const expected = info.preview ? "cook,cook,chef,server,cleaner,manager" : "server,cleaner";
check(
  "1 the map draws the staff at work — all six roles as the preview, else only the hired ones",
  info.kinds.join() === expected,
  info,
);
check("2 they move (animations running)", info.moved && info.running, {
  moved: info.moved,
  running: info.running,
});

const opened = await page.evaluate(() => {
  const z = [...document.querySelectorAll(".map-hotspot-zone")].find((e) =>
    /Kitchen/i.test(e.getAttribute("aria-label") ?? ""),
  );
  z?.click();
  return !!z;
});
await sleep(1200);
const left = await page.evaluate(() => !document.querySelector('[data-testid="staff-life"]'));
check(
  "3 decorative: aria-hidden, no taps — a room under them still opens",
  info.hidden && info.taps === "none" && opened && left,
  { hidden: info.hidden, taps: info.taps, opened, left },
);
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `STAFF LIFE E2E: ${failed.length} FAILURE(S)` : "STAFF LIFE E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
