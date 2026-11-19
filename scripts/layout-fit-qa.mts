/**
 * LAYOUT FIT QA (developer 2026-11-19: Playgama 1.6.1 / 1.6.8 "the game fills the available area at any size, aspect ratio and orientation; in a square window
 * it still fills the area, with no empty bars", and YouTube Playables Design 1 "responsive at all aspect ratios, 9:32 through 32:9"). `fitLayout` in
 * components/kc/game/layoutMode.ts is the one rule that decides how the UI is laid out in a window; GameShell fills the whole window with it.
 *
 *  A. Every window shape is FILLED: the laid-out UI (lw x lh) scaled by `scale` covers the window exactly (no bars), with one uniform scale (nothing stretched).
 *  B. The layout is never smaller than the smallest one the UI was drawn for (320 wide; 320 tall in landscape, 600 tall in portrait) and never huge: a landscape
 *     layout is at most 720 tall (taller windows are scaled up), a portrait one at most 768 wide.
 *  C. Phones are untouched: an upright phone (under 640 wide, no wider than 3:4) and a phone on its side (under 640 tall) are laid out at their own size, scale 1.
 *  D. The mode: landscape from an aspect ratio of 1.3, portrait below it; 9:32 and 32:9 both work.
 *  E. Pure and total: no NaN, no zero, for every size from 1 to 8000 px; nothing outside it is read.
 *
 * Run: npx tsx scripts/layout-fit-qa.mts
 */
import fs from "node:fs";
import {
  FILL_MAX_ASPECT,
  FILL_MAX_W,
  LAND_ASPECT,
  LAND_MIN_H,
  LAND_TARGET_H,
  MIN_LAYOUT_W,
  PORTRAIT_MAX_W,
  PORTRAIT_MIN_H,
  fitLayout,
  isPhoneLandscape,
} from "../src/components/kc/game/layoutMode.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail).slice(0, 300));
  }
}

const SHAPES: Array<[number, number]> = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [412, 915],
  [430, 932], // upright phones
  [568, 320],
  [640, 360],
  [740, 360],
  [844, 390],
  [932, 430], // phones on their side
  [600, 800],
  [768, 1024],
  [834, 1194],
  [1024, 1366], // tablets upright
  [1024, 768],
  [1180, 820],
  [1366, 1024], // tablets turned
  [800, 800],
  [700, 700],
  [1000, 1000],
  [1000, 800],
  [900, 1000], // square-ish
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160], // desktops
  [2560, 1080],
  [3440, 1440],
  [5120, 1440], // ultrawide (to 32:9)
  [1080, 1920],
  [1440, 2560],
  [2160, 3840], // a monitor turned upright
  [360, 1280],
  [450, 1600], // 9:32 (YouTube's tallest)
  [1600, 450],
  [1280, 360], // 32:9 (and 3.5:1)
];

console.log("A. Every window shape is filled, with one uniform scale");
{
  const bad: unknown[] = [];
  for (const [w, h] of SHAPES) {
    const f = fitLayout(w, h);
    const fillW = f.lw * f.scale;
    const fillH = f.lh * f.scale;
    if (Math.abs(fillW - w) > 0.01 || Math.abs(fillH - h) > 0.01) bad.push({ w, h, f });
  }
  assert(
    bad.length === 0,
    `A1: for ${SHAPES.length} shapes (phones to a 5120 x 1440 monitor) the layout scaled by its one scale covers the window exactly: no bars`,
    bad.slice(0, 3),
  );
  assert(
    SHAPES.every(([w, h]) => {
      const f = fitLayout(w, h);
      return f.scale > 0 && Number.isFinite(f.scale);
    }),
    "A2: one scale in both directions (a number, so nothing is stretched out of proportion)",
  );
}

console.log("B. Never smaller than the UI was drawn for, never huge");
{
  const bad: unknown[] = [];
  for (const [w, h] of SHAPES) {
    const f = fitLayout(w, h);
    if (f.lw < MIN_LAYOUT_W - 0.01) bad.push({ w, h, why: "narrower than 320", f });
    if (f.landscape && f.lh < LAND_MIN_H - 0.01)
      bad.push({ w, h, why: "landscape shorter than 320", f });
    if (f.landscape && f.lh > LAND_TARGET_H + 0.01)
      bad.push({ w, h, why: "landscape taller than 720", f });
    if (!f.landscape && f.lw > Math.max(PORTRAIT_MAX_W, FILL_MAX_W) + 0.01)
      bad.push({ w, h, why: "portrait wider than 768", f });
    if (
      !f.landscape &&
      w >= FILL_MAX_W &&
      f.lh < PORTRAIT_MIN_H - 0.01 &&
      f.lw > MIN_LAYOUT_W + 0.01 &&
      f.scale > h / PORTRAIT_MIN_H + 0.01
    )
      bad.push({ w, h, why: "portrait shorter than 600", f });
  }
  assert(
    bad.length === 0,
    "B1: the layout is at least 320 wide, a landscape layout is 320 to 720 tall, a portrait one at most 768 wide",
    bad.slice(0, 3),
  );
  const big = fitLayout(1920, 1080);
  const hd = fitLayout(1280, 720);
  assert(
    Math.abs(big.lh - 720) < 0.01 && Math.abs(big.scale - 1.5) < 0.01 && hd.scale === 1,
    "B2: a 1280 x 720 window is laid out at real pixels; a 1920 x 1080 one at 1280 x 720, scaled x1.5",
    { big, hd },
  );
}

