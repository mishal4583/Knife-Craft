// Beginner coaching in the built game (src/game/coaching.ts, scenes/coachGhost.ts):
//   1. a brand-new player (intro skipped) gets Level 1's "How to slice" card and the ghost
//      demonstration at once;
//   2. tapping exactly where the ghost fingertip taps makes a real cut, and the card goes away;
//   3. once the player has cut, it stays away even when they pause (only shown when needed);
//   4. Level 1 still plays through to the Knife Report with coaching on;
//   5. Level 5 teaches each step as it comes: "How to peel", then "How to halve";
//   6. a later level (Level 12) never shows it, even after a long pause;
//   7. a replayed beginner level (Level 4, already completed) shows no coaching or hint;
//   8. a stuck player (touched, but no progress) gets it back; on Level 3 (chop) swiping along
//      the demonstrated line (the SWIPE half of the loop) also makes a real cut. (Was Level 2:
//      developer 2026-10-10 "don't let the same instructions repeat" — a technique is taught
//      only in the level that introduces it, so Level 2's slice isn't taught again.)
//   8c. Level 2 (slice again) shows no how-to card.
// Prints PASS/FAIL per check and exits 1 on any failure.
import zlib from "node:zlib";
import { launch, boot, freshPlayer, seedSave, sleep, clickButton, shot, save } from "./harness.mjs";
import { playToReport, stepInfo, CX, CY } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const card = (page) =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="coach-card"]')?.innerText.replace(/\s+/g, " ") ?? null,
  );
const at = (n) =>
  seedSave({
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  });

/** Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced) — enough for a puppeteer screenshot. */
function decodePng(buf) {
  let pos = 8;
  let w = 0,
    h = 0,
    ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
    } else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * bpp);
  const stride = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let p = 0;
      if (f === 1) p = a;
      else if (f === 2) p = b;
      else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c),
          pb = Math.abs(a - c),
          pc = Math.abs(a + b - 2 * c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = (v + p) & 255;
    }
  }
  return { w, h, bpp, px: out };
}

/**
 * The ghost fingertip: a compact, round blob of near-white pixels on the food (CSS px),
 * searched in the band where the food sits (38–60% of the height): the ghost knife's
 * handle now hangs below the food on a vertical cut line.
 * Long straight white runs (over 30 CSS px in a row or column) are cleared first. That
 * removes the ghost knife's edge, which lies on the cut line right through the
 * fingertip, but keeps the fingertip's ring. The rest is grouped into connected blobs
 * (on a 4-px grid). Only a small blob about as wide as it is tall, and ring-like (under
 * 45% of its box white), counts: the fingertip is a thin white ring round a see-through
 * pad, while the real knife's shine and the ghost knife's solid bolster are other blobs.
 */
async function findFingertip(page) {
  const dpr = await page.evaluate(() => devicePixelRatio);
  const C = 4; // grid cell, device px
  for (let i = 0; i < 40; i++) {
    const { w, h, bpp, px } = decodePng(Buffer.from(await page.screenshot({ type: "png" })));
    const top = Math.floor(h * 0.38),
      bottom = Math.floor(h * 0.6);
    const gw = Math.ceil(w / C),
      gh = Math.ceil((bottom - top) / C);
    const white = new Uint8Array(w * h);
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * bpp;
        white[y * w + x] = px[k] > 238 && px[k + 1] > 238 && px[k + 2] > 238 ? 1 : 0;
      }
    }
    const RUN = 30 * dpr;
    const keep = white.slice();
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < w;) {
        if (!white[y * w + x]) {
          x++;
          continue;
        }
        let e = x;
        while (e < w && white[y * w + e]) e++;
        if (e - x > RUN) for (let i = x; i < e; i++) keep[y * w + i] = 0;
        x = e;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = top; y < bottom;) {
        if (!white[y * w + x]) {
          y++;
          continue;
        }
        let e = y;
        while (e < bottom && white[e * w + x]) e++;
        if (e - y > RUN) for (let i = y; i < e; i++) keep[i * w + x] = 0;
        y = e;
      }
    }
    const cell = new Int32Array(gw * gh);
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < w; x++) {
        if (keep[y * w + x]) {
          cell[Math.floor((y - top) / C) * gw + Math.floor(x / C)]++;
        }
      }
    }
    const seen = new Uint8Array(gw * gh);
    for (let start = 0; start < cell.length; start++) {
      if (!cell[start] || seen[start]) continue;
      const stack = [start];
      seen[start] = 1;
      let n = 0,
        sx = 0,
        sy = 0,
        x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      while (stack.length) {
        const c = stack.pop();
        const cx = c % gw,
          cy = (c - cx) / gw;
        n += cell[c];
        sx += cell[c] * (cx + 0.5) * C;
        sy += cell[c] * ((cy + 0.5) * C + top);
        x0 = Math.min(x0, cx);
        x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy);
        y1 = Math.max(y1, cy);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx,
            ny = cy + dy;
          const nc = ny * gw + nx;
          if (nx >= 0 && nx < gw && ny >= 0 && ny < gh && cell[nc] && !seen[nc]) {
            seen[nc] = 1;
            stack.push(nc);
          }
        }
      }
      const bw = ((x1 - x0 + 1) * C) / dpr,
        bh = ((y1 - y0 + 1) * C) / dpr;
      if (
        n > 40 &&
        bw < 50 &&
        bh < 50 &&
        bw > 0.6 * bh &&
        bh > 0.6 * bw &&
        n < 0.45 * bw * bh * dpr * dpr
      ) {
        return { x: sx / n / dpr, y: sy / n / dpr, n, box: [Math.round(bw), Math.round(bh)] };
      }
    }
    await sleep(70);
  }
  return null;
}

