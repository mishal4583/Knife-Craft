// Business pages, painted (developer 2026-11-25, docs/planning/BUSINESS-UI-REDESIGN-PLAN-2026-11-25.md), restaurant build, a Level 70 save:
//   1  Overview: the rank card, the One Restaurant card, the one-wallet footer (the pace card needs a closed day, so it is only counted when it is there)
//   2  Equipment: "Your refrigerator", the three refrigerator cards, the knives card with "Manage in the Market"
//   3  Upgrades: six kitchen cards, each prints its own description (the developer's note in the document)
//   4  Suppliers: the ingredient supplier, the standing orders, today's conditions and three contract cards; "Possible supplier events" is not printed on the page
//   5  Menu: the "Menu Management" heading, the category chips, and every dish card has its photo box (the game's own dish picture when the dish has one)
//   6  Operations: What needs attention, Today's service, the inspection card with its seven checks, Finance, the last days, the analytics cards
//   7  at 1815x867, 1280x720, 740x360, 768x1024, 430x900, 390x844, 360x640 and 320x568 no tab scrolls sideways
//   8  every button on a tab is at least 44 px tall
//   9  every painted picture that is drawn is decoded (none until the Codex sheets are cut: the pages then show today's icons)
//  10  no console errors
// Screenshots go to tools/e2e/out/businessredesign-<w>x<h>-<tab>.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, openShortcut, seedSave, sleep } from "./harness.mjs";

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
const TABS = ["Overview", "Equipment", "Upgrades", "Suppliers", "Menu", "Operations"];

const openTab = async (tab) => {
  await page.evaluate((label) => {
    const nav = document.querySelector('nav[aria-label="Business sections"]');
    [...(nav?.querySelectorAll("button") ?? [])]
      .find((b) => b.textContent.includes(label))
      ?.click();
  }, tab);
  await sleep(1200);
};

/** What each tab must show (ids, counts, words), read from the DOM. */
const tabFacts = (tab) =>
  page.evaluate((t) => {
    const q = (s) => document.querySelectorAll(s).length;
    const body = document.body.innerText;
    const has = (s) => body.toLowerCase().includes(s.toLowerCase());
    if (t === "Overview")
      return {
        ok:
          !!document.querySelector('[data-testid="rank-card"]') &&
          !!document.querySelector('[data-testid="one-restaurant-note"]') &&
          !!document.querySelector('[data-testid="one-wallet-footer"]') &&
          has("View Restaurant Progress"),
      };
    if (t === "Equipment")
      return {
        ok:
          !!document.querySelector('[data-testid="your-refrigerator"]') &&
          q("[data-fridge]") === 3 &&
          has("Manage in the Market"),
        fridges: q("[data-fridge]"),
      };
    if (t === "Upgrades") {
      const cards = [...document.querySelectorAll("[data-kitchen]")];
      const described = cards.filter(
        (c) =>
          (c.querySelector('[data-testid="kitchen-description"]')?.textContent ?? "").trim()
            .length > 20,
      ).length;
      return { ok: cards.length === 6 && described === 6, cards: cards.length, described };
    }
    if (t === "Suppliers")
      return {
        ok:
          !!document.querySelector('[data-testid="ingredient-supplier"]') &&
          !!document.querySelector('[data-testid="standing-orders"]') &&
          has("Today's supplier conditions") &&
          q("[data-contract]") === 3 &&
          !has("Possible supplier events"),
        contracts: q("[data-contract]"),
      };
    if (t === "Menu") {
      const dishes = [...document.querySelectorAll("[data-menu-dish]")];
      const chips = [...document.querySelectorAll('[aria-label="Dish categories"] button')].map(
        (b) => b.textContent.trim(),
      );
      return {
        ok:
          has("Menu Management") &&
          dishes.length > 0 &&
          dishes.every((d) => !!d.querySelector("[data-dish-photo]")) &&
          chips[0] === "All" &&
          chips.length === 8,
        dishes: dishes.length,
        chips,
        painted: dishes.filter((d) => d.querySelector('[data-dish-photo="painted"]')).length,
      };
    }
    return {
      ok:
        !!document.querySelector('[data-testid="needs-attention"]') &&
        has("Today's service") &&
        !!document.querySelector('[data-testid="inspection-summary"]') &&
        q('[data-testid="inspection-icons"] > span') === 7 &&
        !!document.querySelector('[data-testid="finance-card"]') &&
        !!document.querySelector('[data-testid="business-history"]') &&
        has("Best-selling dishes") &&
        has("Ingredient purchasing") &&
        has("Supply purchasing") &&
        has("Ingredients used"),
      checks: q('[data-testid="inspection-icons"] > span'),
    };
  }, tab);

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
  await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Later")?.click(),
  );
  await sleep(400);
  await openShortcut(page, "business");
  await sleep(1400);
  const tag = `${w}x${h}`;
  for (const tab of TABS) {
    await openTab(tab);
    const facts = await tabFacts(tab);
    check(`1-6 ${tag} ${tab}: its painted cards are there`, facts.ok, facts);
    const sc = await scroller();
    check(`7 ${tag} ${tab}: no sideways scroll`, !!sc && sc.sw <= sc.cw + 1, sc);
    const small = await page.evaluate(() => {
      const s = [...document.querySelectorAll("div")].find(
        (d) => d.classList.contains("overflow-y-auto") && d.scrollHeight > d.clientHeight + 20,
      );
      if (!s) return ["no scroller"];
      return [...s.querySelectorAll("button")]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => ({
          t: (b.getAttribute("aria-label") ?? b.textContent).trim().slice(0, 24),
          h: Math.round(b.getBoundingClientRect().height),
        }))
        .filter((b) => b.h < 44);
    });
    check(
      `8 ${tag} ${tab}: every button is at least 44 px tall`,
      small.length === 0,
      small.slice(0, 4),
    );
    if (w === 1815 || w === 390)
      await page.screenshot({ path: `out/businessredesign-${tag}-${tab}.png` });
    await page.evaluate(() => {
      const s = [...document.querySelectorAll("div")].find((d) =>
        d.classList.contains("overflow-y-auto"),
      );
      if (s) s.scrollTop = 0;
    });
  }
  if (w === 1815) {
    // 9: scroll the Menu and Operations, then every painted picture that is on the page must be decoded
    for (const tab of ["Menu", "Operations"]) {
      await openTab(tab);
      for (let i = 0; i < 10; i++) {
        const more = await page.evaluate((hh) => {
          const s = [...document.querySelectorAll("div")].find(
            (d) => d.classList.contains("overflow-y-auto") && d.scrollHeight > d.clientHeight + 20,
          );
          if (!s) return false;
          const before = s.scrollTop;
          s.scrollTop += hh * 0.85;
          return s.scrollTop > before;
        }, h);
        await sleep(400);
        if (!more) break;
      }
      const imgs = await page.evaluate(() =>
        // only the pictures on (or just beside) the screen: the others are lazy and wait for the scroll
        [
          ...document.querySelectorAll(
            "img[data-art], [data-dish-photo] img, [data-best-seller] img",
          ),
        ]
          .filter((i) => {
            const r = i.getBoundingClientRect();
            return r.width > 0 && r.bottom > -200 && r.top < window.innerHeight + 200;
          })
          .map((i) => ({ ok: i.complete && i.naturalWidth > 0, src: i.getAttribute("src") })),
      );
      const bad = imgs.filter((i) => !i.ok);
      check(
        `9 ${tab}: every painted picture drawn is decoded (${imgs.length} drawn)`,
        bad.length === 0,
        bad.slice(0, 3),
      );
    }
  }
}
const errors = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("10 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
