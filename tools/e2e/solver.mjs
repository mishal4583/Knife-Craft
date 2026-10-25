// Plays whatever Preparation step is on screen, like a player: taps across the ingredient for cut
// techniques, vertical strokes for peel, and drags the finished ingredient onto the plate/bowl.
import { sleep } from "./harness.mjs";

export const CX = 215,
  CY = 452,
  HALF_W = 62;
const PLATE = { x: 112, y: 616 };
const [CX0, CY0, HALF_W0, PLATE0] = [CX, CY, HALF_W, PLATE];

/**
 * The same aim points, read from the cutting canvas's own box (2026-10-22, phone
 * landscape): the defaults above are the 430×900 portrait layout, where the canvas is
 * 430 × 565 at y 160 — so the ingredient sits at (0.5, 0.517) of it, the cuts span
 * ±0.144 of its width and the plate is at (0.26, 0.807).
 */
export async function geometryFromCanvas(page) {
  const r = await page.evaluate(() => {
    const q = document.querySelector("[data-game-viewport] canvas")?.getBoundingClientRect();
    return q ? { x: q.left, y: q.top, w: q.width, h: q.height } : null;
  });
  if (!r) return null;
  return {
    CX: r.x + r.w * 0.5,
    CY: r.y + r.h * 0.517,
    HALF_W: r.w * 0.144,
    SPAN: r.w * 0.43,
    PLATE: { x: r.x + r.w * 0.26, y: r.y + r.h * 0.807 },
  };
}

export async function stepInfo(page) {
  return page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/([A-Za-z][A-Za-z ]*?)\s*·\s*(\d+)\/(\d+)\s+([a-z-]+)/i);
    // A peel step shows "Garlic · 34% peeled" (Level 1–10 UX pass): done at 100%.
    const p = m ? null : t.match(/([A-Za-z][A-Za-z ]*?)\s*·\s*(\d+)% peeled/i);
    if (p)
      return {
        report: /KNIFE REPORT/.test(t),
        ingredient: p[1],
        n: +p[2] >= 100 ? 1 : 0,
        m: 1,
        tech: "peel",
        step: (t.match(/STEP (\d+) OF (\d+)/) || []).slice(1).map(Number),
      };
    return {
      report: /KNIFE REPORT/.test(t),
      ingredient: m?.[1] ?? null,
      n: m ? +m[2] : null,
      m: m ? +m[3] : null,
      tech: m?.[4]?.toLowerCase() ?? null,
      step: (t.match(/STEP (\d+) OF (\d+)/) || []).slice(1).map(Number),
    };
  });
}

async function tap(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(16);
  await page.mouse.up();
}

async function stroke(page, x0, y0, x1, y1, steps = 14) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await sleep(12);
  }
  await page.mouse.up();
}

/**
 * The cleaning cloth (developer 2026-10-24: slow and satisfying, every corner — it takes many strokes):
 * wipes the board like a player, back and forth row by row, top to bottom, until the clean-up
 * card goes (true) or `maxStrokes` run out (false). Aim points are the portrait defaults unless
 * `cx`/`cy`/`k` (geometry scale) are given.
 */
export async function wipeBoard(page, { cx = CX, cy = CY, k = 1, maxStrokes = 56 } = {}) {
  const up = () => page.evaluate(() => !!document.querySelector('[data-testid="board-cleanup"]'));
  // Every corner needs the cloth (developer 2026-10-24): rows from the far edge to the near one.
  const rows = [-140, -100, -60, -20, 20, 60, 100, 125];
  for (let i = 0; i < maxStrokes; i++) {
    const y = cy + 30 * k + rows[i % rows.length] * k;
    const back = Math.floor(i / rows.length) % 2 === 1;
    const [x0, x1] = back ? [cx + 200 * k, cx - 200 * k] : [cx - 200 * k, cx + 200 * k];
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let s = 1; s <= 20; s++) {
      await page.mouse.move(x0 + ((x1 - x0) * s) / 20, y + Math.sin(s) * 5 * k);
      await sleep(16);
    }
    await page.mouse.up();
    if (!(await up())) return true;
  }
  await sleep(1200);
  return !(await up());
}

/**
 * Plays the current recipe to its Knife Report. Returns a log of what it did.
 * `until` (a page predicate) stops early once true — e.g. when the cooking clip appears.
 */
/**
 * Options added 2026-10-21 (Phase 2), both opt-in, so every existing caller plays exactly as
 * before: `aim(page, stepInfo)` may return the point to tap for the next cut (a test that wants
 * cuts ON the real guides, not this file's generic tomato-sized spacing), or null for the
 * default; `steady` taps exactly that many ms apart (an even rhythm, whatever the page latency).
 */
