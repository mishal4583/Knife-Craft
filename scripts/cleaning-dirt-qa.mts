/**
 * CLEANING DIRT QA (developer 2026-10-22: "finish the cleaning rework, make it proper and
 * satisfying, proper cleaning tools"). The pure module src/game/restaurant/cleaningDirt.ts
 * and the tool look (cleaning/toolLook.ts, CleaningToolIcon.tsx).
 *
 *  D  Determinism: the same area, task, tier and variant give the same stains; tiers differ.
 *  V  Variety (developer 2026-10-22: "don't put the dirt in the same position and
 *     intensity"): another variant (cleaningVariant, new after every clean) moves the
 *     stains, changes their number (±20%) and their strength (opacity 70–100%,
 *     toughness ×0.75–1.25); the Cleanliness tab passes it.
 *  B  Bounds: every stain and every brush mark is inside the 540×960 scene.
 *  Z  Zones: every stain sits on its task's surfaces for that tier (the cooking line, the
 *     tabletops, the floor between tables, the toilets, sinks and mirror, …); the grease
 *     runs along the line; the spill puddle is on the floor between the first rows.
 *  T  Tools: each interactive task has stains, each with a known tool; Disinfect puts the
 *     Squeegee on the mirror and the Sponge on the sinks; every tool has a name and a
 *     proper look (no razor, toothbrush or toilet-paper emoji standing in for a tool).
 *  K  Toughness: one firm stroke clears a crumb but not grease; cleanedShare is 0 → 1;
 *     CLEAN_THRESHOLD is reachable.
 *  S  Streak and milestones: within the window the streak grows, after it it restarts;
 *     25 / 50 / 75 % are crossed once each.
 *  A  Audio: the scrub, sparkle and Spotless sounds are off when Sound is off.
 *  L  Phone landscape (developer 2026-10-22): the 16:9 paintings' own measured surfaces;
 *     stains inside and on them; toilets hidden by stall doors keep portrait; portrait
 *     dirt unchanged; the screen picks the orientation once per cleaning.
 *  R  No Math.random in the dirt module (seeded only).
 *
 * Run: npx tsx scripts/cleaning-dirt-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  CLEAN_MILESTONES,
  CLEAN_THRESHOLD,
  DINING_TABLES,
  DINING_WALK,
  KITCHEN_GEO,
  RESTROOM_GEO,
  SCENE_SIZE,
  STREAK_WINDOW_MS,
  TOUGHNESS,
  cleanedShare,
  cleaningVariant,
  LAND_GEO,
  LAND_SCENE,
  landDirtZones,
  landscapeCleaningSupports,
  diningRug,
  strengthOpacity,
  strengthToughness,
  dirtZones,
  makeStains,
  milestoneCrossed,
  nextStreak,
  scrubAmount,
  spillCenter,
  stainMarks,
  toolForTask,
  type CleaningToolId,
  type Stain,
} from "../src/game/restaurant/cleaningDirt.ts";
import type { CleanArea, TaskKind } from "../src/game/restaurant/cleanliness.ts";
import type { KitchenMapArtStage } from "../src/game/kitchen/kitchenMapArt.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const STAGES: KitchenMapArtStage[] = [
  "humble",
  "growing",
  "established",
  "neighborhood-cafe",
  "flourishing-cafe",
  "grand",
];
// The tasks the Cleanliness tab opens as a mini-game (BusinessCleanliness.tsx).
const INTERACTIVE: Record<CleanArea, TaskKind[]> = {
  kitchen: ["equipment", "grease", "degrease", "deep-kitchen", "sweep-line"],
  dining: ["tables", "floor", "spill", "mop-all", "deep-dining"],
  restroom: ["toilet", "restroom-floor", "restroom-disinfect", "deep-restroom"],
};
const ALL_TOOLS: CleaningToolId[] = [
  "sponge",
  "cloth",
  "scraper",
  "broom",
  "mop",
  "toilet-brush",
  "glass-cloth",
];
// Variant 0 and a few real ones (cleaningVariant after some cleans): every check holds for each.
const VARIANTS = [0, cleaningVariant(1, 12, "floor"), cleaningVariant(7, 40, "grease"), 987654321];
const SV = STAGES.flatMap((stage) => VARIANTS.map((variant) => ({ stage, variant })));
const cases = (Object.keys(INTERACTIVE) as CleanArea[]).flatMap((area) =>
  INTERACTIVE[area].flatMap((task) =>
    SV.map(({ stage, variant }) => ({ area, task, stage, variant })),
  ),
);

console.log("D  determinism");
{
  const same = cases.every(
    ({ area, task, stage, variant }) =>
      JSON.stringify(makeStains(area, task, stage, false, variant)) ===
      JSON.stringify(makeStains(area, task, stage, false, variant)),
  );
  assert(same, "the same area, task and tier always give the same stains");
  const differ = STAGES.slice(1).every(
    (s) =>
      JSON.stringify(makeStains("kitchen", "equipment", s)) !==
      JSON.stringify(makeStains("kitchen", "equipment", "humble")),
  );
  assert(differ, "each kitchen tier lays its own dirt");
  const roomWide = makeStains("dining", "tables", "humble", true);
  assert(
    new Set(roomWide.map((s) => s.task)).size === 4 && roomWide.every((s, i) => s.id === i),
    "the room-wide practice mixes the room's four tasks, ids in order",
  );
}

console.log("V  variety");
{
  const a = makeStains("dining", "floor", "humble", false, cleaningVariant(0, 12, "floor"));
  const b = makeStains("dining", "floor", "humble", false, cleaningVariant(1, 12, "floor"));
  const moved = a.filter((s) => !b.some((t) => Math.hypot(s.x - t.x, s.y - t.y) < 4)).length;
  assert(moved >= a.length * 0.8, "the next clean lays the dirt somewhere else", {
    moved,
    of: a.length,
  });
  assert(
    cleaningVariant(3, 12, "floor") === cleaningVariant(3, 12, "floor") &&
      cleaningVariant(3, 12, "floor") !== cleaningVariant(4, 12, "floor"),
    "the variant is steady while the task waits and new after a clean",
  );
  const counts = new Set(
    Array.from(
      { length: 12 },
      (_, k) => makeStains("kitchen", "equipment", "humble", false, k + 1).length,
    ),
  );
  assert(counts.size >= 3, "the number of stains varies between cleans", [...counts]);
  const all = cases.flatMap(({ area, task, stage, variant }) =>
    makeStains(area, task, stage, false, variant),
  );
  const str = all.map((s) => s.strength);
  assert(
    str.every((x) => x >= 0 && x < 1) && Math.min(...str) < 0.15 && Math.max(...str) > 0.85,
    "stains run from light to heavy (strength 0–1)",
  );
  assert(
    all.every(
      (s) => Math.abs(s.toughness - TOUGHNESS[s.kind] * strengthToughness(s.strength)) < 1e-9,
    ),
    "a heavier stain is tougher (toughness × 0.75–1.25)",
  );
  assert(
    strengthOpacity(0) === 0.7 &&
      strengthOpacity(1) === 1 &&
      strengthToughness(0) === 0.75 &&
      strengthToughness(1) === 1.25,
    "a light stain still shows (70% paint); a heavy one is full",
  );
  // The cleaning game's launcher is shared now (CleaningGame.tsx, developer 2026-10-24).
  const view =
    read("src/components/kc/business/BusinessCleanliness.tsx") +
    read("src/components/kc/restaurant/CleaningGame.tsx");
  const proto = read("src/components/kc/business/AreaCleaningPrototype.tsx");
  assert(
    /variant=\{cleaningVariantFor\(/.test(view) &&
      /cleaningVariant\(st\.cleaned/.test(view) &&
      /makeStains\(area, task, stage, roomWide, variant, orient\)/.test(proto) &&
      /strengthOpacity\(s\.strength\)/.test(proto),
    "the Cleanliness tab passes the variant; the game paints each stain at its strength",
  );
}

console.log("B  bounds");
{
  const out: unknown[] = [];
  for (const { area, task, stage, variant } of cases) {
    const { width, height } = SCENE_SIZE[area];
    const stains = makeStains(area, task, stage, false, variant);
    for (const s of stains)
      if (s.x < 0 || s.y < 0 || s.x > width || s.y > height) out.push({ area, task, stage, s });
    for (const m of stainMarks(stains, area))
      if (m.point.x < 1 || m.point.y < 1 || m.point.x > width - 1 || m.point.y > height - 1)
        out.push({ area, task, stage, m });
  }
  assert(out.length === 0, "every stain and brush mark is inside the scene", out.slice(0, 3));
  assert(
    Object.values(SCENE_SIZE).every((s) => s.width === 540 && s.height === 960),
    "every room uses the 540×960 portrait scene",
  );
}

console.log("Z  zones");
{
  const inZone = (s: Stain, zones: { x: number; y: number; w: number; h: number }[], pad = 1) =>
    zones.some(
      (z) =>
        s.x >= z.x - pad && s.x <= z.x + z.w + pad && s.y >= z.y - pad && s.y <= z.y + z.h + pad,
    );
  const off: unknown[] = [];
  for (const { area, task, stage, variant } of cases) {
    const zones = dirtZones(area, task, stage);
    for (const s of makeStains(area, task, stage, false, variant)) {
      // The spill's centre puddle and the grease streaks are placed on purpose (checked below).
      if ((task === "spill" && s.r === 30) || (s.kind === "grease" && s.stretch > 3)) continue;
      // A stain is kept clear of the scene edge by its radius.
      if (!inZone(s, zones, s.r)) off.push({ area, task, stage, x: s.x, y: s.y });
    }
  }
  assert(off.length === 0, "every stain sits on its task's surfaces for the tier", off.slice(0, 4));

  const streaksOnLine = SV.every(({ stage, variant }) => {
    const { line } = KITCHEN_GEO[stage];
    const streaks = makeStains("kitchen", "grease", stage, false, variant).filter(
      (s) => s.stretch > 3,
    );
    return (
      streaks.length === 3 &&
      streaks.every(
        (s) => s.x > line.x && s.x < line.x + line.w && s.y > line.y && s.y < line.y + line.h,
      )
    );
  });
  assert(streaksOnLine, "Degrease: three grease streaks run along each tier's cooking line");

  const spillOk = SV.every(({ stage, variant }) => {
    const c = spillCenter(stage);
    const ys = [...new Set(DINING_TABLES[stage].centers.map((p) => p.y))].sort((a, b) => a - b);
    const puddle = makeStains("dining", "spill", stage, false, variant).find((s) => s.r === 30);
    return (
      !!puddle &&
      puddle.kind === "puddle" &&
      puddle.x === c.x &&
      puddle.y === c.y &&
      (ys.length < 2 || (c.y > ys[0]! && c.y < ys[1]!))
    );
  });
  assert(spillOk, "the spill puddle lies on the floor between the first two rows of tables");

  const tablesOnTops = SV.every(({ stage, variant }) => {
    const { centers, half } = DINING_TABLES[stage];
    return makeStains("dining", "tables", stage, false, variant).every((s) =>
      centers.some((c) => Math.abs(s.x - c.x) <= half && Math.abs(s.y - c.y) <= half),
    );
  });
  assert(tablesOnTops, "Wipe the tables: every stain is on a tabletop");

  const floorOffTops = SV.every(({ stage, variant }) => {
    const { centers, half } = DINING_TABLES[stage];
    return makeStains("dining", "floor", stage, false, variant).every(
      (s) =>
        !centers.some((c) => Math.abs(s.x - c.x) < half * 0.6 && Math.abs(s.y - c.y) < half * 0.6),
    );
  });
  assert(floorOffTops, "the dining floor's dirt is never on a tabletop");
  const offRugs = SV.every(({ stage, variant }) => {
    const { centers, half } = DINING_TABLES[stage];
    const walk = DINING_WALK[stage];
    return makeStains("dining", "floor", stage, false, variant).every(
      (s) =>
        s.x >= walk.x &&
        s.x <= walk.x + walk.w &&
        s.y >= walk.y &&
        s.y <= walk.y + walk.h &&
        !centers.some((c) => {
          const r = diningRug(c, half);
          return s.x > r.x && s.x < r.x + r.w && s.y > r.y && s.y < r.y + r.h;
        }),
    );
  });
  assert(offRugs, "the dining floor's dirt is on the open walkways, off the rugs (it shows there)");
  const spread = SV.every(({ stage, variant }) => {
    const ys = makeStains("dining", "floor", stage, false, variant).map((s) => s.y);
    return Math.max(...ys) - Math.min(...ys) > 250;
  });
  assert(spread, "the floor dirt spreads over the room, not one strip");

  const toiletInBowls = SV.every(({ stage, variant }) =>
    makeStains("restroom", "toilet", stage, false, variant).every((s) =>
      inZone(s, RESTROOM_GEO[stage].bowls, s.r),
    ),
  );
  assert(toiletInBowls, "Scrub the toilets: the limescale is in the bowls");
}

console.log("T  tools");
{
  const empty = cases.filter(
    ({ area, task, stage, variant }) => makeStains(area, task, stage, false, variant).length === 0,
  );
  assert(empty.length === 0, "every interactive task has stains on every tier", empty.slice(0, 3));
  const unknown = cases.flatMap(({ area, task, stage, variant }) =>
    makeStains(area, task, stage, false, variant).filter((s) => !ALL_TOOLS.includes(s.tool)),
  );
  assert(unknown.length === 0, "every stain names a known tool");
  const single = cases.filter(
    ({ area, task, stage, variant }) =>
      task !== "restroom-disinfect" &&
      !task.startsWith("deep-") &&
      makeStains(area, task, stage, false, variant).some((s) => s.tool !== toolForTask(area, task)),
  );
  assert(single.length === 0, "a one-tool task uses only its own tool", single.slice(0, 3));
  const disinfect = SV.every(({ stage, variant }) => {
    const stains = makeStains("restroom", "restroom-disinfect", stage, false, variant);
    const m = RESTROOM_GEO[stage].mirror;
    const onMirror = (s: Stain) =>
      s.x >= m.x - s.r && s.x <= m.x + m.w + s.r && s.y >= m.y - s.r && s.y <= m.y + m.h + s.r;
    return (
      stains.some((s) => s.tool === "glass-cloth") &&
      stains.some((s) => s.tool === "sponge") &&
      stains.filter((s) => s.tool === "glass-cloth").every(onMirror)
    );
  });
  assert(disinfect, "Disinfect: the Squeegee on the mirror, the Sponge on the sinks");
  assert(
    toolForTask("kitchen", "grease") === "scraper" &&
      toolForTask("kitchen", "sweep-line") === "broom" &&
      toolForTask("dining", "spill") === "mop" &&
      toolForTask("dining", "tables") === "cloth" &&
      toolForTask("restroom", "toilet") === "toilet-brush",
    "each job has the right tool (scraper, broom, mop, cloth, toilet brush)",
  );

  const look = read("src/components/kc/business/cleaning/toolLook.ts");
  const icon = read("src/components/kc/business/cleaning/CleaningToolIcon.tsx");
  const named = ALL_TOOLS.every((t) => new RegExp(`["']?${t}["']?:\\s*\\{\\s*name:`).test(look));
  assert(named, "every tool has a name in TOOL_LOOK");
  const drawnOrEmoji = ALL_TOOLS.every((t) => {
    const line = look.split("\n").find((l) => new RegExp(`^\\s*["']?${t}["']?:`).test(l)) ?? "";
    return /emoji:/.test(line) || icon.includes(`case "${t}":`);
  });
  assert(drawnOrEmoji, "every tool has an emoji or its own drawing");
  const ui = [look, icon, read("src/components/kc/business/AreaCleaningPrototype.tsx")].join("\n");
  assert(!/🪒|🪥|🧻/u.test(ui), "no razor, toothbrush or toilet-paper emoji stands in for a tool");
}

console.log("K  toughness");
{
  const firm = scrubAmount(28);
  assert(
    firm === 1 && scrubAmount(null) < 0.5 && scrubAmount(4) >= 0.2,
    "a firm stroke is 1, a tap a little",
  );
  assert(firm >= TOUGHNESS.crumbs, "one firm stroke sweeps a crumb");
  assert(
    firm / (TOUGHNESS.grease * strengthToughness(0)) < CLEAN_THRESHOLD,
    "one firm stroke doesn't lift grease, even a light one",
  );
  assert(
    firm >= TOUGHNESS.crumbs * strengthToughness(1),
    "one firm stroke sweeps even a heavy crumb pile",
  );
  assert(Math.ceil(TOUGHNESS.grease / firm) <= 3, "grease goes in a few rubs (≤ 3 firm strokes)");
  const stains = makeStains("kitchen", "grease", "humble");
  const marks = stainMarks(stains, "kitchen");
  const zero = new Array(marks.length).fill(0);
  const full = marks.map((m) => stains[m.stain]!.toughness);
  const over = marks.map((m) => stains[m.stain]!.toughness * 5);
  assert(cleanedShare(zero, marks, stains) === 0, "nothing scrubbed → 0");
  assert(
    Math.abs(cleanedShare(full, marks, stains) - 1) < 1e-9 &&
      Math.abs(cleanedShare(over, marks, stains) - 1) < 1e-9,
    "scrubbed to its toughness → 1, and never above",
  );
  assert(cleanedShare([], [], []) === 1, "a room with no dirt is clean");
  assert(CLEAN_THRESHOLD > 0.5 && CLEAN_THRESHOLD < 1, "the finale wipes only the last bit");
}

console.log("S  streak and milestones");
{
  let st = { count: 0, at: -1e9 };
  st = nextStreak(st, 1000);
  st = nextStreak(st, 1000 + STREAK_WINDOW_MS - 1);
  assert(st.count === 2, "two stains inside the window make a streak of 2");
  st = nextStreak(st, st.at + STREAK_WINDOW_MS + 1);
  assert(st.count === 1, "a pause past the window starts again at 1");
  assert(
    milestoneCrossed(20, 30) === 0 &&
      milestoneCrossed(49, 50) === 1 &&
      milestoneCrossed(74, 99) === 2,
    "25 / 50 / 75 % are each crossed",
  );
  assert(
    milestoneCrossed(30, 40) === null && milestoneCrossed(80, 100) === null,
    "between milestones nothing is crossed",
  );
  let crossed = 0;
  for (let p = 0; p < 100; p++) if (milestoneCrossed(p, p + 1) !== null) crossed++;
  assert(crossed === CLEAN_MILESTONES.length, "a climb from 0 to 100 cheers exactly three times");
}

console.log("A  audio");
{
  const audio = read("src/game/AudioManager.ts");
  const gated = ["playScrub", "playSparkle", "playSpotless"].every((fn) => {
    const at = audio.indexOf(`  ${fn}(`);
    return at >= 0 && audio.slice(at, at + 200).includes("if (!this.enabled) return;");
  });
  assert(gated, "the scrub, sparkle and Spotless sounds stay quiet with Sound off");
}

console.log("L  phone landscape");
{
  // Developer 2026-10-22 ("optimize the game for mobile landscape"): the 16:9 room paintings.
  const landCases = cases.filter(({ area, task, stage }) =>
    landscapeCleaningSupports(area, task, stage),
  );
  const out: unknown[] = [];
  const off: unknown[] = [];
  for (const { area, task, stage, variant } of landCases) {
    const stains = makeStains(area, task, stage, false, variant, "landscape");
    if (!stains.length) out.push({ area, task, stage, empty: true });
    for (const s of stains)
      if (s.x < 0 || s.y < 0 || s.x > LAND_SCENE.width || s.y > LAND_SCENE.height)
        out.push({ area, task, stage, x: s.x, y: s.y });
    for (const m of stainMarks(stains, area, "landscape"))
      if (m.point.x < 1 || m.point.y < 1 || m.point.x > 959 || m.point.y > 539) out.push({ m });
    const zones = landDirtZones(area, task, stage);
    for (const s of stains) {
      if ((task === "spill" && s.r === 30) || (s.kind === "grease" && s.stretch > 3)) continue;
      const inside = zones.some(
        (z) =>
          s.x >= z.x - s.r && s.x <= z.x + z.w + s.r && s.y >= z.y - s.r && s.y <= z.y + z.h + s.r,
      );
      if (!inside) off.push({ area, task, stage, x: s.x, y: s.y });
    }
  }
  assert(
    landCases.length > cases.length * 0.85 && out.length === 0,
    "every landscape job has stains inside the 960×540 scene",
    out.slice(0, 3),
  );
  assert(
    off.length === 0,
    "every landscape stain sits on its job's painted surfaces",
    off.slice(0, 3),
  );
  const geoInside = STAGES.every((st) =>
    Object.values(LAND_GEO[st]).every((room) =>
      Object.values(room).every((list) =>
        (list ?? []).every(
          (z: { x: number; y: number; w: number; h: number }) =>
            z.w > 0 && z.h > 0 && z.x >= 0 && z.y >= 0 && z.x + z.w <= 960 && z.y + z.h <= 540,
        ),
      ),
    ),
  );
  assert(geoInside, "every measured landscape surface is a real box inside the painting");
  const toiletFallback = STAGES.filter(
    (st) => !landscapeCleaningSupports("restroom", "toilet", st),
  );
  assert(
    toiletFallback.every((st) => LAND_GEO[st].restroom.bowls === null) &&
      STAGES.every((st) => landscapeCleaningSupports("restroom", "restroom-floor", st)),
    "a painting without visible toilets keeps the toilet jobs in portrait; the other jobs go landscape",
    toiletFallback,
  );
  const portraitSame = cases.every(
    ({ area, task, stage, variant }) =>
      JSON.stringify(makeStains(area, task, stage, false, variant)) ===
      JSON.stringify(makeStains(area, task, stage, false, variant, "portrait")),
  );
  assert(portraitSame, "portrait dirt is unchanged by the landscape option");
  const differs =
    JSON.stringify(makeStains("dining", "floor", "humble", false, 0, "landscape")) !==
    JSON.stringify(makeStains("dining", "floor", "humble", false, 0));
  assert(differs, "landscape lays its own dirt for its own painting");
  const disinfectLand = STAGES.every((st) => {
    const ss = makeStains("restroom", "restroom-disinfect", st, false, 0, "landscape");
    return ss.some((x) => x.tool === "glass-cloth") && ss.some((x) => x.tool === "sponge");
  });
  assert(
    disinfectLand,
    "landscape Disinfect: the Squeegee on the mirrors, the Sponge on the sinks",
  );
  const proto = read("src/components/kc/business/AreaCleaningPrototype.tsx");
  assert(
    /landscapeCleaningSupports\(area, t, stage\)/.test(proto) &&
      /landscapeCleaningArt\(area, stage\)/.test(proto) &&
      /useState<"portrait" \| "landscape">/.test(proto),
    "the cleaning screen picks the landscape room once per cleaning (turning the phone keeps the dirt)",
  );
  for (const st of STAGES)
    for (const area of ["kitchen", "dining", "restroom"])
      assert(
        fs.existsSync(path.join(root, `public/landscape-art/cleaning/${area}-${st}.webp`)),
        `landscape art ${area}-${st} exists`,
      );
}

console.log("R  seeded only");
{
  const src = read("src/game/restaurant/cleaningDirt.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert(!/Math\.random/.test(src), "no Math.random in cleaningDirt.ts");
}

console.log(
  failures ? `\nCLEANING DIRT QA: ${failures} FAILURE(S)` : "\nCLEANING DIRT QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
