// PAGES AUDIT (developer 2026-11-21: "deep check for bugs and issues; make sure icons and images are all integrated properly"): crawls the real game, page by page and tab by tab, at
// 1500 x 850 and 390 x 844, and for every page checks
//   A1 no request answers 4xx / 5xx (a missing or renamed picture) and no page error or console error
//   A2 no <img> that failed to load (no pixels), and no painted icon (.gi-img) that is not drawn at 0.8-1.7 em of its text
//   A3 no emoji left as raw text that has a painted picture or an icon (it must be drawn by the icon runtime), and no flag emoji (Windows shows letters)
//   A4 no sideways scroll
// Screenshots: out/pa-<size>-<page>.png (look at them: art cut off or covered is not something a script can see). Prints PASS/FAIL per page, exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  boot,
  seedSave,
  sleep,
  openSection,
  openShortcut,
} from "./harness.mjs";

const SEEN = [
  "shop",
  "inventory",
  "rack",
  "business",
  "staff",
  "equipment",
  "second-floor",
  "restaurant",
  "menu",
  "progress",
];
const LEVEL = Number(process.env.LV || 60);
const save = seedSave({
  credits: 742000,
  business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET, sectionsSeen: SEEN },
  levelProgress: {
    currentLevelId: `level-${LEVEL}`,
    highestUnlockedLevelId: `level-${LEVEL}`,
    completedLevelIds: Array.from({ length: LEVEL - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});

const SIZES = process.env.SIZES
  ? process.env.SIZES.split(",").map((s) => s.split("x").map(Number))
  : [
      [1500, 850],
      [390, 844],
    ];
const results = [];
const bad = [];
const { browser, page } = await launch();
page.on("response", (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`);
});
page.on("pageerror", (e) => bad.push(`pageerror ${String(e).slice(0, 120)}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/favicon|Failed to load resource/i.test(m.text()))
    bad.push(`console ${m.text().slice(0, 120)}`);
});

const FLAG = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
async function inspect() {
  return page.evaluate((flagSrc) => {
    const FLAG = new RegExp(flagSrc, "u");
    const vw = document.documentElement.clientWidth;
    const imgs = [...document.querySelectorAll("img")].filter((i) => {
      const r = i.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const broken = imgs
      .filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src"))
      .map((i) => i.getAttribute("src"));
    const icons = [...document.querySelectorAll(".gi-pic")].filter(
      (g) => g.getBoundingClientRect().width > 0,
    );
    const badIcons = icons
      .map((g) => {
        const r = g.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(g).fontSize) || 16;
        return { em: r.width / fs, w: r.width, src: g.querySelector("img")?.getAttribute("src") };
      })
      .filter((x) => x.em < 0.8 || x.em > 1.7 || x.w < 8);
    const raw = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(".gi, script, style, option, textarea, title, svg, [data-emoji-raw]"))
        continue;
      const t = n.textContent ?? "";
      if (FLAG.test(t)) raw.push("FLAG " + t.trim().slice(0, 30));
      // a real emoji picture only (Extended_Pictographic): the text symbols ✓ ★ ✦ ✗ are typography in the text font, not emoji, and the icon runtime leaves them alone
      else if (/\p{Extended_Pictographic}/u.test(t)) raw.push(t.trim().slice(0, 30));
    }
    return {
      imgs: imgs.length,
      icons: icons.length,
      broken,
      badIcons: badIcons.slice(0, 4),
      raw: raw.slice(0, 6),
      sideways: document.documentElement.scrollWidth > vw + 1,
    };
  }, FLAG.source);
}

