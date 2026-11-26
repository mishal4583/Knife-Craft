/**
 * KITCHEN AMBIENT QA (developer 2026-11-26: "add some animations like in this video to all the 6 kitchen home screens").
 *
 *  A  the anchor data: every stage, tall and wide, has its pots, glints, window and origin inside the picture; lamps appear from Stage 4
 *  B  `coverRect` follows `object-fit: cover` exactly (so a point of the picture stays on the same pixel of the painting in any window)
 *  C  the animation is light: only transform and opacity move, no filter / blur / shadow animated, no picture, no network
 *  D  the wiring: only the Kitchen home turns it on; Reduced motion (the page class and the system setting) switches it off
 *
 * Run: npx tsx scripts/kitchen-ambient-qa.mts
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  KITCHEN_AMBIENT_SKINS,
  KITCHEN_STEAM_SPRITES,
  ambientPictureSize,
  coverRect,
  kitchenAmbientFor,
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

console.log("C. The animation is light");
{
  const css = read("src/components/kc/kitchenAmbient.css");
  const keyframes = [...css.matchAll(/@keyframes\s+(ka-[\w-]+)\s*\{([\s\S]*?)\n\}/g)];
  assert(
    keyframes.length >= 6,
    "C1: the layer has its keyframes (push-in, beam, mote, lamp, steam, glint)",
    keyframes.map((k) => k[1]),
  );
  const props = new Set<string>();
  for (const k of keyframes)
    for (const m of k[2]!.matchAll(/^\s*([a-z-]+)\s*:/gm)) props.add(m[1]!);
  assert(
    [...props].every((p) => p === "opacity" || p === "transform"),
    "C2: only `transform` and `opacity` are animated",
    [...props],
  );
  assert(
    !/\burl\(/.test(css) && !/@import/.test(css),
    "C3: the CSS loads nothing (no url(), no import)",
  );
  assert(!/animation[^;]*filter|blur\(/.test(css), "C4: nothing is blurred or filtered");
  const comp = read("src/components/kc/KitchenAmbient.tsx");
  // RULE CHANGE (developer 2026-11-26, "where are other animations?"): the layer now also uses the small painted FX sprites (public/fx: lamp glow, glint, petals and leaves, the burner's
  // flame), besides the painted steam wisp. Still no canvas, video, request or randomness; every picture is a small local file, and each name it builds must exist (checked below).
  assert(
    /kitchen-fx\/steam-/.test(comp) &&
      /KITCHEN_STEAM_SPRITES > 0/.test(comp) &&
      /const fx = \(name: string\) => `\$\{import\.meta\.env\.BASE_URL\}fx\/\$\{name\}\.webp`/.test(
        comp,
      ) &&
      (comp.match(/\.(png|jpg|svg|mp4|webm)/g) ?? []).length === 0 &&
      !/fetch\(|new Image|<canvas|<video/.test(comp) &&
      !/Math\.random/.test(comp),
    "C5: the layer draws no canvas or video, makes no request, never re-rolls (no Math.random), and its pictures are only the painted steam wisps and the small painted FX sprites",
  );
  const fxNames = [
    "glow-1",
    "glint-1",
    "glint-2",
    "flame-burner-1",
    "flame-burner-2",
    "flame-burner-4",
    "flame-burner-5",
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
  // when the painted wisps exist (the count is raised), every counted file must be there and small
  const sprites = KITCHEN_STEAM_SPRITES;
  const missing: string[] = [];
  for (let i = 1; i <= sprites; i++) {
    const f = new URL(`../public/kitchen-fx/steam-${i}.webp`, import.meta.url);
    if (!existsSync(f) || statSync(f).size > 60_000) missing.push(`steam-${i}.webp`);
  }
  assert(
    Number.isInteger(sprites) && sprites >= 0 && sprites <= 12 && missing.length === 0,
    `C5b: ${sprites} painted steam wisps are counted and every one exists and is under 60 KB`,
    missing,
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
  assert(
    /classList\.toggle\("kc-reduced-motion"/.test(read("src/App.tsx")),
    "D5: the app sets the reduced-motion class the layer listens to",
  );
}

console.log(
  failures ? `\nKITCHEN AMBIENT QA: ${failures} FAILED` : "\nKITCHEN AMBIENT QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
