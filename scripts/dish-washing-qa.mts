/**
 * DISH WASHING QA — the sink (developer 2026-10-23: "add the dish washing back
 * and integrate it properly"): a service's dishes wait in the sink; the sink
 * game washes them by hand (dish soap, nothing breaks, no money); what's left
 * is washed by the automatic wash-up when the next service starts. Tested
 * with the real functions.
 *
 *  H. Hand wash (serviceSupplies.handWash): the chosen lines are washed —
 *     soap by the piece, nothing breaks, stock and credits and ledger
 *     unchanged; no soap → nothing changes; a clean line → nothing.
 *  A. The cleanliness action "wash" is the hand wash (and says when soap is
 *     missing).
 *  S. The START wash-up still washes whatever is left (and may break a piece).
 *  P. Spotless (serviceReport): a service's own dishes in the sink don't spoil
 *     it; pieces still dirty when it STARTED (no soap) do.
 *  L. Saves: an old lastStart without `dirty` reads 0; the sink survives the
 *     real SaveManager save/load.
 *  D. Determinism and copy: no Math.random; the Level Complete line is short.
 *  R. Realistic dirt (restaurant/dishDirt.ts, developer 2026-10-23: "make the
 *     dirt in the utensils more realistic"): every piece gets several stains
 *     of the kinds that piece really collects, all on the piece, seeded (same
 *     wash, same dirt; the next wash, fresh dirt), each with marks to scrub;
 *     the big pieces come first and thin ones are zoomed in.
 *  W. Wiring: App and the sim don't wash right after a service; App washes at
 *     START; the sink is reachable from Cleanliness, the Pre-Service Check and
 *     Closing Time, each kind washed through the cleanliness action.
 *
 * Run: npx tsx scripts/dish-washing-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import {
  DISH_ITEMS,
  DISH_ORDER,
  DISH_ZOOM,
  dishMarks,
  dishSeed,
  dishStains,
  inDishSurface,
  type DishShape,
} from "../src/game/restaurant/dishDirt.ts";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import {
  SERVICE_SUPPLY_RULES,
  handWash,
  restaurantSuppliesOf,
  sinkLines,
  sinkNoticeLines,
  sinkPieces,
  takeOrderSupplies,
  washUp,
} from "../src/game/restaurant/serviceSupplies.ts";
import {
  applyCleanlinessAction,
  cleanlinessOf,
  snapshotServiceStart,
} from "../src/game/restaurant/cleanliness.ts";
import { closeServiceReport, serviceReportLines } from "../src/game/restaurant/serviceReport.ts";
import type { SupplyId } from "../src/game/business/businessSupplies.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

function saveAt(n: number, credits = 500_000): SaveData {
  return {
    ...structuredClone(DEFAULT_SAVE),
    credits,
    levelProgress: {
      ...structuredClone(DEFAULT_SAVE.levelProgress),
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  };
}
function stocked(save: SaveData, lines: Partial<Record<SupplyId, number>>): SaveData {
  const stock = { ...save.business.supplies.stock };
  for (const [id, units] of Object.entries(lines))
    stock[id as SupplyId] = { units: units!, costBasis: units! * 10 };
  return {
    ...save,
    business: { ...save.business, supplies: { ...save.business.supplies, stock } },
  };
}
const SETTING = { "dinner-plates": 12, "dinner-forks": 12, "dinner-knives": 12 } as const;
const units = (s: SaveData, id: SupplyId) => s.business.supplies.stock[id]?.units ?? 0;
/** Four dine-in guests served: 4 plates, 4 forks, 4 knives in the sink. */
const afterService = (soap = 1) => {
  let s = stocked(saveAt(31), { ...SETTING, "dish-soap": soap });
  for (let i = 0; i < 4; i++) s = takeOrderSupplies(s, "dine-in");
  return s;
};

