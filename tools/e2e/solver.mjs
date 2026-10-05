// Plays whatever Preparation step is on screen, like a player: taps across the ingredient for cut
// techniques, vertical strokes for peel, and drags the finished ingredient onto the plate/bowl.
import { sleep } from "./harness.mjs";

export const CX = 215,
  CY = 452,
  HALF_W = 62;
const PLATE = { x: 112, y: 616 };

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
 * Plays the current recipe to its Knife Report. Returns a log of what it did.
 * `until` (a page predicate) stops early once true — e.g. when the cooking clip appears.
 */
export async function playToReport(page, { tapInterval = 140, maxMs = 90000, until } = {}) {
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
        const y = CY + rows[peelIdx++ % rows.length];
        // start ON the ingredient (a peel only begins from a press on it), sweep out to each side
        await stroke(page, CX, y, CX - 115, y, 14);
        await stroke(page, CX, y, CX + 115, y, 14);
        await sleep(250);
        stuck = Math.min(stuck, 20);
        // a finished peel in a multi-step recipe waits for the plate drag (its counter stays "0/1")
        if (peelIdx >= 6 && peelIdx % 3 === 0) {
          await sleep(700);
          await stroke(page, CX, CY, PLATE.x, PLATE.y, 18);
          await sleep(1500);
        }
      } else {
        const x = CX - HALF_W + ((s.n + 0.5) / s.m) * 2 * HALF_W;
        await tap(page, x, CY);
        await sleep(tapInterval);
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