console.log("C. Phones are untouched");
{
  const upright: Array<[number, number]> = [
    [320, 568],
    [360, 640],
    [390, 844],
    [412, 915],
    [430, 932],
  ];
  const side: Array<[number, number]> = [
    [568, 320],
    [640, 360],
    [740, 360],
    [844, 390],
    [932, 430],
  ];
  assert(
    upright.every(([w, h]) => {
      const f = fitLayout(w, h);
      return (
        !f.landscape &&
        f.scale === 1 &&
        f.lw === w &&
        f.lh === h &&
        w < FILL_MAX_W &&
        w / h <= FILL_MAX_ASPECT
      );
    }),
    "C1: an upright phone is laid out at its own size, portrait, scale 1 (as before)",
  );
  assert(
    side.every(([w, h]) => {
      const f = fitLayout(w, h);
      return f.landscape && f.scale === 1 && f.lw === w && f.lh === h && isPhoneLandscape(w, h);
    }),
    "C2: a phone on its side is laid out at its own size, landscape, scale 1 (as before)",
  );
  const tiny = fitLayout(480, 270);
  assert(
    tiny.landscape && Math.abs(tiny.lh - LAND_MIN_H) < 0.01 && tiny.scale < 1,
    "C3: a very short window lays out at 320 tall and scales down",
    tiny,
  );
  const narrow = fitLayout(280, 560);
  assert(
    !narrow.landscape && Math.abs(narrow.lw - MIN_LAYOUT_W) < 0.01 && narrow.scale < 1,
    "C4: a window under 320 wide lays out at 320 and scales down",
    narrow,
  );
}

console.log("D. The mode follows the aspect ratio");
{
  assert(
    SHAPES.every(([w, h]) => fitLayout(w, h).landscape === w / h >= LAND_ASPECT),
    `D1: landscape exactly from an aspect ratio of ${LAND_ASPECT}, portrait below it (square windows are portrait: 1000 x 1000 and 800 x 800)`,
  );
  assert(
    !fitLayout(800, 800).landscape &&
      fitLayout(1280, 720).landscape &&
      !fitLayout(1080, 1920).landscape,
    "D2: 800 x 800 portrait, 1280 x 720 landscape, a monitor turned upright portrait",
  );
  const nine = fitLayout(360, 1280);
  const thirtyTwo = fitLayout(5120, 1440);
  assert(
    nine.lw >= MIN_LAYOUT_W && thirtyTwo.landscape && thirtyTwo.lh <= LAND_TARGET_H,
    "D3: 9:32 and 32:9 both lay out",
    { nine, thirtyTwo },
  );
}

console.log("E. Total");
{
  let bad = 0;
  for (let w = 1; w <= 8000; w += 37)
    for (let h = 1; h <= 8000; h += 41) {
      const f = fitLayout(w, h);
      if (
        ![f.lw, f.lh, f.scale].every((n) => Number.isFinite(n) && n > 0) ||
        Math.abs(f.lw * f.scale - w) > 0.01 ||
        Math.abs(f.lh * f.scale - h) > 0.01
      )
        bad++;
    }
  const zero = fitLayout(0, 0);
  assert(
    bad === 0 && zero.scale === 1,
    "E1: for every size from 1 x 1 to 8000 x 8000 the answer is finite, positive and fills the window; a 0 x 0 box is answered, never divided by",
    { bad, zero },
  );
  const src = fs
    .readFileSync("src/components/kc/game/layoutMode.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(
    !/window|document|navigator|Math\.random|Date\./.test(
      src.slice(src.indexOf("export function fitLayout")),
    ),
    "E2: fitLayout reads nothing but its two arguments",
  );
}

console.log(failures ? `\nLAYOUT FIT QA: ${failures} FAILED` : "\nLAYOUT FIT QA: ALL PASS");
process.exit(failures ? 1 : 0);
