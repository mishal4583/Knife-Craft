// AUDIT ONLY — edge cases on Levels 2-3: leave after Serve without "Finish Level", pause-menu exit, reload mid-level.
import {
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  text,
  save,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";
const R = [];
const note = (k, v) => {
  R.push({ k, v });
  console.log(k, JSON.stringify(v));
};
const { browser, page, logs } = await launch();
const base = seedSave({
  credits: 124000,
  levelProgress: {
    currentLevelId: "level-2",
    highestUnlockedLevelId: "level-2",
    completedLevelIds: ["level-1"],
  },
  story: { introDone: true, milestoneMask: 0, finaleSeen: false },
});

async function openFromBoard(title) {
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
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
}

// A. Serve, then "Back to Kitchen" instead of "Finish Level" — twice.
await boot(page, base);
for (let run = 1; run <= 2; run++) {
  const b = await readSave(page);
  await openFromBoard("Fresh Cucumber");
  await playToReport(page);
  await clickButton(page, /^Continue$/);
  await sleep(800);
  await clickButton(page, /^Serve to /);
  await sleep(800);
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((x) => x.offsetParent)
      .map((x) => x.textContent.trim()),
  );
  await clickButton(page, /^Back to Kitchen$/);
  await sleep(1200);
  const landed = (await text(page)).replace(/\s+/g, " ").slice(0, 120);
  const a = await readSave(page);
  note(`A${run} serve→Back to Kitchen`, {
    buttonsAfterServe: labels,
    landedOn: landed,
    credits: `${b.credits}→${a.credits}`,
    level2Completed: a.levelProgress.completedLevelIds.includes("level-2"),
    newLedger: a.economyLedger
      .slice(b.economyLedger.length)
      .map((e) => `${e.category} ${e.amount}`),
  });
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(800);
}
await shot(page, "a10b-A-after");

// B. Pause → "Back to Kitchen" mid-level.
await boot(page, base);
await openFromBoard("Fresh Cucumber");
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find(
      (x) =>
        /pause/i.test(x.getAttribute("aria-label") ?? "") ||
        x.textContent.trim() === "II" ||
        x.textContent.trim() === "⏸",
    )
    ?.click(),
);
await sleep(600);
const pauseText = (await text(page)).replace(/\s+/g, " ");
note(
  "B pause overlay",
  /Paused/.test(pauseText)
    ? pauseText.match(/Paused.*?Back to Kitchen/)?.[0]
    : "pause button not found: " + pauseText.slice(0, 150),
);
await clickButton(page, /^Back to Kitchen$/);
await sleep(1000);
note("B pause→Back to Kitchen lands on", (await text(page)).replace(/\s+/g, " ").slice(0, 120));

// C. Reload in the middle of a level.
await boot(page, base);
await openFromBoard("Fresh Cucumber");
const cx = 215,
  cy = 452;
for (let i = 0; i < 3; i++) {
  await page.mouse.click(cx - 50 + i * 20, cy);
  await sleep(200);
}
const mid = (await text(page)).match(/·\s*\d+\/\d+\s+[a-z-]+/i)?.[0];
await page.reload({ waitUntil: "networkidle0" });
await sleep(2000);
const a = await readSave(page);
note("C reload mid-level", {
  counterBefore: mid,
  landedOn: (await text(page)).replace(/\s+/g, " ").slice(0, 120),
  completed: a.levelProgress.completedLevelIds,
  credits: a.credits,
});

// D. Knife Report "Prep Again" then finish — paid once?
await boot(page, base);
const d0 = await readSave(page);
await openFromBoard("Fresh Cucumber");
await playToReport(page);
await clickButton(page, /^Prep Again$/);
await sleep(1200);
await playToReport(page);
await clickButton(page, /^Continue$/);
await sleep(800);
await clickButton(page, /^Serve to /);
await sleep(800);
await clickButton(page, /^Finish Level$/);
await sleep(1200);
const d1 = await readSave(page);
note("D prep-again then finish", {
  credits: `${d0.credits}→${d1.credits}`,
  ledger: d1.economyLedger.slice(d0.economyLedger.length).map((e) => `${e.category} ${e.amount}`),
  completed: d1.levelProgress.completedLevelIds,
});

// E. Level 1 replay via the board (a returning player) — which flow does it use?
await boot(page, base);
await openFromBoard("First Slice");
await playToReport(page);
await clickButton(page, /^Continue$/);
await sleep(800);
note(
  "E Level 1 replay flow",
  (await text(page)).replace(/\s+/g, " ").match(/(ORDER READY|ORDER COMPLETE).{0,120}/i)?.[0],
);

note("console", logs);
save("audit10b-result.json", R);
await browser.close();
