/**
 * KITCHEN AMBIENT QA (developer 2026-11-26: "add some animations like in this video to all the 6 kitchen home screens").
 *
 *  A  the anchor data: every stage, tall and wide, has its pots, glints, window and origin inside the picture; lamps appear from Stage 4
 *     and (developer 2026-11-27: "the steam is not coming from side of the lid or on top") each pot is a measured LID, and its steam starts on it. RULE CHANGE (developer
 *     2026-11-27, a reference picture of soft billowing steam: "make it exactly like this"): the ribbon wisps gave way to a simulated, looping steam film per pot, poured off
 *     the whole lid, rim to rim
 *  B  `coverRect` follows `object-fit: cover` exactly (so a point of the picture stays on the same pixel of the painting in any window)
 *  C  the animation is light: only transform and opacity move, no filter / blur / shadow animated, no picture, no network
 *  D  the wiring: only the Kitchen home turns it on; Reduced motion (the page class and the system setting) switches it off
 *
 * Run: npx tsx scripts/kitchen-ambient-qa.mts
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  KITCHEN_AMBIENT_SKINS,
  SHORT_WIDE_BOX,
  STEAM_PLUME,
  ambientAlignX,
  ambientAlignY,
  ambientPictureSize,
  coverRect,
  kitchenAmbientFor,
  steamPlume,
  type AmbientLayout,
} from "../src/game/kitchen/kitchenAmbient.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const LAYOUTS: AmbientLayout[] = ["tall", "wide"];
const inside = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100;

console.log("A. The anchor data");
{
  assert(KITCHEN_AMBIENT_SKINS.length === 6, "A1: six kitchen stages");
  const bad: string[] = [];
  for (const skin of KITCHEN_AMBIENT_SKINS)
    for (const layout of LAYOUTS) {
      const s = kitchenAmbientFor(skin, layout);
      const w = s.window;
      const ok =
        s.pots.length >= 1 &&
        s.pots.every((p) => inside(p) && p.y > 35 && p.y < 70) &&
        s.glints.length >= 2 &&
        s.glints.every(inside) &&
        s.lamps.every((l) => inside(l) && l.r > 0 && l.r <= 20) &&
        inside(s.origin) &&
        w.x >= 0 &&
        w.y >= 0 &&
        w.w > 0 &&
        w.h > 0 &&
        w.x + w.w <= 100 &&
        w.y + w.h <= 100;
      if (!ok) bad.push(`${skin} ${layout}`);
    }
  assert(
    bad.length === 0,
    "A2: every stage, tall and wide, has pots on the stove, glints, a window and an origin inside the picture",
    bad,
  );
  const noLamps = KITCHEN_AMBIENT_SKINS.slice(0, 3).every((s) =>
    LAYOUTS.every((l) => kitchenAmbientFor(s, l).lamps.length === 0),
  );
  const lamps = KITCHEN_AMBIENT_SKINS.slice(3).every((s) =>
    LAYOUTS.every((l) => kitchenAmbientFor(s, l).lamps.length >= 2),
  );
  assert(
    noLamps && lamps,
    "A3: the first three kitchens have no lamps in the painting, Stage 4 and up have at least two",
  );
  assert(
    ambientPictureSize("wide").w === 1920 &&
      ambientPictureSize("wide").h === 1080 &&
      ambientPictureSize("tall").w === 1080 &&
      ambientPictureSize("tall").h === 1920,
    "A4: the pictures are 1920 x 1080 (wide) and 1080 x 1920 (tall)",
  );
  const pots = KITCHEN_AMBIENT_SKINS.flatMap((skin) =>
    LAYOUTS.flatMap((layout) =>
      kitchenAmbientFor(skin, layout).pots.map((pot, i) => ({
        pot,
        i,
        at: `${skin} ${layout} ${i}`,
      })),
    ),
  );
  // a measured lid: its top above the line where it sits on the pot, the pot's foot below that; as wide as a pot is in that painting
  const odd = pots.filter(
    ({ pot }) =>
      !(
        (pot.open ? pot.top === pot.y : pot.top < pot.y && pot.y - pot.top <= 1.5) &&
        pot.base - pot.y >= 1.5 &&
        pot.base - pot.y <= 9 &&
        pot.w >= 3.5 &&
        pot.w <= 15
      ),
  );
  assert(
    odd.length === 0,
    "A5: every pot is a measured lid (top, the line it sits on, width) over the pot's foot",
    odd.map((o) => o.at),
  );
  const wrong: string[] = [];
  const frame = STEAM_PLUME.seconds / (STEAM_PLUME.cols * STEAM_PLUME.rows);
  for (const { pot, i, at } of pots) {
    const plume = steamPlume(pot, i);
    // the film's lid line on the pot's rim, the film's lid as wide as the pot's own lid
    const onRim = plume.x === pot.x && plume.y === pot.y;
    const sized = Math.abs(plume.width * STEAM_PLUME.lidW - pot.w) < 0.01;
    // never hidden, never solid; each starts a whole number of frames into the loop
    const frames = plume.offset / frame;
    const calm = plume.strength >= 0.6 && plume.strength <= 1 && plume.offset >= 0;
    if (!(onRim && sized && calm && Math.abs(frames - Math.round(frames)) < 1e-9)) wrong.push(at);
  }
  assert(
    wrong.length === 0,
    "A6: every lid has its steam: the film's lid line on the pot's rim, sized by the lid",
    wrong,
  );
  const together = KITCHEN_AMBIENT_SKINS.flatMap((skin) =>
    (["tall", "wide"] as const).filter((layout) => {
      const offsets = kitchenAmbientFor(skin, layout).pots.map((p, i) => steamPlume(p, i).offset);
      return new Set(offsets).size !== offsets.length;
    }),
  );
  assert(together.length === 0, "A6b: no two pots of one stove puff together", together);
  assert(
    pots.filter((p) => p.pot.open).length === 1 &&
      kitchenAmbientFor("skin-05", "wide").pots[1]?.open === true,
    "A7: the one open pan is the Flourishing Café's, in its wide painting",
  );
}

console.log("B. The cover rectangle");
{
  const pic = { w: 1920, h: 1080 };
  const same = coverRect({ w: 960, h: 540 }, pic);
  assert(
    same.left === 0 && same.top === 0 && same.width === 960 && same.height === 540,
    "B1: a box of the picture's own shape is filled exactly",
  );
  const tall = coverRect({ w: 390, h: 844 }, pic);
  assert(
    Math.abs(tall.height - 844) < 1e-9 &&
      tall.width > 390 &&
      Math.abs(tall.left + tall.width / 2 - 195) < 1e-9 &&
      tall.top === 0,
    "B2: a tall box crops the sides, centred",
    tall,
  );
  const flat = coverRect({ w: 1815, h: 600 }, pic);
  assert(
    Math.abs(flat.width - 1815) < 1e-9 &&
      flat.height > 600 &&
      Math.abs(flat.top + flat.height / 2 - 300) < 1e-9 &&
      flat.left === 0,
    "B3: a flat box crops the top and bottom, centred",
    flat,
  );
  let covered = true;
  for (const [w, h] of [
    [390, 844],
    [320, 568],
    [1815, 867],
    [1280, 720],
    [740, 360],
    [768, 1024],
    [3440, 1440],
  ])
    for (const p of [pic, { w: 1080, h: 1920 }]) {
      const r = coverRect({ w, h }, p);
      if (
        r.left > 1e-6 ||
        r.top > 1e-6 ||
        r.left + r.width < w - 1e-6 ||
        r.top + r.height < h - 1e-6
      )
        covered = false;
      if (Math.abs(r.width / r.height - p.w / p.h) > 1e-9) covered = false;
    }
  assert(
    covered,
    "B4: in every window shape the rectangle covers the box and keeps the picture's shape",
  );
}

{
  const right = coverRect({ w: 390, h: 844 }, { w: 1080, h: 1920 }, 1);
  const low = coverRect({ w: 768, h: 390 }, { w: 1920, h: 1080 }, 0.5, 1);
  assert(
    Math.abs(right.left + right.width - 390) < 1e-9 &&
      right.left < 0 &&
      Math.abs(low.top + low.height - 390) < 1e-9 &&
      low.top < 0,
    "B5: aligned to the right or the bottom, the rectangle still covers the box, the two edges together",
    { right, low },
  );
  assert(
    ambientAlignX("tall") === 1 &&
      ambientAlignX("wide") === 0.5 &&
      ambientAlignY("wide", 390) === 1 &&
      ambientAlignY("wide", SHORT_WIDE_BOX) === 0.5 &&
      ambientAlignY("wide", 867) === 0.5 &&
      ambientAlignY("tall", 400) === 0.5,
    "B6: an upright phone keeps the painting to the right (the stove clear of the buttons), a phone on its side to the bottom (the lids above the day strip); larger wide windows stay centred",
  );
}

console.log("C. The animation is light");
{
  const css = read("src/components/kc/kitchenAmbient.css");
  const keyframes = [...css.matchAll(/@keyframes\s+(ka-[\w-]+)\s*\{([\s\S]*?)\n\}/g)];
  assert(
    keyframes.length >= 6,
    "C1: the layer has its keyframes (push-in, beam, mote, lamp, steam, glint)",
    keyframes.map((k) => k[1]),
  );
  // RULE CHANGE (developer 2026-11-27, "make it exactly like this"): the steam film also steps its picture's position, frame by frame (8 times a second;
  // moving a huge picture by transform instead could flash blank on a phone)
  const film = new Map([
    ["ka-film-x", "background-position-x"],
    ["ka-film-y", "background-position-y"],
  ]);
  const props = new Set<string>();
  for (const k of keyframes)
    for (const m of k[2]!.matchAll(/^\s*([a-z-]+)\s*:/gm))
      if (film.get(k[1]!) !== m[1]) props.add(m[1]!);
  assert(
    [...props].every((p) => p === "opacity" || p === "transform"),
    "C2: only `transform` and `opacity` are animated (and the steam film's frame position)",
    [...props],
  );
  assert(
    !/\burl\(/.test(css) && !/@import/.test(css),
    "C3: the CSS loads nothing (no url(), no import)",
  );
  assert(!/animation[^;]*filter|blur\(/.test(css), "C4: nothing is blurred or filtered");
  const comp = read("src/components/kc/KitchenAmbient.tsx");
  // RULE CHANGE (developer 2026-11-26, "where are other animations?"): the layer now also uses the small painted FX sprites (public/fx: glint, petals and leaves), besides the painted steam wisp. (A painted burner flame and lamp glow were tried and removed the same day: pasted over the painting they read as burning pots and discs.) Still no canvas, video, request or randomness; every picture is a small local file, and each name it builds must exist (checked below).
  assert(
    /STEAM_PLUME\.file/.test(comp) &&
      /const fx = \(name: string\) => `\$\{import\.meta\.env\.BASE_URL\}fx\/\$\{name\}\.webp`/.test(
        comp,
      ) &&
      (comp.match(/\.(png|jpg|svg|mp4|webm)/g) ?? []).length === 0 &&
      !/fetch\(|new Image|<canvas|<video/.test(comp) &&
      !/Math\.random/.test(comp),
    "C5: the layer draws no canvas or video, makes no request, never re-rolls (no Math.random), and its pictures are only the steam film and the small painted FX sprites",
  );
  const fxNames = [
    "glint-1",
    "glint-2",
    ...[1, 2, 3, 4, 5, 6].map((n) => `petal-${n}`),
    "leaf-1",
    "leaf-2",
  ];
  const usedInComp = fxNames.every((n) => {
    const base = n.replace(/-\d+$/, "");
    return comp.includes(`"${n}"`) || comp.includes(base);
  });
  const fxMissing = fxNames.filter((n) => {
    const f = new URL(`../public/fx/${n}.webp`, import.meta.url);
    return !existsSync(f) || statSync(f).size > 60_000;
  });
  assert(
    usedInComp && fxMissing.length === 0,
    "C5c: every painted FX sprite the layer names exists and is under 60 KB",
    fxMissing,
  );
  // the steam film: one small see-through picture of cols x rows frames
  const plumeUrl = new URL(`../public/${STEAM_PLUME.file}`, import.meta.url);
  const bytes = existsSync(plumeUrl) ? readFileSync(plumeUrl) : Buffer.alloc(30);
  const vp8x = bytes.toString("ascii", 12, 16) === "VP8X";
  const size = vp8x ? [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)] : [0, 0];
  assert(
    vp8x &&
      (bytes[20]! & 0x10) !== 0 &&
      size[0] === STEAM_PLUME.cols * STEAM_PLUME.frameW &&
      size[1] === STEAM_PLUME.rows * STEAM_PLUME.frameH &&
      size[0]! <= 2048 &&
      size[1]! <= 2048 &&
      bytes.length <= 460 * 1024,
    `C5b: the steam film is a see-through WebP of ${STEAM_PLUME.cols} x ${STEAM_PLUME.rows} frames, at most 2048 px a side and 460 KB`,
    { size, kb: Math.round(bytes.length / 1024) },
  );
  const spans = (comp.match(/className="ka-/g) ?? []).length;
  assert(spans >= 5, "C6: it is made of a handful of small elements", spans);
}

console.log("D. The wiring");
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const upgrades = read("src/components/kc/KitchenUpgrades.tsx");
  const progress = read("src/components/kc/RestaurantProgress.tsx");
  assert(
    /<KitchenBackground skin=\{equippedUpgrade\.asset\} ambient \/>/.test(kitchen),
    "D1: the Kitchen home turns the life on",
  );
  assert(
    !/ambient/.test(upgrades) && !/<KitchenBackground[^>]*ambient/.test(progress),
    "D2: the upgrade previews and the journey thumbnails stay still",
  );
  const bg = read("src/components/kc/KitchenBackground.tsx");
  assert(
    /ambient = false/.test(bg) &&
      /if \(!live\) return picture/.test(bg) &&
      /coverRect\(vp,/.test(bg) &&
      /thumb/.test(bg),
    "D3: off by default; a thumbnail never gets it; the layer follows the picture's cover box",
  );
  const css = read("src/components/kc/kitchenAmbient.css");
  assert(
    /\.kc-reduced-motion \.kitchen-ambient\s*\{\s*display:\s*none/.test(css) &&
      /\.kc-reduced-motion \.ka-stage\s*\{\s*animation:\s*none/.test(css) &&
      /@media \(prefers-reduced-motion: reduce\)/.test(css),
    "D4: Settings -> Reduced motion and the system's setting hide the layer and stop the push-in",
  );
  const layer = read("src/components/kc/KitchenAmbient.tsx");
  assert(
    /steamPlume\(p, pi\)/.test(layer) &&
      /"--tx": pct\(-STEAM_PLUME\.rimX \* 100\)/.test(layer) &&
      /"--ty": pct\(-STEAM_PLUME\.rimY \* 100\)/.test(layer) &&
      /transform: translate\(var\(--tx/.test(css),
    "D6: each pot's film is laid with its lid line on the pot's rim",
  );
  assert(
    /const alignX = ambientAlignX\(layout\);/.test(bg) &&
      /const alignY = ambientAlignY\(layout, vp\.h\);/.test(bg) &&
      /coverRect\(vp, ambientPictureSize\(layout\), alignX, alignY\)/.test(bg),
    "D7: the live kitchen's stage uses both alignments",
  );
  // the film, the CSS that plays it and the script that makes it agree
  const maker = read("scripts/make-steam-plume.py");
  const pair = (name: string) =>
    maker
      .match(new RegExp(`^${name} = ([\\d.]+), ([\\d.]+)$`, "m"))
      ?.slice(1)
      .map(Number) ?? [];
  const per = STEAM_PLUME.seconds / (STEAM_PLUME.cols * STEAM_PLUME.rows);
  const row = STEAM_PLUME.seconds / STEAM_PLUME.rows;
  assert(
    pair("COLS, ROWS").join() === `${STEAM_PLUME.cols},${STEAM_PLUME.rows}` &&
      pair("FRAME_W, FRAME_H").join() === `${STEAM_PLUME.frameW},${STEAM_PLUME.frameH}` &&
      new RegExp(
        `^RIM_X, RIM_Y, LID_W = ${STEAM_PLUME.rimX}, ${STEAM_PLUME.rimY}, ${STEAM_PLUME.lidW}$`,
        "m",
      ).test(maker),
    "D8: the game reads the film as the script makes it (frames, their size, where the lid is)",
    [pair("COLS, ROWS"), pair("FRAME_W, FRAME_H")],
  );
  assert(
    css.includes(`ka-film-x ${row}s steps(${STEAM_PLUME.cols}) infinite`) &&
      css.includes(`ka-film-y ${STEAM_PLUME.seconds}s steps(${STEAM_PLUME.rows}) infinite`) &&
      css.includes(`ka-film-out ${per}s linear infinite`) &&
      css.includes(`calc(var(--start, 0s) - ${per}s)`) &&
      css.includes(`background-size: ${STEAM_PLUME.cols * 100}% ${STEAM_PLUME.rows * 100}%`) &&
      css.includes(`aspect-ratio: ${STEAM_PLUME.frameW} / ${STEAM_PLUME.frameH}`) &&
      /mix-blend-mode: plus-lighter/.test(css) &&
      /isolation: isolate/.test(css),
    "D9: it plays a frame every 125 ms, the second layer one frame ahead, fading into each other",
    { row, per },
  );
  assert(
    /classList\.toggle\("kc-reduced-motion"/.test(read("src/App.tsx")),
    "D5: the app sets the reduced-motion class the layer listens to",
  );
}

console.log(
  failures ? `\nKITCHEN AMBIENT QA: ${failures} FAILED` : "\nKITCHEN AMBIENT QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
