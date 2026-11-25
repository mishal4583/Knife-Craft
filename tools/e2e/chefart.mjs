// The painted rival chefs, prestige emblems and health inspector (Codex sheets of 2026-11-25), restaurant build:
//   J1 Restaurant Progress (a Level 70 save): the rival chefs' faces and the prestige emblem are drawn and decoded, at 390 x 844 and 1815 x 867, with no sideways scroll at 320 x 568
//   J2 the Pre-Service Check (Level 14): the inspector is at the door with his ARRIVAL picture, and after "Let him in" his reaction picture shows (decoded)
//   J3 no console errors
// Screenshots: out/chefart-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, seedSave, sleep, shot } from "./harness.mjs";
import { serviceSave } from "./servicedrive.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const progressSave = seedSave({
  business: {
    ...MOVED_IN_BUSINESS,
    assistant: { hired: true, seen: [], tipsOff: true },
    sectionsSeen: ["shop", "inventory", "rack", "business"],
  },
  credits: 500000,
  levelProgress: {
    currentLevelId: "level-70",
    highestUnlockedLevelId: "level-70",
    completedLevelIds: Array.from({ length: 69 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});
progressSave.version = 3;

async function openProgress() {
  await sleep(1800);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Later")?.click(),
  );
  await sleep(500);
  await page.evaluate(() => document.querySelector('[data-testid="kitchen-rank"]')?.click());
  await sleep(1500);
  if (!/Restaurant Progress/i.test(await page.evaluate(() => document.body.innerText))) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          x.getBoundingClientRect().width > 0 &&
          /back|‹/i.test((x.getAttribute("aria-label") ?? "") + x.textContent),
      );
      b?.click();
    });
    await sleep(1500);
  }
}

/** Scrolls the page's scroller top to bottom (the pictures are lazy), then reads every painted portrait. */
async function portraits() {
  for (let i = 0; i < 14; i++) {
    const more = await page.evaluate(() => {
      const s = [...document.querySelectorAll("div")].find(
        (d) => d.classList.contains("overflow-y-auto") && d.scrollHeight > d.clientHeight + 20,
      );
      if (!s) return false;
      const before = s.scrollTop;
      s.scrollTop += s.clientHeight * 0.8;
      return s.scrollTop > before;
    });
    await sleep(350);
    if (!more) break;
  }
  await sleep(500);
  return page.evaluate(() =>
    [...document.querySelectorAll("img[data-portrait]")].map((i) => ({
      id: i.getAttribute("data-portrait"),
      ok: i.complete && i.naturalWidth > 0,
      w: Math.round(i.getBoundingClientRect().width),
    })),
  );
}
const toTop = () =>
  page.evaluate(() => {
    const s = [...document.querySelectorAll("div")].find((d) =>
      d.classList.contains("overflow-y-auto"),
    );
    if (s) s.scrollTop = 0;
  });

try {
  // J1
  for (const [w, h] of [
    [390, 844],
    [1815, 867],
    [320, 568],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await boot(page, progressSave);
    await openProgress();
    const list = await portraits();
    const rivals = list.filter((p) => !/^prestige-|^inspector-/.test(p.id));
    const emblems = list.filter((p) => /^prestige-/.test(p.id));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(
      `J1 ${w}x${h}: rival chefs and the prestige emblem are drawn and decoded, no sideways scroll`,
      rivals.length >= 1 &&
        rivals.every((p) => p.ok) &&
        emblems.length === 1 &&
        emblems.every((p) => p.ok && p.w >= 48) &&
        overflow <= 0,
      {
        rivals: rivals.length,
        undecoded: list.filter((p) => !p.ok).map((p) => p.id),
        emblems,
        overflow,
      },
    );
    if (w !== 320) {
      await toTop();
      await sleep(400);
      await shot(page, `chefart-progress-${w}x${h}-top`);
      await page.evaluate(() =>
        document
          .querySelector('[data-testid="prestige-card"]')
          ?.scrollIntoView({ block: "center" }),
      );
      await sleep(500);
      await shot(page, `chefart-progress-${w}x${h}-prestige`);
    }
  }

  // J2: Level 13, a dirty restaurant (three open chores, no soap), the inspector due: Grade C, so his disappointed reaction
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const L = 13;
  const dirty = seedSave({
    credits: 5_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: {},
      staff: { hiredRoles: ["server", "cashier"] },
      sauceStation: { doneDay: 1 },
      healthInspector: undefined,
      cleanliness: {
        tasks: ["equipment", "grease", "bins"].map((kind) => ({ kind, count: 1, since: 0 })),
        introSeen: true,
      },
    },
    levelProgress: {
      currentLevelId: `level-${L}`,
      highestUnlockedLevelId: `level-${L}`,
      completedLevelIds: Array.from({ length: L - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
  dirty.version = 3;
  await boot(page, dirty);
  await sleep(2500);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Later")?.click(),
  );
  await sleep(400);
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(900);
  for (let i = 0; i < 6; i++) {
    const open = await page.evaluate(() => {
      if (document.querySelector('[data-testid="pre-service-check"]')) return true;
      [...document.querySelectorAll("button")]
        .find((x) => /^Open for service$/.test((x.textContent ?? "").trim()))
        ?.click();
      return false;
    });
    if (open) break;
    await sleep(700);
  }
  await page.waitForSelector('[data-testid="psc-inspector"]', { timeout: 20000 }).catch(() => {});
  await sleep(1200);
  await page.evaluate(() =>
    document.querySelector('[data-testid="psc-inspector"]')?.scrollIntoView({ block: "center" }),
  );
  await sleep(800);
  const due = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="psc-inspector"]');
    const img = card?.querySelector("img[data-portrait]");
    return {
      status: card?.getAttribute("data-status") ?? null,
      id: img?.getAttribute("data-portrait") ?? null,
      ok: !!img && img.complete && img.naturalWidth > 0,
    };
  });
  await shot(page, "chefart-inspector-arrival");
  check(
    "J2a the inspector is at the door with his arrival picture",
    due.status === "due" && due.id === "inspector-arrival" && due.ok,
    due,
  );
  await page.evaluate(() =>
    document.querySelector('[data-testid="psc-inspector-let-in"]')?.click(),
  );
  await sleep(1500);
  await page.evaluate(() =>
    document.querySelector('[data-testid="psc-inspector"]')?.scrollIntoView({ block: "center" }),
  );
  await sleep(800);
  const done = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="psc-inspector"]');
    const img = card?.querySelector("img[data-portrait]");
    return {
      status: card?.getAttribute("data-status") ?? null,
      grade: card?.getAttribute("data-grade") ?? null,
      id: img?.getAttribute("data-portrait") ?? null,
      ok: !!img && img.complete && img.naturalWidth > 0,
    };
  });
  await shot(page, "chefart-inspector-result");
  const want = { A: "pleased", B: "neutral", C: "disappointed" }[done.grade ?? ""];
  check(
    "J2b after he is let in, his reaction picture matches the grade",
    done.status === "done" && !!want && done.id === `inspector-${want}` && done.ok,
    { ...done, want },
  );
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await sleep(700);
  const small = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  await shot(page, "chefart-inspector-320");
  check("J2c the inspector card fits at 320 x 568", small <= 0, small);
} catch (e) {
  console.log("FAIL harness", String(e).slice(0, 300));
  await shot(page, "chefart-fail").catch(() => {});
  results.push({ id: "harness", ok: false });
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("J3 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(failed ? `CHEF ART E2E: ${failed} FAILURE(S)` : "CHEF ART E2E: ALL PASS");
process.exit(failed ? 1 : 0);
