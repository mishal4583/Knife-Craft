// The Kitchen's life (developer 2026-11-26, from his Gemini clip), restaurant build, all six kitchen stages in a phone and a wide window:
//   K1 every stage draws its layer (steam, the beam, the stage's own lamps and glints) and it MOVES (a steam puff's opacity changes over a second and a half)
//   K2 the layer sits on the painting: the stage box is the picture's own `object-cover` rectangle (the pot's pixel is where the painting has its pot, whatever the window)
//   K3 Settings -> Reduced motion hides it (the page's `kc-reduced-motion` class)
//   K5 (developer 2026-11-27: "the steam is not coming from side of the lid or on top") every wisp's TAIL, as the browser draws it at the start of its rise, is on its lid point
//   K6 the tails the layer hangs the wisps by are where the real pictures' tails are
//   K7 on upright phones the main pot's lid (its top and both sides) is not under a button, and the column's buttons stay at least 48 px; on a phone on its side every lid is clear of
//      the buttons and the day strip
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
  // K5 and K6: where the browser really puts each wisp's tail
  const measured = new Map();
  for (const [id, skin] of STAGES) {
    for (const [layout, w, h] of layouts) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await boot(page, save(id));
      await sleep(1800);
      const tails = await page.evaluate(() => {
        const layer = document.querySelector('[data-testid="kitchen-ambient"]');
        return [...layer.querySelectorAll('[data-testid="ka-steam"]')].map((el) => {
          const rise = el
            .getAnimations()
            .find((a) => /^ka-steam-(rise|jet)$/.test(a.animationName));
          const { duration, delay } = rise.effect.getComputedTiming();
          rise.pause();
          rise.currentTime = delay + Math.ceil(-delay / duration) * duration;
          const css = getComputedStyle(el);
          const [ox, oy] = css.transformOrigin.split(" ").map(parseFloat);
          const m = new DOMMatrix(css.transform);
          // the origin is the tail: it moves only by the matrix's own shift
          const x = el.offsetLeft + ox + m.e;
          const y = el.offsetTop + oy + m.f;
          return {
            from: el.dataset.from,
            off: Math.hypot(
              x - (Number(el.dataset.ax) / 100) * layer.offsetWidth,
              y - (Number(el.dataset.ay) / 100) * layer.offsetHeight,
            ),
            sprite: el.dataset.sprite,
            tailX: -parseFloat(el.style.getPropertyValue("--ntx")) / 100,
            tailY: -parseFloat(el.style.getPropertyValue("--nty")) / 100,
          };
        });
      });
      for (const t of tails) measured.set(t.sprite, [t.tailX, t.tailY]);
      const worst = Math.max(...tails.map((t) => t.off));
      const sides = new Set(tails.map((t) => t.from));
      check(
        `K5 ${skin} ${layout}: every wisp's tail is on its lid point (top, left side, right side)`,
        worst <= 2 && ["top", "left", "right"].every((s) => sides.has(s)),
        { wisps: tails.length, worstPx: +worst.toFixed(2) },
      );
    }
  }
  const pictures = await page.evaluate(
    async (used) => {
      const out = {};
      for (const n of used) {
        const img = new Image();
        img.src = `${location.pathname.replace(/[^/]*$/, "")}kitchen-fx/steam-${n}.webp`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const a = g.getImageData(0, 0, c.width, c.height).data;
        const solid = (x, y) => a[(y * c.width + x) * 4 + 3] > 40;
        let bottom = 0;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++) if (solid(x, y)) bottom = y;
        let sum = 0;
        let count = 0;
        for (let y = Math.floor(bottom - c.height * 0.03); y <= bottom; y++)
          for (let x = 0; x < c.width; x++)
            if (solid(x, y)) {
              sum += x;
              count++;
            }
        out[n] = [sum / count / c.width, bottom / c.height];
      }
      return out;
    },
    [...measured.keys()],
  );
  const astray = [...measured].filter(
    ([n, [x, y]]) => Math.abs(x - pictures[n][0]) > 0.04 || Math.abs(y - pictures[n][1]) > 0.03,
  );
  check(
    "K6 the tails the layer hangs the wisps by are the real pictures' tails",
    measured.size >= 3 && astray.length === 0,
    { used: [...measured.keys()], astray },
  );
  // K7: the lids are seen
  for (const [w, h] of [
    [390, 844],
    [360, 800],
    [412, 915],
    [844, 390],
  ]) {
    const covered = [];
    for (const [id, skin] of STAGES) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await boot(page, save(id));
      await sleep(1800);
      await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .find((b) => b.textContent.trim() === "Later")
          ?.click(),
      );
      await sleep(500);
      const under = await page.evaluate((upright) => {
        const stage = document.querySelector(".ka-stage").getBoundingClientRect();
        const wisps = [...document.querySelectorAll('[data-testid="ka-steam"]')].filter(
          (el) => !upright || el.dataset.pot === "0",
        );
        return wisps
          .filter((el) => {
            const x = stage.left + (Number(el.dataset.ax) / 100) * stage.width;
            const y = stage.top + (Number(el.dataset.ay) / 100) * stage.height;
            const hit = document.elementFromPoint(x, y);
            if (!hit || hit.closest("button")) return true;
            // anything that PAINTS there hides the lid (a card, the day strip). A bare layout box does not (the button column's own empty box), nor does a wash over the whole
            // screen; the walk stops at the screen itself (the first box that also holds the painting)
            const painting = document.querySelector('[data-testid="kitchen-bg-box"]');
            for (
              let e = hit;
              e && !e.contains(painting) && !painting.contains(e);
              e = e.parentElement
            ) {
              const css = getComputedStyle(e);
              const paints =
                css.backgroundColor !== "rgba(0, 0, 0, 0)" ||
                css.backgroundImage !== "none" ||
                parseFloat(css.borderTopWidth) > 0;
              const r = e.getBoundingClientRect();
              if (paints && !(r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.8))
                return true;
            }
            return false;
          })
          .map((el) => `pot ${el.dataset.pot} ${el.dataset.from}`);
      }, h > w);
      if (under.length) covered.push({ skin, under: [...new Set(under)] });
    }
    const smallest = await page.evaluate(() =>
      Math.min(
        ...[...document.querySelectorAll("button")]
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.left > innerWidth - 90)
          .flatMap((r) => [r.width, r.height]),
      ),
    );
    check(
      `K7 at ${w} x ${h}: the buttons on the right are at least 48 px`,
      smallest >= 47.5,
      smallest,
    );
    check(
      `K7 at ${w} x ${h}: ${h > w ? "the main pot's lid, top and sides, is clear of the buttons" : "every lid is clear of the buttons and the day strip"}`,
      covered.length === 0,
      covered,
    );
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
