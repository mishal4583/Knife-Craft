// AUDIT ONLY — plays a brand-new player through intro -> Level 1 ... Level 10 -> post-Level-10, via real input.
// Records every transition's screen text, timings, save/ledger, network and memory. Changes nothing in the game.
import { launch, sleep, clickButton, readSave, shot, text, save } from "./harness.mjs";
import { playToReport, stepInfo } from "./solver.mjs";

const URL0 = process.env.KC_URL || "http://localhost:4173/";
const { browser, page, logs } = await launch();
const net = [];
page.on("response", (r) =>
  net.push({
    t: Date.now(),
    url: r.url().replace(URL0, ""),
    status: r.status(),
    fromCache: r.fromCache(),
  }),
);
const cdp = await page.createCDPSession();
await cdp.send("Performance.enable");
const heap = async () => {
  const m = (await cdp.send("Performance.getMetrics")).metrics;
  const g = (k) => m.find((x) => x.name === k)?.value ?? 0;
  return {
    heapMB: +(g("JSHeapUsedSize") / 1048576).toFixed(1),
    nodes: g("Nodes"),
    listeners: g("JSEventListeners"),
  };
};
const dom = () =>
  page.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    text: document.body.innerText.slice(0, 600),
  }));
const R = { boot: {}, intro: [], levels: [], after10: {}, logs: [] };

// ---------- BOOT (fresh player) ----------
const t0 = Date.now();
await page.goto(URL0, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
const tNav = Date.now();
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () =>
    /warming the kitchen/.test(document.body.innerText) ||
    document.querySelector("canvas") ||
    document.body.innerText.length > 40,
  { timeout: 30000 },
);
R.boot.firstPaintText = (await text(page)).slice(0, 200);
await page
  .waitForFunction(
    () =>
      document.body.innerText.length > 60 && !/warming the kitchen/.test(document.body.innerText),
    { timeout: 30000 },
  )
  .catch(() => {});
R.boot.msToFirstContent = Date.now() - tNav;
R.boot.bytes = net
  .filter((n) => n.t >= tNav)
  .map((n) => n.url)
  .filter((u) => !u.startsWith("data:"));
await shot(page, "a10-intro-0");

// ---------- INTRO (read every beat, advance like a patient player: wait for auto beats, tap buttons) ----------
const tIntro = Date.now();
let lastTxt = "";
for (let i = 0; i < 40; i++) {
  const txt = (await text(page)).replace(/\s+/g, " ").trim();
  if (txt !== lastTxt) {
    R.intro.push({ atMs: Date.now() - tIntro, text: txt.slice(0, 220) });
    lastTxt = txt;
  }
  if (await clickButton(page, /^(OPEN THE RESTAURANT|READY|BACK TO THE KITCHEN)$/i)) {
    await sleep(600);
    continue;
  }
  const s = await stepInfo(page);
  // The cinematic intro stays mounted (data-intro-scene) until it closes.
  const introGone = await page.evaluate(() => !document.querySelector("[data-intro-scene]"));
  if (s.m && introGone) break;
  await sleep(1000);
}
R.introTotalMs = Date.now() - tIntro;
await shot(page, "a10-level1-start");

