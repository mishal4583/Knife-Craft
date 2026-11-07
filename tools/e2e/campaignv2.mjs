// Campaign V2 (developer 2026-11-07): the 91-level campaign in the real browser. Restaurant build.
//   C1 a fresh player boots on campaign version 4 at Level 1
//   C2 a save from the 148-level campaign (version 3, 100 levels done) is migrated on load: version 4, ids inside 1-91, nothing lost that was done
//   C3 Level 6 is the Chicken Introduction (the first protein, was Level 57) and its order card names it
//   C4 Level 15 opens the Meat & Fish Counter chapter
//   C5 the last level (91) is the Grand Service
//   C6 no console errors
// Screenshots: out/campaignv2-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, readSave, seedSave, sleep, shot, text } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const at = (n, extra = {}) =>
  seedSave({
    credits: 100_000,
    business: { ...MOVED_IN_BUSINESS, staff: { hiredRoles: ["server", "cashier"] } },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
      ...extra,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });
const { browser, page, logs } = await launch();

// C1 + C3: Level 6.
await boot(page, at(6));
await sleep(2500);
let body = await text(page);
await shot(page, "campaignv2-level6");
const s6 = await readSave(page);
check("C1 the save is on campaign version 4", s6?.levelProgress?.campaignVersion === 4, s6?.levelProgress?.campaignVersion);
check("C3 Level 6 is the Chicken Introduction", /Chicken Introduction/i.test(body) || /Sliced Chicken Plate/i.test(body), body.slice(0, 200));

// C2: a version-3 save with 100 of 148 levels done.
await boot(
  page,
  at(101, {
    campaignVersion: 3,
    currentLevelId: "level-101",
    highestUnlockedLevelId: "level-101",
    completedLevelIds: Array.from({ length: 100 }, (_, i) => `level-${i + 1}`),
  }),
);
await sleep(2500);
const s3 = await readSave(page);
const ids = s3?.levelProgress?.completedLevelIds ?? [];
const nums = ids.map((id) => Number(id.split("-")[1]));
check(
  "C2 a 148-level save is migrated to version 4 with its ids inside 1-91",
  s3?.levelProgress?.campaignVersion === 4 && nums.length > 50 && nums.every((n) => n >= 1 && n <= 91),
  { version: s3?.levelProgress?.campaignVersion, done: nums.length, max: Math.max(...nums), current: s3?.levelProgress?.currentLevelId },
);

// C4: Level 15 starts a chapter.
await boot(page, at(15));
await sleep(2500);
body = await text(page);
await shot(page, "campaignv2-level15");
check("C4 Level 15 is the Ribeye Introduction (The Meat & Fish Counter)", /Ribeye Introduction|Meat & Fish/i.test(body), body.slice(0, 200));

// C5: the last level.
await boot(page, at(91));
await sleep(2500);
body = await text(page);
check("C5 Level 91 is the Grand Service", /Grand Service/i.test(body), body.slice(0, 200));

const bad = logs.filter((l) => /error/i.test(l.type ?? l) && !/favicon|Failed to load resource|bridge/i.test(l.text ?? String(l)));
check("C6 no console errors", bad.length === 0, bad.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