console.log("H. Hand wash");
{
  const s = afterService();
  const lines = sinkLines(s);
  const soap0 = restaurantSuppliesOf(s).soapPct;
  const w = handWash(s, ["dinner-plates"]);
  const after = restaurantSuppliesOf(w.save);
  assert(
    sinkPieces(s) === 12 && lines.length === 3 && lines.every((l) => l.n === 4),
    "H1: four guests leave 12 pieces in the sink, by line (4 plates, 4 forks, 4 knives)",
  );
  assert(
    w.washed === 4 &&
      !w.noSoap &&
      (after.dirty["dinner-plates"] ?? 0) === 0 &&
      (after.dirty["dinner-forks"] ?? 0) === 4 &&
      sinkPieces(w.save) === 8 &&
      after.washedTotal === restaurantSuppliesOf(s).washedTotal + 4,
    "H2: washing the plates by hand cleans exactly that line; the rest waits",
  );
  // A sealed bottle was opened for the first wash (100 %), then 4 × 0.25 % used.
  const opened = soap0 === 0 ? 100 : soap0;
  assert(
    Math.abs(after.soapPct - (opened - 4 * SERVICE_SUPPLY_RULES.soapPerPiece)) < 1e-9,
    `H3: soap by the piece, no machine minimum (${opened}% → ${after.soapPct}%)`,
  );
  const all = handWash(s, ["dinner-plates", "dinner-forks", "dinner-knives"]);
  assert(
    all.washed === 12 &&
      sinkPieces(all.save) === 0 &&
      restaurantSuppliesOf(all.save).brokenTotal === restaurantSuppliesOf(s).brokenTotal &&
      (["dinner-plates", "dinner-forks", "dinner-knives"] as SupplyId[]).every(
        (id) => units(all.save, id) === units(s, id),
      ),
    "H4: washed with care nothing breaks — every piece is still in stock",
  );
  assert(
    all.save.credits === s.credits && all.save.economyLedger.length === s.economyLedger.length,
    "H5: hand washing moves no money and writes no ledger entry",
  );
  const dry = afterService(0);
  const wd = handWash(dry, ["dinner-plates"]);
  assert(wd.noSoap && wd.washed === 0 && wd.save === dry, "H6: no dish soap → nothing changes");
  assert(
    handWash(all.save, ["dinner-plates"]).save === all.save &&
      handWash(s, [] as SupplyId[]).save === s,
    "H7: a clean line (or nothing chosen) → nothing changes, no soap used",
  );
}

console.log("A. The cleanliness action");
{
  const s = afterService();
  const r = applyCleanlinessAction(s, { kind: "wash", ids: ["dinner-forks"] });
  assert(
    r.needs.length === 0 &&
      (restaurantSuppliesOf(r.save).dirty["dinner-forks"] ?? 0) === 0 &&
      JSON.stringify(r.save) === JSON.stringify(handWash(s, ["dinner-forks"]).save),
    'A1: { kind: "wash" } is exactly the hand wash',
  );
  const dry = applyCleanlinessAction(afterService(0), { kind: "wash", ids: ["dinner-forks"] });
  assert(dry.needs.includes("dish-soap"), "A2: without soap the action says dish soap is needed");
}

console.log("S. START still washes what's left");
{
  const s = afterService();
  const half = handWash(s, ["dinner-plates"]).save;
  const start = washUp(half, 31);
  assert(
    start.washed === 8 && sinkPieces(start.save) === 0,
    "S1: what the player left (8 pieces) is washed by the automatic wash-up at the next START",
  );
  // The automatic wash-up may break a piece (seeded): over many services some do.
  let t = stocked(saveAt(31), { ...SETTING, "dish-soap": 20 });
  let broken = 0;
  for (let k = 0; k < 40; k++) {
    for (let i = 0; i < 4; i++) t = takeOrderSupplies(t, "dine-in");
    const w = washUp(t, 31);
    broken += w.broken.length;
    t = stocked(w.save, SETTING);
  }
  let h = stocked(saveAt(31), { ...SETTING, "dish-soap": 20 });
  let handBroken = 0;
  for (let k = 0; k < 40; k++) {
    for (let i = 0; i < 4; i++) h = takeOrderSupplies(h, "dine-in");
    const before = restaurantSuppliesOf(h).brokenTotal;
    h = handWash(
      h,
      sinkLines(h).map((l) => l.id),
    ).save;
    handBroken += restaurantSuppliesOf(h).brokenTotal - before;
    h = stocked(h, SETTING);
  }
  assert(
    broken > 0 && handBroken === 0,
    `S2: over 40 services the automatic wash-up broke ${broken} pieces; washed by hand, ${handBroken}`,
  );
}

