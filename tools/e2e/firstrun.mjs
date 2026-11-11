// The first-run hand (developer 2026-11-01: "proper hand instructions to buy the ingredients, hire them and then go
// back to cutting"), restaurant build, in a real browser, from a brand-new save:
//   H1 the Market's hand is on the first Buy button ("1️⃣ Tap Buy"); there is no Hire card (developer 2026-11-07: hire when the game needs them).
//   H2 buying everything moves it on.
//   H3 the bottom bar's Kitchen tab has the hand and the caption "2️⃣ … back to the Kitchen".
//   H4 on the Kitchen the hand is on "Open for service".
//   H5 the Pre-Service Check (when it opens) has the hand on its start button; starting opens the cutting.
//   H6 the plate is ready: the Server's card (a, b hire); the guest has eaten: the Cashier's card (c, d hire); the hand is gone once the service is done.
//   H6e the last plate of Level 1 shows the "Next: ..." teaser for Level 2.
//   H6f the first serve announces no city-ranking climb (developer 2026-11-11).
//   H7 no console errors.
import {
  hirePaige,
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
  await hirePaige(page);
  await clickButton(page, /^Show me/);
  await sleep(1500);

  // ---------- H1: buy first (the hires come inside the service) ----------
  const buyHand = await handFor();
  const hint1 = await flat();
  await shot(page, "firstrun-1-buy");
  const cash0 = (await readSave(page)).credits;
  check(
    "H1 the Market starts with the hand on the first Buy button and the line 1️⃣ Tap Buy; no Hire card yet; the opening cash is there",
    buyHand.includes("buy") &&
      !buyHand.some((h) => /^hire-/.test(h)) &&
      /1️⃣ Tap Buy/.test(hint1) &&
      !(await q('[data-testid="team-hire"]')) &&
      cash0 === 23600,
    { buyHand, cash0 },
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
    "H3 food bought: the hand is on the Kitchen tab with the caption 2️⃣ back to the Kitchen",
    toKitchen.includes("kitchen") && /2️⃣/.test(cap ?? "") && /Kitchen/.test(cap ?? ""),
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
  const before = await readSave(page);
  await clickButton(page, /^Serve to /);
  await sleep(900);
  // ---------- H6a: the plate is ready and nobody can carry it: the Server's card ----------
  const srv = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="service-hire"]');
    const img = el?.querySelector("img");
    return el
      ? {
          role: el.getAttribute("data-hire-role"),
          portrait: !!img && img.complete && img.naturalWidth > 0,
          src: img?.getAttribute("src") ?? null,
          hand: !!el.querySelector('[data-testid="first-run-hand"]'),
          buttons: el.querySelectorAll("button").length,
          text: el.textContent.replace(/\s+/g, " ").slice(0, 120),
        }
      : null;
  });
  await shot(page, "firstrun-6a-server-prompt");
  check(
    "H6a the plate is ready and there is no Server: the game offers to hire one, with her portrait, the hand on Hire and NO skip button (one button)",
    !!srv &&
      srv.role === "server" &&
      srv.portrait &&
      /server\.webp/.test(srv.src ?? "") &&
      srv.hand &&
      srv.buttons === 1,
    srv,
  );
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="service-hire"] button')]
      .find((b) => /^Hire /.test(b.textContent.trim()))
      ?.click(),
  );
  await sleep(600);
  const afterServer = await readSave(page);
  const staffEntries = (s) =>
    (s.economyLedger ?? []).filter((e) => e.category === "staff-purchase");
  check(
    "H6b hiring the Server is permanent and paid once from the opening cash (one staff-purchase entry)",
    afterServer.business.staff.hiredRoles.includes("server") &&
      afterServer.credits < before.credits &&
      staffEntries(afterServer).length === staffEntries(before).length + 1,
    {
      roles: afterServer.business.staff.hiredRoles,
      paid: before.credits - afterServer.credits,
    },
  );
  // The plate is carried out and eaten; then the bill is due and nobody is at the till.
  let cashier = null;
  for (let i = 0; i < 30 && !cashier; i++) {
    await sleep(500);
    cashier = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="service-hire"]');
      return el
        ? { role: el.getAttribute("data-hire-role"), img: !!el.querySelector("img") }
        : null;
    });
  }
  await shot(page, "firstrun-6c-cashier-prompt");
  check(
    "H6c the guest has eaten and nobody is at the till: the game offers to hire a Cashier",
    !!cashier && cashier.role === "cashier" && cashier.img,
    cashier,
  );
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="service-hire"] button')]
      .find((b) => /^Hire /.test(b.textContent.trim()))
      ?.click(),
  );
  await sleep(600);
  const afterCashier = await readSave(page);
  check(
    "H6d both are on the team for good, the prompt is gone, and the bill is made",
    afterCashier.business.staff.hiredRoles.includes("server") &&
      afterCashier.business.staff.hiredRoles.includes("cashier") &&
      !(await q('[data-testid="service-hire"]')) &&
      staffEntries(afterCashier).length === staffEntries(before).length + 2,
    afterCashier.business.staff.hiredRoles,
  );
  await sleep(1500);
  await sweepCash(page);
  // Level-end teaser (developer 2026-11-10): the last plate of Level 1 says what Level 2 brings.
  const teaser = await page.evaluate(
    () => document.querySelector('[data-testid="level-teaser"]')?.textContent?.trim() ?? null,
  );
  check(
    "H6e the last plate of Level 1 ends with the teaser for Level 2",
    !!teaser && /Next: carrots, and peeling potatoes/.test(teaser),
    teaser,
  );
  await clickButton(page, /^(Next Customer|Back to Kitchen)$/);
  await sleep(1800);
  const done = await readSave(page);
  // Developer 2026-11-11: the first serve must not announce a city-ranking climb (no "#50 -> #49" card, no Level Complete ranking row).
  await sleep(1200);
  const rankNews = await page.evaluate(() => ({
    card: !!document.querySelector('[data-testid="celebration"][data-celebration="rank"]'),
    text: /City ranking|You climbed to/.test(document.body.innerText),
  }));
  check(
    "H6f the first serve announces no city-ranking climb",
    !rankNews.card && !rankNews.text,
    rankNews,
  );
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