// ---------- LEVELS 1..10 ----------
for (let lv = 1; lv <= 10; lv++) {
  const L = { level: lv };
  const before = await readSave(page);
  L.creditsBefore = before?.credits ?? null;
  // wait for the HUD step counter (scene ready)
  const tReady = Date.now();
  await page
    .waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
      timeout: 30000,
    })
    .catch(() => {});
  L.msToHud = Date.now() - tReady;
  L.hudText = (await text(page)).replace(/\s+/g, " ").slice(0, 300);
  L.dom = await dom();
  L.heapStart = await heap();
  await shot(page, `a10-L${lv}-hud`);
  const tPlay = Date.now();
  const nBefore = net.length;
  const played = await playToReport(page);
  L.played = played.ok;
  L.stepsLog = played.log;
  L.msPlay = Date.now() - tPlay;
  L.report =
    (await text(page)).replace(/\s+/g, " ").match(/KNIFE REPORT.*?(Continue)/i)?.[0] ?? null;
  await shot(page, `a10-L${lv}-report`);
  await clickButton(page, /^Continue$/);
  await sleep(900);
  const afterContinue = (await text(page)).replace(/\s+/g, " ");
  L.flow = /ORDER COMPLETE/i.test(afterContinue)
    ? "legacy OrderComplete"
    : /ORDER READY/i.test(afterContinue)
      ? "service (Serve/Finish Level)"
      : "unknown";
  L.afterContinueText = afterContinue.slice(0, 400);
  if (L.flow.startsWith("legacy")) {
    await shot(page, `a10-L${lv}-ordercomplete`);
    const mid = await readSave(page);
    L.creditsAfterServe = mid.credits;
    L.nextDishOffered = /Next Dish/.test(afterContinue);
  } else {
    await clickButton(page, /^Serve to /);
    await sleep(900);
    L.served =
      (await text(page)).replace(/\s+/g, " ").match(/SERVED.*?Back to (Kitchen|Orders)/i)?.[0] ??
      null;
    await page.evaluate(() => document.querySelector("details summary")?.click());
    await sleep(200);
    L.settlement = (
      await page.evaluate(() => document.querySelector("details")?.innerText ?? "")
    ).replace(/\s+/g, " ");
    await shot(page, `a10-L${lv}-served`);
    const mid = await readSave(page);
    L.creditsAfterServe = mid.credits;
    L.finishClicked = await clickButton(page, /^Finish Level$/);
    await sleep(300);
    L.afterFinishText = (await text(page)).replace(/\s+/g, " ").slice(0, 400);
    L.bannerVisible = /LEVEL COMPLETE|THE ROOM COMES BACK/i.test(L.afterFinishText);
    await shot(page, `a10-L${lv}-after-finish`);
    await sleep(4600); // banner auto-dismiss is 4200 ms
    L.bannerGoneAfter4_9s = !/LEVEL COMPLETE|THE ROOM COMES BACK/i.test(await text(page));
  }
  const after = await readSave(page);
  L.creditsAfter = after.credits;
  L.completed = after.levelProgress.completedLevelIds.slice();
  L.current = after.levelProgress.currentLevelId;
  L.highest = after.levelProgress.highestUnlockedLevelId;
  L.ledgerNew = after.economyLedger
    .slice(before?.economyLedger?.length ?? 0)
    .map((e) => `${e.category} ${e.amount} ${e.description ?? ""}`);
  L.heapEnd = await heap();
  L.domEnd = await dom();
  L.netDuringLevel = net
    .slice(nBefore)
    .map((n) => `${n.status}${n.fromCache ? "(cache)" : ""} ${n.url}`)
    .filter((u) => !/data:/.test(u));
  // where is the next level on the board?
  const nextTitle = lv < 10 ? null : null;
  L.board = await page.evaluate(() => {
    const vh = innerHeight;
    const rows = [...document.querySelectorAll("button")].filter((b) =>
      /^(Prepare|Replay)$/.test(b.textContent.trim()),
    );
    const prep = rows.find((b) => b.textContent.trim() === "Prepare");
    const r = prep?.getBoundingClientRect();
    return {
      screenText: document.body.innerText.replace(/\s+/g, " ").slice(0, 250),
      prepareButtons: rows.filter((b) => b.textContent.trim() === "Prepare").length,
      replayButtons: rows.filter((b) => b.textContent.trim() === "Replay").length,
      nextPrepareTop: r ? Math.round(r.top) : null,
      nextPrepareVisible: r ? r.top >= 0 && r.bottom <= vh - 90 : false,
      viewport: vh,
    };
  });
  await shot(page, `a10-L${lv}-board`);
  R.levels.push(L);
  save("audit10-result.json", R);
  console.log(
    `L${lv}: played=${L.played} hud=${L.msToHud}ms play=${L.msPlay}ms credits ${L.creditsBefore}->${L.creditsAfterServe}->${L.creditsAfter} banner=${L.bannerVisible} next-visible=${L.board.nextPrepareVisible} heap=${L.heapEnd.heapMB}MB canvases=${L.domEnd.canvases}`,
  );
  if (lv < 10) {
    // Start the next level the way the board offers it: the one "Prepare" button.
    const tStart = Date.now();
    if (L.flow.startsWith("legacy")) await clickButton(page, /^Next Dish/);
    else
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(
          (x) => x.textContent.trim() === "Prepare",
        );
        b?.scrollIntoView({ block: "center" });
        b?.click();
      });
    await page
      .waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
        timeout: 30000,
      })
      .catch(() => {});
    R.levels[R.levels.length - 1].msBoardToNextHud = Date.now() - tStart;
  }
}

// ---------- AFTER LEVEL 10 ----------
R.after10.board = (await text(page)).replace(/\s+/g, " ").slice(0, 700);
await clickButton(page, /^Back$|^←/);
await sleep(300);
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((b) => b.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(1200);
R.after10.kitchen = (await text(page)).replace(/\s+/g, " ").slice(0, 500);
await shot(page, "a10-after10-kitchen");
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((b) => b.textContent.includes("Market"))
    ?.click(),
);
await sleep(1200);
R.after10.market = (await text(page)).replace(/\s+/g, " ").slice(0, 900);
await shot(page, "a10-after10-market");
const fin = await readSave(page);
R.final = {
  credits: fin.credits,
  completed: fin.levelProgress.completedLevelIds,
  ledgerSum: fin.economyLedger.reduce((a, e) => a + e.amount, 0),
  ledger: fin.economyLedger.map((e) => `${e.category} ${e.amount} ${e.description ?? ""}`),
  story: fin.story,
  ownedKnives: fin.ownedKnifeIds,
};
R.logs = logs;
R.totalMs = Date.now() - t0;
save("audit10-result.json", R);
await browser.close();
