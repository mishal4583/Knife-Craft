// The margins of the wide maps (developer 2026-11-24: "the both sides of the restaurant map are not filled in properly, why is the garden extended: fill it properly in all 6 kitchen maps"), restaurant build.
//   1. every one of the six Kitchen maps, in a window WIDER than 16:9 (2160x910) and a TALLER one (1500x1000), draws its margins from the painted garden pictures (data-fill="garden"), and the
//      margin is real picture, not a bar: it has texture (a spread of colours) and is not one flat colour;
//   2. if one of the four margin pictures cannot load, the margins still fill (the old mirrored strips, data-fill="mirrored"): never a bar;
//   3. the Second Floor draws its own margins the same way;
//   4. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, seedSave, sleep } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const STAGES = [
  ["humble", null],
  ["growing", "growing-kitchen"],
  ["established", "established-kitchen"],
  ["neighborhood-cafe", "neighborhood-cafe"],
  ["flourishing-cafe", "flourishing-cafe"],
  ["grand", "grand-kitchen"],
];
const saveFor = (upgrade) => {
  const s = seedSave({
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
    ...(upgrade
      ? { ownedKitchenUpgradeIds: ["humble-kitchen", upgrade], equippedKitchenUpgradeId: upgrade }
      : {}),
  });
  s.version = 3;
  return s;
};

const { browser, page, logs } = await launch();
await page.setRequestInterception(true);
const blocked = new Set();
page.on("request", (req) => {
  if ([...blocked].some((b) => req.url().includes(b))) req.abort();
  else req.continue();
});

/** What the margin canvas shows: its fill kind, and for the left and right margins a sample of real pixels. */
async function margins() {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid="map-edge-fill"]');
    if (!c) return null;
    const g = c.getContext("2d");
    const W = c.width;
    const H = c.height;
    const box = c.getBoundingClientRect();
    const dpr = W / box.width;
    // the viewport's wide margins: find the picture's box from the stage element, if any, else sample the outermost columns
    const stage = document.querySelector(".restaurant-map-stage");
    const sr = stage?.getBoundingClientRect();
    const leftW = sr ? Math.max(0, Math.round((sr.left - box.left) * dpr)) : 0;
    const rightW = sr ? Math.max(0, Math.round((box.right - sr.right) * dpr)) : 0;
    const topH = sr ? Math.max(0, Math.round((sr.top - box.top) * dpr)) : 0;
    const botH = sr ? Math.max(0, Math.round((box.bottom - sr.bottom) * dpr)) : 0;
    const stats = (x, y, w, h) => {
      if (w < 8 || h < 8) return null;
      const d = g.getImageData(x, y, w, h).data;
      const seen = new Set();
      let sum = 0;
      let sum2 = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 16) {
        const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += l;
        sum2 += l * l;
        n++;
        seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
      }
      const mean = sum / n;
      return { std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), colours: seen.size, mean };
    };
    return {
      fill: c.getAttribute("data-fill"),
      leftW,
      rightW,
      topH,
      botH,
      left: stats(2, Math.round(H * 0.3), Math.max(8, leftW - 4), Math.round(H * 0.4)),
      right: stats(
        W - rightW + 2,
        Math.round(H * 0.3),
        Math.max(8, rightW - 4),
        Math.round(H * 0.4),
      ),
      top: stats(Math.round(W * 0.3), 2, Math.round(W * 0.4), Math.max(8, topH - 4)),
      bottom: stats(Math.round(W * 0.3), H - botH + 2, Math.round(W * 0.4), Math.max(8, botH - 4)),
    };
  });
}
const openMap = async () => {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await sleep(2500);
};

// ---- 1: six maps, a wider and a taller window ----
for (const [w, h, kind] of [
  [2160, 910, "wide"],
  [1500, 1000, "tall"],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  for (const [stage, upgrade] of STAGES) {
    await boot(page, saveFor(upgrade));
    await sleep(1800);
    await openMap();
    const m = await margins();
    const sides = kind === "wide" ? [m?.left, m?.right] : [m?.top, m?.bottom];
    check(
      `1 ${stage} ${w}x${h}: margins are the painted garden, with texture (not a flat bar)`,
      !!m && m.fill === "garden" && sides.every((s) => s && s.colours >= 40 && s.std >= 8),
      m && { fill: m.fill, sides, leftW: m.leftW, topH: m.topH },
    );
  }
}

// ---- 2: a margin picture that cannot load: the old strips still fill ----
await page.setViewport({ width: 2160, height: 910, deviceScaleFactor: 1 });
blocked.add("margins/grand-left.webp");
await boot(page, saveFor("grand-kitchen"));
await sleep(1800);
await openMap();
const fb = await margins();
check(
  "2 a margin picture that fails to load falls back to the mirrored strips: still filled (texture), never a bar",
  !!fb &&
    fb.fill === "mirrored" &&
    fb.left &&
    fb.left.colours >= 40 &&
    fb.right &&
    fb.right.colours >= 40,
  fb && { fill: fb.fill, left: fb.left, right: fb.right },
);
blocked.clear();

// ---- 3: the Second Floor ----
await boot(page, saveFor("grand-kitchen"));
await sleep(1800);
await openMap();
const wentUp = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find(
    (x) => /2nd Floor/i.test(x.textContent) && x.getBoundingClientRect().width > 0,
  );
  b?.click();
  return !!b;
});
await sleep(3000);
const sf = await margins();
check(
  "3 the Second Floor draws its own painted margins too",
  wentUp &&
    !!sf &&
    sf.fill === "garden" &&
    sf.left &&
    sf.left.colours >= 30 &&
    sf.right &&
    sf.right.colours >= 30,
  sf && { wentUp, fill: sf.fill, left: sf.left, right: sf.right },
);

const errs = logs.filter(
  (l) => /error/i.test(l) && !/favicon|Failed to load resource|ERR_FAILED/i.test(l),
);
check("4 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
