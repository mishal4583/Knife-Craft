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
  DISH_BRUSH,
  DISH_ITEMS,
  DISH_MAX_WEAR_PER_SEC,
  DISH_ORDER,
  DISH_RINSE_RATE,
  DISH_RINSE_REACH,
  DISH_RINSE_THRESHOLD,
  DISH_SCRUB_RATE,
  DISH_TOUGH,
  DISH_ZOOM,
  dishMarks,
  dishRinsePoints,
  dishShapeFor,
  paceAmount,
  dishSeed,
  dishStains,
  inDishSurface,
  type DishShape,
} from "../src/game/restaurant/dishDirt.ts";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { cleanedShare, scrubAmount } from "../src/game/restaurant/cleaningDirt.ts";
import {
  SERVICE_SUPPLY_RULES,
  bottleView,
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
    // Developer 2026-11-07: every piece is washed on its own ("each: 1"), no longer a whole kind at once.
    /cleanlinessAction\(\{ kind: "wash", ids: \[id\], each: 1 \}\)/.test(sink) &&
      /const result = onWash\(activeItem\.id\)/.test(game) &&
      /dishwashing\/premium-sink\.webp/.test(game) &&
      fs.existsSync(path.resolve("public/dishwashing/premium-sink.webp")) &&
      fs.statSync(path.resolve("public/dishwashing/premium-sink.webp")).size < 120_000,
    "W4: each PIECE scrubbed and rinsed clean is one cleanliness action (each: 1); the sink art is bundled and small",
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
    pot: /crust|sauce|grease|grime|coffee-ring/,
    pan: /grease|crust|sauce|grime/,
    tray: /crust|grease|crumbs|grime/,
    utensil: /sauce|grease|crust/,
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
      DISH_ORDER.bowl < DISH_ORDER.spoon &&
      DISH_ORDER.pot < DISH_ORDER.plate,
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

// ---------- N. Every piece the orders used is washed, slowly (developer 2026-11-07) ----------
console.log("N. Pots, pans, plates, glasses: used per order, washed one by one");
{
  const recipe = (id: string) => getCampaignRecipe(id)!;
  const fry = recipe("camp-onion-rings-basket");
  const curry = recipe("camp-indian-steak-curry");
  const salad = recipe("camp-simple-garden-salad");
  const kitchen = {
    "dinner-plates": 20,
    "dinner-forks": 20,
    "dinner-knives": 20,
    "water-glasses": 20,
    "soup-bowls": 20,
    "soup-spoons": 20,
    "frying-pans": 2,
    tongs: 1,
    skimmers: 1,
    spatulas: 1,
    "stock-pot": 1,
    saucepans: 2,
    ladles: 1,
    whisks: 1,
    "mixing-bowls": 2,
    "measuring-cups": 1,
    "salt-pepper": 6,
    "water-jugs": 3,
    "dish-soap": 3,
  } as const;
  const serve = (
    s: SaveData,
    service: "dine-in" | "takeaway",
    r: typeof fry,
    n: number,
    lvl = 60,
  ) =>
    Array.from({ length: n }).reduce<SaveData>(
      (acc, _, i) => takeOrderSupplies(acc, service, { recipe: r, levelNumber: lvl, index: i }),
      s,
    );
  const dirtyOf = (s: SaveData, id: SupplyId) => restaurantSuppliesOf(s).dirty[id] ?? 0;

  // N1: a cooked order dirties the pots, pans and utensils ITS dish needs (the tool rules' own reading)
  const base = stocked(saveAt(60), kitchen);
  const one = serve(base, "dine-in", fry, 1);
  assert(
    dirtyOf(one, "frying-pans") === 1 &&
      dirtyOf(one, "tongs") === 1 &&
      dirtyOf(one, "skimmers") === 1 &&
      dirtyOf(one, "spatulas") === 1 &&
      dirtyOf(one, "stock-pot") === 0 &&
      dirtyOf(one, "ladles") === 0,
    "N1: an order of fried onion rings dirties a pan, tongs, a skimmer and a turner — not the stock pot or the ladle",
  );
  // N2: a pan serves 3 orders before it is dirty again; the count never passes what you own
  const four = serve(base, "dine-in", fry, 4);
  const many = serve(base, "dine-in", fry, 30);
  assert(
    dirtyOf(four, "frying-pans") === 2 &&
      dirtyOf(many, "frying-pans") === 2 &&
      dirtyOf(many, "tongs") === 1,
    "N2: a pan is dirty again after 3 orders (4 orders = 2 pans); never more pieces than you own (30 orders, 2 pans)",
  );
  // N3: the curry's soup bowls, spoons, glasses AND the pot and ladle it was cooked in
  const soupy = serve(base, "dine-in", curry, 3);
  assert(
    dirtyOf(soupy, "soup-bowls") === 3 &&
      dirtyOf(soupy, "soup-spoons") === 3 &&
      dirtyOf(soupy, "water-glasses") === 3 &&
      dirtyOf(soupy, "stock-pot") === 1 &&
      dirtyOf(soupy, "ladles") === 1 &&
      dirtyOf(soupy, "saucepans") === 1,
    "N3: three bowls of curry: 3 bowls, 3 spoons, 3 glasses, plus the stock pot, a saucepan and the ladle",
  );
  // N4: a takeaway order is cooked too (pots and pans dirty) but uses no tableware
  const away = serve(base, "takeaway", fry, 1);
  assert(
    dirtyOf(away, "frying-pans") === 1 &&
      dirtyOf(away, "dinner-plates") === 0 &&
      dirtyOf(away, "water-glasses") === 0,
    "N4: a takeaway order dirties the pans it was cooked in but no plates or glasses",
  );
  // N5: what you don't own is never dirty
  const bare = stocked(saveAt(60), {
    "dinner-plates": 20,
    "dinner-forks": 20,
    "dinner-knives": 20,
    "water-glasses": 20,
  });
  const bareServed = serve(bare, "dine-in", fry, 3);
  assert(
    dirtyOf(bareServed, "frying-pans") === 0 &&
      dirtyOf(bareServed, "tongs") === 0 &&
      dirtyOf(bareServed, "dinner-plates") === 3,
    "N5: a pan you don't own is not in the sink; the 3 plates are",
  );
  // N6: the table's shakers and jug are used by the guests (a table seats two; a pair of shakers each, one jug a table)
  const six = serve(base, "dine-in", salad, 6);
  assert(
    dirtyOf(six, "salt-pepper") === 6 &&
      dirtyOf(six, "water-jugs") === 3 &&
      dirtyOf(serve(base, "dine-in", salad, 3), "water-jugs") === 2,
    "N6: six guests use six shakers and three jugs (a jug a table of two); three guests leave two jugs",
  );
  assert(
    dirtyOf(serve(base, "dine-in", salad, 6, 11), "salt-pepper") === 0 &&
      dirtyOf(serve(base, "dine-in", salad, 6, 13), "water-jugs") === 0 &&
      dirtyOf(serve(base, "dine-in", salad, 6, 13), "salt-pepper") === 6,
    "N7: the shakers come with the dine-in stage (L12), the jugs two levels later (rule 2026-11-08) — before that they stay clean",
  );
  // N8: the sink holds all of it: tableware + cookware + table pieces
  const day = serve(serve(base, "dine-in", fry, 5), "dine-in", curry, 3);
  const lines = sinkLines(day);
  const total = sinkPieces(day);
  assert(
    lines.some((l) => l.id === "frying-pans") &&
      lines.some((l) => l.id === "stock-pot") &&
      lines.some((l) => l.id === "dinner-plates" && l.n === 5) &&
      lines.some((l) => l.id === "soup-bowls" && l.n === 3) &&
      total === lines.reduce((t, l) => t + l.n, 0),
    `N8: the sink holds every plate, bowl, glass, pot and pan the orders used (${total} pieces)`,
  );
  // N9: one piece at a time: washing ONE pan leaves the other, costs one piece of soap
  const pans = serve(base, "dine-in", fry, 4);
  const soap0 = restaurantSuppliesOf(pans).soapPct;
  const wOne = handWash(pans, ["frying-pans"], 1);
  const afterOne = restaurantSuppliesOf(wOne.save);
  const opened = soap0 === 0 ? 100 : soap0;
  assert(
    wOne.washed === 1 &&
      dirtyOf(wOne.save, "frying-pans") === 1 &&
      // Pots and pans are counted apart from the tableware (the breakage seed and the $500 tiers keep their pace).
      afterOne.washedKitchen === restaurantSuppliesOf(pans).washedKitchen + 1 &&
      afterOne.washedTotal === restaurantSuppliesOf(pans).washedTotal &&
      Math.abs(afterOne.soapPct - (opened - SERVICE_SUPPLY_RULES.soapPerPiece)) < 1e-9,
    "N9: washing one pan washes one pan (one piece of soap); the other waits",
  );
  const wTwo = handWash(wOne.save, ["frying-pans"], 1);
  assert(
    dirtyOf(wTwo.save, "frying-pans") === 0 &&
      (restaurantSuppliesOf(wTwo.save).used["frying-pans"] ?? 0) === 0 &&
      handWash(wTwo.save, ["frying-pans"], 1).save === wTwo.save,
    "N10: the second pan is washed too; a clean pan starts counting its orders from zero; nothing left, nothing changes",
  );
  // The action the sink game sends does the same.
  const viaAction = applyCleanlinessAction(pans, { kind: "wash", ids: ["frying-pans"], each: 1 });
  const wholeLine = applyCleanlinessAction(pans, { kind: "wash", ids: ["frying-pans"] });
  assert(
    JSON.stringify(viaAction.save) === JSON.stringify(wOne.save) &&
      dirtyOf(wholeLine.save, "frying-pans") === 0,
    "N11: the wash action with `each: 1` washes one piece; without `each` it washes the whole line (closing, the Cleaner)",
  );
  // A half-washed set keeps its share.
  const refill = serve(wOne.save, "dine-in", fry, 3);
  assert(
    dirtyOf(refill, "frying-pans") >= 1 && dirtyOf(refill, "frying-pans") <= 2,
    "N12: after washing one pan, more orders dirty pans again — never above what you own",
  );
  // N13: the START wash-up washes the pots too and breaks none
  const started = washUp(day, 60);
  assert(
    sinkPieces(started.save) === 0 &&
      started.washed === total &&
      Object.keys(restaurantSuppliesOf(started.save).used).length === 0 &&
      units(started.save, "frying-pans") === units(day, "frying-pans") &&
      units(started.save, "stock-pot") === units(day, "stock-pot"),
    "N13: the START wash-up washes the pots too; nothing is lost (pots and pans never break)",
  );
  // N14: an old save without `used` still reads
  const old = structuredClone(day);
  delete (old.business.restaurantSupplies as { used?: unknown }).used;
  assert(
    Object.keys(restaurantSuppliesOf(old).used).length === 0 && sinkPieces(old) === total,
    "N14: an older save without `used` reads as nothing used, the sink unchanged",
  );
  // N15: every washable smallware has a picture
  const kd = read("src/game/restaurant/kitchenDirt.ts");
  const ids = [...kd.matchAll(/^\s+"?([a-z-]+)"?: \d+,/gm)].map((m) => m[1]!);
  assert(
    ids.length >= 12 &&
      ids.every((id) => DISH_ITEMS.some((t) => t.id === id)) &&
      !/Math\.random\(/.test(kd),
    `N15: every washable smallware (${ids.length}) has a sink picture; the rules are pure`,
  );
  assert(
    dishShapeFor("stock-pot" as SupplyId) === "pot" &&
      dishShapeFor("frying-pans" as SupplyId) === "pan" &&
      dishShapeFor("sheet-pans" as SupplyId) === "tray" &&
      dishShapeFor("ladles" as SupplyId) === "utensil" &&
      dishShapeFor("x" as SupplyId, "Cast-iron skillet") === "pan",
    "N16: pots, pans, trays and utensils get their own pictures (and a name decides for the rest)",
  );

  // N17: the pace — a patient, thorough scrub (zig-zag at 500 px/s) takes real time
  const paceOf = (shape: DishShape, seedN: number) => {
    const stains = dishStains(shape, dishSeed(seedN, "dinner-plates"));
    const marks = dishMarks(stains, shape);
    const wear = new Float64Array(marks.length);
    const r = DISH_BRUSH[shape];
    const b = marks.reduce(
      (acc, m) => ({
        x0: Math.min(acc.x0, m.point.x),
        x1: Math.max(acc.x1, m.point.x),
        y0: Math.min(acc.y0, m.point.y),
        y1: Math.max(acc.y1, m.point.y),
      }),
      { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 },
    );
    const step = 500 / 60; // px per event at 500 px/s
    let t = 0;
    let dir = 1;
    let row = 0;
    let x = b.x0;
    let y = b.y0;
    let prev = { x, y };
    for (let i = 0; i < 60 * 600; i++) {
      x += dir * step;
      if (x > b.x1 || x < b.x0) {
        dir = -dir;
        x = Math.max(b.x0, Math.min(b.x1, x));
        row++;
        y = b.y0 + ((row * r * 0.9) % (b.y1 - b.y0 + 1));
      }
      const cur = { x, y };
      const amount = scrubAmount(Math.hypot(cur.x - prev.x, cur.y - prev.y)) * DISH_SCRUB_RATE;
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const len = dx * dx + dy * dy;
      marks.forEach((m, k) => {
        const tough = stains[m.stain]!.toughness;
        if (wear[k]! >= tough) return;
        const u = len
          ? Math.max(0, Math.min(1, ((m.point.x - prev.x) * dx + (m.point.y - prev.y) * dy) / len))
          : 0;
        const d2 = (m.point.x - (prev.x + u * dx)) ** 2 + (m.point.y - (prev.y + u * dy)) ** 2;
        if (d2 <= r * r) wear[k] = Math.min(tough, wear[k]! + amount);
      });
      prev = cur;
      t += 1 / 60;
      if (cleanedShare(wear, marks, stains) >= 0.9) return t;
    }
    return Infinity;
  };
  // The rinse: the same ideal zig-zag (500 px/s) over the suds, rows one rinse reach apart.
  const rinseOf = (shape: DishShape) => {
    const pts = dishRinsePoints(shape);
    const dose = new Float64Array(pts.length);
    const reach = DISH_BRUSH[shape] * DISH_RINSE_REACH;
    const b = pts.reduce(
      (acc, q) => ({
        x0: Math.min(acc.x0, q.x),
        x1: Math.max(acc.x1, q.x),
        y0: Math.min(acc.y0, q.y),
        y1: Math.max(acc.y1, q.y),
      }),
      { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 },
    );
    const step = 500 / 60;
    let t = 0;
    let dir = 1;
    let row = 0;
    let x = b.x0;
    let y = b.y0;
    let prev = { x, y };
    for (let i = 0; i < 60 * 120; i++) {
      x += dir * step;
      if (x > b.x1 || x < b.x0) {
        dir = -dir;
        x = Math.max(b.x0, Math.min(b.x1, x));
        row++;
        // rows top to bottom, then back up (a whole piece is covered, never skipped by a wrap-around)
        const rows = Math.max(1, Math.ceil((b.y1 - b.y0) / (reach * 1.2)));
        const k = row % (2 * rows);
        y = b.y0 + Math.min(k, 2 * rows - k) * reach * 1.2;
      }
      const cur = { x, y };
      const amount = paceAmount(
        scrubAmount(Math.hypot(cur.x - prev.x, cur.y - prev.y)) * DISH_RINSE_RATE,
        1000 / 60,
      );
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const len = dx * dx + dy * dy;
      pts.forEach((q, k) => {
        const u = len
          ? Math.max(0, Math.min(1, ((q.x - prev.x) * dx + (q.y - prev.y) * dy) / len))
          : 0;
        const d2 = (q.x - (prev.x + u * dx)) ** 2 + (q.y - (prev.y + u * dy)) ** 2;
        if (d2 <= reach * reach) dose[k] = Math.min(1, dose[k]! + amount);
      });
      prev = cur;
      t += 1 / 60;
      if (dose.filter((d) => d >= 1).length / pts.length >= DISH_RINSE_THRESHOLD) return t;
    }
    return Infinity;
  };
  // Rule changed (developer 2026-11-08): "none of the dish utensils should exceed 5 s, if 5 is too much 4": EVERY piece, on the
  // WORST of 60 draws of dirt, is scrubbed clean and rinsed in 4 s or less (the earlier check read the quickest of five draws).
  const SHAPES = [
    "plate",
    "small-plate",
    "bowl",
    "cup-set",
    "glass",
    "jug",
    "shakers",
    "knife",
    "fork",
    "spoon",
    "pot",
    "pan",
    "tray",
    "utensil",
  ] as DishShape[];
  const draws = Array.from({ length: 60 }, (_, i) => i + 1);
  const worst = Object.fromEntries(
    SHAPES.map((sh) => [sh, Math.max(...draws.map((n) => paceOf(sh, n))) + rinseOf(sh)]),
  ) as Record<string, number>;
  const mean = Object.fromEntries(
    SHAPES.map((sh) => [sh, draws.reduce((t, n) => t + paceOf(sh, n), 0) / draws.length]),
  ) as Record<string, number>;
  console.log(
    "      worst scrub + rinse seconds (zig-zag, 500 px/s, 60 draws):",
    JSON.stringify(worst, (_, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)),
  );
  assert(
    Math.max(...Object.values(worst)) <= 4 &&
      // still a real scrub, never an instant tap: an average plate, pot or pan takes real scrubbing (about a second of scrub before the rinse)
      mean.plate! >= 0.8 &&
      mean.pan! >= 0.8 &&
      mean.pot! >= 0.8 &&
      DISH_TOUGH >= 1.6 &&
      DISH_SCRUB_RATE <= 0.25,
    "N17: the pace — EVERY dish piece (plate, bowl, glass, cutlery, pot, pan, tray, utensil) is scrubbed and rinsed in 4 s or less even on the worst of 60 draws of dirt, and an average plate, pot or pan still takes real scrubbing (0.8 s+ before the rinse)",
    { worst, mean },
  );
  // N17b: a frantic scribble is no quicker than a steady scrub (the pace cap per second)
  const perSec = (pxPerSec: number, hz: number) => {
    const stroke = pxPerSec / hz;
    return paceAmount(scrubAmount(stroke) * DISH_SCRUB_RATE, 1000 / hz) * hz;
  };
  const steady = perSec(500, 60);
  assert(
    perSec(3000, 60) <= steady * 1.05 &&
      perSec(3000, 240) <= steady * 1.05 &&
      perSec(12000, 120) <= steady * 1.05 &&
      DISH_MAX_WEAR_PER_SEC <= 4,
    `N17b: scribbling at 3000 px/s wears no faster than a steady 500 px/s (${perSec(3000, 60).toFixed(2)} vs ${steady.toFixed(2)} a second)`,
  );
  // N18: the rinse — suds to wash off every piece
  const rinseOk = (
    [
      "plate",
      "pot",
      "pan",
      "tray",
      "glass",
      "fork",
      "knife",
      "spoon",
      "utensil",
      "bowl",
      "jug",
      "shakers",
      "cup-set",
      "small-plate",
    ] as DishShape[]
  ).every(
    (sh) =>
      dishRinsePoints(sh).length >= 6 &&
      dishRinsePoints(sh).every((p) => inDishSurface(p.x, p.y, sh)),
  );
  assert(
    rinseOk && DISH_RINSE_THRESHOLD >= 0.8 && DISH_RINSE_THRESHOLD < 1,
    "N18: every piece has points to rinse, all on the piece; the rinse needs 80 %+ of them (was 93 %: one quick pass of water, developer 2026-11-08)",
  );
  // N20: the soap estimate is honest — a full sink needs its pieces' share, so "services left" is not a guess
  const emptySink = bottleView(stocked(saveAt(60), { "dish-soap": 1 }), "dish-soap");
  const fullSink = bottleView(stocked(day, { "dish-soap": 1 }), "dish-soap");
  assert(
    fullSink.usePer >= Math.ceil(total * SERVICE_SUPPLY_RULES.soapPerPiece) &&
      fullSink.usePer >= emptySink.usePer &&
      emptySink.usePer === SERVICE_SUPPLY_RULES.soapPerWashUp,
    `N20: dish soap "services left" counts what is in the sink (${total} pieces use ${fullSink.usePer}% a wash, an empty sink ${emptySink.usePer}%)`,
  );
  // N19: wiring — one piece at a time, then the rinse, then the rack
  const game = read("src/components/kc/restaurant/WashUpSink.tsx");
  assert(
    /const \[queue\] = useState/.test(game) &&
      /startRinse\(\)/.test(game) &&
      /rinseSegment\(/.test(game) &&
      /paintFoam\(/.test(game) &&
      /data-testid="wash-up-foam"/.test(game) &&
      /data-rack=\{item\.id\}/.test(game) &&
      /DISH_SCRUB_RATE/.test(game) &&
      /paceAmount\(amount, dt\)|paceAmount\(/.test(game) &&
      !/setWashedPieces\(\(p\) => p \+ activeItem\.n\)/.test(game),
    "N19: the sink queues every piece, scrubs (slowly), rinses off the suds, then racks it — one washed piece at a time",
  );
}

console.log(failures ? `DISH WASHING QA: ${failures} FAILURE(S)` : "DISH WASHING QA: ALL PASS");
process.exit(failures ? 1 : 0);