const { browser, page, logs } = await launch();

// ---------- 1–4: a brand-new player, Level 1 ----------
await freshPlayer(page);
await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
  timeout: 30000,
});
await sleep(1200);
await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
await page.waitForFunction(() => !!document.querySelector('[data-testid="coach-card"]'), {
  timeout: 15000,
});
check(
  "1a Level 1 shows the How to slice card",
  /HOW TO SLICE/i.test((await card(page)) ?? ""),
  await card(page),
);
await shot(page, "coach-1-level1");

const before = await stepInfo(page);
const tip = await findFingertip(page);
check("2a the ghost fingertip is on the board", !!tip, tip);
if (tip) {
  await page.mouse.click(tip.x, tip.y);
  await sleep(900);
}
const afterTap = await stepInfo(page);
check("2b tapping where the ghost taps makes a real cut", afterTap.n === (before.n ?? 0) + 1, {
  before: before.n,
  after: afterTap.n,
});
check("2c the card goes away on touch", (await card(page)) === null);
await sleep(5500);
check(
  "3a after a real cut, a pause brings nothing back (the player knows how)",
  (await card(page)) === null,
);
const played = await playToReport(page, { maxMs: 90000 });
check("4a Level 1 still plays through to the Knife Report", played.ok, played.log.slice(-3));
check("4b no card on the Knife Report", (await card(page)) === null);

// ---------- 5: Level 5 teaches each step as it comes ----------
await boot(page, at(5));
await clickButton(page, /Prepare$/);
await page
  .waitForFunction(() => !!document.querySelector('[data-testid="coach-card"]'), {
    timeout: 5000,
  })
  .catch(() => {});
check(
  "5a Level 5 step 1: How to peel",
  /HOW TO PEEL/i.test((await card(page)) ?? ""),
  await card(page),
);
await shot(page, "coach-5-peel");
// Peel by hand, one stroke at a time, until step 2 (halve) starts — the solver's
// peel strokes would carry on and swipe through the halve too.
let toHalve = false;
for (let i = 0; i < 40 && !toHalve; i++) {
  const y = CY + [0, -18, 18, -36, 36, -9, 9, -27, 27, -50, 50][i % 11];
  const dir = i % 2 === 0 ? -1 : 1;
  await page.mouse.move(CX, y);
  await page.mouse.down();
  for (let k = 1; k <= 14; k++) {
    await page.mouse.move(CX + (dir * 115 * k) / 14, y);
    await sleep(12);
  }
  await page.mouse.up();
  await sleep(500);
  toHalve = await page.evaluate(() => /STEP 2 OF/.test(document.body.innerText));
}
await sleep(1500); // the player looks at the new step
check(
  "5b after peeling, the halve step teaches itself: How to halve",
  toHalve && /HOW TO HALVE/i.test((await card(page)) ?? ""),
  await card(page),
);
await shot(page, "coach-5-halve");

// ---------- 6: a later level: never ----------
await boot(page, at(12));
await clickButton(page, /Prepare$/);
await sleep(9500);
check("6a Level 12: no coaching, even after a long pause", (await card(page)) === null);

// ---------- 7: a replayed beginner level ----------
// Level 4 is already completed; the player picks it on the Order Board ("Replay").
await boot(page, at(6));
await clickButton(page, /See all orders/);
await sleep(800);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-level-row="level-4"] button')]
    .find((b) => /Replay/.test(b.textContent))
    ?.click(),
);
await sleep(6000);
const replaying = (await stepInfo(page)).ingredient !== null;
check(
  "7a replaying Level 4 (already completed): no coaching card and no gesture hint",
  replaying &&
    (await card(page)) === null &&
    !(await page.evaluate(() => /tap to cut, or swipe/.test(document.body.innerText))),
  { replaying },
);

// ---------- 8: stuck → it comes back; SWIPE also cuts ----------
await boot(page, at(3));
await clickButton(page, /Prepare$/);
await page.waitForFunction(() => !!document.querySelector('[data-testid="coach-card"]'), {
  timeout: 5000,
});
await page.mouse.click(30, 300); // a touch off the food: no progress
await sleep(400);
const hidden = (await card(page)) === null;
await sleep(4600);
check(
  "8a a touch that made no progress hides it; still stuck after a pause, it comes back",
  hidden && /HOW TO CHOP/i.test((await card(page)) ?? ""),
);
const beforeSwipe = await stepInfo(page);
const tip2 = await findFingertip(page);
if (tip2) {
  await page.mouse.move(tip2.x, tip2.y - 70);
  await page.mouse.down();
  for (let k = 1; k <= 16; k++) {
    await page.mouse.move(tip2.x, tip2.y - 70 + (140 * k) / 16);
    await sleep(12);
  }
  await page.mouse.up();
  await sleep(900);
}
const afterSwipe = await stepInfo(page);
check(
  "8b swiping along the demonstrated line also makes a real cut",
  !!tip2 && afterSwipe.n === (beforeSwipe.n ?? 0) + 1,
  { tip2, before: beforeSwipe.n, after: afterSwipe.n },
);

// ---------- 8c: Level 2 repeats slice — no lesson again ----------
await boot(page, at(2));
await clickButton(page, /Prepare$/);
await page.waitForFunction(() => /STEP 1 OF|0\/\d+ slice/i.test(document.body.innerText), {
  timeout: 15000,
});
await sleep(2500);
check(
  "8c Level 2 (slice, already taught on Level 1) shows no how-to card",
  (await card(page)) === null,
);

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("coach-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nCOACH E2E: ALL PASS" : `\nCOACH E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