export async function playToReport(
  page,
  { tapInterval = 140, maxMs = 90000, until, aim, steady, geom } = {},
) {
  // `geom` (geometryFromCanvas) replaces the portrait aim points; without it, as before.
  const { CX, CY, HALF_W, PLATE, SPAN } = geom ?? {
    CX: CX0,
    CY: CY0,
    HALF_W: HALF_W0,
    PLATE: PLATE0,
    SPAN: 190,
  };
  const k = SPAN / 190;
  let lastTap = 0;
  const log = [];
  const t0 = Date.now();
  let lastKey = "",
    stuck = 0,
    peelIdx = 0;
  const stop = async () => !!until && (await page.evaluate(until));
  while (Date.now() - t0 < maxMs) {
    if (await stop()) {
      log.push("stopped");
      return { ok: true, log, stopped: true };
    }
    // Phase B (2026-10-25, restaurant build): a service order opens on its
    // customer walking in; a player taps to start cooking.
    if (
      await page.evaluate(
        () => !!document.querySelector('[data-testid="service-floor"][data-mode="arrive"]'),
      )
    ) {
      log.push("floor");
      await page.evaluate(() => document.querySelector('[data-testid="service-floor"]')?.click());
      await sleep(300);
      continue;
    }
    // Phase 2 (2026-10-21; the cloth since 2026-10-24): a messy board offers the
    // cloth at the start of an order and takes the board until it is
    // wiped — wipe it like a player, row by row, every corner (no Skip since 2026-10-24).
    if (await page.evaluate(() => !!document.querySelector('[data-testid="board-cleanup"]'))) {
      log.push("wipe");
      await wipeBoard(page, { cx: CX, cy: CY, k });
      await sleep(1100);
      continue;
    }
    // Phase 3 (2026-10-21): a Vegetable Avalanche (Kitchen Chaos) holds the
    // board until it is cleared or skipped — sweep it like a player, and skip
    // whatever a few sweeps miss.
    if (await page.evaluate(() => !!document.querySelector('[data-testid="avalanche"]'))) {
      const sweeps = log.filter((l) => l === "avalanche").length;
      log.push("avalanche");
      if (sweeps >= 6) await page.click('[data-testid="avalanche-skip"]').catch(() => null);
      else {
        const dy = [-60, 0, 60, -30, 30, -90][sweeps] * k;
        await stroke(page, CX - SPAN, CY + dy, CX + SPAN, CY + dy, 22);
      }
      await sleep(600);
      continue;
    }
    const s = await stepInfo(page);
    if (s.report) {
      log.push("report");
      return { ok: true, log };
    }
    const key = `${s.ingredient}|${s.n}|${s.m}|${s.tech}|${s.step}`;
    stuck = key === lastKey ? stuck + 1 : 0;
    if (key !== lastKey) log.push(key);
    lastKey = key;
    if (s.n !== null && s.n < s.m) {
      if (s.tech === "peel") {
        // horizontal full-width strokes at staggered heights (a peel's counter only changes when the step ends)
        const rows = [0, -18, 18, -36, 36, -9, 9, -27, 27, -50, 50, -60, 60];
        const y = CY + rows[peelIdx++ % rows.length] * k;
        // start ON the ingredient (a peel only begins from a press on it), sweep out to each side
        await stroke(page, CX, y, CX - 115 * k, y, 14);
        await stroke(page, CX, y, CX + 115 * k, y, 14);
        await sleep(250);
        stuck = Math.min(stuck, 20);
        // a finished peel in a multi-step recipe waits for the plate drag (its counter stays "0/1")
        if (peelIdx >= 6 && peelIdx % 3 === 0) {
          await sleep(700);
          await stroke(page, CX, CY, PLATE.x, PLATE.y, 18);
          await sleep(1500);
        }
      } else {
        const aimed = aim ? await aim(page, s) : null;
        const x = aimed ? aimed.x : CX - HALF_W + ((s.n + 0.5) / s.m) * 2 * HALF_W;
        const y = aimed ? aimed.y : CY;
        if (steady) {
          const wait = lastTap + steady - Date.now();
          if (wait > 0) await sleep(wait);
        }
        await tap(page, x, y);
        lastTap = Date.now();
        await sleep(steady ? 0 : tapInterval);
      }
    } else {
      // step complete: wait for the plate to appear, then drag the prepared ingredient onto it
      await sleep(900);
      const again = await stepInfo(page);
      if (again.report || (await stop())) continue;
      if (`${again.ingredient}|${again.n}|${again.m}|${again.tech}|${again.step}` === key) {
        await stroke(page, CX, CY, PLATE.x, PLATE.y, 18);
        await sleep(1500);
      }
    }
    if (stuck > 60) {
      log.push("STUCK at " + key);
      return { ok: false, log };
    }
  }
  log.push("TIMEOUT");
  return { ok: false, log };
}
