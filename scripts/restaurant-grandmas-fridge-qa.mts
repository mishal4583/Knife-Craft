/**
 * GRANDMA'S FRIDGE QA — the feature is RETIRED (developer redesign 2026-10-15,
 * commit 0b2ce52: "ingredients are purchased in the Market from Level 3
 * onward; there is no free pantry or ingredient handout").
 *
 * Re-baselined 2026-10-17 (developer: "fix it according to your plan"). The
 * old suite (L / C / R / T / P / S / I / F / E, in git history before this
 * date) tested the Level 3 leftovers, Grandma's pantry and the Level 12–14
 * fridge notes — all removed by that redesign. What it checks now:
 *
 *  R  Retired APIs stay as no-ops for old saves: no leftovers, giving them
 *     changes nothing, no fridge note on any level, no pantry export; an old
 *     save's legacy record still reads (never dropped).
 *  C  Stock from Level 3: Levels 1–2 use none; from Level 3 a level's own
 *     order takes exactly its planned ingredients (no money moves); an empty
 *     fridge refuses the serve with nothing taken, the Pre-Service Check
 *     applies, and with $0 an ad or supplier credit covers it (no
 *     soft-lock); a replay uses nothing.
 *  W  Wiring: no screen imports the retired fridge helpers.
 *
 * Run: npx tsx scripts/restaurant-grandmas-fridge-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import type { IngredientId } from "../src/game/definitions.ts";
import {
  giveGrandmasLeftovers,
  grandmasFridgeNoteFor,
  grandmasFridgeOf,
  leftoversFor,
} from "../src/game/restaurant/grandmasFridge.ts";
import * as campaignStockModule from "../src/game/restaurant/campaignStock.ts";
import {
  consumeCampaignOrderStock,
  orderRequirements,
  serviceUsesStock,
} from "../src/game/restaurant/campaignStock.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import { coverFor } from "../src/game/restaurant/serviceCover.ts";
import { ticketsFor } from "../src/game/restaurant/serviceTickets.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const level = (n: number) => getLevel(`level-${n}`)!;
const at = (s: SaveData, n: number): SaveData => ({
  ...s,
  levelProgress: {
    ...s.levelProgress,
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 2,
  },
});
const fresh = (n: number, credits = 300_000): SaveData =>
  at({ ...DEFAULT_SAVE, credits, business: { ...DEFAULT_SAVE.business, inventory: {} } }, n);
const qty = (s: SaveData, id: IngredientId) => getQuantity(s.business.inventory, id);
/** Opens level n (its tickets saved, as the game does) and returns the save + its recipe. */
function open(s: SaveData, n: number) {
  const t = ticketsFor(s.levelProgress, level(n));
  return { save: { ...s, levelProgress: t.progress }, recipe: t.tickets[0]! };
}

console.log("R. Retired, kept as no-ops for old saves");
{
  const s3 = fresh(3);
  const given = giveGrandmasLeftovers(s3);
  const notes = Array.from({ length: 15 }, (_, i) =>
    grandmasFridgeNoteFor(s3, level(i + 1), i + 1),
  );
  assert(
    leftoversFor(s3).length === 0 &&
      given === s3 &&
      notes.every((n) => n === null) &&
      !("pantryForMissing" in campaignStockModule),
    "R1: no leftovers, giving them changes nothing (no stock, money or ledger), no fridge note on Levels 1–15, no pantry",
  );
  const legacy = {
    ...s3,
    business: {
      ...s3.business,
      grandmasFridge: { atLevel: 3, lines: [{ ingredientId: "tomato", quantity: 1 }] },
    },
  } as SaveData;
  assert(
    grandmasFridgeOf(legacy)?.atLevel === 3 && grandmasFridgeOf(s3) === null,
    "R2: an old save's legacy record still reads (never dropped); a new save has none",
  );
}

console.log("C. Stock from Level 3");
{
  assert(
    !serviceUsesStock(1) && !serviceUsesStock(2) && serviceUsesStock(3),
    "C1: Levels 1–2 use no stock; from Level 3 every order uses its real ingredients",
  );
  const { save: opened, recipe } = open(fresh(3), 3);
  const needs = orderRequirements(opened, recipe);
  let stocked = opened;
  for (const r of needs)
    stocked = {
      ...stocked,
      business: {
        ...stocked.business,
        inventory: addStock(
          stocked.business.inventory,
          r.ingredientId,
          r.quantity,
          100,
          stocked.business.calendar.businessDay,
        ),
      },
    };
  const served = consumeCampaignOrderStock(stocked, 3, recipe, true);
  assert(
    served.ok &&
      needs.every((r) => qty(served.save, r.ingredientId) === 0) &&
      served.save.credits === stocked.credits &&
      served.save.economyLedger.length === stocked.economyLedger.length,
    "C2: Level 3's order takes exactly its planned ingredients once; no money moves",
    { needs, ok: served.ok },
  );
  const empty = consumeCampaignOrderStock(opened, 3, recipe, true);
  const plan = servicePlanFor(opened, level(3))!;
  const brokePlan = servicePlanFor({ ...opened, credits: 0 }, level(3))!;
  assert(
    !empty.ok &&
      empty.reason === "missingStock" &&
      plan.check.applies &&
      !plan.check.ready &&
      servicePlanNeedsSheet(plan) &&
      coverFor(brokePlan, "stock") !== null,
    "C3: an empty fridge refuses the serve (nothing taken); the check opens; with $0 an ad or supplier credit covers it (no soft-lock)",
  );
  const replay = consumeCampaignOrderStock(stocked, 3, recipe, false);
  assert(
    replay.ok &&
      needs.every((r) => qty(replay.save, r.ingredientId) === qty(stocked, r.ingredientId)),
    "C4: a replay (no order owed) uses nothing",
  );
}

console.log("W. Wiring");
{
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) files.push(p);
    }
  };
  walk(path.join(root, "src/components"));
  files.push(path.join(root, "src/App.tsx"));
  const users = files.filter((f) => /grandmasFridge/.test(fs.readFileSync(f, "utf8")));
  assert(users.length === 0, "W1: no screen uses the retired fridge helpers", users);
}

console.log(
  failures ? `\nGRANDMA'S FRIDGE QA: ${failures} FAILURE(S)` : "\nGRANDMA'S FRIDGE QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
