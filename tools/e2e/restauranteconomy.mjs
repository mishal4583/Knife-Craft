// The final economy pass (docs/ECONOMY_FINAL.md) in a real browser. KC_URL = a RESTAURANT_MODE
// test build (VITE_RESTAURANT_MODE=1). The release build's prices are checked by economyv25.mjs
// (Growing Kitchen "Build · $20,000").
//   1. Kitchen Upgrade (restaurant): Growing Kitchen costs $16,000 and says what it gives
//      ("+1.5% restaurant quality on order earnings"); building it writes ONE
//      kitchen-investment-purchase entry of −$16,000.
//   2. Level 31 opens Day 1: the Pre-Service Check offers "Stock the whole day" for both of today's
//      services (Levels 31, 32) with units, cost and whether it fits the fridge; a row's Restock
//      opens the Market on that ingredient with the day's quantity.
//   3. With $0, Grandma's pantry is offered with the Emergency Service note; using it records the
//      level as an Emergency Service in the save (no money moves).
//   4. 320×568 · 360×640 · 390×844 · 430×932: the check (with the day card) fits, no sideways
//      scroll, every button ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  text,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });

const done = (n) => Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`);
const saveAt = (n, cents, extra = {}) =>
  seedSave({
    version: 3,
    business: MOVED_IN_BUSINESS,
    credits: cents,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: done(n),
    },
    ownedKitchenUpgradeIds: ["humble-kitchen"],
    equippedKitchenUpgradeId: "humble-kitchen",
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
    ...extra,
  });
async function openKitchenUpgrades() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button, [role=button], div")].find(
      (x) => /^Kitchen Upgrade/.test(x.textContent?.trim() ?? "") && x.onclick !== undefined,
    );
    (el?.closest("button") ?? el)?.click();
  });
  await sleep(800);
}
async function prepare(title) {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Play|Start Service)$/.test(x.textContent.trim()),
        );
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
  await sleep(1000);
}
const day = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="psc-day-stock"]');
    if (!el) return null;
    return {
      text: el.innerText.replace(/\s+/g, " "),
      rows: [...el.querySelectorAll("[data-psc-day-ingredient]")].map((r) => ({
        id: r.getAttribute("data-psc-day-ingredient"),
        button: r.querySelector("button")?.textContent.trim() ?? "",
      })),
    };
  });

// ---------- 1. Kitchen Upgrade ----------
await boot(page, saveAt(60, 3_000_000));
await openKitchenUpgrades();
const k1 = await flat();
const benefit = await page.evaluate(
  () => document.querySelector('[data-testid="kitchen-benefit"]')?.textContent ?? null,
);
await shot(page, "economy-kitchen-upgrade");
const before = await readSave(page);
await clickButton(page, /Build · \$16,000/);
await sleep(800);
const after = await readSave(page);
const kip = after.economyLedger
  .slice(before.economyLedger.length)
  .filter((e) => e.category === "kitchen-investment-purchase");
check(
  "1 Kitchen Upgrade (restaurant): Growing Kitchen $16,000 with its benefit; one −$16,000 entry",
  /Build · \$16,000/.test(k1) &&
    /\+1\.5% restaurant quality on order earnings/.test(benefit ?? "") &&
    kip.length === 1 &&
    kip[0].amount === -1_600_000 &&
    after.equippedKitchenUpgradeId === "growing-kitchen",
  { benefit, kip },
);

// ---------- 2. Whole-day stocking ----------
await boot(page, saveAt(31, 500_000));
await prepare("Baguette Rounds");
const d = await day();
await page.evaluate(() =>
  document.querySelector('[data-testid="psc-day-stock"]')?.scrollIntoView({ block: "center" }),
);
await shot(page, "economy-day-stock");
const first = d?.rows[0];
if (first) {
  await page.evaluate((id) => {
    document.querySelector(`[data-psc-day-ingredient="${id}"] button`)?.click();
  }, first.id);
  await sleep(1000);
}
const buyText = await page.evaluate((id) => {
  const card = document.querySelector(`[data-ingredient="${id}"]`);
  const buy =
    card && [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()));
  return buy?.textContent.trim() ?? "";
}, first?.id ?? "");
const units = Number(first?.button.match(/Restock (\d+)/)?.[1] ?? "0");
check(
  "2 Level 31 offers Stock the whole day (Levels 31, 32 — units, cost, fridge fit); Restock opens the Market at the day's quantity",
  !!d &&
    /Stock the whole day/i.test(d.text) &&
    /Levels 31, 32/.test(d.text) &&
    /\d+ units · \$/.test(d.text) &&
    /(Fits your fridge|your fridge has)/.test(d.text) &&
    d.rows.length > 0 &&
    units > 0 &&
    buyText.startsWith(`Buy ${units} `),
  { day: d?.text?.slice(0, 80), rows: d?.rows.slice(0, 3), units, buyText },
);

// ---------- 3. Emergency Service ----------
await boot(page, saveAt(31, 0));
await prepare("Baguette Rounds");
const sheet = await page.evaluate(
  () =>
    document.querySelector('[data-testid="pre-service-check"]')?.innerText.replace(/\s+/g, " ") ??
    "",
);
const pre = await readSave(page);
await clickButton(page, /Use Grandma's pantry/);
await sleep(800);
const post = await readSave(page);
check(
  "3 $0: Grandma's pantry comes with the Emergency Service note; using it records the level as an Emergency Service, no money moves",
  /Emergency Service: this service's orders earn their pay but no quality bonus/.test(sheet) &&
    post.levelProgress.emergency?.["level-31"] === true &&
    post.credits === pre.credits &&
    post.economyLedger.length === pre.economyLedger.length,
  { emergency: post.levelProgress.emergency, credits: [pre.credits, post.credits] },
);

// ---------- 4. Widths ----------
const fit = [];
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await boot(page, saveAt(31, 500_000));
  await prepare("Baguette Rounds");
  const m = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="pre-service-check"]');
    const card = document.querySelector('[data-testid="psc-day-stock"]');
    const small = [...(card?.querySelectorAll("button") ?? [])].filter(
      (b) => b.getBoundingClientRect().height < 47.5,
    ).length;
    return {
      sheet: !!el,
      card: !!card,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cardRight: card ? Math.round(card.getBoundingClientRect().right) : 0,
      small,
    };
  });
  fit.push({ w, ...m });
  if (w === 320) await shot(page, "economy-day-stock-320");
}
check(
  "4 320–430 px: the check with the day card fits, no sideways scroll, buttons ≥ 48 px",
  fit.every((f) => f.sheet && f.card && f.overflow <= 0 && f.cardRight <= f.w && f.small === 0),
  fit,
);

const errors = logs.filter((l) => /pageerror/.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(
  failed ? `RESTAURANT ECONOMY E2E: ${failed} FAILURE(S)` : "RESTAURANT ECONOMY E2E: ALL PASS",
);
process.exit(failed ? 1 : 0);
