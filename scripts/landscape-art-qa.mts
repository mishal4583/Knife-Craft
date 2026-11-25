/**
 * LANDSCAPE ART QA (developer 2026-11-19/20: the Codex landscape pictures, "integrate all the assets properly"). The second set of landscape pictures
 * (`src/game/landscapeArt.ts`, built by `scripts/make-landscape-assets.py` from the Codex PNGs) is complete, light and wired.
 *
 *  A. Every picture the code can ask for exists in public/landscape-art: 10 mini-game rooms, 6 Kitchen skins, 7 restaurant maps (6 stages and the Second Floor),
 *     7 story scenes and the loading room: 31 files.
 *  B. Each is a real webp (1440 x 810 and under 300 KB; the true Kitchen pictures 1600 x 900 and the true maps 1920 x 1080, under 600 KB: a wide window only, a phone never
 *     downloads them); the whole set stays under 8 MB. (RULE CHANGE 2026-11-20: the Kitchen, the maps and the Second Floor are the true landscape pictures in true/.)
 *  C. Every portrait-only screen gives its room (`<PortraitOnly art={landscapeGameArt(...)} />`), the Sauce Station by phase; the shell paints it behind the stage
 *     only while the stage is framed (`data-testid="shell-art"`), under a soft shadow.
 *  D. The Kitchen home, the cutting scene, the restaurant map, the Second Floor, the intro story and the loading screen use their landscape picture in a wide window
 *     and keep the portrait one otherwise.
 *
 * Run: npx tsx scripts/landscape-art-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  landscapeGameArt,
  landscapeKitchenArt,
  landscapeLoadingArt,
  landscapeDiningArt,
  landscapeClipArt,
  type ClipId,
  landscapeMapArt,
  landscapeSecondFloorArt,
  landscapeStoryArt,
  type LandscapeGameId,
} from "../src/game/landscapeArt.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail).slice(0, 300));
  }
}
// import.meta.env is not there under tsx: BASE_URL reads as undefined, so the helpers give "undefinedlandscape-art/..."; strip the prefix
const rel = (u: string) => u.replace(/^undefined/, "").replace(/^\.?\//, "");

const GAMES: LandscapeGameId[] = [
  "dessert-run",
  "unload-the-van",
  "car-park",
  "sauce-mix",
  "sauce-bottle",
  "fridge-check",
  "dishwashing",
  "delivery-inspection",
  "stockroom",
  "fridge-sort",
];
const STAGES = [
  "humble",
  "growing",
  "established",
  "neighborhood-cafe",
  "flourishing-cafe",
  "grand",
] as const;
const CLIPS: ClipId[] = [
  "chef-cooking",
  "chef-salad",
  "chef-fruit",
  "chef-plating",
  "chef-curry",
  "chef-bread",
  "oven-bread",
];
const SCENES = ["scene1", "scene2", "scene3A", "scene3B", "scene3C", "scene4", "scene5"];
const all = [
  ...GAMES.map((g) => landscapeGameArt(g)),
  ...[1, 2, 3, 4, 5, 6].map((n) => landscapeKitchenArt(`skin-0${n}`)),
  ...STAGES.map((s) => landscapeMapArt(s)),
  landscapeSecondFloorArt(),
  ...SCENES.map((s) => landscapeStoryArt(s)),
  landscapeLoadingArt(),
  ...STAGES.map((s) => landscapeDiningArt(s)),
  ...CLIPS.map((c) => landscapeClipArt(c)),
].map(rel);

console.log("A. The set is complete");
const missing = all.filter((f) => !fs.existsSync(path.join(ROOT, "public", f)));
assert(
  all.length === 44 && new Set(all).size === 44 && missing.length === 0,
  "A1: 44 distinct pictures (10 games, 6 Kitchens, 7 maps, 7 scenes, loading, 6 dining rooms, 7 film backgrounds), all in public/landscape-art/true",
  missing,
);

console.log("\nB. Real, the right size, light");
{
  const bad: unknown[] = [];
  let total = 0;
  for (const f of all) {
    const b = fs.readFileSync(path.join(ROOT, "public", f));
    total += b.length;
    const riff = b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
    let w = 0;
    let h = 0;
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8 ") {
      w = b.readUInt16LE(26) & 0x3fff;
      h = b.readUInt16LE(28) & 0x3fff;
    } else if (kind === "VP8X") {
      w = 1 + b.readUIntLE(24, 3);
      h = 1 + b.readUIntLE(27, 3);
    } else if (kind === "VP8L") {
      const v = b.readUInt32LE(21);
      w = (v & 0x3fff) + 1;
      h = ((v >> 14) & 0x3fff) + 1;
    }
    // the true pictures (Codex, composed wide from scratch): Kitchen 1600 x 900, maps 1920 x 1080; everything else 1440 x 810
    // RULE CHANGE 2026-11-20: every picture is a TRUE landscape one (landscape-art/true/): Kitchen, games, story and loading 1600 x 900; maps, Second Floor and dining rooms 1920 x 1080
    // RULE CHANGE 2026-11-22: the six Kitchen pictures are the developer's new paintings at 1920 x 1080 (scripts/make-kitchen-wide.py)
    const [ew, eh, maxKb] = /true\/(map-|second-floor|dining-|clip-|kitchen-)/.test(f)
      ? [1920, 1080, 600]
      : [1600, 900, 600];
    if (!riff || w !== ew || h !== eh || b.length > maxKb * 1024)
      bad.push({ f, riff, w, h, kb: Math.round(b.length / 1024) });
  }
  assert(
    bad.length === 0,
    "B1: every file is a webp of its size (1440 x 810, 1600 x 900, maps and dining rooms 1920 x 1080) and light",
    bad.slice(0, 3),
  );
  assert(
    total < 12 * 1024 * 1024,
    `B2: the whole set is under 12 MB (RULE CHANGE 2026-11-20: 44 pictures, loaded one screen at a time in a wide window only) (${Math.round(total / 1024)} KB)`,
  );
}

console.log("\nC. Mini-games and the sink");
{
  const files: Array<[string, string]> = [
    ["src/components/kc/inventory/DessertRunGame.tsx", 'landscapeGameArt("dessert-run")'],
    ["src/components/kc/inventory/KitchenDispatchGame.tsx", 'landscapeGameArt("unload-the-van")'],
  ];
  // RULE CHANGE 2026-11-20 (developer: "fix the games in landscape first"): these screens are real landscape layouts on their wide room: they paint it themselves (`landscapeGameArt`)
  // and carry no `<PortraitOnly />`. Dessert Run and Unload the Van (fixed 9:16 canvas puzzles) still give their room to the framed stage.
  const landscape: Array<[string, string]> = [
    ["src/components/kc/inventory/CarParkGame.tsx", 'landscapeGameArt("car-park")'],
    [
      "src/components/kc/sauce/SauceStationGame.tsx",
      'landscapeGameArt(phase === "bottle" ? "sauce-bottle" : "sauce-mix")',
    ],
    ["src/components/kc/restaurant/FridgeCheckGame.tsx", 'landscapeGameArt("fridge-check")'],
    ["src/components/kc/inventory/StockroomSortGame.tsx", 'landscapeGameArt("stockroom")'],
    ["src/components/kc/inventory/FridgeSortGame.tsx", 'landscapeGameArt("fridge-sort")'],
    ["src/components/kc/restaurant/WashUpSink.tsx", 'landscapeGameArt("dishwashing")'],
    [
      "src/components/kc/inventory/DeliveryInspectionGame.tsx",
      'landscapeGameArt("delivery-inspection")',
    ],
  ];
  assert(
    landscape.every(([f, expr]) => read(f).includes(expr) && !/<PortraitOnly/.test(read(f))),
    "C1c: seven games and the sink are landscape layouts on their wide room (no PortraitOnly)",
    landscape
      .filter(([f, e]) => !read(f).includes(e) || /<PortraitOnly/.test(read(f)))
      .map(([f]) => f),
  );
  // RULE CHANGE 2026-11-20 (developer: "design wide versions of Dessert Run and Unload the Van"): the two canvas puzzles paint their wide room themselves behind a 16:9 board
  // (`dr-room`, `kd-room`); the framed stage (and its `<PortraitOnly art>`) is only the branch for an upright window.
  assert(
    files.every(
      ([f, expr]) =>
        read(f).includes(`src={${expr}}`) &&
        /data-testid="(dr|kd)-room"/.test(read(f)) &&
        /\) : \(\s*<>\s*<PortraitOnly art=\{/.test(read(f)),
    ),
    "C1: Dessert Run and Unload the Van paint their wide room behind a landscape board; the framed 9:16 stage is only the upright branch",
    files
      .filter(
        ([f, e]) => !read(f).includes(`src={${e}}`) || !/data-testid="(dr|kd)-room"/.test(read(f)),
      )
      .map(([f]) => f),
  );
  const shell = read("src/components/kc/game/GameShell.tsx");
  assert(
    /fit\.frame && stageArt/.test(shell) &&
      /data-testid="shell-art"/.test(shell) &&
      /shadow-\[0_0_60px_18px/.test(shell),
    "C2: the shell paints the room behind a framed stage only, under a soft shadow",
  );
}

console.log("\nD. Everything else");
{
  const kb = read("src/components/kc/KitchenBackground.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  const map = read("src/components/kc/restaurantMap/RestaurantMapView.tsx");
  const sf = read("src/components/kc/restaurantMap/SecondFloorView.tsx");
  const intro = read("src/components/kc/story/CinematicIntro.tsx");
  const html = read("index.html");
  assert(
    /landscapeKitchenArt\(skin\)/.test(kb) && /const wide = landscape && !thumb/.test(kb),
    "D1: the Kitchen home shows the skin's landscape painting in a wide window (not a thumbnail)",
  );
  assert(
    /landscape \? landscapeKitchenArt\(kitchenSkin \?\? "skin-01"\)/.test(prep) &&
      /cuttingKitchenSkin/.test(read("src/App.tsx")),
    "D2: the cutting scene shows the built kitchen's landscape painting",
  );
  assert(
    /landscapeMapArt\(stageId\)/.test(map) &&
      /wideZones\(stageId\)/.test(map) &&
      /landscapeSecondFloorArt\(\)/.test(sf),
    "D3: the restaurant map shows its stage's dining room, the Second Floor its food hall",
  );
  assert(
    /landscapeStoryArt/.test(intro) && !/<PortraitOnly/.test(intro),
    "D4: the intro story uses the landscape scenes and is no longer portrait-only",
  );
  assert(
    /landscapeDiningArt\(stage\)/.test(read("src/components/kc/game/ServiceFloor.tsx")) &&
      /landscapeDiningArt\(stage\)/.test(read("src/components/kc/game/DiningCashView.tsx")),
    "D6: the service floor and the served card's room show the stage's wide dining picture in a landscape window",
  );
  assert(
    // RULE CHANGE (developer 2026-11-23: the landscape oven film arrived, composed from the two Gemini clips): the oven film is no longer a portrait film in the middle of a
    // painted oven picture; the 16:9 film (oven-bread-wide.*) covers the window and the controls sit over it. The cooking films' portrait path keeps its matching picture.
    /landscapeClipArt\(CLIP_ART\[kind\]\)/.test(read("src/components/kc/game/CookingClip.tsx")) &&
      /oven-bread-wide\.webm/.test(read("src/components/kc/game/OvenStep.tsx")) &&
      !/FilmBackdrop/.test(read("src/components/kc/game/OvenStep.tsx")),
    "D7: each portrait cooking film sits in the middle of its own matching wide picture; the oven film is the full-frame 16:9 film",
  );
  assert(
    // RULE CHANGE (developer 2026-11-22: "use this image as the loading screen"): the wide loading screen is the ONE finished picture loading/wide.webp (scripts/make-loading-wide.py)
    // with the real fill over its track, no longer landscape-art/true/loading.webp behind the upright pieces.
    /min-aspect-ratio: 13\/10/.test(html) &&
      /loading\/wide\.webp/.test(html) &&
      /class="bs-wfill"/.test(html) &&
      fs.existsSync(path.join(ROOT, "public", "loading", "wide.webp")),
    "D5: the loading screen is the finished wide picture (with the real fill over its empty track) in a wide window only",
  );
  // Developer 2026-11-21: the Gemini-made 16:9 cooking films (scripts/make-wide-cooking-videos.py): played full frame in a landscape window by the kinds that have one.
  const clip = read("src/components/kc/game/CookingClip.tsx");
  const wideKinds = ["fruit", "salad"];
  assert(
    wideKinds.every(
      (k) =>
        new RegExp(`${k}: \{ webm: ${k}WideWebm, mp4: ${k}WideMp4, poster: ${k}WidePoster \}`).test(
          clip,
        ) &&
        ["webm", "mp4"].every((e) =>
          fs.existsSync(path.join(ROOT, "src/assets/video", `chef-${k}-wide.${e}`)),
        ) &&
        fs.existsSync(path.join(ROOT, "src/assets/video", `chef-${k}-wide-poster.webp`)),
    ) &&
      /const wide = landscape \? WIDE_CLIPS\[kind\] : undefined/.test(clip) &&
      /data-testid="cooking-clip-wide"/.test(clip) &&
      /<FilmBackdrop/.test(clip),
    "D8: a landscape window plays the wide film FULL FRAME for the fruit and salad kinds (files built); the other kinds keep the portrait film on its backdrop; an upright phone keeps the portrait film",
  );
}

// ───────── E. The margins of the wide maps (developer 2026-11-24: "the both sides of the restaurant map are not filled in properly, why is the garden extended") ─────────
console.log("E. The painted garden margins of the wide maps");
{
  const MARGIN_NAMES = [
    "humble",
    "growing",
    "established",
    "neighborhood-cafe",
    "flourishing-cafe",
    "grand",
    "second-floor",
  ] as const;
  const dirM = path.join(ROOT, "public", "landscape-art", "true", "margins");
  const sizeOf = (b: Buffer) => {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    return { w: 0, h: 0 };
  };
  const { MAP_MARGIN, landscapeMapMarginArt } = await import("../src/game/landscapeArt.ts");
  const bad: unknown[] = [];
  let total = 0;
  for (const n of MARGIN_NAMES) {
    for (const side of ["left", "right", "top", "bottom"] as const) {
      const f = path.join(dirM, `${n}-${side}.webp`);
      if (!fs.existsSync(f)) {
        bad.push({ n, side, missing: true });
        continue;
      }
      const b = fs.readFileSync(f);
      total += b.length;
      const { w, h } = sizeOf(b);
      const wantW = side === "left" || side === "right" ? MAP_MARGIN.x : 1920 + 2 * MAP_MARGIN.x;
      const wantH = side === "left" || side === "right" ? 1080 : MAP_MARGIN.y;
      if (w !== wantW || h !== wantH || b.length > 140 * 1024)
        bad.push({ n, side, w, h, kb: Math.round(b.length / 1024) });
    }
  }
  assert(
    bad.length === 0 && total < 3 * 1024 * 1024,
    "E1: every one of the six Kitchen maps and the Second Floor has its four margin pictures (left and right 360 x 1080, top and bottom 2640 x 220 with the corners), each under 140 KB, the 28 together under 3 MB",
    { bad: bad.slice(0, 4), totalKB: Math.round(total / 1024) },
  );
  assert(
    landscapeMapMarginArt("grand", "left").endsWith("landscape-art/true/margins/grand-left.webp") &&
      landscapeMapMarginArt("second-floor", "bottom").endsWith(
        "landscape-art/true/margins/second-floor-bottom.webp",
      ),
    "E2: the margin picture URLs follow landscape-art/true/margins/<map>-<side>.webp",
  );
  const edge = fs.readFileSync(
    path.join(ROOT, "src/components/kc/restaurantMap/MapEdgeFill.tsx"),
    "utf8",
  );
  const mapView = fs.readFileSync(
    path.join(ROOT, "src/components/kc/restaurantMap/RestaurantMapView.tsx"),
    "utf8",
  );
  const floorView = fs.readFileSync(
    path.join(ROOT, "src/components/kc/restaurantMap/SecondFloorView.tsx"),
    "utf8",
  );
  assert(
    /margin=\{stageId\}/.test(mapView) && /margin="second-floor"/.test(floorView),
    "E3: the restaurant map passes its stage and the Second Floor its own name, so every map draws its own margins",
  );
  assert(
    /landscapeMapMarginArt\(margin, "left"\)/.test(edge) &&
      /drawGarden\(\{ left, right, top, bottom \}\)/.test(edge) &&
      /drawMirrored\(\)/.test(edge) &&
      /data-fill=\{fill\}/.test(edge),
    "E4: MapEdgeFill draws the painted margins, and falls back to the old mirrored strips only if one of the four cannot load (never a bar); data-fill says which it used",
  );
  assert(
    /the picture itself last/i.test(edge),
    "E5: the picture itself is drawn last, untouched, over the margins",
  );
  const gen = fs.readFileSync(path.join(ROOT, "scripts/make-map-margins.py"), "utf8");
  assert(
    /default_rng\(/.test(gen) &&
      /outdoor_mask/.test(gen) &&
      /OUT = os\.path\.join\(SRC, "margins"\)/.test(gen) &&
      !/Image\.fromarray\([^)]*\)\.save\(os\.path\.join\(SRC/.test(gen),
    "E6: scripts/make-map-margins.py is deterministic (a fixed seed), takes only outdoor material (never wall or room) and writes only into the margins folder, never over a map picture",
  );
}

console.log(failures ? `\nLANDSCAPE ART QA: ${failures} FAILED` : "\nLANDSCAPE ART QA: ALL PASS");
process.exit(failures ? 1 : 0);
