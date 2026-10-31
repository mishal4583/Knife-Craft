// Phase 3 (opening restoration): the kitchen restoration reveal is shown only AFTER the purchase is saved,
// restaurant build, in a real browser (Business → Upgrades → Build):
//   V1 with too little money Build buys nothing and no reveal opens (the saved kitchen is unchanged).
//   V2 when the reveal is on screen the purchase is already in the SAVED game: the new tier is equipped
//      and its one kitchen-investment-purchase entry is in the ledger (wallet = opening cash + ledger).
//   V3 a double-tapped Build buys once and opens one reveal.
//   V4 reloading with the reveal on screen brings the same built kitchen and no reveal back (never saved).
//   V5 no console errors.
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  sleep,
  readSave,
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
const reveals = () =>
  page.evaluate(() => document.querySelectorAll('[data-testid="restoration-reveal"]').length);
const savedNow = () => readSave(page);
const poorSave = () =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS },
    credits: 5000,
    ownedKitchenUpgradeIds: ["humble-kitchen"],
    equippedKitchenUpgradeId: "humble-kitchen",
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const richSave = () => ({ ...poorSave(), credits: 900_000_000 });
async function calm() {
  for (let i = 0; i < 4; i++) {
    const hit = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^(Later|No thanks|Keep .*)$/.test(x.textContent.trim()),
      );
      b?.click();
      return !!b;
    });
    if (!hit) break;
    await sleep(600);
  }
}
async function openUpgrades() {
  await openShortcut(page, "business");
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /Upgrades$/.test(b.textContent.trim()))
      ?.click(),
  );
  await page.waitForFunction(() => /Growing Kitchen/.test(document.body.innerText), {
    timeout: 10000,
  });
  await sleep(500);
}
const tapBuild = (times) =>
  page.evaluate((n) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Build · \$/.test(x.textContent),
    );
    for (let i = 0; i < n; i++) b?.click();
    return !!b;
  }, times);
try {
  // ---------- V1 poor ----------
  await boot(page, poorSave());
  await calm();
  await openUpgrades();
  const before = await savedNow();
  await tapBuild(1);
  await sleep(800);
  const poor = await savedNow();
  check(
    "V1 too little money: nothing bought, no reveal, the saved kitchen is unchanged",
    (await reveals()) === 0 &&
      poor.equippedKitchenUpgradeId === before.equippedKitchenUpgradeId &&
      poor.economyLedger.length === before.economyLedger.length &&
      poor.credits === before.credits,
    { eq: poor.equippedKitchenUpgradeId },
  );

  // ---------- V2 / V3 rich, double tap ----------
  await boot(page, richSave());
  await calm();
  await openUpgrades();
  const b0 = await savedNow();
  await tapBuild(2);
  // Watch every frame until the reveal shows; read the saved game the moment it does.
  await page
    .waitForSelector('[data-testid="restoration-reveal"]', { timeout: 6000 })
    .catch(() => null);
  const atReveal = await savedNow();
  const shown = await reveals();
  await sleep(600);
  const b1 = await savedNow();
  const bought = b1.economyLedger.filter(
    (e) =>
      e.category === "kitchen-investment-purchase" && !b0.economyLedger.some((o) => o.id === e.id),
  );
  const atRevealBought = atReveal.economyLedger.filter(
    (e) =>
      e.category === "kitchen-investment-purchase" && !b0.economyLedger.some((o) => o.id === e.id),
  );
  check(
    "V2 when the reveal is on screen the purchase is already saved: the new tier equipped, its ONE ledger entry written",
    shown >= 1 &&
      atReveal.equippedKitchenUpgradeId !== b0.equippedKitchenUpgradeId &&
      atRevealBought.length === 1 &&
      atReveal.credits - b0.credits === ledgerSum(atReveal) - ledgerSum(b0),
    { shown, eq: atReveal.equippedKitchenUpgradeId, entries: atRevealBought.length },
  );
  check(
    "V3 a double-tapped Build buys once (one entry, wallet down by exactly its price) and opens one reveal",
    bought.length === 1 && b0.credits - b1.credits === -bought[0].amount && (await reveals()) === 1,
    { entries: bought.length, reveals: await reveals() },
  );

  // ---------- V4 reload ----------
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(1500);
  await calm();
  const reloaded = await savedNow();
  check(
    "V4 after a reload the built kitchen is there and no reveal comes back (it is never saved)",
    reloaded.equippedKitchenUpgradeId === b1.equippedKitchenUpgradeId && (await reveals()) === 0,
    { eq: reloaded.equippedKitchenUpgradeId },
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("V5 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