console.log("P. Spotless");
{
  // A service that started clean, served 4 guests: its dishes are in the sink at close.
  let s = stocked(saveAt(31), { ...SETTING, "dish-soap": 1, "cleaning-liquid": 1 });
  s = snapshotServiceStart(s, 31);
  for (let i = 0; i < 4; i++) s = takeOrderSupplies(s, "dine-in");
  const r = closeServiceReport(s, 31, false);
  assert(
    cleanlinessOf(s).lastStart?.dirty === 0 &&
      r.report.hygiene?.dirtyLeft === 0 &&
      r.report.hygiene?.soap === true,
    "P1: a service's own dishes waiting in the sink don't spoil it (0 left at its start)",
  );
  // Started with yesterday's 12 pieces still dirty (no soap for the START wash-up).
  let d = afterService(0);
  d = washUp(d, 31).save; // no soap: they stay
  d = snapshotServiceStart(stocked(d, { "cleaning-liquid": 1 }), 31);
  const rd = closeServiceReport(d, 31, false);
  assert(
    cleanlinessOf(d).lastStart?.dirty === 12 &&
      rd.report.hygiene?.dirtyLeft === 12 &&
      rd.report.hygiene?.soap === false &&
      rd.report.spotless === false &&
      serviceReportLines(rd.report).some((l) => /12 dirty pieces left/.test(l)),
    "P2: pieces still dirty when the service STARTED break the spotless streak (and say so)",
  );
}

console.log("L. Saves");
{
  const s = afterService();
  const old = {
    ...s,
    business: {
      ...s.business,
      cleanliness: {
        ...(s.business as unknown as { cleanliness?: object }).cleanliness,
        lastStart: { level: 31, open: 0, areas: [] },
      },
    },
  } as SaveData;
  assert(cleanlinessOf(old).lastStart?.dirty === 0, "L1: an old lastStart without `dirty` reads 0");
  await SaveManager.save(s);
  const back = await SaveManager.load();
  assert(
    sinkPieces(back) === 12 && sinkLines(back).length === 3,
    "L2: the sink survives the real SaveManager save/load",
  );
}