async function visit(size, name, go) {
  const before = bad.length;
  try {
    await go();
    await sleep(1300);
    const shot = `out/pa-${size[0]}-${name}.png`;
    await page.screenshot({ path: shot });
    const m = await inspect();
    const fresh = bad.slice(before);
    const problems = [];
    if (fresh.length)
      problems.push(`requests/errors: ${[...new Set(fresh)].slice(0, 4).join(" | ")}`);
    if (m.broken.length) problems.push(`broken pictures: ${m.broken.slice(0, 3).join(", ")}`);
    if (m.badIcons.length) problems.push(`mis-sized painted icons: ${JSON.stringify(m.badIcons)}`);
    if (m.raw.length) problems.push(`raw emoji: ${m.raw.join(" / ")}`);
    if (m.sideways) problems.push("sideways scroll");
    const ok = problems.length === 0;
    results.push({ name: `${size[0]} ${name}`, ok });
    console.log(
      `${ok ? "PASS" : "FAIL"} ${size[0]} ${name}  (${m.imgs} pictures, ${m.icons} painted icons)`,
      problems.join("; "),
    );
  } catch (e) {
    results.push({ name: `${size[0]} ${name}`, ok: false });
    console.log(`FAIL ${size[0]} ${name} ERROR ${String(e).slice(0, 140)}`);
  }
}

const clickText = (re) =>
  page.evaluate((src) => {
    const r = new RegExp(src);
    const b = [...document.querySelectorAll("button, [role=tab]")].find(
      (x) => r.test(x.textContent.trim()) && x.getBoundingClientRect().width > 0,
    );
    b?.click();
    return !!b;
  }, re.source);
const tabsOf = (sel) =>
  page.evaluate(
    (s) =>
      [...document.querySelectorAll(`${s} button, ${s} [role=tab]`)]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => b.textContent.trim()),
    sel,
  );
const later = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click(),
  );

for (const size of SIZES) {
  await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: 1 });
  await boot(page, save);
  await sleep(1500);
  await later();
  await visit(size, "kitchen", async () => {});
  await visit(size, "orders", async () => {
    await clickText(/^See all orders/);
  });
  await boot(page, save);
  await sleep(1200);
  await later();
  // Market and its tabs
  await visit(size, "market", async () => {
    await openSection(page, "Market");
  });
  for (const t of [
    "Knives",
    "Cutting Boards",
    "Ingredients",
    "Blacksmith",
    "Smallwares",
    "Tableware",
    "Takeaway",
    "Cleaning",
    "Second Floor",
  ]) {
    await visit(size, `market-${t.replace(/\W/g, "")}`, async () => {
      await clickText(new RegExp(`^\\S*\\s*${t}`));
    });
  }
  // Business and its tabs
  await visit(size, "business", async () => {
    await openShortcut(page, "business");
  });
  for (const t of [
    "Equipment",
    "Upgrades",
    "Staff",
    "Suppliers",
    "Menu",
    "Operations",
    "Overview",
  ]) {
    await visit(size, `business-${t}`, async () => {
      await clickText(new RegExp(`^\\S*\\s*${t}`));
    });
  }
  // Cleanliness: its own section under the Kitchen's Mini-games button (developer 2026-11-22)
  await visit(size, "cleanliness", async () => {
    await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
    await sleep(700);
    await page.evaluate(() => document.querySelector('[data-testid="minigames-shortcut"]')?.click());
    await sleep(500);
    await page.evaluate(() => document.querySelector('[data-testid="minigame-cleaning"]')?.click());
  });
  // Inventory
  await visit(size, "inventory", async () => {
    await openShortcut(page, "inventory");
  });
  for (const t of ["Supplies", "Fridge", "Ingredients", "Needs"]) {
    await visit(size, `inventory-${t}`, async () => {
      await clickText(new RegExp(`^\\S*\\s*${t}`));
    });
  }
  await visit(size, "progress", async () => {
    await openShortcut(page, "progress");
  });
  await visit(size, "restaurant", async () => {
    await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  });
  await visit(size, "secondfloor", async () => {
    await clickText(/2nd Floor/);
  });
  const tabs = await tabsOf('nav[aria-label="Business sections"]');
  void tabs;
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\nPAGES AUDIT: ${failed.length} of ${results.length} FAILED`
    : `\nPAGES AUDIT: ALL ${results.length} PAGES PASS`,
);
process.exit(failed.length ? 1 : 0);
