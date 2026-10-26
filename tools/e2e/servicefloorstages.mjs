// Transformation Phase B (2026-10-25) — the service floor on all six kitchen stages,
// restaurant build: for each built stage, the customer reaches the seat, the order bubble is
// on screen and the figure stays inside the room at 320×568, 390×844 and 768×1024, and with
// Reduced Motion the customer is seated at once. Screenshots: out/sfstage-<stage>-<w>.png.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, MOVED_IN_BUSINESS, clickButton, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const TIERS = [
  ["humble", "humble-kitchen"],
  ["growing", "growing-kitchen"],
  ["established", "established-kitchen"],
  ["neighborhood-cafe", "neighborhood-cafe"],
  ["flourishing-cafe", "flourishing-cafe"],
  ["grand", "grand-kitchen"],
];
const FOOD = Object.fromEntries(
  ["bread", "tomato", "garlic", "basil", "mozzarella"].map((id) => [
    id,
    { ingredientId: id, quantity: 3, unitCost: 0, purchaseDay: 1 },
  ]),
);
const saveFor = (tierIndex, reducedMotion) => {
  const s = seedSave({
    business: { ...MOVED_IN_BUSINESS, inventory: FOOD },
    credits: 5000,
    levelProgress: {
      currentLevelId: "level-12",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
  s.ownedKitchenUpgradeIds = TIERS.slice(0, tierIndex + 1).map(([, id]) => id);
  s.equippedKitchenUpgradeId = TIERS[tierIndex][1];
  s.settings = { ...(s.settings ?? {}), reducedMotion };
  return s;
};
async function startLevel12() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate(() => {
    let n = [...document.querySelectorAll("p")].find(
      (p) => p.textContent.trim() === "Bruschetta for the House",
    );
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Replay)$/.test(x.textContent.trim()),
        );
      if (b) return b.click();
    }
  });
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]')))
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
  await page.waitForSelector('[data-testid="service-floor"]', { timeout: 15000 }).catch(() => null);
}
const floor = () =>
  page.evaluate(() => {
    const f = document.querySelector('[data-testid="service-floor"]');
    if (!f) return null;
    const view = f.querySelector(".sf-view")?.getBoundingClientRect();
    // The member who ordered (in a party, the one with the bubble — not just the last drawn).
    const bubbleEl = f.querySelector('[data-testid="service-floor-order"]');
    const person = (
      bubbleEl?.parentElement?.querySelector(".sf-person") ??
      [...f.querySelectorAll(".sf-person")].at(-1)
    )?.getBoundingClientRect();
    const bubble = bubbleEl?.getBoundingClientRect();
    const map = f.querySelector(".sf-map")?.getAttribute("src") ?? "";
    return {
      state: f.dataset.state,
      map: map.split("/").pop(),
      personIn: !!(
        view &&
        person &&
        person.left >= view.left - 2 &&
        person.right <= view.right + 2 &&
        person.top >= view.top - 2 &&
        person.bottom <= view.bottom + 2
      ),
      bubbleOnScreen: bubble
        ? bubble.left >= 0 && bubble.right <= innerWidth && bubble.top >= 0
        : false,
      bubbleAbove: !!(bubble && person && bubble.bottom <= person.top + 4),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

for (const [i, [stage]] of TIERS.entries()) {
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await boot(page, saveFor(i, false));
  await startLevel12();
  await sleep(4200);
  const seen = {};
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [768, 1024],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await sleep(450);
    seen[w] = await floor();
    await shot(page, `sfstage-${stage}-${w}`);
  }
  check(
    `S ${stage}: its own painting; seated with the bubble above, on screen, the customer in the room, no sideways scroll at 320/390/768`,
    Object.values(seen).every(
      (f) =>
        f &&
        f.state === "seated" &&
        f.map === `kitchen-upgrade-map-${stage}.webp` &&
        f.personIn &&
        f.bubbleOnScreen &&
        f.bubbleAbove &&
        f.overflow <= 0,
    ),
    seen,
  );
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await boot(page, saveFor(i, true));
  await startLevel12();
  await sleep(300);
  const rm = await floor();
  check(
    `RM ${stage}: Reduced Motion seats the customer at once`,
    rm?.state === "seated" && rm.personIn,
    rm,
  );
}
const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\nSERVICE FLOOR STAGES E2E: ${failed.length} FAILURE(S)`
    : "\nSERVICE FLOOR STAGES E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
