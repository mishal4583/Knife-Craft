// Transformation Phase C (2026-10-25) — the Kitchen's next-upgrade strip, restaurant build:
//   K1 early on it names the Growing Kitchen with its existing price, locked until its level.
//   K2 at 320×568, 390×844 and 768×1024 it is on screen, ≥ 48 px, no sideways scroll, and
//      overlaps neither the wallet, Settings nor the shortcut column.
//   K3 a tap opens Kitchen Upgrades and buys nothing (wallet and ledger unchanged).
//   K4 level reached and enough money: "Ready"; every tier built: no strip.
//   K5 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, MOVED_IN_BUSINESS, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const TIERS = [
  "humble-kitchen",
  "growing-kitchen",
  "established-kitchen",
  "neighborhood-cafe",
  "flourishing-cafe",
  "grand-kitchen",
];
const saveAt = (n, credits, owned) => {
  const s = seedSave({
    business: { ...MOVED_IN_BUSINESS },
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: n > 10 ? 1 : 0, finaleSeen: false },
  });
  // Version 3 (as phase5.mjs): credits in cents, and no level-based tier grant of a version 1 save.
  s.version = 3;
  s.ownedKitchenUpgradeIds = owned;
  s.equippedKitchenUpgradeId = owned.at(-1);
  return s;
};
const toKitchen = async () => {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(700);
};
const strip = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="next-kitchen-strip"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const hit = (sel) => {
      const o = document.querySelector(sel)?.getBoundingClientRect();
      return (
        !!o && !(o.right <= r.left || o.left >= r.right || o.bottom <= r.top || o.top >= r.bottom)
      );
    };
    const settings = document.querySelector('[aria-label="Settings"]')?.getBoundingClientRect();
    const price = [...el.querySelectorAll("span")].find((x) =>
      /^\$[\d,]+\.\d\d$/.test(x.textContent.trim()),
    );
    const pr = price?.getBoundingClientRect();
    return {
      text: el.innerText.replace(/\s+/g, " ").trim(),
      priceWhole:
        !!price && price.scrollWidth <= price.clientWidth + 1 && !!pr && pr.right <= r.right + 1,
      state: el.dataset.state,
      onScreen: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
      height: r.height,
      overlapsShortcuts: hit('[data-testid="daily-check-shortcut"]'),
      overlapsSettings:
        !!settings &&
        !(
          settings.right <= r.left ||
          settings.left >= r.right ||
          settings.bottom <= r.top ||
          settings.top >= r.bottom
        ),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

// ---------- K1, K2 ----------
await boot(page, saveAt(3, 124000, ["humble-kitchen"]));
await toKitchen();
const k1 = await strip();
check(
  // Rule changed (developer 2026-10-26): every kitchen tier is for sale from Level 5 (was 16).
  "K1 early on: the Growing Kitchen with its existing price, locked until Level 5",
  !!k1 &&
    k1.state === "locked" &&
    /Growing Kitchen/.test(k1.text) &&
    /Lv 5\b/.test(k1.text) &&
    /\$16,000\.00/.test(k1.text),
  k1,
);
const sizes = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(500);
  sizes[w] = await strip();
  await shot(page, `kitchenstrip-${w}`);
}
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(400);
check(
  "K2 at 320, 390 and 768 px: the price shown in full, on screen, ≥ 48 px, no sideways scroll, clear of Settings and the shortcuts",
  Object.values(sizes).every(
    (s) =>
      s &&
      s.onScreen &&
      s.height >= 47.5 &&
      s.overflow <= 0 &&
      !s.overlapsShortcuts &&
      !s.overlapsSettings,
  ),
  sizes,
);

// ---------- K3 ----------
const before = await readSave(page);
await page.click('[data-testid="next-kitchen-strip"]');
await sleep(900);
const opened = await page.evaluate(() =>
  /Kitchen Upgrades|Growing Kitchen/i.test(document.body.innerText),
);
const after = await readSave(page);
check(
  "K3 a tap opens Kitchen Upgrades and buys nothing",
  opened &&
    after.credits === before.credits &&
    after.economyLedger.length === before.economyLedger.length,
  { opened, credits: [before.credits, after.credits] },
);

// ---------- K4 ----------
await boot(page, saveAt(16, 2000000, ["humble-kitchen"]));
await toKitchen();
const ready = await strip();
await boot(page, saveAt(60, 0, TIERS));
await toKitchen();
const none = await strip();
check(
  "K4 level reached and enough money: Ready; every tier built: no strip",
  ready?.state === "ready" && /Ready/.test(ready.text) && none === null,
  { ready, none },
);

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("K5 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\nKITCHEN STRIP E2E: ${failed.length} FAILURE(S)`
    : "\nKITCHEN STRIP E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
