// The first-run hand (developer 2026-11-01: "proper hand instructions to buy the ingredients, hire them and then go
// back to cutting"), restaurant build, in a real browser, from a brand-new save:
//   H1 the Market's hand is on the first Hire button (Server first, "1️⃣ Tap Hire"); hiring both moves it on.
//   H2 the hand is then on the first Buy button ("2️⃣ Tap Buy"); buying everything moves it on.
//   H3 the bottom bar's Kitchen tab has the hand and the caption "3️⃣ … back to the Kitchen".
//   H4 on the Kitchen the hand is on "Open for service".
//   H5 the Pre-Service Check (when it opens) has the hand on its start button; starting opens the cutting.
//   H6 the hand is gone once the first service is done.
//   H7 no console errors.
import {
  launch,
  freshPlayer,
  sleep,
  clickButton,
  readSave,
  text,
  sweepCash,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const q = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const handFor = () =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-testid="first-run-hand"],[data-testid="first-shopping-hand"]',
      ),
    ].map((e) => e.getAttribute("data-hand-for") ?? e.getAttribute("data-hand-tab") ?? "buy"),
  );

try {
  await freshPlayer(page);
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
    timeout: 30000,
  });
  await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
  await page.waitForFunction(() => !document.querySelector("[data-intro-scene]"), {
    timeout: 10000,
  });
  await sleep(2500);
  // Grandma's own pointer at the Market, then "Show me".
  await clickButton(page, /^Show me/);
  await sleep(1500);

  // ---------- H1: hire first ----------
  const hireHand = await handFor();
  const hint1 = await flat();
  await shot(page, "firstrun-1-hire");
  check(
    "H1 the Market starts with the hand on the Server's Hire button and the line 1️⃣ Tap Hire (hire before buying)",
    hireHand.includes("hire-server") && !hireHand.includes("buy") && /1️⃣ Tap Hire/.test(hint1),
    hireHand,
  );
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('[data-testid="team-hire"] button')].find((x) =>
        /^Hire/.test(x.textContent.trim()),
      );
      b?.click();
    });
    await sleep(800);
  }

  // ---------- H2: then buy ----------
  const buyHand = await handFor();
  const hint2 = await flat();
  await shot(page, "firstrun-2-buy");
  const cashAfterHire = (await readSave(page)).credits;
  check(
    "H2a with both hired the hand is on the first Buy button with the numbered line, and the $10.00 for food is left",
    buyHand.includes("buy") &&
      !buyHand.some((h) => /^hire-/.test(h)) &&
      /2️⃣ Tap Buy/.test(hint2) &&
      cashAfterHire === 1000,
    { buyHand, cashAfterHire },
  );
  for (let i = 0; i < 4; i++) {
    const had = await page.evaluate(() => {
      const row = document.querySelector("[data-plan-ingredient]");
      const b =
        row && [...row.querySelectorAll("button")].find((x) => /^Buy /.test(x.textContent.trim()));
      b?.click();
      return !!b;
    });
    await sleep(900);
    if (!had) break;
  }

  // ---------- H3: back to the Kitchen ----------
  const toKitchen = await handFor();
  const cap = await page.evaluate(
    () => document.querySelector('[data-testid="first-run-caption"]')?.textContent ?? null,
  );
  await shot(page, "firstrun-3-kitchen-tab");
  check(
    "H3 both hired: the hand is on the Kitchen tab with the caption 3️⃣ back to the Kitchen",
    toKitchen.includes("kitchen") && /3️⃣/.test(cap ?? "") && /Kitchen/.test(cap ?? ""),
    { toKitchen, cap },
  );
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(1200);

  // ---------- H4: open for service ----------
  const openHand = await handFor();
  await shot(page, "firstrun-4-open");
  check(
    "H4 on the Kitchen the hand is on Open for service",
    openHand.includes("open-service"),
    openHand,
  );
  await clickButton(page, /^Open for service$/);
  await sleep(1500);

  // ---------- H5: the sheet, then the cutting ----------
  let startHand = [];
  let sheet = await q('[data-testid="pre-service-check"]');
  if (sheet) {
    startHand = await handFor();
    await shot(page, "firstrun-5-start");
  }
  for (let i = 0; i < 3; i++) {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          /^(🔥 Start service|START SERVICE|🚪 Open restaurant|OPEN THE RESTAURANT)$/i.test(
            x.textContent.trim(),
          ) && !x.disabled,
      );
      b?.click();
      return !!b;
    });
    await sleep(900);
    if (!clicked) break;
  }
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  check(
    "H5 the Pre-Service Check (when it opens) shows the hand on its start button, and starting opens the cutting",
    !sheet || startHand.includes("start-service"),
    { sheet, startHand },
  );

  // ---------- H6: the first service done: no hand ----------
  for (let step = 0; step < 4; step++) {
    await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(1200);
    if (/ORDER READY/i.test(await flat())) break;
  }
  await clickButton(page, /^Serve to /);
  await sleep(3500);
  await sweepCash(page);
  await clickButton(page, /^Next Customer$/);
  await sleep(1800);
  const done = await readSave(page);
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(1000);
  check(
    "H6 after the first service no first-run hand is left on screen",
    done.levelProgress.completedLevelIds.includes("level-1") && (await handFor()).length === 0,
    await handFor(),
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("H7 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
