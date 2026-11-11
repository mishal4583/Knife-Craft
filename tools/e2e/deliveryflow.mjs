// The delivery routine (developer 2026-11-11: "receive the delivery, check for damaged product, unpack, sort to the fridge, then the Fridge Check;
// every mini-game mandatory and in its right order; the unpacking game not even visible in the Inventory"), restaurant build, real browser.
//   F1 the Inventory shows the routine at the TOP: 1 Check the delivery (next), 2 Unpack (locked)
//   F2 the Unpack chip is locked; tapping it sends the player to the check, not to Fridge Sort
//   F3 "Open for service" with a delivery waiting does NOT start the service: the "Before you open" sheet lists the steps
//   F4 its button opens the check (Delivery Inspection)
//   F5 once the delivery is checked, Unpack is open and the sheet points at it; its button opens Fridge Sort
//   F6 checked and unpacked: nothing blocks the service
//   F7 320 x 568: the sheet and the card fit, no sideways scroll, every button at least 48 px
//   F8 no console errors
// Screenshots: out/flow-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  openShortcut,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const CRATE = ["tomato", "carrot", "lettuce", "apple", "onion", "basil"];
const COUNTS = { tomato: 2, carrot: 2, lettuce: 1, apple: 1, onion: 1, basil: 1 };
const STOCK = Object.fromEntries(
  [...CRATE, "potato", "cucumber", "garlic", "bread"].map((id) => [
    id,
    { ingredientId: id, quantity: 8, unitCost: 100, purchaseDay: 1 },
  ]),
);
const saveAt = (n, business = {}) =>
  seedSave({
    credits: 500_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: STOCK,
      staff: { hiredRoles: ["server", "cashier"] },
      ...business,
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const waiting = { fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1 } };
const checked = { ...waiting, deliveryInspection: { seed: 1, inspected: 99, howto: 1 } };

const tap = async (page, sel) => {
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.disabled) return false;
    el.click();
    return true;
  }, sel);
  await sleep(700);
  return ok;
};
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const text = (page, sel) =>
  page.evaluate(
    (s) => document.querySelector(s)?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    sel,
  );
const openInventory = async (page) => {
  await openShortcut(page, "inventory");
  await sleep(1200);
};
const openKitchenAndOpenService = async (page) => {
  await openShortcut(page, "kitchen");
  await sleep(1200);
  return page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /^Open for service$/.test((x.textContent ?? "").trim()),
    );
    if (b && !b.disabled) {
      b.click();
      return true;
    }
    return false;
  });
};

const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

// F1 + F2: the Inventory
await boot(page, saveAt(3, waiting));
await openInventory(page);
const card = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="delivery-routine"]');
  const first = document.querySelector(".kc-scroll, main, [data-scroll]");
  void first;
  return c
    ? {
        top: Math.round(c.getBoundingClientRect().top),
        inspect: c.querySelector('[data-testid="flow-step-inspect"]')?.dataset.state,
        unpack: c.querySelector('[data-testid="flow-step-unpack"]')?.dataset.state,
        text: c.textContent.replace(/\s+/g, " ").trim(),
      }
    : null;
});
await shot(page, "flow-1-inventory");
check(
  "F1 the Inventory shows the routine at the top: Check the delivery (next), Unpack (locked)",
  !!card &&
    card.inspect === "next" &&
    card.unpack === "locked" &&
    /Check the delivery/.test(card.text) &&
    card.top < 420,
  card,
);
const chipState = await page.evaluate(
  () => document.querySelector('[data-testid="fridge-sort-chip"]')?.dataset.state ?? null,
);
await tap(page, '[data-testid="fridge-sort-chip"]');
const onCheck = await has(page, '[data-testid="delivery-inspection"]');
const onSort = await has(page, '[data-testid="fridge-sort"]');
check(
  "F2 the Unpack chip is locked and a tap sends the player to the check",
  chipState === "locked" && onCheck && !onSort,
  { chipState, onCheck, onSort },
);

// F3 + F4: the Kitchen
await boot(page, saveAt(3, waiting));
const clicked = await openKitchenAndOpenService(page);
await sleep(700);
const gate = await page.evaluate(() => ({
  sheet: !!document.querySelector('[data-testid="service-gate"]'),
  steps: [
    ...document.querySelectorAll('[data-testid="service-gate"] [data-testid^="flow-step-"]'),
  ].map((e) => e.dataset.testid.replace("flow-step-", "")),
  playing: !!document.querySelector("canvas") && !document.querySelector('[data-testid="kitchen"]'),
}));
await shot(page, "flow-3-gate");
check(
  "F3 'Open for service' with a delivery waiting shows the 'Before you open' sheet and does not start the service",
  clicked && gate.sheet && gate.steps.join() === "inspect,unpack" && !gate.playing,
  { clicked, gate },
);
await tap(page, '[data-testid="gate-go"]');
check(
  "F4 the sheet's button opens the check",
  (await has(page, '[data-testid="delivery-inspection"]')) &&
    !(await has(page, '[data-testid="service-gate"]')),
);

// F5: checked, not unpacked
await boot(
  page,
  saveAt(3, { ...waiting, deliveryInspection: { seed: 1, inspected: 99, howto: 1 } }),
);
await openKitchenAndOpenService(page);
await sleep(700);
const gate2 = await page.evaluate(() => ({
  steps: [
    ...document.querySelectorAll('[data-testid="service-gate"] [data-testid^="flow-step-"]'),
  ].map((e) => `${e.dataset.testid.replace("flow-step-", "")}:${e.dataset.state}`),
}));
await tap(page, '[data-testid="gate-go"]');
check(
  "F5 checked: only Unpack is left, it is open, and its button opens Fridge Sort",
  gate2.steps.join() === "unpack:next" && (await has(page, '[data-testid="fridge-sort"]')),
  gate2,
);

// F6: nothing waits
await boot(page, saveAt(3, { fridgeSort: { crate: [], counts: {}, seed: 1 } }));
await openKitchenAndOpenService(page);
await sleep(900);
check(
  "F6 with nothing waiting the sheet never shows",
  !(await has(page, '[data-testid="service-gate"]')),
);

// F7: small phone
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveAt(3, waiting));
await openKitchenAndOpenService(page);
await sleep(700);
const small = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('[data-testid="service-gate"] button')];
  return {
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    minH: Math.round(Math.min(...btns.map((b) => b.getBoundingClientRect().height))),
    inside: (() => {
      const r = document
        .querySelector('[data-testid="service-gate"] [role="dialog"]')
        ?.getBoundingClientRect();
      return !!r && r.top >= 0 && r.bottom <= window.innerHeight + 1;
    })(),
  };
});
await shot(page, "flow-7-small");
check(
  "F7 at 320 x 568 the sheet fits, no sideways scroll, every button at least 48 px",
  !small.sideways && small.minH >= 48 && small.inside,
  small,
);

check(
  "F8 no console errors",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0,
  logs.slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