console.log("D. Determinism and copy");
{
  const files = [
    "src/game/restaurant/serviceSupplies.ts",
    "src/components/kc/restaurant/WashUpSink.tsx",
    "src/components/kc/restaurant/SinkWash.tsx",
  ].map(read);
  assert(
    files.every((f) => !/Math\.random/.test(f)),
    "D1: no Math.random in the sink",
  );
  const line = sinkNoticeLines(afterService())[0] ?? "";
  assert(
    /^🫧 12 in the sink/.test(line) &&
      line.split(" ").filter((w) => /[A-Za-z]/.test(w)).length <= 12 &&
      sinkNoticeLines(saveAt(31)).length === 0,
    `D2: Level Complete's sink line is short ("${line}") and absent when the sink is empty`,
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const sim = read("scripts/restaurantCampaignSim.mts");
  const sink = read("src/components/kc/restaurant/SinkWash.tsx");
  const game = read("src/components/kc/restaurant/WashUpSink.tsx");
  assert(
    !/washUp\(\s*recordService\(/.test(app) &&
      /closeServiceReport\(recorded, levelNumber\(level\.id\), false\)/.test(app) &&
      /markStarterCrateSeen\(washUp\(base, levelNumber\(level\.id\)\)\.save\)/.test(app) &&
      /sinkNoticeLines\(nextSave\)/.test(app),
    "W1: App: no wash-up right after a service (its dishes wait), the START one stays, Level Complete says what's in the sink",
  );
  assert(
    !/washUp\(recordService\(/.test(sim) &&
      /closeServiceReport\(recordService\(next, n\), n, false\)/.test(sim) &&
      /markStarterCrateSeen\(washUp\(s, n\)\.save\)/.test(sim),
    "W2: the sim mirrors the game (its player never washes by hand: the START wash-up does it)",
  );
  assert(
    /<SinkWash/.test(read("src/components/kc/business/BusinessCleanliness.tsx")) &&
      /<SinkWash/.test(read("src/components/kc/restaurant/ServiceCheckLayer.tsx")) &&
      /<SinkWash/.test(read("src/components/kc/restaurant/ClosingTime.tsx")),
    "W3: the sink opens from Cleanliness, the Pre-Service Check and Closing Time",
  );
  assert(
    /cleanlinessAction\(\{ kind: "wash", ids: \[id\] \}\)/.test(sink) &&
      /const result = onWash\(activeItem\.id\)/.test(game) &&
      /dishwashing\/premium-sink\.webp/.test(game) &&
      fs.existsSync(path.resolve("public/dishwashing/premium-sink.webp")) &&
      fs.statSync(path.resolve("public/dishwashing/premium-sink.webp")).size < 120_000,
    "W4: each kind scrubbed clean is one cleanliness action; the sink art is bundled and small",
  );
}

// ---------- R. Realistic dirt ----------
{
  const shapes = [...new Set(DISH_ITEMS.map((t) => t.shape))] as DishShape[];
  const KINDS: Record<DishShape, RegExp> = {
    plate: /sauce|crust|grease|crumbs|smear/,
    "small-plate": /sauce|crust|crumbs|smear/,
    bowl: /coffee-ring|crust|grease|crumbs/,
    fork: /sauce|grease|crust/,
    knife: /grease|sauce|smear|crust/,
    spoon: /sauce|coffee-ring|crust|grease/,
    glass: /water-spots|smear|coffee-ring/,
    "cup-set": /coffee-ring|smear|water-spots/,
    jug: /water-spots|scale|smear/,
    shakers: /grime|crumbs|smear/,
  };
  let few = "";
  let off = "";
  let wrongKind = "";
  let noMarks = "";
  let fresh = 0;
  for (const shape of shapes) {
    for (let w = 0; w < 25; w++) {
      const stains = dishStains(shape, dishSeed(w, `x-${shape}` as never));
      if (stains.length < 3) few ||= `${shape}#${w}: ${stains.length}`;
      for (const st of stains) {
        if (!inDishSurface(st.x, st.y, shape)) off ||= `${shape}#${w} ${st.kind}`;
        if (!KINDS[shape].test(st.kind)) wrongKind ||= `${shape} ${st.kind}`;
        if (!(st.strength > 0 && st.strength <= 1 && st.toughness > 0)) off ||= `${shape} strength`;
      }
      const marks = dishMarks(stains, shape);
      for (const st of stains)
        if (!marks.some((m) => m.stain === st.id)) noMarks ||= `${shape}#${w} ${st.kind}`;
      if (!marks.every((m) => inDishSurface(m.point.x, m.point.y, shape))) off ||= `${shape} mark`;
    }
    const a = JSON.stringify(dishStains(shape, 1234));
    const b = JSON.stringify(dishStains(shape, 1234));
    const c = JSON.stringify(dishStains(shape, dishSeed(322, "dinner-plates")));
    const d = JSON.stringify(dishStains(shape, dishSeed(321, "dinner-plates")));
    if (a === b && c !== d) fresh++;
  }
  assert(!few, `R1: every piece gets at least 3 stains on every wash ${few}`);
  assert(!off, `R2: every stain and every mark to scrub sits on the piece ${off}`);
  assert(
    !wrongKind,
    `R3: each piece collects its own kinds of dirt (glass: water spots…) ${wrongKind}`,
  );
  assert(!noMarks, `R4: every stain has marks the sponge must pass over ${noMarks}`);
  assert(
    fresh === shapes.length,
    `R5: seeded — the same wash gives the same dirt, the next wash fresh dirt (${fresh}/${shapes.length})`,
  );
  assert(
    shapes.every((s) => DISH_ZOOM[s] >= 1) &&
      DISH_ZOOM.fork > DISH_ZOOM.plate &&
      DISH_ORDER.plate < DISH_ORDER.fork &&
      DISH_ORDER.bowl < DISH_ORDER.spoon,
    "R6: big pieces come first; thin cutlery is zoomed in so its dirt shows",
  );
  const game = read("src/components/kc/restaurant/WashUpSink.tsx");
  assert(
    /dishStains\(/.test(game) &&
      /playScrub\("wet"\)/.test(game) &&
      /playSparkle\(/.test(game) &&
      /playSpotless\(/.test(game) &&
      /new CleaningFx|CleaningFx\(/.test(game) &&
      /reducedMotionOn\(\)/.test(game) &&
      !/Math\.random\(/.test(game + read("src/game/restaurant/dishDirt.ts")),
    "R7: the sink uses the rooms' feel engine (wet scrub sound, sparkles, suds, spotless chime; reduced motion honoured), seeded",
  );
}

console.log(failures ? `DISH WASHING QA: ${failures} FAILURE(S)` : "DISH WASHING QA: ALL PASS");
process.exit(failures ? 1 : 0);
