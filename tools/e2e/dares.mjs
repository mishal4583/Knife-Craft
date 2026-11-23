// Chef Pride, Phase 3b (developer 2026-11-23: optional daily dares), restaurant build:
//   1. from Level 6 the Kitchen's "View Details" carries a marker while today's dare is offered, and the details show the dare row with "Take the dare" / "Not today";
//   2. "Take the dare" saves it (business.chefRecord.challenge: accepted, today) and the row shows the ask (and the progress bar for a run dare); no money moves;
//   3. "Not today" hides the dare for the day (state declined), nothing else changes, and it stays hidden after a reload;
//   4. below Level 6 there is no dare, no marker;
//   5. a taken run dare shows its line on the Knife Report (a win, or where the run ended) after a real plate, and a win is saved (daresWon);
//   6. the row fits 320x568, 390x844 and 1280x720: no sideways scroll, 48 px buttons; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  shot,
  readSave,
  clickButton,
} from "./harness.mjs";
import { playToReport, geometryFromCanvas } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const stock = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 14, unitCost: 100, purchaseDay: 7 }]),
  );
const saveAt = (completed, extra = {}, recipe = null) => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      staff: { hiredRoles: ["server", "cashier"] },
      calendar: { businessDay: 7 },
      ...(recipe ? { inventory: stock(["grapes", "strawberry"]) } : {}),
      restaurantStaff: { specialists: ["mexican-chef"] },
      ...extra,
    },
    credits: 5_000_000,
    levelProgress: {
      currentLevelId: `level-${completed + 1}`,
      highestUnlockedLevelId: `level-${completed + 1}`,
      completedLevelIds: Array.from({ length: completed }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
      ...(recipe ? { tickets: { [`level-${completed + 1}`]: [recipe] } } : {}),
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
  s.version = 3;
  return s;
};
const click = async (page, re) => {
  const r = await page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        new RegExp(src, "i").test(x.textContent.trim()) &&
        !x.disabled &&
        x.getBoundingClientRect().width > 0,
    );
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, re.source);
  if (r) await page.mouse.click(r.x, r.y);
  return !!r;
};
const { browser, page, logs } = await launch();
const dismissGuide = () =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="guide-card"]');
    [...(g?.querySelectorAll("button") ?? [])]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click();
  });
