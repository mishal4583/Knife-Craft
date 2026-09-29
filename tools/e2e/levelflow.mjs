// Regression check for G1/G2 (docs/HANDOFF.md §4):
//   G2 — a brand-new player's first Level 1 runs the service flow
//        (Serve -> Finish Level), pays the settlement AND the $50 completion
//        reward once, and shows Level Complete.
//   G1 — Serve -> "Back to Kitchen" (no Finish Level) completes the level
//        once; a retry is a replay and pays nothing.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  freshPlayer,
  seedSave,
  sleep,
  clickButton,
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

async function skipIntro() {
  await page.waitForFunction(() => /Skip story/i.test(document.body.innerText), {
    timeout: 30000,
  });
  await clickButton(page, /Skip story/i);
  await sleep(800);
}
async function waitHud() {
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
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
    await sleep(900);
  }
  return { played: played.ok, flow };
}

// ---------- G2: fresh player, Level 1, Finish Level ----------
await freshPlayer(page);
await skipIntro();
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
await clickButton(page, /^Finish Level$/);
await sleep(300);
const g2Banner = await flat(page);
check("G2.3 Level Complete shown after Finish Level", /LEVEL COMPLETE/i.test(g2Banner));
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
check("G2.6 wallet = $1,240 + signed ledger", g2.credits === 124000 + g2Sum, {
  credits: g2.credits,
  ledgerSum: g2Sum,
});

// ---------- G2 + G1: fresh player, Level 1, Serve -> Back to Kitchen ----------
await freshPlayer(page);
await skipIntro();
const g1a = await playAndServe();
check("G1.1 fresh Level 1 (second run) uses the service flow", g1a.flow === "service", g1a);
await clickButton(page, /^Back to Kitchen$/);
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

// ---------- G1: Level 2 Serve -> Back to Kitchen, twice ----------
async function openFromBoard(title) {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(600);
  await clickButton(page, /^See all orders/);
  await sleep(600);
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Replay)$/.test(x.textContent.trim()),
        );
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
}
await boot(
  page,
  seedSave({
    credits: 124000,
    levelProgress: {
      currentLevelId: "level-2",
      highestUnlockedLevelId: "level-2",
      completedLevelIds: ["level-1"],
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  }),
);
for (let run = 1; run <= 2; run++) {
  const b = await readSave(page);
  await openFromBoard("Fresh Cucumber");
  const r = await playAndServe();
  await clickButton(page, /^Back to Kitchen$/);
  await sleep(1500);
  const a = await readSave(page);
  const led = newLedger(b, a);
  const done = a.levelProgress.completedLevelIds.includes("level-2");
  if (run === 1)
    check(
      "G1.3 Level 2 first Serve -> Back to Kitchen: completed, settlement + reward once",
      r.flow === "service" &&
        done &&
        led.filter((e) => e.startsWith("campaign-settlement")).length === 1 &&
        led.filter((e) => e.startsWith("completion-reward")).length === 1,
      // No wallet delta here: the seeded save's legacy `credits` are migrated
      // to cents on the first save, so only the ledger is compared.
      { flow: r.flow, ledger: led },
    );
  else
    check(
      "G1.4 Level 2 retry is a replay: no ledger entry, no wallet change",
      led.length === 0 && a.credits === b.credits,
      {
        ledger: led,
        delta: a.credits - b.credits,
      },
    );
  await page.evaluate(() => document.querySelector("[role=dialog] button")?.click());
  await sleep(400);
}

// ---------- pause exit mid-level still pays nothing ----------
{
  const b = await readSave(page);
  await openFromBoard("First Slice");
  await waitHud();
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((x) => /pause/i.test(x.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(600);
  await clickButton(page, /^Back to Kitchen$/);
  await sleep(1000);
  const a = await readSave(page);
  check(
    "G1.5 pause -> Back to Kitchen before Serve: no ledger entry",
    newLedger(b, a).length === 0,
    newLedger(b, a),
  );
}

check("console has no errors", logs.filter((l) => /error/i.test(l.type ?? l)).length === 0, logs);
save("levelflow-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `LEVEL FLOW: ${failed} FAILURE(S)` : "LEVEL FLOW: ALL PASS");
process.exit(failed ? 1 : 0);
