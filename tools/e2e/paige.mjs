// Paige, the personal assistant (developer 2026-11-07), restaurant build, in a real browser (restaurant/assistant.ts, components/kc/assistant).
//   P1 a brand-new game: after the intro and the naming card Paige introduces herself in the Kitchen (her pose, her painted bubble, "Hire Paige")
//   P2 her introduction comes BEFORE Grandma's pointer; the hire is free (credits and ledger unchanged); then the pointer appears with Paige's face
//   P3 after the first service the first-cash tip rings the Market tab; one beat per screen visit; "Got it" saves it as seen
//   P4 Ask Paige opens the notebook with that tip; "Show again" brings the bubble back; the Tips switch turns her off and on and is saved
//   P5 Tips Off: no bubble pops up by itself
//   P6 her card on the Staff screen (portrait, free, notebook, tips)
//   P7 at 320 x 568 and 390 x 844 the bubble fits, nothing scrolls sideways, every button is at least 48 px
//   P8 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  freshPlayer,
  boot,
  seedSave,
  sleep,
  readSave,
  shot,
  clickButton,
  passNameCard,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const q = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const click = async (sel, wait = 350) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await sleep(wait);
};
const bubble = () =>
  page.evaluate(() => {
    const h = document.querySelector('[data-testid="assistant-host"]');
    if (!h) return null;
    const b = h.querySelector('[data-testid="assistant-bubble"]');
    const pose = h.querySelector("img[data-paige-pose]");
    const r = b?.getBoundingClientRect();
    // 2026-11-08: a popup card over a dimmed, blurred scrim (was a painted speech bubble)
    const scrim = h.querySelector('[data-testid="assistant-scrim"]');
    const frame = b ? getComputedStyle(b).borderTopWidth !== "0px" : "";
    return {
      beat: h.getAttribute("data-beat"),
      line: Number(h.getAttribute("data-line")),
      pose: h.getAttribute("data-pose"),
      text: h.querySelector('[data-testid="assistant-text"]')?.textContent ?? "",
      poseLoaded: !!pose && pose.complete && pose.naturalWidth > 0,
      frame: !!frame && !!scrim && /blur/.test(getComputedStyle(scrim).backdropFilter || ""),
      buttons: [...h.querySelectorAll("button")].map((x) => ({
        t: x.textContent.trim() || x.getAttribute("aria-label"),
        id: x.getAttribute("data-testid"),
        w: Math.round(x.getBoundingClientRect().width),
        h: Math.round(x.getBoundingClientRect().height),
      })),
      rect: r
        ? {
            l: Math.round(r.left),
            t: Math.round(r.top),
            r: Math.round(r.right),
            b: Math.round(r.bottom),
          }
        : null,
      ring: !!h.querySelector('img[data-paige-piece^="ui-ring"]'),
      vw: window.innerWidth,
      vh: window.innerHeight,
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

try {
  // ---- P1, P2: a brand-new game ----
  await freshPlayer(page);
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
    timeout: 30000,
  });
  await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
  await page.waitForFunction(() => !document.querySelector("[data-intro-scene]"), {
    timeout: 10000,
  });
  await passNameCard(page);
  await page.waitForSelector('[data-testid="assistant-host"]', { timeout: 8000 }).catch(() => null);
  await sleep(500);
  const before = await readSave(page);
  const b1 = await bubble();
  const sectionPointerFirst = await q('[data-testid="section-pointer"]');
  await shot(page, "paige-1-meet");
  check(
    "P1 after the intro Paige introduces herself in the Kitchen: her wave pose, the popup card on a dimmed, blurred screen, her name, and the Hire button",
    !!b1 &&
      b1.beat === "meet" &&
      b1.pose === "wave" &&
      /Paige/.test(b1.text) &&
      b1.poseLoaded &&
      b1.frame &&
      !sectionPointerFirst,
    b1,
  );
  await click('[data-testid="assistant-next"]');
  const b1b = await bubble();
  check(
    "P1b the second line is a different pose, and the last line offers Hire Paige · Free",
    !!b1b &&
      b1b.line === 1 &&
      b1b.pose !== "wave" &&
      b1b.buttons.some((x) => x.id === "assistant-hire" && /Hire Paige · Free/.test(x.t)),
    b1b,
  );
  await click('[data-testid="assistant-hire"]', 900);
  const after = await readSave(page);
  const pointer = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="section-pointer"]');
    return p
      ? {
          tab: p.getAttribute("data-pointer-tab"),
          paigeFace: !!p.querySelector("img[data-paige-avatar]"),
          grandma: p.textContent.includes("\u{1F475}"),
          text: p.textContent.replace(/\s+/g, " ").slice(0, 120),
        }
      : null;
  });
  await shot(page, "paige-2-pointer");
  check(
    "P2 hiring is free (credits and ledger unchanged), it is saved, and THEN Grandma's pointer appears with Paige's face and no stale 'hire first' line",
    after.business.assistant?.hired === true &&
      after.credits === before.credits &&
      JSON.stringify(after.economyLedger) === JSON.stringify(before.economyLedger) &&
      !!pointer &&
      pointer.tab === "shop" &&
      pointer.paigeFace &&
      !pointer.grandma &&
      !/Hire your team/.test(pointer.text),
    { hired: after.business.assistant, credits: [before.credits, after.credits], pointer },
  );

  // ---- P3 - P6: a player who has finished the first service ----
  const save2 = seedSave({
    credits: 5000,
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [] }, // tips ON
      sectionsSeen: ["shop", "inventory", "rack", "business"], // Grandma's pointers are done, so Paige's turn comes
    },
    levelProgress: {
      currentLevelId: "level-2",
      highestUnlockedLevelId: "level-2",
      completedLevelIds: ["level-1"],
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });
  await boot(page, save2);
  await page.waitForSelector('[data-testid="assistant-host"]', { timeout: 8000 }).catch(() => null);
  await sleep(600);
  const b3 = await bubble();
  await shot(page, "paige-3-first-pay");
  const marketTab = await page.evaluate(() => {
    const t = document.querySelector('[data-nav="shop"]')?.getBoundingClientRect();
    const r = document
      .querySelector('img[data-paige-piece="ui-ring-round"], img[data-paige-piece="ui-ring-rect"]')
      ?.getBoundingClientRect();
    return t && r
      ? {
          tab: [Math.round(t.left + t.width / 2), Math.round(t.top + t.height / 2)],
          ring: [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)],
        }
      : null;
  });
  check(
    "P3 after the first service Paige says 'first cash', with a glowing ring centred on the Market tab",
    !!b3 &&
      b3.beat === "first-pay" &&
      b3.ring &&
      !!marketTab &&
      Math.abs(marketTab.tab[0] - marketTab.ring[0]) <= 6 &&
      Math.abs(marketTab.tab[1] - marketTab.ring[1]) <= 6,
    { b3: b3 && { beat: b3.beat, ring: b3.ring, text: b3.text }, marketTab },
  );
  await click('[data-testid="assistant-next"]');
  await shot(page, "paige-3b-last-line");
  await click('[data-testid="assistant-ok"]', 700);
  const s3 = await readSave(page);
  const gone = !(await q('[data-testid="assistant-bubble"]'));
  check(
    "P3b 'Got it' closes the bubble, saves the tip as seen, and no second tip pops up on the same screen visit",
    gone && (s3.business.assistant?.seen ?? []).includes("first-pay"),
    s3.business.assistant,
  );

  // ---- P4: the notebook ----
  const ask = await q('[data-testid="ask-paige"]');
  await click('[data-testid="ask-paige"]', 500);
  const book = await page.evaluate(() => ({
    open: !!document.querySelector('[data-testid="paige-notebook"]'),
    tips: [...document.querySelectorAll("[data-tip]")].map((e) => e.getAttribute("data-tip")),
    switchOn: document
      .querySelector('[data-testid="paige-tips-switch"]')
      ?.getAttribute("aria-checked"),
  }));
  await shot(page, "paige-4-notebook");
  check(
    "P4 Ask Paige opens the notebook with the tip she gave and Tips: On",
    ask && book.open && book.tips.join() === "first-pay" && book.switchOn === "true",
    book,
  );
  await click('[data-testid="paige-replay"]', 700);
  const replayed = await bubble();
  check(
    "P4b 'Show again' closes the notebook and brings that bubble back",
    !!replayed && replayed.beat === "first-pay" && !(await q('[data-testid="paige-notebook"]')),
    replayed && replayed.beat,
  );
  await click('[data-testid="assistant-ok"]', 400);
  await click('[data-testid="ask-paige"]', 400);
  await click('[data-testid="paige-tips-switch"]', 500);
  const off = await readSave(page);
  const offState = await page.evaluate(() =>
    document.querySelector('[data-testid="paige-tips-switch"]')?.getAttribute("aria-checked"),
  );
  await click('[data-testid="paige-tips-switch"]', 500);
  const on = await readSave(page);
  check(
    "P4c the Tips switch turns her off and on and is saved",
    off.business.assistant?.tipsOff === true &&
      offState === "false" &&
      on.business.assistant?.tipsOff === undefined,
    { off: off.business.assistant, on: on.business.assistant },
  );
  await click('[data-testid="paige-tips-switch"]', 400); // off again
  await clickButton(page, /^Close$/);
  await sleep(300);

  // ---- P5: Tips Off ----
  const quiet = seedSave({
    credits: 5000,
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
    },
    levelProgress: {
      currentLevelId: "level-2",
      highestUnlockedLevelId: "level-2",
      completedLevelIds: ["level-1"],
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });
  await boot(page, quiet);
  await sleep(1500);
  check(
    "P5 Tips Off: nothing pops up by itself (the Ask Paige button is still there)",
    !(await q('[data-testid="assistant-bubble"]')) && (await q('[data-testid="ask-paige"]')),
  );

  // ---- P6: her card on the Staff screen (the Manager / Office room opens later in the game) ----
  await boot(
    page,
    seedSave({
      credits: 50000,
      business: {
        ...MOVED_IN_BUSINESS,
        assistant: { hired: true, seen: [], tipsOff: true },
        sectionsSeen: ["shop", "inventory", "rack", "business"],
      },
      levelProgress: {
        currentLevelId: "level-40",
        highestUnlockedLevelId: "level-40",
        completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
        campaignVersion: 4,
      },
      story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
      settings: {
        sound: false,
        music: false,
        reducedMotion: false,
        restaurantName: "Test Kitchen",
      },
    }),
  );
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(900);
  await page.evaluate(() => {
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => /Staff/.test(x.textContent))
      ?.click();
  });
  await sleep(1000);
  const card = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="assistant-card"]');
    const img = c?.querySelector("img");
    return c
      ? {
          portrait:
            !!img &&
            img.complete &&
            img.naturalWidth > 0 &&
            /staff-portraits\/assistant\.webp/.test(img.getAttribute("src") ?? ""),
          text: c.textContent.replace(/\s+/g, " "),
        }
      : null;
  });
  await shot(page, "paige-6-staff-card");
  check(
    "P6 her card on the Staff screen shows her portrait, that she is free with no wages, the notebook and Tips",
    !!card &&
      card.portrait &&
      /Paige/.test(card.text) &&
      /free, no wages/.test(card.text) &&
      /Notebook/.test(card.text) &&
      /Tips: Off/.test(card.text),
    card,
  );

  // ---- P7: small phones ----
  const sizes = [
    [320, 568],
    [390, 844],
  ];
  const fits = [];
  for (const [w, h] of sizes) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await boot(page, save2);
    await page
      .waitForSelector('[data-testid="assistant-host"]', { timeout: 8000 })
      .catch(() => null);
    await sleep(700);
    const b = await bubble();
    await shot(page, `paige-7-${w}`);
    fits.push({
      w,
      beat: b?.beat,
      inside: !!b?.rect && b.rect.l >= 0 && b.rect.r <= b.vw && b.rect.t >= 0 && b.rect.b <= b.vh,
      sideways: b?.sideways,
      small: (b?.buttons ?? []).filter((x) => x.w < 48 || x.h < 48).map((x) => x.t),
      poseLoaded: b?.poseLoaded,
    });
  }
  check(
    "P7 at 320 x 568 and 390 x 844 the bubble is inside the screen, nothing scrolls sideways and every button is at least 48 px",
    fits.every(
      (f) =>
        f.beat === "first-pay" && f.inside && !f.sideways && f.small.length === 0 && f.poseLoaded,
    ),
    fits,
  );

  const bad = logs.filter(
    (l) => !/favicon|bridge|playgama|Failed to load resource.*(404|net::)/i.test(l),
  );
  check("P8 no console errors", bad.length === 0, bad.slice(0, 5));
} catch (e) {
  check("run", false, String(e).slice(0, 500));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? "\nPAIGE E2E: ALL PASS" : `\nPAIGE E2E: ${failed.length} FAIL`);
process.exit(failed.length === 0 ? 0 : 1);
