// Economy V2.5 in the built game:
//   1. a save that finished all 250 levels BEFORE V2.5 (no `economy`, no milestone entries) is migrated
//      once on load: its reached milestones and the Final Reward are marked claimed WITHOUT payment
//      (no ~$85k windfall), its balance and all six kitchen tiers are kept, no banner; reloads pay nothing;
//   2. its Restaurant Progress shows CAMPAIGN COMPLETE · 250 / 250 · the Final Reward as finished before
//      it existed, historical earnings rows (investment $0 — its kitchens were free) and Endless unlocked;
//   3. a CURRENT save that completed Level 250 but hasn't been paid (reload during the finale) gets the
//      $50,000 Final Reward exactly once with the "Campaign Complete · 250 / 250" banner; reloads pay nothing;
//   4. Kitchen Upgrade: a V2.5 save builds Growing Kitchen for $20,000 (one kitchen-investment-purchase
//      entry, + the $1,500 first-kitchen-upgrade milestone); an unaffordable tier says
//      "Not enough money — need $X more"; Endless stays locked before Level 250.
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

// ---------- 1. Old finished save: migrated once, no windfall ----------
await boot(page, finished());
await sleep(1200);
let s = await readSave(page);
check(
  "1a no Final Reward and no milestone payments for a campaign finished before V2.5",
  count(s, "family-legacy").length === 0 && count(s, "milestone-reward").length === 0,
  { legacy: count(s, "family-legacy"), milestones: count(s, "milestone-reward").length },
);
check("1b balance unchanged ($10,000)", s.credits === 1_000_000, s.credits);
check(
  "1c version 3 and all six kitchen tiers kept, not charged",
  s.version === 3 &&
    s.ownedKitchenUpgradeIds.length === 6 &&
    count(s, "kitchen-investment-purchase").length === 0,
  s.ownedKitchenUpgradeIds,
);
check(
  "1d migrated once: economy version 1, the Final Reward + 11 reached milestones claimed as waived",
  s.economy?.version === 1 &&
    s.economy.waivedMilestoneIds.includes("campaign-complete") &&
    s.economy.waivedMilestoneIds.length === 12 &&
    s.economy.claimedMilestoneIds.length === 12,
  s.economy && { waived: s.economy.waivedMilestoneIds.length, v: s.economy.version },
);
let t = await flat(page);
check("1e no reward banner", !/Milestone reached|Final Reward \+/i.test(t));
for (let i = 0; i < 3; i++) {
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(900);
}
const s2 = await readSave(page);
check(
  "1f three reloads pay nothing and keep the migration",
  s2.credits === s.credits &&
    count(s2, "family-legacy").length === 0 &&
    count(s2, "milestone-reward").length === 0 &&
    JSON.stringify(s2.economy) === JSON.stringify(s.economy),
);

// ---------- 2. Restaurant Progress (historical) ----------
for (let i = 0; i < 12; i++)
  if (!(await clickButton(page, /Continue|OK|Close|Got it|Dismiss/))) break;
