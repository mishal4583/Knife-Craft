// Economy V2.5 in the built game:
//   1. a save that finished all 250 levels before V2.5 (no milestone entries) gets every reached
//      milestone + the $50,000 Family Legacy exactly once on load, with a banner; a reload pays nothing more;
//   2. Restaurant Progress shows CAMPAIGN COMPLETE · FAMILY LEGACY · +$50,000 · "Your restaurant is yours."
//      and the earnings rows;
//   3. Kitchen Upgrade: a V2.5 save builds Growing Kitchen for $20,000 (one kitchen-investment-purchase
//      entry, + the $1,500 first-kitchen-upgrade milestone); an unaffordable tier says how much is missing.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  text,
  save,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const allLevels = Array.from({ length: 250 }, (_, i) => `level-${i + 1}`);
const finished = (extra = {}) =>
  seedSave({
    version: 2, // pre-V2.5: kitchen tiers were free, so migration grants all six
    credits: 1_000_000,
    levelProgress: {
      currentLevelId: "level-250",
      highestUnlockedLevelId: "level-250",
      completedLevelIds: allLevels,
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
    ...extra,
  });
const count = (s, cat) => s.economyLedger.filter((e) => e.category === cat);

const { browser, page, logs } = await launch();

// ---------- 1. Family Legacy on load, once ----------
await boot(page, finished());
await sleep(1200);
let s = await readSave(page);
const legacy = count(s, "family-legacy");
const milestones = count(s, "milestone-reward");
check(
  "1a Family Legacy paid once, $50,000",
  legacy.length === 1 && legacy[0].amount === 5_000_000,
  legacy,
);
// Default items + all six kitchen tiers (migrated) at Level 250: every milestone except the
// Blacksmith, Business-day, staff and knife ones.
const expectedMilestones = 100 + 250 + 500 + 1000 + 1500 + 3000 + 4000 + 5000 + 7500 + 7500 + 5000;
const paidMilestones = milestones.reduce((t, e) => t + e.amount, 0);
check(
  "1b every reached milestone paid once",
  paidMilestones === expectedMilestones * 100 &&
    new Set(milestones.map((e) => e.description)).size === milestones.length,
  { paid: paidMilestones / 100, expected: expectedMilestones },
);
check(
  "1c wallet = $10,000 + milestones + $50,000",
  s.credits === 1_000_000 + expectedMilestones * 100 + 5_000_000,
  s.credits,
);
check(
  "1d version 3 and all six kitchen tiers kept",
  s.version === 3 && s.ownedKitchenUpgradeIds.length === 6,
  s.ownedKitchenUpgradeIds,
);
let t = await flat(page);
check(
  "1e one summary banner (Family Legacy + the other milestones, total amount)",
  /Family Legacy/i.test(t) &&
    /Level 250 complete \+ 11 milestones/i.test(t) &&
    /\+\$85,350/.test(t),
  t.match(/Family Legacy[^$]*\$[0-9,.]+/i)?.[0],
);
await shot(page, "v25-1-banner");
await page.reload({ waitUntil: "networkidle0" });
await sleep(1200);
const s2 = await readSave(page);
check(
  "1f reload pays nothing more",
  s2.credits === s.credits &&
    count(s2, "family-legacy").length === 1 &&
    count(s2, "milestone-reward").length === milestones.length,
);

// ---------- 2. Restaurant Progress ----------
for (let i = 0; i < 12; i++)
  if (!(await clickButton(page, /Continue|OK|Close|Got it|Dismiss/))) break;
await clickButton(page, /Progress$/);
await sleep(800);
t = await flat(page);
check("2a CAMPAIGN COMPLETE", /Campaign Complete/i.test(t));
check("2b FAMILY LEGACY +$50,000", /Family Legacy/i.test(t) && /\+\$50,000/.test(t));
check("2c 'Your restaurant is yours.'", /Your restaurant is yours\./.test(t));
check(
  "2d earnings rows",
  [
    "Current cash",
    "Level rewards earned",
    "Milestone rewards",
    "Business revenue",
    "Invested in your restaurant",
    "Total spent",
    "Remaining wealth",
  ].every((l) => t.includes(l)),
);
check("2e no 'richest' / '#1' claim", !/richest|number one|#1/i.test(t));
await shot(page, "v25-2-progress");

// ---------- 3. Kitchen development ----------
await boot(
  page,
  seedSave({
    version: 3,
    credits: 2_500_000, // $25,000
    levelProgress: {
      currentLevelId: "level-60",
      highestUnlockedLevelId: "level-60",
      completedLevelIds: allLevels.slice(0, 59),
    },
    ownedKitchenUpgradeIds: ["humble-kitchen"],
    equippedKitchenUpgradeId: "humble-kitchen",
  }),
);
await sleep(800);
const before = await readSave(page);
await clickButton(page, /^Kitchen$/);
await sleep(400);
await page.evaluate(() => {
  const el = [...document.querySelectorAll("button, [role=button], div")].find(
    (x) => /^Kitchen Upgrade/.test(x.textContent?.trim() ?? "") && x.onclick !== undefined,
  );
  (el?.closest("button") ?? el)?.click();
});
await sleep(700);
t = await flat(page);
check(
  "3a Kitchen Upgrade screen offers 🔨 Build · $20,000 for Growing Kitchen",
  /Build · \$20,000/.test(t) && /Growing Kitchen/.test(t),
  t.slice(0, 200),
);
await shot(page, "v25-3-kitchen-available");
await clickButton(page, /Build · \$20,000/);
await sleep(700);
const after = await readSave(page);
const kip = count(after, "kitchen-investment-purchase").slice(
  count(before, "kitchen-investment-purchase").length,
);
check(
  "3b built: −$20,000 in one kitchen-investment-purchase entry, kitchen moved",
  kip.length === 1 &&
    kip[0].amount === -2_000_000 &&
    after.equippedKitchenUpgradeId === "growing-kitchen",
  kip,
);
check(
  "3c + the $1,500 'First kitchen upgrade' milestone, once",
  count(after, "milestone-reward").filter((e) => e.description === "first-kitchen-upgrade")
    .length === 1 && after.credits === before.credits - 2_000_000 + 150_000,
  { before: before.credits, after: after.credits },
);
t = await flat(page);
await clickButton(page, /Established Kitchen/);
await sleep(400);
t = await flat(page);
check(
  "3d selecting Established Kitchen ($25,000) with $8,350 shows 'need $16,650.00 more' and a disabled Build",
  after.credits === 835_000 &&
    /need \$16,650\.00 more/i.test(t) &&
    (await page.evaluate(
      () =>
        [...document.querySelectorAll("button")].find((b) => /Build · \$25,000/.test(b.textContent))
          ?.disabled === true,
    )),
  t.match(/Current balance[^.]*\./)?.[0],
);
await shot(page, "v25-4-kitchen-built");

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("economyv25-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nECONOMY V2.5 E2E: ALL PASS" : `\nECONOMY V2.5 E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
