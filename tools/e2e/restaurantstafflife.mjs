// First-floor staff life (developer 2026-10-16), restaurant build:
//   1. nobody hired: only the Old Chef (from the intro) works in the kitchen;
//   2. a hired Cleaner with a real restroom job (the soap needs refilling, soap in stock)
//      appears in the restroom at it, with the job's icon (🧼);
//   3. the Cleaner really cleans: after a few seconds the job is gone from the save, a soap
//      is used, it counts as the Cleaner's, and the Cleaner leaves the restroom;
//   4. the people move and are decorative (aria-hidden, no taps);
//   5. no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = (hiredRoles, extra = {}) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, staff: { hiredRoles }, ...extra },
    levelProgress: {
      currentLevelId: "level-40",
      highestUnlockedLevelId: "level-40",
      completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const openMap = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".restaurant-map-stage", { timeout: 15000 });
  await sleep(1200);
};
const castOf = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="staff-life"] .floor-actor')].map((a) => ({
      kind: a.getAttribute("data-actor"),
      text: a.textContent ?? "",
    })),
  );

const { browser, page, logs } = await launch();

// 1. Nobody hired.
await boot(page, save([]));
await openMap(page);
const alone = await castOf(page);
check(
  "1 nobody hired: only the Old Chef works in the kitchen",
  alone.length === 1 && alone[0].kind === "chef",
  alone,
);

// 2–3. A hired Cleaner with a real restroom job.
await boot(
  page,
  save(["cleaner"], {
    supplies: {
      ...(MOVED_IN_BUSINESS.supplies ?? {}),
      stock: { "hand-soap": { units: 3, costBasis: 300 } },
    },
    cleanliness: {
      tasks: [{ kind: "sink", count: 1, since: 1 }],
      cleanerAreas: ["kitchen", "dining", "restroom"],
    },
  }),
);
const s0 = await readSave(page);
await openMap(page);
const working = await castOf(page);
await shot(page, "restaurant-staff-cleaner-390");
check(
  "2 a hired Cleaner with an open restroom job is in the restroom at it (🧼)",
  working.some((a) => a.kind === "cleaner" && a.text.includes("🧼")),
  working,
);
const info = await page.evaluate(async () => {
  const layer = document.querySelector('[data-testid="staff-life"]');
  const actors = [...(layer?.querySelectorAll(".floor-actor") ?? [])];
  const where = () => actors.map((a) => getComputedStyle(a).transform).join("|");
  const t0 = where();
  await new Promise((r) => setTimeout(r, 1500));
  return {
    moved: where() !== t0,
    hidden: layer?.getAttribute("aria-hidden") === "true",
    taps: layer ? getComputedStyle(layer).pointerEvents : null,
  };
});
await sleep(6000);
const s1 = await readSave(page);
const after = await castOf(page);
const tasks0 = s0.business.cleanliness?.tasks ?? [];
const tasks1 = s1.business.cleanliness?.tasks ?? [];
const soap = (s) => s.business.supplies?.stock?.["hand-soap"]?.units ?? 0;
check(
  "3 the Cleaner really cleans: the job leaves the save, a soap is used, it counts as the Cleaner's, and they leave",
  tasks0.some((t) => t.kind === "sink") &&
    !tasks1.some((t) => t.kind === "sink") &&
    soap(s1) === soap(s0) - 1 &&
    (s1.business.cleanliness?.byCleaner ?? 0) === (s0.business.cleanliness?.byCleaner ?? 0) + 1 &&
    !after.some((a) => a.kind === "cleaner"),
  { tasks0, tasks1, soap: [soap(s0), soap(s1)], after },
);
check(
  "4 they move; decorative (aria-hidden, no taps)",
  info.moved && info.hidden && info.taps === "none",
  info,
);
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `STAFF LIFE E2E: ${failed.length} FAILURE(S)` : "STAFF LIFE E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
