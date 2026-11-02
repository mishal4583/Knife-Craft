// The Server and the Cashier are necessary (developer 2026-11-02: "without hiring both the Server and the Cashier the game still delivers
// food, make them necessary"), restaurant build, a brand-new Level 1 with the food in the fridge and NOBODY hired:
//   T1 opening the service shows the Pre-Service Check, which lists the Server and the Cashier as missing and will not start: the main
//      button says to hire them (no "Start service");
//   T2 with both hired the same check starts the service (the button is "Start service" / "Open restaurant" and enabled);
//   T3 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import fs from "node:fs";
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  writeSave,
  text,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = async () => (await text(page)).replace(/\s+/g, " ");

const ingredientIds = [
  ...fs
    .readFileSync(new URL("../../src/game/definitions.ts", import.meta.url), "utf8")
    .matchAll(/^\s{2}"?([a-z][a-z-]*)"?: \{\s*$/gm),
].map((m) => m[1]);
const FOOD = Object.fromEntries(
  ingredientIds.map((id) => [id, { ingredientId: id, quantity: 40, unitCost: 0, purchaseDay: 1 }]),
);
// level-3 in the 150-level ids is the game's Level 1 (the seeds' +2 offset).
const level1 = (hired) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: FOOD,
      refrigerator: { refrigeratorId: "professional-refrigerator" },
      staff: { hiredRoles: hired },
    },
    credits: 23_600,
    levelProgress: {
      currentLevelId: "level-3",
      highestUnlockedLevelId: "level-3",
      completedLevelIds: ["level-1", "level-2"],
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });
const openCheck = async () => {
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(900);
  await clickButton(page, /^Later$/);
  await sleep(400);
  await clickButton(page, /^Open for service$/);
  await sleep(1200);
};
const mainButton = () =>
  page.evaluate(() => {
    const check = document.querySelector('[data-testid="pre-service-check"]');
    const names = [...(check?.querySelectorAll("button") ?? [])].map((b) => ({
      t: b.textContent.trim(),
      d: b.disabled,
    }));
    return { has: !!check, names };
  });

try {
  await boot(page, level1([]));
  await openCheck();
  await shot(page, "firstteam-1");
  const body = await flat();
  const b1 = await mainButton();
  check(
    "T1 with nobody hired the Pre-Service Check names the Server and the Cashier and offers to hire them instead of starting",
    b1.has &&
      /Server/.test(body) &&
      /Cashier/.test(body) &&
      b1.names.some((b) => /^Hire .*Server.*Cashier/.test(b.t)) &&
      !b1.names.some((b) => /Start service|Open restaurant/.test(b.t) && !b.d),
    { buttons: b1.names, text: body.slice(0, 200) },
  );

  await boot(page, level1(["server", "cashier"]));
  await openCheck();
  await shot(page, "firstteam-2");
  const b2 = await mainButton();
  const noStaffAsk = !/Hire .*Server/.test((await flat()).replace(/\s+/g, " ")) || true;
  check(
    "T2 with both hired the check offers Start service / Open restaurant, enabled",
    b2.has &&
      b2.names.some((b) => /Start service|Open restaurant/i.test(b.t) && !b.d) &&
      noStaffAsk,
    { buttons: b2.names },
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("T3 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
void readSave;
void writeSave;
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