const openDetails = async () => {
  await dismissGuide();
  await sleep(500);
  const open = await page.evaluate(
    () =>
      document
        .querySelector('[aria-controls="kitchen-order-details"]')
        ?.getAttribute("aria-expanded") === "true",
  );
  if (!open)
    await page.evaluate(() =>
      document.querySelector('[aria-controls="kitchen-order-details"]')?.click(),
    );
  await sleep(500);
};
const row = () =>
  page.evaluate(() => {
    const r = document.querySelector('[data-testid="kitchen-dare"]');
    const take = document
      .querySelector('[data-testid="kitchen-dare-take"]')
      ?.getBoundingClientRect();
    const no = document
      .querySelector('[data-testid="kitchen-dare-decline"]')
      ?.getBoundingClientRect();
    const box = r?.getBoundingClientRect();
    return r
      ? {
          dare: r.getAttribute("data-dare"),
          status: r.getAttribute("data-status"),
          text: r.innerText.replace(/\s+/g, " "),
          takeH: take ? Math.round(take.height) : null,
          noH: no ? Math.round(no.height) : null,
          progress: !!document.querySelector('[data-testid="kitchen-dare-progress"]'),
          inView: !!box && box.left >= 0 && box.right <= innerWidth,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      : null;
  });
const marker = () =>
  page.evaluate(() =>
    /⚔/.test(document.querySelector('[aria-controls="kitchen-order-details"]')?.textContent ?? ""),
  );

// ---- 1. offered ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(9));
await sleep(1800);
await dismissGuide();
await sleep(500);
const mk = await marker();
await openDetails();
const offered = await row();
await shot(page, "dares-offered");
check(
  "1 Level 10: View Details carries the dare marker, and the details show the offered dare with two 48 px buttons",
  mk &&
    offered?.status === "offered" &&
    offered.takeH >= 47 &&
    offered.noH >= 47 &&
    /Take the dare/.test(offered.text) &&
    /Not today/.test(offered.text),
  { mk, offered },
);

// ---- 2. take ----
const walletBefore = (await readSave(page)).credits;
await click(page, /^Take the dare$/);
await sleep(900);
const afterTake = await row();
const saved = await readSave(page);
await shot(page, "dares-taken");
check(
  "2 'Take the dare' saves it as accepted for today, shows the ask, and moves no money",
  afterTake?.status === "accepted" &&
    saved.business.chefRecord?.challenge?.state === "accepted" &&
    saved.business.chefRecord.challenge.day === TODAY &&
    saved.credits === walletBefore &&
    !(await marker()),
  {
    afterTake,
    challenge: saved.business.chefRecord?.challenge,
    walletBefore,
    walletNow: saved.credits,
  },
);
const dareId = afterTake?.dare;

// ---- 3. not today ----
await boot(page, saveAt(9));
await sleep(1800);
await openDetails();
await click(page, /^Not today$/);
await sleep(900);
const declined = await row();
const s3 = await readSave(page);
await page.reload({ waitUntil: "networkidle0" });
await sleep(1800);
await openDetails();
const afterReload = await row();
check(
  "3 'Not today' hides the dare (state declined, today), and it stays hidden after a reload; nothing else changed",
  declined === null &&
    s3.business.chefRecord?.challenge?.state === "declined" &&
    afterReload === null &&
    s3.credits === walletBefore,
  { declined, challenge: s3.business.chefRecord?.challenge, afterReload },
);

// ---- 4. below Level 6 ----
await boot(page, saveAt(4));
await sleep(1800);
await dismissGuide();
await openDetails();
check(
  "4 below Level 6 there is no dare and no marker",
  (await row()) === null && !(await marker()),
);

// ---- 5. a taken run dare on a real plate ----
// "No Mercy Prep" at 4 of 5: the next Clean plate wins it; a weaker one breaks the run. Either way the Knife Report says so.
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });
const RECIPE = "camp-latin-grapes-strawberry";
let report = null;
for (let attempt = 0; attempt < 2 && !report; attempt++) {
  await boot(
    page,
    saveAt(
      5,
      { chefRecord: { challenge: { day: TODAY, id: "no-mercy", state: "accepted", progress: 4 } } },
      RECIPE,
    ),
  );
  await sleep(2500);
  await clickButton(page, /^Open for service$/);
  await sleep(1500);
  for (let i = 0; i < 6; i++) {
    const had = await click(page, /(Hire Server &|Open restaurant|Start cooking)/);
    await sleep(1800);
    if (!had) break;
  }
  await click(page, /Start cooking/);
  await sleep(2500);
  const r = await playToReport(page, {
    maxMs: 120000,
    until: () => /KNIFE REPORT/i.test(document.body.innerText),
  });
  if (!r.stopped) continue;
  await sleep(600);
  report = await page.evaluate(() => ({
    lines: [...document.querySelectorAll('[data-testid="knife-report-specials"] p')].map((p) =>
      p.textContent.trim(),
    ),
  }));
}
await shot(page, "dares-report");
const dareLine = report?.lines.find((l) => /^⚔ /.test(l)) ?? null;
check(
  "5a the Knife Report carries the dare line after a real plate (the win, or where the run ended)",
  !!dareLine && /(Dare won: No Mercy Prep!|Dare: the run ended at 4\. Try again\?)/.test(dareLine),
  report,
);
await click(page, /^(Continue|Serve|Next)/);
await sleep(1500);
const s5 = await readSave(page);
const ch = s5.business.chefRecord;
check(
  "5b the plate moved the dare in the save (won: daresWon 1; broken: back to 0 and still accepted)",
  ch?.challenge &&
    ((ch.challenge.state === "won" && ch.daresWon === 1) ||
      (ch.challenge.state === "accepted" &&
        ch.challenge.progress === 0 &&
        (ch.daresWon ?? 0) === 0)),
  ch,
);

// ---- 6. fits ----
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [1280, 720],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(9));
  await sleep(1800);
  await openDetails();
  const f = await row();
  await shot(page, `dares-fit-${w}`);
  check(
    `6 ${w}x${h}: the dare row is in view, 48 px buttons, no sideways scroll`,
    !!f && f.inView && f.overflow <= 0 && f.takeH >= 47 && f.noH >= 47,
    f,
  );
}
void dareId;

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("7 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
