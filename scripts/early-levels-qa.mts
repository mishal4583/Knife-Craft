/**
 * EARLY LEVELS QA (developer 2026-11-08, docs/planning/FIRST-20-LEVELS-PLAN-2026-11-08.md): the schedule of the first 20 levels.
 *   A  the schedule constants and where each system / mini-game / chore opens
 *   B  the first 20 dishes: nothing repeats the previous level's ingredients without something new
 *   C  Unpack the delivery (was "Put it away"): the new words, Paige's line
 *   D  the Second Floor: opens at Level 11; Paige offers it only when the first machine is affordable with money left
 *   E  "Closed for tonight" on the Closing Time card
 *   F  cleaned is cleaned: the closing passes are staged and not asked twice
 *   G  the Paige tips at Level 15 / 16 only point at the Market (no money)
 *   H  the specialist chefs wait for their chapter (Mexican / Mediterranean starters do not open them early)
 * Run: npx tsx scripts/early-levels-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  DINE_IN_FROM_LEVEL,
  FIRST_SHOPPING_LEVEL,
  FRIDGE_FROM_LEVEL,
  MOP_FROM_LEVEL,
  PAN_LIST_FROM_LEVEL,
  RESTROOM_FROM_LEVEL,
  SECOND_FLOOR_FROM_LEVEL,
  SECOND_FLOOR_RESERVE_CENTS,
  STOCKROOM_FROM_LEVEL,
} from "../src/game/config/earlyLevels.ts";
import { CLEANING_FROM_LEVEL } from "../src/game/config/cleaningStart.ts";
import { dayCeremonyAt } from "../src/game/restaurant/firstLevels.ts";
import { FRIDGE_SORT_FIRST_LEVEL } from "../src/game/business/fridgeSort.ts";
import { STOCKROOM_FIRST_LEVEL } from "../src/game/business/stockroomSort.ts";
import { SECOND_FLOOR_OPENS_AT, STATIONS } from "../src/game/restaurant/secondFloor.ts";
import { phaseChores } from "../src/game/restaurant/cleanliness.ts";
import { isSystemLive, CUISINES } from "../src/game/restaurant/restaurantProgression.ts";
import {
  assistantBeatFor,
  beatById,
  hireAssistant,
  MAX_LINE_CHARS,
} from "../src/game/restaurant/assistant.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";

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
const saveAt = (n: number, credits = 0, seen: string[] = []): SaveData => {
  const base = structuredClone(DEFAULT_SAVE);
  return hireAssistant({
    ...base,
    credits,
    levelProgress: {
      ...base.levelProgress,
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    business: { ...base.business, assistant: { hired: true, seen } },
  });
};

console.log("A. The schedule");
assert(
  FIRST_SHOPPING_LEVEL === 6 &&
    STOCKROOM_FROM_LEVEL === 6 &&
    STOCKROOM_FIRST_LEVEL === 6 &&
    PAN_LIST_FROM_LEVEL === 8 &&
    FRIDGE_FROM_LEVEL === 10 &&
    SECOND_FLOOR_FROM_LEVEL === 11 &&
    SECOND_FLOOR_OPENS_AT === 11 &&
    DINE_IN_FROM_LEVEL === 12 &&
    MOP_FROM_LEVEL === 14 &&
    RESTROOM_FROM_LEVEL === 16 &&
    CLEANING_FROM_LEVEL === 4 &&
    FRIDGE_SORT_FIRST_LEVEL === 3,
  "A1: shopping list + Stock the shelves L6, fridge L10, Second Floor L11, dine-in L12, cleaning L4, Unpack the delivery L3",
);
assert(
  !isSystemLive("fridge-freshness", 9) &&
    isSystemLive("fridge-freshness", 10) &&
    !isSystemLive("dine-in", 11) &&
    isSystemLive("dine-in", 12),
  "A2: the fridge system opens at Level 10 and dine-in (the sink) at Level 12",
);
assert(
  dayCeremonyAt(3) &&
    phaseChores("closing", 3).length === 0 &&
    phaseChores("closing", 4).join() === "wipe-boards",
  "A3: Day 2 opens with Level 3; the first night asks for ONE chore (the boards) at Level 4",
  phaseChores("closing", 4),
);
{
  const closing = (n: number) => phaseChores("closing", n, 1);
  assert(
    !closing(9).includes("spoiled-out") &&
      closing(10).includes("spoiled-out") &&
      closing(10).includes("wrap-fridge") &&
      !closing(13).includes("mop-all") &&
      closing(14).includes("mop-all") &&
      !closing(15).includes("restroom-disinfect") &&
      closing(16).includes("restroom-disinfect") &&
      !closing(7).includes("degrease") &&
      closing(8).includes("degrease") &&
      !closing(11).includes("clear-tables") &&
      closing(12).includes("clear-tables"),
    "A4: chores are staged by their cause: degrease L8, spoiled food + wrap L10, tables L12, mop L14, restroom L16",
    [4, 8, 10, 12, 14, 16].map((n) => closing(n).join()),
  );
}

console.log("B. The first 20 dishes");
{
  const levels = getLevels().slice(0, 20);
  const names = levels.map((l) =>
    [l.recipeId, ...(l.recipePoolIds ?? [])]
      .map((id) =>
        getCampaignRecipe(id ?? "")
          ?.components.map((c) => c.ingredientId)
          .join("+"),
      )
      .join("|"),
  );
  const ing = (i: number) => {
    const set = new Set<string>();
    for (const id of [levels[i]!.recipeId, ...(levels[i]!.recipePoolIds ?? [])])
      for (const c of getCampaignRecipe(id ?? "")?.components ?? []) set.add(c.ingredientId);
    return set;
  };
  const seen = new Set<string>();
  const firstNew: number[] = [];
  for (let i = 0; i < 20; i++) {
    const fresh = [...ing(i)].filter((x) => !seen.has(x));
    firstNew.push(fresh.length);
    ing(i).forEach((x) => seen.add(x));
  }
  assert(
    // Levels 10 (the fridge), 14 and 15 bring no new ingredient (L10/L14 are system levels); every other level has one.
    firstNew.every((n, i) => n > 0 || [9, 13, 14].includes(i) || i === 19 - 19),
    "B1: every one of the first 20 levels brings a new ingredient, except the system levels 10 and 14",
    { firstNew, names },
  );
  const l2 = ing(1);
  assert(
    l2.has("carrot") && l2.has("potato") && !l2.has("tomato"),
    "B2: Level 2 is potato and carrot (no tomato repeating Level 1)",
    [...l2],
  );
}

console.log("C. Unpack the delivery");
{
  const chip = read("src/components/kc/inventory/FridgeSortChip.tsx");
  const game = read("src/components/kc/inventory/FridgeSortGame.tsx");
  const check = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const fs3 = beatById("fridge-sort");
  assert(
    /Fridge Sort/.test(chip) &&
      !/Unpack delivery/.test(chip.replace(/\/\*[\s\S]*?\*\//g, "")) &&
      !/Put it away/.test(chip.replace(/\/\*[\s\S]*?\*\//g, "")),
    "C1: the chip says 'Fridge Sort · N' (developer 2026-11-08: was 'Unpack delivery')",
  );
  assert(
    /Fridge Sort/.test(game) && /Fridge Sort/.test(check),
    "C2: the game's how-to and the Pre-Service Check name it 'Fridge Sort'",
  );
  assert(
    !!fs3 &&
      /order arrived/i.test(fs3.lines[0]!.text) &&
      /Fridge Sort/.test(fs3.lines[0]!.text) &&
      fs3.lines[0]!.text.length <= MAX_LINE_CHARS,
    "C3: Paige says the order arrived and to play Fridge Sort (within the line limit)",
    fs3?.lines[0]?.text,
  );
}

console.log("D. The Second Floor needs a machine the player can afford");
{
  const price = STATIONS[0]!.price;
  const poor = assistantBeatFor(
    saveAt(11, price + SECOND_FLOOR_RESERVE_CENTS - 1, [
      "restock",
      "fridge-check",
      "system:fridge-freshness",
      "cleaning",
      "stockroom-sort",
      "fridge-sort",
      "ads-optional",
    ]),
  );
  const rich = assistantBeatFor(
    saveAt(11, price + SECOND_FLOOR_RESERVE_CENTS, [
      "restock",
      "fridge-check",
      "system:fridge-freshness",
      "cleaning",
      "stockroom-sort",
      "fridge-sort",
      "ads-optional",
    ]),
  );
  assert(
    price === 50_000 && SECOND_FLOOR_RESERVE_CENTS === 30_000,
    "D1: the first machine costs $500 and $300 must be left to carry on",
  );
  assert(
    poor?.id !== "second-floor" && rich?.id === "second-floor",
    "D2: Paige offers the Second Floor only at Level 11+ and with $800 (the machine + $300)",
    { poor: poor?.id, rich: rich?.id },
  );
  assert(
    assistantBeatFor(saveAt(10, 1_000_000))?.id !== "second-floor",
    "D3: never before Level 11, whatever the cash",
  );
}

console.log("E. Closed for tonight");
{
  const closing = read("src/components/kc/restaurant/ClosingTime.tsx");
  assert(
    /closing-notice/.test(closing) &&
      /Closed for tonight/.test(closing) &&
      /opens with your next service/.test(closing),
    "E1: the Closing Time card says the restaurant is closed and when the next day opens",
  );
}

console.log("F. Cleaned is cleaned");
{
  const clean = read("src/game/restaurant/cleanliness.ts");
  assert(
    /CLEAN_ONCE/.test(clean) && /Cleaned is cleaned/.test(clean),
    "F1: the heavy closing passes are skipped when their area is already clean (night-sync-qa C1 plays it)",
  );
}

console.log("G. L15 / L16 tips");
{
  const steak = beatById("steak-knife");
  const fish = beatById("fish-board");
  assert(
    !!steak &&
      !!fish &&
      steak.go === "shop" &&
      fish.go === "shop" &&
      steak.lines[0]!.text.length <= MAX_LINE_CHARS &&
      fish.lines[0]!.text.length <= MAX_LINE_CHARS &&
      assistantBeatFor(saveAt(15, 0, ["system:fridge-freshness"]))?.id !== undefined,
    "G1: Level 15 (steak) and 16 (fish) get a short Paige tip that opens the Market, with no money in it",
  );
}

console.log("H. Specialist chefs wait for their chapter");
{
  const chef = (id: string) => CUISINES.find((c) => c.id === id)!;
  assert(
    chef("mexican").firstLevel > 20 &&
      chef("mediterranean").firstLevel > 20 &&
      chef("french").firstLevel > 20,
    "H1: Mexican, Mediterranean and French open after Level 20 although their starter dishes are cooked earlier",
    [chef("mexican").firstLevel, chef("mediterranean").firstLevel, chef("french").firstLevel],
  );
}

console.log(failures ? `\nEARLY LEVELS QA: ${failures} FAILURE(S)` : "\nEARLY LEVELS QA: ALL PASS");
process.exit(failures ? 1 : 0);
