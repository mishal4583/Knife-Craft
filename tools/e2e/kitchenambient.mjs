// The Kitchen's life (developer 2026-11-26, from his Gemini clip), restaurant build, all six kitchen stages in a phone and a wide window:
//   K1 every stage draws its layer (steam, the beam, the stage's own lamps and glints) and it MOVES (a steam puff's opacity changes over a second and a half)
//   K2 the layer sits on the painting: the stage box is the picture's own `object-cover` rectangle (the pot's pixel is where the painting has its pot, whatever the window)
//   K3 Settings -> Reduced motion hides it (the page's `kc-reduced-motion` class)
//   K4 no sideways scroll, no console errors
// Screenshots: out/kitchenambient-<stage>-<layout>.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const STAGES = [
  ["humble-kitchen", "skin-01", 0],
  ["growing-kitchen", "skin-02", 0],
  ["established-kitchen", "skin-03", 0],
  ["neighborhood-cafe", "skin-04", 2],
  ["flourishing-cafe", "skin-05", 3],
  ["grand-kitchen", "skin-06", 5], // lamps: the wide painting has 5 lamp points, the tall one 3 (see LAMPS_TALL)
];
const OWNED = STAGES.map((s) => s[0]);
const save = (id) => {
  // the kitchen shown is the best one OWNED, so a stage is tested by owning only the kitchens up to it
  const owned = OWNED.slice(0, OWNED.indexOf(id) + 1);
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: "level-30",
      highestUnlockedLevelId: "level-30",
      completedLevelIds: Array.from({ length: 29 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    ownedKitchenUpgradeIds: owned,
    equippedKitchenUpgradeId: id,
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
  s.version = 3;
  return s;
};

const { browser, page, logs } = await launch();
const layouts = [
  ["tall", 390, 844],
  ["wide", 1815, 867],
];
try {
  for (const [id, skin, lamps] of STAGES) {
    for (const [layout, w, h] of layouts) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await boot(page, save(id));
      await sleep(2200);
      await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .find((b) => b.textContent.trim() === "Later")
          ?.click(),
      );
      await sleep(500);
      const read = () =>
        page.evaluate(() => {
          const root = document.querySelector('[data-testid="kitchen-ambient"]');
          const steam = [...document.querySelectorAll('[data-testid="ka-steam"]')];
          const stage = document.querySelector(".ka-stage");
          const box = document
            .querySelector('[data-testid="kitchen-bg-box"]')
            ?.getBoundingClientRect();
          const img = stage?.querySelector("img");
          const r = stage?.getBoundingClientRect();
          return {
            skin: root?.getAttribute("data-skin") ?? null,
            layout: root?.getAttribute("data-layout") ?? null,
            steam: steam.length,
            lamps: document.querySelectorAll('[data-testid="ka-lamp"]').length,
            glints: document.querySelectorAll('[data-testid="ka-glint"]').length,
            beam: !!document.querySelector('[data-testid="ka-beam"]'),
            opacities: steam.map((s) => Number(getComputedStyle(s).opacity)),
            stage: r
              ? {
                  l: Math.round(r.left),
                  t: Math.round(r.top),
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                }
              : null,
            imgSrc: img?.getAttribute("src")?.slice(-24) ?? null,
            box: box ? { l: box.left, t: box.top, r: box.right, b: box.bottom } : null,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            vw: window.innerWidth,
            vh: window.innerHeight,
          };
        });
      const a = await read();
      await sleep(1500);
      const b = await read();
      await shot(page, `kitchenambient-${skin}-${layout}`);
      const moved = a.opacities.some((o, i) => Math.abs(o - (b.opacities[i] ?? o)) > 0.02);
      check(
        `K1 ${skin} ${layout}: steam, beam, ${lamps} lamps, glints, and it moves`,
        a.skin === skin &&
          a.layout === layout &&
          a.steam >= 3 &&
          a.beam &&
          a.lamps === (layout === "tall" ? Math.min(lamps, 3) : lamps) &&
          a.glints >= 2 &&
          moved,
        { steam: a.steam, lamps: a.lamps, glints: a.glints, moved },
      );
      // K2: the stage is the painting's cover rectangle: same aspect as the picture, and it covers the window
      const aspect = layout === "wide" ? 1920 / 1080 : 1080 / 1920;
      const sa = a.stage ? a.stage.w / a.stage.h : 0;
      // the game lays its screens out at a logical size and scales them to the window, so the stage is compared with its OWN container, not the window
      const covers =
        !!a.stage &&
        !!a.box &&
        a.stage.l <= a.box.l + 2 &&
        a.stage.t <= a.box.t + 2 &&
        a.stage.l + a.stage.w >= a.box.r - 2 &&
        a.stage.t + a.stage.h >= a.box.b - 2;
      check(
        `K2 ${skin} ${layout}: the layer's stage is the painting's own cover box`,
        Math.abs(sa - aspect) < 0.02 && covers,
        { stage: a.stage, box: a.box, aspect: +sa.toFixed(3), want: +aspect.toFixed(3) },
      );
      check(`K4 ${skin} ${layout}: no sideways scroll`, a.overflow <= 0, a.overflow);
    }
  }
  // K3: reduced motion
  await page.setViewport({ width: 1815, height: 867, deviceScaleFactor: 1 });
  await boot(page, save("grand-kitchen"));
  await sleep(2200);
  await page.evaluate(() => document.documentElement.classList.add("kc-reduced-motion"));
  await sleep(400);
  const red = await page.evaluate(() => ({
    display: getComputedStyle(document.querySelector('[data-testid="kitchen-ambient"]')).display,
    anim: getComputedStyle(document.querySelector(".ka-stage")).animationName,
  }));
  check(
    "K3 Reduced motion hides the layer and stops the push-in",
    red.display === "none" && red.anim === "none",
    red,
  );
} catch (e) {
  console.log("FAIL harness", String(e).slice(0, 300));
  await shot(page, "kitchenambient-fail").catch(() => {});
  results.push({ id: "harness", ok: false });
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("K4 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(failed ? `KITCHEN AMBIENT E2E: ${failed} FAILURE(S)` : "KITCHEN AMBIENT E2E: ALL PASS");
process.exit(failed ? 1 : 0);
