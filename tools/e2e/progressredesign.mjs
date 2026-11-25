// Restaurant Progress, painted (developer 2026-11-25), restaurant build, a Level 70 save:
//   1  the page draws its cards (the hero, chef title, prestige, league, guide, standing, numbers, next goal, campaign, earnings, journey, knives, boards, milestones) and every one is a painted card
//   2  what the audit removed is gone: no "Local restaurant rankings", no Popularity card, no summary list, no "Restaurant Complete" row, no "Remaining wealth"
//   3  at 1815x867, 1280x720, 740x360, 768x1024, 430x900, 390x844, 360x640 and 320x568 there is no sideways scroll and every button is at least 44 px tall
//   4  Milestones shows six rows first and opens in full on "Show all"
//   5  every painted picture that is drawn is decoded (none now: the pictures are not delivered yet, the page shows today's icons)
//   6  no console errors
// Section screenshots go to tools/e2e/out/progressredesign-<w>x<h>-<n>.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, seedSave, sleep } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const save = seedSave({
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
save.version = 3;

const SIZES = [
  [1815, 867],
  [1280, 720],
  [740, 360],
  [768, 1024],
  [430, 900],
  [390, 844],
  [360, 640],
  [320, 568],
];

/** The Kitchen's rank card goes to Achievements while money waits; its back arrow leads to Progress. */
async function openProgress() {
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

const scroller = () =>
  page.evaluate(() => {
    const sc = [...document.querySelectorAll("div")].find(
      (d) => d.classList.contains("overflow-y-auto") && d.scrollHeight > d.clientHeight + 20,
    );
    return sc
      ? { sh: sc.scrollHeight, ch: sc.clientHeight, sw: sc.scrollWidth, cw: sc.clientWidth }
      : null;
  });

for (const [w, h] of SIZES) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, save);
  await sleep(1800);
  await openProgress();
  const tag = `${w}x${h}`;
  const info = await page.evaluate(() => {
    const body = document.body.innerText;
    const cards = document.querySelectorAll("section.pg-card").length;
    return {
      onPage: /Restaurant Progress/i.test(body),
      cards,
      hero: !!document.querySelector('[data-testid="city-rank-hero"]'),
      ids: [
        "chef-title-card",
        "prestige-card",
        "league-card",
        "city-leaderboard",
        "restaurant-standing",
        "restaurant-numbers",
      ].filter((id) => !document.querySelector(`[data-testid="${id}"]`)),
      removed: [
        "Local restaurant rankings",
        "City Popularity",
        "Remaining wealth",
        "Restaurant Complete ",
        "Kitchen upgrade",
      ].filter((t) => body.includes(t)),
    };
  });
  check(
    `1 ${tag}: the page and its painted cards are there`,
    info.onPage && info.hero && info.cards >= 10 && info.ids.length === 0,
    info,
  );
  if (w === 1815 || w === 430) {
    check(`2 ${tag}: what the audit removed is gone`, info.removed.length === 0, info.removed);
  }
  const sc = await scroller();
  check(`3 ${tag}: no sideways scroll`, !!sc && sc.sw <= sc.cw + 1, sc);
  const small = await page.evaluate(() => {
    const sc = [...document.querySelectorAll("div")].find(
      (d) => d.classList.contains("overflow-y-auto") && d.scrollHeight > d.clientHeight + 20,
    );
    if (!sc) return ["no scroller"];
    return [...sc.querySelectorAll("button")]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => ({
        t: (b.getAttribute("aria-label") ?? b.textContent).trim().slice(0, 24),
        h: Math.round(b.getBoundingClientRect().height),
      }))
      .filter((b) => b.h < 44);
  });
  check(
    `3 ${tag}: every button in the page is at least 44 px tall`,
    small.length === 0,
    small.slice(0, 4),
  );
  if (w === 1815 || w === 430) {
    // screenshots, top to bottom
    for (let i = 0; i < 12; i++) {
      await page.screenshot({ path: `out/progressredesign-${tag}-${i}.png` });
      const more = await page.evaluate((hh) => {
        const s = [...document.querySelectorAll("div")].find(
          (d) => d.classList.contains("overflow-y-auto") && d.scrollHeight > d.clientHeight + 20,
        );
        if (!s) return false;
        const before = s.scrollTop;
        s.scrollTop += hh * 0.85;
        return s.scrollTop > before;
      }, h);
      await sleep(250);
      if (!more) break;
    }
  }
  if (w === 1280) {
    // 4: milestones
    const before = await page.evaluate(
      () => document.querySelectorAll('[data-testid="milestones-list"] li').length,
    );
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => /^Show all \d+$/.test(x.textContent.trim()) && !/50/.test(x.textContent),
      );
      b?.scrollIntoView({ block: "center" });
      b?.click();
      return b?.textContent.trim() ?? null;
    });
    await sleep(500);
    const after = await page.evaluate(
      () => document.querySelectorAll('[data-testid="milestones-list"] li').length,
    );
    check(
      `4 ${tag}: Milestones shows six first and opens in full on "Show all"`,
      before === 6 && !!clicked && after > 6,
      { before, after, clicked },
    );
    // the pictures load lazily as they come into view: scroll the whole page once, then check every one that is drawn
    for (let y = 0; y < 8000; y += 500) {
      await page.evaluate((top) => {
        const sc = [...document.querySelectorAll("div")].find(
          (d) => d.classList.contains("overflow-y-auto") && d.scrollHeight > d.clientHeight + 20,
        );
        if (sc) sc.scrollTop = top;
      }, y);
      await sleep(120);
    }
    await sleep(800);
    const art = await page.evaluate(() =>
      [...document.querySelectorAll("img[data-art]")]
        .map((i) => ({ n: i.dataset.art, ok: i.complete && i.naturalWidth > 0 }))
        .filter((x) => !x.ok),
    );
    check(
      `5 ${tag}: every painted picture that is drawn is decoded`,
      art.length === 0,
      art.slice(0, 4),
    );
  }
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
