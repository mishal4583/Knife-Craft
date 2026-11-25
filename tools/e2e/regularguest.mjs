// The regular guest (developer 2026-11-25, first-20-levels plan row 13), restaurant build:
//   G1 Level 14, a first play: the first order card reads "Sofia's order · ⭐ regular" and greets "Back again, chef! The usual, please."
//   G2 Level 12 (before she comes): the first order card has no "regular" mark
//   G3 the card fits at 320 x 568 (no sideways scroll) and in the wide window
//   G4 no console errors
// NOT covered here (check by hand): finishing Level 13 shows "Sofia liked it and will be back" on the Level Complete card. The rule is in `regular-guest-qa` (R15) and
// the wiring is one line in App.tsx; a full three-order Level 13 play through the page was too slow and unreliable to keep as a browser check.
// Screenshots: out/regularguest-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, MOVED_IN_BUSINESS, sleep, clickButton, shot } from "./harness.mjs";
import { serviceSave } from "./servicedrive.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const RECIPE = "camp-garden-tomato-cucumber";
const save = (level) =>
  serviceSave({
    level,
    quantity: 120,
    ingredients: ["tomato", "cucumber"],
    top: {
      levelProgress: {
        currentLevelId: `level-${level}`,
        highestUnlockedLevelId: `level-${level}`,
        completedLevelIds: Array.from({ length: level - 1 }, (_, i) => `level-${i + 1}`),
        campaignVersion: 4,
        tickets: { [`level-${level}`]: [RECIPE] },
      },
    },
    business: { staff: { hiredRoles: ["server", "cashier", "prep-cook", "line-cook", "cleaner"] } },
    seedSave,
    MOVED_IN_BUSINESS,
  });

/** Opens the service and waits for the first order card; returns its heading and the page text. */
const firstCard = async (page) => {
  await sleep(2500);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Later")?.click(),
  );
  await sleep(400);
  await clickButton(page, /^Open for service$|Prepare$/).catch(() => {});
  await sleep(1500);
  for (let i = 0; i < 6; i++) {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          /^(⚡ Quick restock|🔥 Start service|🚪 Open restaurant|START SERVICE)/i.test(
            x.textContent.trim(),
          ) && !x.disabled,
      );
      b?.click();
      return !!b;
    });
    await sleep(900);
    if (!clicked) break;
  }
  await page
    .waitForSelector('[data-testid="order-card-heading"]', { timeout: 30000 })
    .catch(() => {});
  await sleep(800);
  return page.evaluate(() => ({
    heading: (
      document.querySelector('[data-testid="order-card-heading"]')?.textContent ?? ""
    ).replace(/\s+/g, " "),
    text: document.body.innerText.replace(/\s+/g, " "),
  }));
};

const { browser, page, logs } = await launch();
try {
  await boot(page, save(14));
  const c14 = await firstCard(page);
  await shot(page, "regularguest-14-390");
  check(
    "G1 Level 14: the first guest is Sofia, marked as a regular, with her own greeting",
    /Sofia's order · ⭐ regular/.test(c14.heading) && /Back again, chef!/.test(c14.text),
    c14.heading,
  );
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await sleep(600);
  const small = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await shot(page, "regularguest-14-320");
  await page.setViewport({ width: 1815, height: 867, deviceScaleFactor: 1 });
  await sleep(800);
  const wide = await page.evaluate(() => ({
    heading: document.querySelector('[data-testid="order-card-heading"]')?.textContent ?? "",
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  await shot(page, "regularguest-14-wide");
  check(
    "G3 the card fits at 320 x 568 and in a wide window, and still says regular there",
    small <= 0 && wide.overflow <= 0 && /regular/.test(wide.heading),
    { small, wide },
  );

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, save(12));
  const c12 = await firstCard(page);
  check(
    "G2 Level 12: an ordinary guest, no regular mark",
    c12.heading.length > 0 && !/regular/.test(c12.heading) && !/Back again, chef/.test(c12.text),
    c12.heading,
  );
} catch (e) {
  console.log("FAIL harness", String(e).slice(0, 300));
  await shot(page, "regularguest-fail").catch(() => {});
  results.push({ id: "harness", ok: false });
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("G4 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(failed ? `REGULAR GUEST E2E: ${failed} FAILURE(S)` : "REGULAR GUEST E2E: ALL PASS");
process.exit(failed ? 1 : 0);
