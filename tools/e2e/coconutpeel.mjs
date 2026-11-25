// Coconut and mango are peeled first (developer 2026-11-25: "how can coconut be chopped without peeling the shell"), restaurant build.
// A real service of Level 71 with one saved Salmon & Coconut ticket, played by the solver; a recorder in the page notes every step the HUD shows:
//   C1 the coconut's steps come in the order PEEL, HALVE, CHOP (the first coconut step is "n% peeled", never a cut), after the salmon's slice
//   C2 the order is FOUR steps ("STEP n OF 4") and the card says "Peel the coconut"
//   C3 the dish is served and paid (it can be finished)
//   C4 no console errors
// Screenshots: out/coconutpeel-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, MOVED_IN_BUSINESS, sleep, shot, readSave } from "./harness.mjs";
import { driveService, serviceSave } from "./servicedrive.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const LEVEL = 71;
const { browser, page, logs } = await launch();
try {
  const save = serviceSave({
    level: LEVEL,
    ingredients: ["salmon", "coconut"],
    // Level 71's Pre-Service Check wants the whole team hired before it lets the service start
    business: {
      staff: {
        hiredRoles: [
          "server",
          "cashier",
          "prep-cook",
          "line-cook",
          "cleaner",
          "head-chef",
          "manager",
        ],
      },
    },
    top: {
      levelProgress: {
        currentLevelId: `level-${LEVEL}`,
        highestUnlockedLevelId: `level-${LEVEL}`,
        completedLevelIds: Array.from({ length: LEVEL - 1 }, (_, i) => `level-${i + 1}`),
        campaignVersion: 4,
        tickets: { [`level-${LEVEL}`]: ["camp-thai-salmon-coconut"] },
      },
    },
    seedSave,
    MOVED_IN_BUSINESS,
  });
  await boot(page, save);
  await sleep(2500);
  // the recorder: every distinct "<Ingredient> · <what it is doing>" and "STEP n OF m" the HUD shows, in order
  await page.evaluate(() => {
    window.__hud = [];
    setInterval(() => {
      const t = document.body.innerText.replace(/\s+/g, " ");
      const m = /([A-Za-z][A-Za-z ]*?)\s*·\s*(\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.exec(t);
      const s = /STEP (\d+) OF (\d+)/i.exec(t);
      const what = m
        ? `${m[1].trim()}|${/peeled/i.test(m[2]) ? "peel" : m[2].replace(/^\d+\/\d+\s+/, "")}`
        : null;
      const last = window.__hud[window.__hud.length - 1];
      if (what && (!last || last.what !== what))
        window.__hud.push({
          what,
          step: s ? `${s[1]}/${s[2]}` : null,
          peelCard: /Peel the coconut/i.test(t),
        });
    }, 150);
  });
  // a picture of the coconut mid-peel, taken from a timer while the solver plays (the solver's own hook is not called during a cut)
  let shotDone = false;
  const watcher = setInterval(async () => {
    if (shotDone) return;
    try {
      const on = await page.evaluate(() =>
        /Coconut\s*·\s*[3-9]\d% peeled/i.test(document.body.innerText),
      );
      if (on) {
        shotDone = true;
        await shot(page, "coconutpeel-1-coconut-peel");
      }
    } catch {
      /* the page is busy: try again on the next tick */
    }
  }, 250);
  const r = await driveService(page, { maxMs: 420000 });
  clearInterval(watcher);
  const hud = await page.evaluate(() => window.__hud);
  // the HUD line reads "<dish> <ingredient> · what", so the coconut's own steps end in "Coconut|<step>" (the salmon's step is "Salmon Fillet|slice")
  const coconut = hud.filter((h) => /Coconut\|/i.test(h.what) && !/Salmon/i.test(h.what));
  const order = coconut.map((h) => h.what.split("|")[1]);
  console.log("recorded:", JSON.stringify(hud.map((h) => `${h.step} ${h.what}`)));
  check(
    "C1 the coconut's steps run peel, then halve, then chop (the first one is the peel, never a cut)",
    order.length >= 3 &&
      order[0] === "peel" &&
      /halve/.test(order[1] ?? "") &&
      /chop/.test(order[2] ?? ""),
    order,
  );
  check(
    "C2 the order is four steps and says to peel the coconut",
    hud.some((h) => /\/4$/.test(h.step ?? "")) && hud.some((h) => h.peelCard),
    hud.slice(0, 4).map((h) => `${h.step} ${h.what} ${h.peelCard}`),
  );
  if (!r.ok) {
    await shot(page, "coconutpeel-stuck");
    console.log(
      "stuck on:",
      (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 500),
    );
  }
  const s = await readSave(page);
  const done =
    (s?.levelProgress?.completedLevelIds ?? []).includes(`level-${LEVEL}`) ||
    (s?.economyLedger?.length ?? 0) > 0;
  check("C3 the dish is served and paid (the order can be finished)", done, {
    steps: r.steps?.slice(-4),
    ledger: s?.economyLedger?.length,
  });
} catch (e) {
  console.log("FAIL harness", String(e).slice(0, 300));
  await shot(page, "coconutpeel-fail").catch(() => {});
  results.push({ id: "harness", ok: false });
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("C4 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `COCONUT PEEL E2E: ${failed} FAILURE(S)` : "COCONUT PEEL E2E: ALL PASS");
process.exit(failed ? 1 : 0);
