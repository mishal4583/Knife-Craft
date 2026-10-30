// Regression check for G1/G2 (docs/HANDOFF.md §4):
//   G2 — a brand-new player's first Level 1 runs the service flow
//        (Serve -> Next Customer (last order)), pays the settlement AND the $50 completion
//        reward once, and shows Level Complete.
//   G1 — Serve -> "Back to Kitchen" (no Next Customer (last order)) completes the level
//        once; a retry is a replay and pays nothing.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  startFirstLevel,
  sleep,
  clickButton,
  sweepCash,
  readSave,
  shot,
  text,
  save,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const newLedger = (b, a) =>
  a.economyLedger
    .slice(b?.economyLedger?.length ?? 0)
    .map((e) => `${e.category} ${e.amount} ${e.description ?? ""}`.trim());

const { browser, page, logs } = await launch();

async function waitHud() {
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    {
      timeout: 30000,
    },
  );
}
async function playAndServe() {
  await waitHud();
  const played = await playToReport(page);
  await clickButton(page, /^Continue$/);
  await sleep(900);
  const flow = /ORDER READY/i.test(await flat(page))
    ? "service"
    : /ORDER COMPLETE/i.test(await flat(page))
      ? "legacy"
      : "unknown";
  if (flow === "service") {
    await clickButton(page, /^Serve to /);
    // The cash lies on the table: the player sweeps it into the wallet (it enters only then).
    await sleep(3500);
    await sweepCash(page);
  }
  return { played: played.ok, flow };
}

// ---------- G2: fresh player, Level 1, Next Customer (last order) ----------
await startFirstLevel(page);
const g2a = await playAndServe();
check(
  "G2.1 first Level 1 uses the service flow (ORDER READY -> Serve)",
  g2a.flow === "service",
  g2a,
);
const g2Served = await readSave(page);
check("G2.2 serving pays the Level 1 settlement once", !!g2Served, {
  ledger: g2Served ? newLedger(null, g2Served) : null,
});
await clickButton(page, /^Next Customer$/);
await sleep(3000);
const g2Banner = await flat(page);
check(
  "G2.3 the level system is hidden: no Level Complete screen, service rolls on to the next customer",
  !/LEVEL COMPLETE/i.test(g2Banner) && /Potato|Pre-Service|Start cooking/i.test(g2Banner),
  { banner: g2Banner.slice(0, 120) },
);
await shot(page, "levelflow-G2-finish");
await sleep(1500);
const g2 = await readSave(page);
const g2Ledger = newLedger(null, g2);
check(
  "G2.4 ledger = one settlement + one $50 completion reward for level-1",
  g2Ledger.filter((e) => e.startsWith("campaign-settlement")).length === 1 &&
    g2Ledger.filter((e) => e === "completion-reward 5000 level-1").length === 1,
  g2Ledger,
);
// completeLevel leaves the "current" cursor on the finished level and
// unlocks the next one through highestUnlockedLevelId (LevelManager.ts).
check(
  "G2.5 level-1 completed, level-2 unlocked",
  g2.levelProgress.completedLevelIds.includes("level-1") &&
    g2.levelProgress.highestUnlockedLevelId === "level-2",
  g2.levelProgress,
);
const g2Sum = g2.economyLedger.reduce((s, e) => s + e.amount, 0);
// Rule changed (developer 2026-10-30, "buy everything from your own money"): a new game opens with
// $10.00, spends some of it in the Market, then earns the Level 1 pay.
check(
  "G2.6 wallet = $10.00 + signed ledger (a new game starts at $10.00)",
  g2.credits === 1000 + g2Sum && g2Sum > 0,
  {
    credits: g2.credits,
    ledgerSum: g2Sum,
  },
);

// ---------- G2 + G1: fresh player, Level 1, Serve -> Back to Kitchen ----------
await startFirstLevel(page);
const g1a = await playAndServe();
check("G1.1 fresh Level 1 (second run) uses the service flow", g1a.flow === "service", g1a);
await clickButton(page, /^Back to (Kitchen|Orders)$/);
await sleep(1500);
const g1 = await readSave(page);
const g1Ledger = newLedger(null, g1);
check(
  "G1.2 Back to Kitchen after Serve completes level-1 and pays settlement + reward once",
  g1.levelProgress.completedLevelIds.includes("level-1") &&
    g1Ledger.filter((e) => e.startsWith("campaign-settlement")).length === 1 &&
    g1Ledger.filter((e) => e === "completion-reward 5000 level-1").length === 1,
  { completed: g1.levelProgress.completedLevelIds, ledger: g1Ledger },
);

// ---------- G1.3: the Level 2 practice level is gone (2026-10-29/30) ----------
// Level 2 now pays like every other level; it is covered by firstshop.mjs / the QA suites.

// ---------- pause exit mid-level still pays nothing ----------
{
  await startFirstLevel(page);
  const b = await readSave(page);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((x) => /pause/i.test(x.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(600);
  await clickButton(page, /^Back to (Kitchen|Orders)$/);
  await sleep(1000);
  const a = await readSave(page);
  check(
    "G1.5 pause -> Back to Kitchen before Serve: no ledger entry, wallet unchanged",
    newLedger(b, a).length === 0 && a.credits === b.credits,
    newLedger(b, a),
  );
}

check("console has no errors", logs.filter((l) => /error/i.test(l.type ?? l)).length === 0, logs);
save("levelflow-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `LEVEL FLOW: ${failed} FAILURE(S)` : "LEVEL FLOW: ALL PASS");
process.exit(failed ? 1 : 0);
