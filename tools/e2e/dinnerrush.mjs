// The first Dinner Rush (developer 2026-11-26), restaurant build, Level 18 in the day's third service (the Dinner):
//   R1 the Kitchen's Next Customer card says so: collapsed, "View Details" carries a 🔥; open, the details show "Dinner Rush: serve all N guests · +30 Hype and a badge"
//   R2 the line fits (no sideways scroll) at 320 x 568, 390 x 844 and in a wide window
//   R3 an ordinary Level 18 (the day's first service, Breakfast) shows no rush
//   R4 no console errors
// What is NOT covered here (check by hand): playing the service and clearing it (the rules are in `dinner-rush-qa`).
// Screenshots: out/dinnerrush-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = (index) => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      staff: { hiredRoles: ["server", "cashier", "prep-cook", "line-cook", "head-chef"] },
      popularity: { ...(MOVED_IN_BUSINESS.popularity ?? {}), score: 80 },
      restaurantDay: {
        day: 1,
        opened: true,
        servicesDone: index,
        servicesPlanned: 3,
        closingDue: false,
        openingCredits: null,
        openingLevel: 18 - index,
        closingDone: [],
      },
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: "level-18",
      highestUnlockedLevelId: "level-18",
      completedLevelIds: Array.from({ length: 17 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
  s.version = 3;
  return s;
};
const { browser, page, logs } = await launch();
const open = async () => {
  await sleep(2500);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Later")?.click(),
  );
  await sleep(500);
};
const details = () =>
  page.evaluate(() => {
    const btn = [...document.querySelectorAll("button[aria-controls='kitchen-order-details']")][0];
    return {
      label: btn?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      expanded: btn?.getAttribute("aria-expanded") ?? null,
    };
  });
try {
  for (const [w, h] of [
    [390, 844],
    [320, 568],
    [1815, 867],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await boot(page, save(2));
    await open();
    const closed = await details();
    await page.evaluate(() =>
      document.querySelector("button[aria-controls='kitchen-order-details']")?.click(),
    );
    await sleep(700);
    const row = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="kitchen-rush"]');
      return {
        text: el?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        guests: Number(el?.getAttribute("data-guests") ?? 0),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    await shot(page, `dinnerrush-${w}x${h}`);
    if (w === 390)
      check(
        "R1 the card announces the Dinner Rush: a 🔥 on View Details, and the line in the details",
        /🔥/.test(closed.label ?? "") &&
          /Dinner Rush: serve all \d+ guests · \+30 Hype and a badge/.test(row.text ?? "") &&
          row.guests >= 2,
        { closed, row },
      );
    check(`R2 ${w}x${h}: the line fits, no sideways scroll`, !!row.text && row.overflow <= 0, row);
  }
  // R3: the day's first service
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, save(0));
  await open();
  const plain = await details();
  await page.evaluate(() =>
    document.querySelector("button[aria-controls='kitchen-order-details']")?.click(),
  );
  await sleep(600);
  const none = await page.evaluate(() => !!document.querySelector('[data-testid="kitchen-rush"]'));
  check(
    "R3 the day's first service (Breakfast) is no rush",
    !none && !/🔥/.test(plain.label ?? ""),
    {
      plain,
      none,
    },
  );
} catch (e) {
  console.log("FAIL harness", String(e).slice(0, 300));
  await shot(page, "dinnerrush-fail").catch(() => {});
  results.push({ id: "harness", ok: false });
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("R4 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(failed ? `DINNER RUSH E2E: ${failed} FAILURE(S)` : "DINNER RUSH E2E: ALL PASS");
process.exit(failed ? 1 : 0);