await clickButton(page, /Progress$/);
await sleep(800);
t = await flat(page);
check("2a CAMPAIGN COMPLETE · 250 / 250", /Campaign Complete/i.test(t) && /250 \/ 250/.test(t));
check(
  "2b the Final Reward is explained as finished before it existed (not +$50,000)",
  /finished the campaign before the Final Reward existed/i.test(t),
  t.match(/Final Reward[^.]*\./i)?.[0],
);
check("2c Endless Service unlocked", /Endless Service/i.test(t));
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
check(
  "2e historical investment $0 (its kitchens were free), current-rate chart labelled",
  /Invested in your restaurant \$0\.00/.test(t) && /at today's rates/i.test(t),
  t.match(/Invested in your restaurant[^A-Z]*/)?.[0],
);
check("2f no 'richest' / '#1' claim", !/richest|number one|#1/i.test(t));
await shot(page, "v25-2-progress");

// ---------- 3. Current save: Level 250 just completed, Final Reward paid once ----------
await boot(
  page,
  seedSave({
    version: 3,
    credits: 1_000_000,
    economy: {
      version: 1,
      // Every reached milestone already claimed, except the Final Reward.
      claimedMilestoneIds: [
        "first-dish",
        "levels-10",
        "levels-25",
        "levels-50",
        "first-kitchen-upgrade",
        "levels-100",
        "halfway",
        "levels-150",
        "levels-200",
        "every-kitchen-stage",
        "final-chapter",
      ],
      waivedMilestoneIds: [],
      lifetime: {},
      lifetimeSince: "start",
    },
    levelProgress: {
      currentLevelId: "level-250",
      highestUnlockedLevelId: "level-250",
      completedLevelIds: allLevels,
    },
    ownedKitchenUpgradeIds: [
      "humble-kitchen",
      "growing-kitchen",
      "established-kitchen",
      "neighborhood-cafe",
      "flourishing-cafe",
      "grand-kitchen",
    ],
    equippedKitchenUpgradeId: "grand-kitchen",
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
  }),
);
await sleep(1200);
s = await readSave(page);
const legacy = count(s, "family-legacy");
check(
  "3a the $50,000 Final Reward is paid once (family-legacy), unscaled",
  legacy.length === 1 &&
    legacy[0].amount === 5_000_000 &&
    s.credits ===
      1_000_000 + 5_000_000 + count(s, "milestone-reward").reduce((a, e) => a + e.amount, 0),
  { legacy, credits: s.credits },
);
t = await flat(page);
check(
  "3b banner: Campaign Complete · 250 / 250 · Final Reward +$50,000 · Endless Service unlocked",
  /Campaign Complete/i.test(t) &&
    /250 \/ 250/.test(t) &&
    /Final Reward \+\$50,000/.test(t) &&
    /Endless Service unlocked/i.test(t),
  t.match(/Campaign Complete.{0,160}/i)?.[0],
);
await shot(page, "v25-1-banner");
for (let i = 0; i < 2; i++) {
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(900);
}
const s3 = await readSave(page);
check(
  "3c reloads after Level 250 pay nothing more",
  s3.credits === s.credits && count(s3, "family-legacy").length === 1,
  s3.credits,
);

// ---------- 4. Kitchen development ----------
await boot(
  page,
  seedSave({
    version: 3,
    credits: 2_500_000, // $25,000 (no `economy`: migrated on load, its reached milestones waived)
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
  "4a Kitchen Upgrade screen offers 🔨 Build · $20,000 for Growing Kitchen",
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
  "4b built: −$20,000 in one kitchen-investment-purchase entry, kitchen moved",
  kip.length === 1 &&
    kip[0].amount === -2_000_000 &&
    after.equippedKitchenUpgradeId === "growing-kitchen",
  kip,
);
check(
  "4c + the $1,500 'First kitchen upgrade' milestone, once",
  count(after, "milestone-reward").filter((e) => e.description === "first-kitchen-upgrade")
    .length === 1 && after.credits === before.credits - 2_000_000 + 150_000,
  { before: before.credits, after: after.credits },
);
t = await flat(page);
await clickButton(page, /Established Kitchen/);
await sleep(400);
t = await flat(page);
check(
  "4d selecting Established Kitchen ($25,000) with $6,500 shows 'Not enough money — need $18,500.00 more' and a disabled Build",
  after.credits === 650_000 &&
    /Not enough money — need \$18,500\.00 more/i.test(t) &&
    (await page.evaluate(
      () =>
        [...document.querySelectorAll("button")].find((b) => /Build · \$25,000/.test(b.textContent))
          ?.disabled === true,
    )),
  t.match(/Not enough money[^.]*\./)?.[0],
);
await shot(page, "v25-4-kitchen-built");
await boot(
  page,
  seedSave({
    version: 3,
    credits: 100_000,
    levelProgress: {
      currentLevelId: "level-60",
      highestUnlockedLevelId: "level-60",
      completedLevelIds: allLevels.slice(0, 59),
    },
  }),
);
await sleep(800);
await clickButton(page, /See all orders/);
await sleep(700);
t = await flat(page);
check(
  "4e at Level 60 Endless Service is locked until Level 250",
  /Endless Service 🔒 unlocks after Level 250/i.test(t),
);

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("economyv25-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nECONOMY V2.5 E2E: ALL PASS" : `\nECONOMY V2.5 E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
