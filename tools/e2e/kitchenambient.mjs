// The Kitchen's life (developer 2026-11-26, from his Gemini clip), restaurant build, all six kitchen stages in a phone and a wide window:
//   K1 every stage draws its layer (steam, the beam, the stage's own lamps and glints) and it MOVES (the steam film shows other frames a second and a half later)
//   K2 the layer sits on the painting: the stage box is the picture's own `object-cover` rectangle (the pot's pixel is where the painting has its pot, whatever the window)
//   K3 Settings -> Reduced motion hides it (the page's `kc-reduced-motion` class)
//   K5 RULE CHANGE (developer 2026-11-27, a reference picture: "make it exactly like this"; the wisps became a steam film): every pot has its film, and the browser draws
//      the film's lid line on the pot's rim
//   K6 the film picture itself: nothing hangs below the lid line, steam lies along the whole lid, it fades out before the top, every frame moves on and the loop has no jump
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
            frames: steam.map((s) => {
              const css = getComputedStyle(s.querySelector(".ka-film"));
              return `${css.backgroundPositionX} ${css.backgroundPositionY}`;
            }),
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
      const moved = a.frames.length > 0 && a.frames.every((f, i) => f !== b.frames[i]);
      check(
        `K1 ${skin} ${layout}: steam, beam, ${lamps} lamps, glints, and it moves`,
        a.skin === skin &&
          a.layout === layout &&
          // (one film a pot, counted by K5; a painting may have a single pot)
          a.steam >= 1 &&
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
  // K5: where the browser really puts each film's lid line
  for (const [id, skin] of STAGES) {
    for (const [layout, w, h] of layouts) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await boot(page, save(id));
      await sleep(1800);
      const films = await page.evaluate(() => {
        const layer = document.querySelector('[data-testid="kitchen-ambient"]');
        const burners = layer.querySelectorAll('[data-testid="ka-burner"]').length;
        const list = [...layer.querySelectorAll('[data-testid="ka-steam"]')].map((el) => {
          const m = new DOMMatrix(getComputedStyle(el).transform);
          // the film's lid line: 0.5 across, 0.91 down (STEAM_PLUME)
          const x = el.offsetLeft + m.e + 0.5 * el.offsetWidth;
          const y = el.offsetTop + m.f + 0.91 * el.offsetHeight;
          return {
            off: Math.hypot(
              x - (Number(el.dataset.ax) / 100) * layer.offsetWidth,
              y - (Number(el.dataset.ay) / 100) * layer.offsetHeight,
            ),
            lid: (0.56 * el.offsetWidth) / ((Number(el.dataset.lid) / 100) * layer.offsetWidth),
            playing: [...el.querySelectorAll(".ka-film")].map((f) => f.getAnimations().length),
          };
        });
        return { burners, list };
      });
      const worst = Math.max(...films.list.map((f) => f.off));
      check(
        `K5 ${skin} ${layout}: every pot has its steam film, its lid line on the pot's rim and as wide as the lid`,
        films.list.length === films.burners &&
          worst <= 2 &&
          films.list.every((f) => Math.abs(f.lid - 1) < 0.03 && f.playing.join() === "3,3"),
        { pots: films.list.length, worstPx: +worst.toFixed(2) },
      );
    }
  }
  // K6: the film picture (10 x 6 frames, the lid line at 0.91, the lid 0.56 of a frame wide)
  const film = await page.evaluate(async () => {
    const img = new Image();
    img.src = `${location.pathname.replace(/[^/]*$/, "")}kitchen-fx/plume.webp`;
    await img.decode();
    const [cols, rows] = [10, 6];
    const w = img.width / cols;
    const h = img.height / rows;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    const frames = [];
    for (let i = 0; i < cols * rows; i++) {
      g.clearRect(0, 0, w, h);
      g.drawImage(img, (i % cols) * w, Math.floor(i / cols) * h, w, h, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      frames.push(Uint8Array.from({ length: w * h }, (_, p) => d[p * 4 + 3]));
    }
    const rowMax = (f, from, to, x0 = 0, x1 = w) => {
      let m = 0;
      for (let y = Math.floor(from * h); y < Math.ceil(to * h); y++)
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) m = Math.max(m, f[y * w + x]);
      return m;
    };
    const lidLeft = (0.5 - 0.28) * w;
    const third = (0.56 * w) / 3;
    const change = (a, b) => a.reduce((sum, v, p) => sum + Math.abs(v - b[p]), 0) / a.length;
    const steps = frames.map((f, i) => change(f, frames[(i + 1) % frames.length]));
    const mean = steps.reduce((a, b) => a + b) / steps.length;
    return {
      below: Math.max(...frames.map((f) => rowMax(f, 0.975, 1))),
      top: Math.max(...frames.map((f) => rowMax(f, 0, 0.012))),
      // steam over each third of the lid, just above its line, in every frame
      thinnest: Math.min(
        ...frames.flatMap((f) =>
          [0, 1, 2].map((k) =>
            rowMax(f, 0.8, 0.91, lidLeft + k * third, lidLeft + (k + 1) * third),
          ),
        ),
      ),
      still: Math.min(...steps),
      mean,
      seam: steps[steps.length - 1],
    };
  });
  check(
    "K6 the steam film: nothing below the lid line, steam along the whole lid, gone before the top, every frame moves on, and the loop has no jump",
    film.below <= 12 &&
      film.top <= 12 &&
      film.thinnest >= 60 &&
      film.still > film.mean * 0.2 &&
      film.seam < film.mean * 1.8,
    film,
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
        const points = wisps.flatMap((el) => {
          const { ax, ay, lid, top } = el.dataset;
          const sides =
            el.dataset.open === undefined
              ? [
                  [Number(ax) - 0.47 * Number(lid), ay, "left"],
                  [Number(ax) + 0.47 * Number(lid), ay, "right"],
                ]
              : [];
          return [[ax, top, "top"], ...sides].map(([px, py, from]) => ({
            pot: el.dataset.pot,
            px: Number(px),
            py: Number(py),
            from,
          }));
        });
        return points
          .filter((point) => {
            const x = stage.left + (point.px / 100) * stage.width;
            const y = stage.top + (point.py / 100) * stage.height;
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
          .map((point) => `pot ${point.pot} ${point.from}`);
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
