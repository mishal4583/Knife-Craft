// Beginner coaching in the built game (src/game/coaching.ts, scenes/coachGhost.ts):
//   1. a brand-new player (intro skipped) gets Level 1's "How to slice" card and the ghost
//      demonstration at once;
//   2. tapping exactly where the ghost fingertip taps makes a real cut, and the card goes away;
//   3. left idle, the demonstration comes back (taught step: after ~4 s), and swiping along
//      the demonstrated line (the SWIPE half of the loop) also makes a real cut;
//   4. Level 1 still plays through to the Knife Report with coaching on;
//   5. Level 5 teaches each step as it comes: "How to peel", then "How to halve";
//   6. a later level (Level 12) shows nothing at first, only after ~8 s without input.
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
 * The ghost fingertip: a compact, round blob of near-white pixels on the board (CSS px).
 * White pixels are grouped into connected blobs (on a 4-px grid); the real resting knife's
 * shine and the ghost knife's long thin edge are other blobs, so only a small blob about as
 * wide as it is tall counts.
 */
async function findFingertip(page) {
  const dpr = await page.evaluate(() => devicePixelRatio);
  const C = 4; // grid cell, device px
  for (let i = 0; i < 40; i++) {
    const { w, h, bpp, px } = decodePng(Buffer.from(await page.screenshot({ type: "png" })));
    const top = Math.floor(h * 0.36),
      bottom = Math.floor(h * 0.66);
    const gw = Math.ceil(w / C),
      gh = Math.ceil((bottom - top) / C);
    const cell = new Int32Array(gw * gh);
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * bpp;
        if (px[k] > 238 && px[k + 1] > 238 && px[k + 2] > 238) {
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
      if (n > 40 && bw < 50 && bh < 50 && bw > 0.6 * bh && bh > 0.6 * bw) {
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
await sleep(5200);
check("3a left idle, the demonstration comes back", /HOW TO SLICE/i.test((await card(page)) ?? ""));
// SWIPE, the other way the ghost shows: drag along the (vertical) line through the fingertip.
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
  "3b swiping along the demonstrated line also makes a real cut",
  !!tip2 && afterSwipe.n === (beforeSwipe.n ?? 0) + 1,
  { tip2, before: beforeSwipe.n, after: afterSwipe.n },
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

// ---------- 6: a later level only after idling ----------
await boot(page, at(12));
await clickButton(page, /Prepare$/);
await sleep(3000);
check("6a Level 12: no card at first (nothing new to learn)", (await card(page)) === null);
await page
  .waitForFunction(() => !!document.querySelector('[data-testid="coach-card"]'), {
    timeout: 9000,
  })
  .catch(() => {});
check(
  "6b after ~8 s without input the demonstration appears",
  (await card(page)) !== null,
  await card(page),
);

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("coach-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nCOACH E2E: ALL PASS" : `\nCOACH E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
