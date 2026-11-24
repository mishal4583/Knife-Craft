// Chef Pride audit remediation, Batch 4 (developer 2026-11-23), in a real browser, restaurant build. The identity checks play REAL plates and services with the cutting solver
// (430x900) and read the saved record and Restaurant Progress; the boundary checks seed a save just either side of a line and read what the real screen says.
//   S1 Precision  : 25 perfect cuts + 2 plates of 95%+ earns nothing; one real Masterful plate makes it 3 and Steady Hand is earned (cuts alone are not enough)
//   S2 Speed      : fastest plate 61 s earns nothing; a real plate sets a real time (seconds) and Speed reads it; strict at 60.000 / 59.999 s ... 15.000 / 14.999 s on the real card
//   S3 Cleanliness: a real spotless service takes 4 spotless / best streak 0 to 5 / 1: not enough; from best streak 1 it makes 5 / 2: Clean Counter is earned
//   S4 Favourite  : popularity 70 with $20 in lifetime tips earns nothing; a real service's tips take it past $25 and Local Favourite is earned
//   S5 Restaurateur: #1 of 50 with 29 Endless stars is Executive Chef; with 30 it is Legendary Restaurateur
//   S6 Respect    : in the city's top ten the Progress card carries the respect line of the rival just behind (hand-written); at #11 and below it does not
//   S7 Paige Later: the rival message offers Later (Go there / Got it / Later, 48 px, inside the screen); Later hides it for this level, writes only the existing guideSeen list,
//                   does not count it as given; it comes back on the next level; Got it then gives it for good
//   S8 Breakpoint : the title chip shows from a 600 px tall window (599 no, 600 yes); the rival's line stays at 700 px (699 no, 700 yes); nothing overlaps at 360x640
//   S9 InfoTip    : the title, prestige and league cards each have an ⓘ with the rules, 48 px, inside the screen at 320x568
//   S10 bestPlate : the chef title card shows the best plate (derived from the recipe book) and the fastest plate
// Usage: node batch4real.mjs [S1 .. S10]   (default all). KC_URL=http://localhost:4174/ runs the same flows on the committed HEAD: its values are the "before" (INFO lines).
import {
  MOVED_IN_BUSINESS,
  boot,
  launch,
  openSection,
  readSave,
  seedSave,
  shot,
  sleep,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";
import { driveService, serviceSave, watchBanner } from "./servicedrive.mjs";

const args = process.argv.slice(2);
const want = new Set(args.filter((a) => /^S\d+$/.test(a)));
const run = (id) => want.size === 0 || want.has(id);
const BASELINE = (process.env.KC_URL ?? "").includes("4174");
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const info = (id, detail) => console.log(`INFO ${id}`, JSON.stringify(detail));
/** A check about the NEW behaviour: asserted on this build, only reported (as INFO) on the committed HEAD. */
const expectNew = (id, ok, detail) =>
  BASELINE
    ? info(`${id} (HEAD)`, { holds: ok, ...(typeof detail === "object" ? detail : { detail }) })
    : check(id, ok, detail);

const { browser, page, logs } = await launch();
await watchBanner(page); // (the service driver reads the Level Complete card the moment it appears)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

const completedIds = (n) => Array.from({ length: n }, (_, i) => `level-${i + 1}`);
const uiSave = (completed, business = {}, top = {}) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      ...business,
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${completed + 1}`,
      highestUnlockedLevelId: `level-${completed + 1}`,
      completedLevelIds: completedIds(completed),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    ...top,
  });
const economyTips = (cents) => ({
  economy: {
    version: 1,
    claimedMilestoneIds: [],
    waivedMilestoneIds: [],
    lifetime: { "customer-tip": cents },
    lifetimeSince: "start",
  },
});

/** What Restaurant Progress says (after opening it from the Kitchen). */
async function progress() {
  await sleep(1200);
  await openSection(page, "Progress");
  await sleep(1200);
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const card = q('[data-testid="chef-title-card"]');
    const chips = Object.fromEntries(
      [...(card?.querySelectorAll("[data-identity]") ?? [])].map((x) => [
        x.getAttribute("data-identity"),
        Number(x.getAttribute("data-tier")),
      ]),
    );
    const tx = (el) => el?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    return {
      name: tx(q('[data-testid="chef-title-name"]')),
      goal: tx(q('[data-testid="chef-title-goal"]')),
      records: tx(q('[data-testid="chef-title-records"]')),
      chips,
      respect: tx(q('[data-testid="rival-chef-respect"]')),
      infotips: [...document.querySelectorAll("button[data-infotip]")].map((b) =>
        b.getAttribute("aria-label"),
      ),
    };
  });
}
const dismissGuide = () =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="guide-card"]');
    [...(g?.querySelectorAll("button") ?? [])]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click();
  });

// ───────── one real plate (Level 6, a one-order ticket), played to the Knife Report and kept ─────────
const RECIPE = "camp-latin-grapes-strawberry";
const plateSave = (chefRecord) =>
  serviceSave({
    level: 6,
    ingredients: ["grapes", "strawberry"],
    business: { chefRecord },
    top: {
      levelProgress: {
        currentLevelId: "level-6",
        highestUnlockedLevelId: "level-6",
        completedLevelIds: completedIds(5),
        campaignVersion: 4,
        tickets: { "level-6": [RECIPE] },
      },
    },
    seedSave,
    MOVED_IN_BUSINESS,
  });
const tap = async (re) => {
  const hit = await page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        new RegExp(src, "i").test(x.textContent.trim().replace(/\s+/g, " ")) &&
        !x.disabled &&
        x.getBoundingClientRect().width > 0,
    );
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, re.source);
  if (hit) await page.mouse.click(hit.x, hit.y);
  return !!hit;
};
async function playPlate(save) {
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await boot(page, save);
  await sleep(2500);
  await tap(/^Later$/);
  await tap(/^Open for service$/);
  await sleep(1500);
  for (let i = 0; i < 8; i++)
    if (await tap(/(Hire Server|Hire Cashier|Open restaurant)/)) await sleep(1800);
  let started = false;
  for (let i = 0; i < 30 && !started; i++) {
    started = await tap(/Start cooking/);
    if (!started) await sleep(700);
  }
  await sleep(2000);
  const r = await playToReport(page, {
    maxMs: 150000,
    until: () => /KNIFE REPORT/i.test(document.body.innerText),
  });
  await sleep(700);
  await tap(/^Continue$/);
  await sleep(2500);
  // the plate is saved at Continue; leave the level (it is not finished) so Restaurant Progress can be opened from the Kitchen
  await tap(/Back to Kitchen/);
  await sleep(1500);
  return !!r.stopped;
}
async function playService(save) {
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
  await boot(page, save);
  await sleep(2500);
  const r = await driveService(page, { maxMs: 600000 });
  await sleep(1500);
  return r.ok;
}
const BATCH_ING = ["pepper", "onion", "corn"];

let S2_real = null;
// ───────── S1: Precision ─────────
if (run("S1")) {
  const before = { perfectCuts: 25, masterful: 2, plates: 5 };
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, uiSave(5, { chefRecord: before }));
  const p0 = await progress();
  info("S1 before", p0);
  expectNew(
    "S1a 25 perfect cuts with only 2 plates of 95%+ earns no Precision title (and the card says what is missing)",
    p0.chips.precision === 0 && /plates of 95%\+ 2 of 3/.test(p0.goal ?? ""),
    p0,
  );
  const ok = await playPlate(plateSave(before));
  const s = await readSave(page);
  const rec = s.business.chefRecord ?? {};
  check("S1b a real plate was played and kept", ok && rec.plates === 6, { plates: rec.plates });
  info("S1 after the plate", {
    masterful: rec.masterful,
    perfectCuts: rec.perfectCuts,
    fastestMs: rec.fastestMs,
  });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  const p1 = await progress();
  await shot(page, "batch4-S1-precision-after");
  expectNew(
    "S1c the real plate scored 95%+ (masterful 2 → 3) and Steady Hand is earned: both numbers met",
    rec.masterful === 3 && p1.chips.precision === 1,
    { masterful: rec.masterful, chips: p1.chips, name: p1.name },
  );
  // S2 (Speed) reads the same plate: its real time is under 15 s
  S2_real = { fastestMs: rec.fastestMs, speedTier: p1.chips.speed };
}

// ───────── S2: Speed ─────────
if (run("S2")) {
  const at = async (ms, quick = 0) => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await boot(page, uiSave(5, { chefRecord: { plates: 5, fastestMs: ms, quickClean: quick } }));
    return (await progress()).chips.speed;
  };
  if (S2_real) {
    info("S2 real plate", S2_real);
    expectNew(
      "S2a the real plate's fastest time sets Speed: a few seconds is 'under 15 s', the top tier (4)",
      S2_real.fastestMs > 0 && S2_real.fastestMs < 15000 && S2_real.speedTier === 4,
      S2_real,
    );
  }
  const rows = [];
  for (const [ms, tier] of [
    [0, 0],
    [60000, 0],
    [59999, 1],
    [40000, 1],
    [39999, 2],
    [25000, 2],
    [24999, 3],
    [15000, 3],
    [14999, 4],
  ])
    rows.push({ ms, want: tier, got: await at(ms) });
  info("S2 boundaries (ms: tier wanted / tier shown)", rows);
  expectNew(
    "S2b the real card is strict at every line: 60000 no / 59999 yes, 40000 / 39999, 25000 / 24999, 15000 / 14999",
    rows.every((r) => r.got === r.want),
    rows,
  );
  const quick = await at(0, 9999);
  expectNew(
    "S2c a record with only a quick-clean counter (and no fastest plate) earns no Speed title",
    quick === 0,
    { tier: quick },
  );
}

// ───────── S3: Cleanliness (two real services) ─────────
if (run("S3")) {
  const spotless = (spotlessN, streak, best) => ({
    restaurantRecord: { services: 6, spotless: spotlessN, streak, bestStreak: best },
  });
  const A = serviceSave({
    level: 12,
    ingredients: BATCH_ING,
    business: spotless(4, 0, 0),
    seedSave,
    MOVED_IN_BUSINESS,
  });
  const okA = await playService(A);
  const sa = await readSave(page);
  const ra = sa.business.restaurantRecord ?? {};
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  const pa = await progress();
  info("S3 A (4 spotless, best streak 0) after a real spotless service", {
    spotless: ra.spotless,
    streak: ra.streak,
    bestStreak: ra.bestStreak,
    cleanlinessTier: pa.chips.cleanliness,
  });
  check(
    "S3a a real service was played and was spotless (spotless 5, best streak 1)",
    okA && ra.spotless === 5 && ra.bestStreak === 1,
    ra,
  );
  expectNew(
    "S3b 5 spotless services but a best streak of only 1: Clean Counter is NOT earned yet",
    pa.chips.cleanliness === 0,
    { tier: pa.chips.cleanliness },
  );
  const B = serviceSave({
    level: 12,
    ingredients: BATCH_ING,
    business: spotless(4, 1, 1),
    seedSave,
    MOVED_IN_BUSINESS,
  });
  const okB = await playService(B);
  const sb = await readSave(page);
  const rb = sb.business.restaurantRecord ?? {};
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  const pb = await progress();
  await shot(page, "batch4-S3-cleanliness-after");
  info("S3 B (4 spotless, best streak 1) after a real spotless service", {
    spotless: rb.spotless,
    streak: rb.streak,
    bestStreak: rb.bestStreak,
    cleanlinessTier: pb.chips.cleanliness,
  });
  check(
    "S3c the second real service made it 5 spotless in a streak of 2",
    okB && rb.spotless === 5 && rb.bestStreak === 2,
    rb,
  );
  expectNew(
    "S3d 5 spotless services AND a best streak of 2: Clean Counter is earned",
    pb.chips.cleanliness === 1,
    { tier: pb.chips.cleanliness },
  );
}

// ───────── S4: Customer Favourite (a real service's tips) ─────────
if (run("S4")) {
  const A = () =>
    serviceSave({
      level: 12,
      ingredients: BATCH_ING,
      business: { popularity: { score: 70 } },
      top: economyTips(2000),
      seedSave,
      MOVED_IN_BUSINESS,
    });
  // before: the same record in the UI save (popularity 70, $20 of tips)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, uiSave(11, { popularity: { score: 70 } }, economyTips(2000)));
  const p0 = await progress();
  info("S4 before the service ($20 of tips, popularity 70)", p0);
  expectNew(
    "S4a popularity 70 with only $20 in tips: Local Favourite is NOT earned (it needs $25)",
    p0.chips.favourite === 0,
    p0.chips,
  );
  const ok = await playService(A());
  // the tips lie on the tables with the bills until the cash is collected (the Kitchen's "on the table · Collect"): collecting is what settles them
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /on the table.*Collect/i.test(b.textContent))
      ?.click(),
  );
  await sleep(2500);
  const s = await readSave(page);
  const tips = s.economy?.lifetime?.["customer-tip"] ?? 0;
  info("S4 economy after collecting", s.economy);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  const p1 = await progress();
  await shot(page, "batch4-S4-favourite-after");
  info("S4 after the service", { lifetimeTipsCents: tips, favouriteTier: p1.chips.favourite });
  check(
    "S4b a real service was played and customers tipped (lifetime tips rose above $25)",
    ok && tips >= 2500,
    { tips },
  );
  expectNew(
    "S4c popularity 70 with the tips now past $25: Local Favourite is earned",
    p1.chips.favourite === 1,
    p1.chips,
  );
}

// ───────── S5: Restaurateur ─────────
if (run("S5")) {
  const stars = async (n) => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await boot(page, uiSave(91, { endlessStars: { total: n, days: 10, bestDay: 3 } }));
    return progress();
  };
  const p29 = await stars(29);
  const p30 = await stars(30);
  await shot(page, "batch4-S5-restaurateur-30");
  info("S5", {
    stars29: p29.chips.restaurateur,
    stars30: p30.chips.restaurateur,
    goal29: p29.goal,
  });
  expectNew(
    "S5a #1 of 50 with 29 Endless stars is Executive Chef (tier 3)",
    p29.chips.restaurateur === 3,
    p29.chips,
  );
  expectNew(
    "S5b #1 of 50 with 30 Endless stars is Legendary Restaurateur (tier 4)",
    p30.chips.restaurateur === 4,
    p30.chips,
  );
}

// ───────── S6: respect ─────────
if (run("S6")) {
  const RESPECT = {
    91: /^\S+\sChef Amelie: “Maison Lumière shines brighter for knowing you\.”$/, // rank 1, passed maison-lumiere
    81: /^\S+\sChef Takeshi: “Patience and precision, still\. I bow once more\.”$/, // rank 5, passed kaiseki-mori
    69: /^\S+\sChef Victor: “A velvet touch on every plate\. Take a bow, Chef\.”$/, // rank 10, passed the-velvet-spoon
  };
  const seen = {};
  for (const c of [91, 81, 69, 67, 65]) {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await boot(page, uiSave(c));
    const p = await progress();
    seen[c] = p.respect;
    if (c === 91) await shot(page, "batch4-S6-respect-rank1");
  }
  info("S6 respect line by completed levels (rank 1, 5, 10, 11, 12)", seen);
  expectNew(
    "S6a at #1, #5 and #10 the rival just behind says its own hand-written respect line",
    [91, 81, 69].every((c) => RESPECT[c].test(seen[c] ?? "")),
    seen,
  );
  expectNew(
    "S6b at #11 and #12 (outside the top ten) there is none",
    seen[67] === null && seen[65] === null,
    { r11: seen[67], r12: seen[65] },
  );
}

// ───────── S7: Paige Later ─────────
if (run("S7")) {
  // Level 30 (29 completed): the Spice Route's chef; its window is two levels (29 and 30 completed). Every other tip is already given.
  const OTHER = ["restock", "system:cuisines"];
  const assistant = { hired: true, seen: OTHER, tipsOff: false };
  const saveAt = (completed, guideSeen) =>
    uiSave(completed, { assistant, ...(guideSeen ? { guideSeen } : {}) }, { credits: 300 });
  const beat = async () => {
    let t = null;
    for (let i = 0; i < 14 && !t; i++) {
      await sleep(700);
      await dismissGuide();
      t = await page.evaluate(
        () =>
          document
            .querySelector('[data-testid="assistant-host"]')
            ?.innerText.replace(/\s+/g, " ") ?? null,
      );
    }
    return t;
  };
  const lastLine = async () => {
    await page.evaluate(() => document.querySelector('[data-testid="assistant-next"]')?.click());
    await sleep(600);
  };
  const buttons = () =>
    page.evaluate(() => {
      const h = document.querySelector('[data-testid="assistant-host"]');
      const one = (id) => {
        const b = h?.querySelector(`[data-testid="${id}"]`);
        const r = b?.getBoundingClientRect();
        return r
          ? {
              h: Math.round(r.height),
              inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
            }
          : null;
      };
      return { go: one("assistant-go"), ok: one("assistant-ok"), later: one("assistant-later") };
    });
  for (const [w, h] of [
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await boot(page, saveAt(29));
    const t1 = await beat();
    if (w === 390)
      check(
        "S7a Paige says the Spice Route's chef is talking big",
        /Spice Route is next, and Chef Samir is talking big\./.test(t1 ?? ""),
        t1,
      );
    await lastLine();
    const b = await buttons();
    if (w === 390) await shot(page, "batch4-S7-paige-later-390");
    else await shot(page, "batch4-S7-paige-later-320");
    expectNew(
      `S7b ${w}x${h}: Go there, Got it and Later are all there, 48 px tall and inside the screen`,
      !!b.go && !!b.ok && !!b.later && [b.go, b.ok, b.later].every((x) => x.h >= 47 && x.inside),
      b,
    );
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, saveAt(29));
  await beat();
  await lastLine();
  await page.evaluate(() => document.querySelector('[data-testid="assistant-later"]')?.click());
  await sleep(1200);
  const gone = await page.evaluate(
    () => !document.querySelector('[data-testid="assistant-host"]')?.innerText.trim(),
  );
  const s1 = await readSave(page);
  const guide1 = s1.business.guideSeen ?? [];
  const seen1 = s1.business.assistant?.seen ?? [];
  info("S7 after Later", { guideSeen: guide1, assistantSeen: seen1 });
  expectNew(
    "S7c Later closes the bubble, writes ONE entry in the existing guideSeen list and does not count the message as given",
    gone &&
      guide1.some((e) => /^later:rival:spice-route@\d+$/.test(e)) &&
      !seen1.includes("rival:spice-route"),
    { gone, guide1 },
  );
  const keys = Object.keys(s1.business).sort().join();
  info("S7 save fields", { keysAfterLater: keys.length });
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3500);
  await dismissGuide();
  const again = await page.evaluate(
    () =>
      document.querySelector('[data-testid="assistant-host"]')?.innerText.replace(/\s+/g, " ") ??
      null,
  );
  expectNew(
    "S7d after a reload, on the same level, it does not come back",
    !again || !/Spice Route is next/.test(again),
    again,
  );
  // the next level: the entry (written at 29 completed) travels with the save
  await boot(page, saveAt(30, guide1));
  const t2 = await beat();
  expectNew(
    "S7e on the next level it comes back",
    /Spice Route is next, and Chef Samir is talking big\./.test(t2 ?? ""),
    t2,
  );
  await lastLine();
  await page.evaluate(() => document.querySelector('[data-testid="assistant-ok"]')?.click());
  await sleep(1200);
  const s2 = await readSave(page);
  expectNew(
    "S7f 'Got it' gives it for good (saved with her other tips, so it is in the notebook)",
    (s2.business.assistant?.seen ?? []).includes("rival:spice-route"),
    s2.business.assistant?.seen,
  );
}

// ───────── S8: the breakpoint ─────────
if (run("S8")) {
  const rec = { perfectCuts: 120, masterful: 12, fastestMs: 50000, plates: 40, services: 5 };
  const rows = [];
  for (const h of [599, 600, 699, 700, 640]) {
    await page.setViewport({ width: 390, height: h, deviceScaleFactor: 1 });
    await boot(page, uiSave(9, { chefRecord: rec }));
    await sleep(1500);
    await dismissGuide();
    await sleep(500);
    rows.push({
      h,
      ...(await page.evaluate(() => {
        const vis = (s) => {
          const r = document.querySelector(s)?.getBoundingClientRect();
          return !!r && r.width > 0 && r.height > 0;
        };
        const rank = document
          .querySelector('[data-testid="kitchen-rank"]')
          ?.getBoundingClientRect();
        const gift = document
          .querySelector('[data-testid="kitchen-gift"]')
          ?.getBoundingClientRect();
        return {
          chip: vis('[data-testid="kitchen-chef-title"]'),
          rival: vis('[data-testid="kitchen-rival-chef"]'),
          rankH: rank ? Math.round(rank.height) : null,
          giftClear: !!rank && !!gift ? gift.top >= rank.bottom - 0.5 : null,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      })),
    });
  }
  info("S8 heights", rows);
  const at = (h) => rows.find((r) => r.h === h);
  expectNew(
    "S8a the title chip: hidden at 599 px tall, shown from 600",
    !at(599).chip && at(600).chip && at(640).chip,
    rows,
  );
  expectNew(
    "S8b the rival's line: hidden at 699 px tall, shown from 700 (it adds a row, so it keeps its own line)",
    !at(699).rival && at(700).rival && !at(640).rival,
    rows,
  );
  expectNew(
    "S8c at 640 the rank card did not grow (about 105 px) and the Daily Gift is clear of it; nothing scrolls sideways",
    at(640).rankH <= 110 && at(640).giftClear && rows.every((r) => r.overflow <= 0),
    at(640),
  );
}

// ───────── S9: InfoTips ─────────
if (run("S9")) {
  const out = {};
  for (const [w, h] of [
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await boot(
      page,
      uiSave(40, {
        chefRecord: { perfectCuts: 120, masterful: 12, fastestMs: 50000, plates: 40, services: 5 },
      }),
    );
    const p = await progress();
    const labels = [
      "How chef titles are earned",
      "How prestige works",
      "How the city league works",
    ];
    out[`${w}x${h}`] = { present: labels.map((l) => p.infotips.includes(l)) };
    for (const l of labels) {
      const box = await page.evaluate((label) => {
        const b = document.querySelector(`button[data-infotip][aria-label="${label}"]`);
        b?.scrollIntoView({ block: "center" });
        const r = b?.getBoundingClientRect();
        return r
          ? {
              w: Math.round(r.width),
              h: Math.round(r.height),
              inside: r.left >= 0 && r.right <= innerWidth,
            }
          : null;
      }, l);
      if (!box) continue;
      await page.evaluate(
        (label) => document.querySelector(`button[data-infotip][aria-label="${label}"]`)?.click(),
        l,
      );
      await sleep(400);
      const bubble = await page.evaluate(() => {
        const b = document.querySelector("[data-infotip-bubble]");
        const r = b?.getBoundingClientRect();
        return b
          ? {
              text: b.textContent.replace(/\s+/g, " ").trim().slice(0, 60),
              inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
            }
          : null;
      });
      out[`${w}x${h}`][l] = { box, bubble };
      if (w === 320 && l === "How the city league works")
        await shot(page, "batch4-S9-infotip-league-320");
      await page.mouse.click(5, 5);
      await sleep(300);
    }
  }
  info("S9", out);
  const ok = Object.values(out).every(
    (o) =>
      o.present.every(Boolean) &&
      ["How chef titles are earned", "How prestige works", "How the city league works"].every(
        (l) => o[l]?.box?.h >= 47 && o[l]?.box?.inside && o[l]?.bubble?.inside,
      ),
  );
  expectNew(
    "S9 each of the three cards has an ⓘ (48 px, inside the screen) whose bubble opens inside the screen, at 390x844 and 320x568",
    ok,
    out,
  );
}

// ───────── S10: bestPlate ─────────
if (run("S10")) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(
    page,
    uiSave(
      9,
      { chefRecord: { plates: 5, fastestMs: 14000 } },
      {
        recipeProgress: {
          a: { best: 88, done: true },
          b: { best: 97, done: true },
          c: { best: 91, done: true },
        },
      },
    ),
  );
  const p = await progress();
  await shot(page, "batch4-S10-records");
  info("S10", p.records);
  expectNew(
    "S10 the chef title card shows the best plate (97%, the best dish in the recipe book) and the fastest plate (14 s)",
    p.records === "Best plate 97% · Fastest 14 s",
    p.records,
  );
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("0 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
