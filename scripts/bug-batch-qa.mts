/**
 * BUG BATCH QA (developer 2026-11-08, "Bugs and Issues KnifeCraft.docx", items 1-11). The rules that are pure; the pictures are checked in
 * tools/e2e/bugbatch.mjs.
 *   1  the restroom picture no longer resizes when wiping starts (a fixed-height hint slot and status line)
 *   2  Paige is a popup over a dimmed, blurred screen
 *   3  congratulations: the ranking climbed, popularity rose, a spotless run (celebrations.ts)
 *   4  the first machine: save up, then buy it with money left (floorGuide.ts)
 *   7  the 2nd floor button
 *   9  seated guests face the table
 *  10  international names
 *  11  no "Next Customer" for the first 20 levels; chips for what to do instead (afterServe.ts)
 *  (5 and 6, the cutting speed and the tap magnet, are tap-cut-qa; 8, the NPC size, is people.css read below)
 * Run: npx tsx scripts/bug-batch-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  POPULARITY_CARD_DELTA,
  SPOTLESS_RUN_FOR_THANKS,
  celebrationFor,
} from "../src/game/restaurant/celebrations.ts";
import { firstMachineGuide, firstMachineNeeded } from "../src/game/restaurant/floorGuide.ts";
import { STATIONS } from "../src/game/restaurant/secondFloor.ts";
import { SECOND_FLOOR_RESERVE_CENTS } from "../src/game/config/earlyLevels.ts";
import {
  MAX_AFTER_SERVE_CHIPS,
  afterServeChips,
  nextCustomerHidden,
} from "../src/game/restaurant/afterServe.ts";
import { CUSTOMERS } from "../src/game/customers/customerDefinitions.ts";
import { PEOPLE_LOOKS } from "../src/game/restaurant/peopleLooks.ts";
import { MAX_LINE_CHARS, beatById } from "../src/game/restaurant/assistant.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const saveAt = (n: number, credits = 0): SaveData => {
  const b = structuredClone(DEFAULT_SAVE);
  return {
    ...b,
    credits,
    levelProgress: {
      ...b.levelProgress,
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  };
};

console.log("1. The restroom picture stays still");
{
  const src = read("src/components/kc/business/AreaCleaningPrototype.tsx");
  assert(
    /data-testid="cleaning-hint-slot"/.test(src) &&
      /mb-1 h-8/.test(src) &&
      /mt-1 flex h-5 items-center justify-center overflow-hidden whitespace-nowrap/.test(src) &&
      !/min-h-6 items-center justify-center gap-1/.test(src),
    "1a: the tool hint has a fixed 32 px slot and the status line a fixed single line, so the footer never changes height and the room never resizes",
  );
}

console.log("2. Paige is a popup");
{
  const host = read("src/components/kc/assistant/AssistantHost.tsx");
  assert(
    /data-testid="assistant-scrim"/.test(host) &&
      /backdrop-blur/.test(host) &&
      /bg-walnut-dark\/55/.test(host) &&
      /PaigeCutout/.test(host) &&
      /PaigeNameplate/.test(host) &&
      !/paige-bubble/.test(host),
    "2a: Paige's popup over a dimmed and blurred screen (developer 2026-11-11: a standalone cutout, one big speech bubble and a PAIGE nameplate; was the shared card with a round portrait)",
  );
  assert(
    /shadow-\[0_0_0_200vmax/.test(host),
    "2b: what she points at is left bright by a spotlight (no blur there), with the ring on it",
  );
  const long = ["fridge-sort", "second-floor", "steak-knife"].map(
    (id) => beatById(id)!.lines[0]!.text.length,
  );
  assert(
    long.every((n) => n <= MAX_LINE_CHARS),
    "2c: her lines still fit the popup",
    long,
  );
}

console.log("3. Congratulations");
{
  assert(
    celebrationFor({ rank: null, popularity: null, spotlessStreak: 0 }) === null &&
      celebrationFor({
        rank: null,
        popularity: { before: 50, after: 50 + POPULARITY_CARD_DELTA - 1 },
        spotlessStreak: 1,
      }) === null,
    "3a: nothing worth a card, no card",
  );
  const rank = celebrationFor({
    rank: { from: 41, to: 40, passed: "🍝 Curry Corner" },
    popularity: null,
    spotlessStreak: 0,
  })!;
  assert(
    rank.kind === "rank" &&
      /#40/.test(rank.title) &&
      rank.lines.some((l) => /Curry Corner/.test(l)) &&
      rank.paige.length > 0,
    "3b: a climb in the city ranking: the new place, who was passed, and Paige's words",
    rank,
  );
  const pop = celebrationFor({
    rank: null,
    popularity: { before: 50, after: 50 + POPULARITY_CARD_DELTA },
    spotlessStreak: 0,
  })!;
  assert(
    pop.kind === "popularity" && pop.lines.some((l) => /Popularity 50 → 5\d/.test(l)),
    "3c: rising popularity gets a card with the numbers",
    pop,
  );
  const thanks = celebrationFor({
    rank: null,
    popularity: null,
    spotlessStreak: SPOTLESS_RUN_FOR_THANKS,
  })!;
  assert(
    thanks.kind === "spotless" && /spotless/i.test(thanks.paige),
    "3d: a spotless run earns Paige's appreciation for keeping the restaurant clean",
    thanks,
  );
  const all = celebrationFor({
    rank: { from: 5, to: 4, passed: "x" },
    popularity: { before: 40, after: 60 },
    spotlessStreak: 3,
  })!;
  assert(
    all.lines.length === 4 && /spotless/i.test(all.paige),
    "3e: everything at once is ONE card with every line",
    all.lines,
  );
  const app = read("src/App.tsx");
  assert(
    /celebrationFor\(/.test(app) && /<CelebrationCard/.test(app) && /setCelebration/.test(app),
    "3f: the app shows it after a first completion and after a night's close",
  );
}

console.log("4. The first machine, step by step");
{
  const price = STATIONS[0]!.price;
  const need = firstMachineNeeded(price);
  assert(
    need === price + SECOND_FLOOR_RESERVE_CENTS,
    "4a: it needs the price + the reserve for food and wages",
  );
  assert(
    firstMachineGuide(saveAt(10, 1_000_000), 10, 1_000_000) === null,
    "4b: nothing before the floor opens (Level 11)",
  );
  const short = firstMachineGuide(saveAt(11), 11, need - 1_00)!;
  assert(
    short.stage === "save" && short.missing === 100 && short.price === price && short.fraction < 1,
    "4c: short of the money: 'save' with what is missing",
    short,
  );
  const ready = firstMachineGuide(saveAt(11), 11, need)!;
  assert(
    ready.stage === "buy" && ready.missing === 0 && ready.fraction === 1,
    "4d: with the price + the reserve: 'buy'",
    ready,
  );
  const owned = saveAt(11);
  owned.business = {
    ...owned.business,
    secondFloor: {
      ...(owned.business.secondFloor ?? {}),
      stations: { coffee: { level: 1, lastCollectAt: 0 } },
    },
  } as SaveData["business"];
  assert(
    firstMachineGuide(owned, 11, need) === null,
    "4e: with a machine the ordinary 'Next:' goal strip takes over",
  );
  const view = read("src/components/kc/restaurantMap/SecondFloorView.tsx");
  const market = read("src/components/kc/MarketSecondFloor.tsx");
  assert(
    /data-testid="floor-first-machine"/.test(view) &&
      /reserveShort/.test(view) &&
      /firstMachineNeeded/.test(market),
    "4f: the floor shows the step (a progress bar, then a pointing hand at Buy) and neither the floor nor the Market sells the FIRST machine without the reserve",
  );
}

console.log("7. The 2nd floor button");
{
  const btn = read("src/components/kc/restaurantMap/UpstairsButton.tsx");
  const css = read("src/components/kc/restaurantMap/upstairs.css");
  const router = read("src/ScreensRouter.tsx");
  assert(
    /data-testid="upstairs"/.test(btn) &&
      /upstairs-glow/.test(btn) &&
      /upstairs-chip/.test(btn) &&
      /<UpstairsButton/.test(router),
    "7a: the map uses the medallion button (data-testid upstairs kept), a glow when there is a reason to go up, a chip for the money or 'New!'",
  );
  assert(
    /min-height: 56px/.test(css) &&
      /kc-reduced-motion \.upstairs-glow/.test(css) &&
      !/\bwidth:\s*\d+px;\s*height/.test(css.split(".upstairs-medal")[0]!),
    "7b: 56 px tall (touch target), Reduced Motion turns the glow off",
  );
}

console.log("8, 9. The people");
{
  const css = read("src/components/kc/restaurantMap/people.css");
  const poses = read("src/components/kc/restaurantMap/GuestPoses.tsx");
  const life = read("src/components/kc/restaurantMap/FloorLife.tsx");
  assert(
    /clamp\(29px, 9\.6vw, 56px\)/.test(css) && /124%/.test(css),
    '8: a person is about 0.6 of the size it was (map 9.6vw up to 56 px, was 16vw up to 92 px, and 10.5vw / 62 px before the developer\'s "only a little smaller" of 2026-11-08; the dining room 124%, was 190% then 135%)',
  );
  assert(
    /guest-back-view/.test(poses) &&
      /col=\{1\} row=\{1\}/.test(poses) &&
      /back: true/.test(life) &&
      /\.cs-back/.test(css),
    "9: a seated guest is the back view (they face the table, away from the camera), in the dining room and on the map",
  );
}

console.log("10. Names");
{
  const names = CUSTOMERS.map((c) => c.name);
  const indian = ["Priya", "Sana", "Meera", "Arjun", "Rohan", "Anika", "Amir"];
  assert(
    names.length === 12 && new Set(names).size === 12 && !names.some((n) => indian.includes(n)),
    "10a: twelve different regulars, none with an Indian or Arabic name from the old list",
    names,
  );
  assert(
    ["Emma", "Lucas", "Sofia", "Mia", "Mateo", "Liam", "Isabella", "Chloé"].every((n) =>
      names.includes(n),
    ),
    "10b: the popular international names are in",
  );
  assert(
    CUSTOMERS.every((c) => !!PEOPLE_LOOKS[c.id]),
    "10c: every regular still has its painted look (the ids, which name the portraits, did not change)",
  );
}

console.log("11. Between customers");
{
  assert(
    nextCustomerHidden(1) && nextCustomerHidden(20) && !nextCustomerHidden(21),
    "11a: no 'Next Customer' through Level 20",
  );
  const rich = saveAt(6, 5_000);
  const chips = afterServeChips(rich);
  assert(chips.length <= MAX_AFTER_SERVE_CHIPS, "11b: at most three things to do", chips);
  const card = read("src/components/kc/game/ServiceOrderComplete.tsx");
  const app = read("src/App.tsx");
  assert(
    /data-testid="after-serve"/.test(card) &&
      /afterServe \? "wood" : "ghost"/.test(card) &&
      /nextCustomerHidden\(levelNumber\(activeLevel\.id\)\)/.test(app),
    "11c: the card has no Next Customer while it applies; 'Back to Kitchen' is the main button; the chips open the real screens",
  );
}

console.log(failures ? `\nBUG BATCH QA: ${failures} FAILURE(S)` : "\nBUG BATCH QA: ALL PASS");
process.exit(failures ? 1 : 0);
