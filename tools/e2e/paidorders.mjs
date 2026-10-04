// Developer decision #5 — a two-order level never pays an order twice.
//   1. Level 30 (2 orders): serve the 1st, leave. The order is paid once and
//      saved as paid; the level stays open.
//   2. Retry: the session carries on with the 1st order counted. Serving one
//      more finishes the level: 2 settlements in all (it used to be 3) and
//      the completion reward once; the saved entry is cleared.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot, text } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const settlements = (s) =>
  s.economyLedger.filter((e) => e.category === "campaign-settlement").length;
const rewards = (s) =>
  s.economyLedger.filter((e) => e.category === "completion-reward" && e.description === "level-30")
    .length;

const { browser, page, logs } = await launch();

async function openLevel30() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(600);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("p")].find(
      (p) => p.textContent.trim() === "Italian Service Night",
    );
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
  });
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
}
async function playAndServe() {
  const played = await playToReport(page, { maxMs: 150000 });
  await clickButton(page, /^Continue$/);
  await sleep(900);
  const ready = /ORDER READY/i.test(await flat(page));
  if (ready) {
    await clickButton(page, /^Serve to /);
    await sleep(1200);
  }
  return { played: played.ok, ready };
}

const done = Array.from({ length: 29 }, (_, i) => `level-${i + 1}`);
await boot(
  page,
  seedSave({
    credits: 2000000,
    levelProgress: {
      currentLevelId: "level-30",
      highestUnlockedLevelId: "level-30",
      completedLevelIds: done,
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  }),
);
const start = await readSave(page);

// ---------- 1. Serve the 1st order, then leave ----------
await openLevel30();
const first = await playAndServe();
const servedOne = await flat(page);
await shot(page, "paidorders-1-served");
await clickButton(page, /^Back to (Kitchen|Orders)$/);
await sleep(1500);
const afterLeave = await readSave(page);
check(
  "1 serving the 1st of 2 orders pays it once and saves it as paid; the level stays open",
  first.played &&
    first.ready &&
    settlements(afterLeave) - settlements(start) === 1 &&
    afterLeave.levelProgress.paidOrders?.["level-30"]?.length === 1 &&
    !afterLeave.levelProgress.completedLevelIds.includes("level-30") &&
    !/Finish Level/.test(servedOne),
  {
    first,
    paidOrders: afterLeave.levelProgress.paidOrders,
    settlements: settlements(afterLeave) - settlements(start),
  },
);

// ---------- 2. Retry: one more order finishes it ----------
await openLevel30();
const second = await playAndServe();
const servedTwo = await flat(page);
await shot(page, "paidorders-2-retry-served");
check(
  "2a the retry carries on: the next serve completes the level's 2 orders (Finish Level)",
  second.played && second.ready && /Finish Level/.test(servedTwo),
  { second, text: servedTwo.slice(0, 200) },
);
await clickButton(page, /^Finish Level$/);
await sleep(1800);
const end = await readSave(page);
check(
  "2b 2 settlements in all (not 3), the completion reward once, the paid entry cleared",
  settlements(end) - settlements(start) === 2 &&
    rewards(end) === 1 &&
    end.levelProgress.completedLevelIds.includes("level-30") &&
    end.levelProgress.paidOrders?.["level-30"] === undefined,
  {
    settlements: settlements(end) - settlements(start),
    rewards: rewards(end),
    paidOrders: end.levelProgress.paidOrders,
  },
);
const sum = end.economyLedger.reduce((s, e) => s + e.amount, 0);
const startSum = start.economyLedger.reduce((s, e) => s + e.amount, 0);
check(
  "2c wallet = start + the new ledger entries",
  end.credits === start.credits + sum - startSum,
  {
    credits: end.credits,
    expected: start.credits + sum - startSum,
  },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("3 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `PAID ORDERS E2E: ${failed.length} FAILURE(S)` : "PAID ORDERS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
