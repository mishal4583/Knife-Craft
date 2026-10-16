/**
 * RESTAURANT MENU ORDER QA (developer 2026-10-16; restaurant/restaurantMenu.ts,
 * kc/business/BusinessMenu.tsx).
 *
 *  O  The menu lists dishes in the order the 150-level campaign brings them:
 *     the level a dish joins the menu, then the level its recipe is first
 *     cooked, then the catalog. On / off never moves a dish.
 *  T  On / off is a toggle switch (role="switch", aria-checked).
 *  P  Popular restaurant (≥ 60/100): a tip suggests raising prices by
 *     (popularity − 50) ÷ 2.5 % — +4 % at 60, +12 % at 80, +20 % at 100.
 *
 * Run: npx tsx scripts/restaurant-menu-order-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  campaignOrderKey,
  inCampaignOrder,
  unlockedMenuDishes,
} from "../src/game/restaurant/restaurantMenu.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) => fs.readFileSync(path.join(import.meta.dirname, "..", p), "utf8");
const view = read("src/components/kc/business/BusinessMenu.tsx");

console.log("O. Campaign order");
{
  const all = inCampaignOrder(unlockedMenuDishes(150));
  const keys = all.map(campaignOrderKey);
  const ascending = keys.every((k, i) => {
    if (i === 0) return true;
    const p = keys[i - 1]!;
    for (let n = 0; n < 3; n++) if (k[n] !== p[n]) return k[n]! > p[n]!;
    return true;
  });
  assert(
    all.length === unlockedMenuDishes(150).length && ascending,
    `O1: all ${all.length} dishes in campaign order (joins the menu, first cooked, catalog)`,
  );
  const reversed = inCampaignOrder([...unlockedMenuDishes(150)].reverse());
  assert(
    reversed.map((d) => d.id).join() === all.map((d) => d.id).join(),
    "O2: the order never depends on the input order",
  );
  assert(
    /const shown = restaurant \? inCampaignOrder\(filtered\) : filtered;/.test(view) &&
      !/activeIds\.has\(b\.id\)/.test(view),
    "O3: the menu shows the campaign order; turning a dish off never moves it (no on-first sort)",
  );
}

console.log("T. Toggle switch");
assert(
  /role="switch"/.test(view) && /aria-checked=\{onMenu\}/.test(view),
  "T1: on / off is a toggle switch with aria-checked",
);

console.log("P. Popular-price tip");
assert(
  /const POPULAR_TIP_FROM = 60;/.test(view) &&
    /Math\.round\(\(popularity\.popularity - 50\) \/ 2\.5\)/.test(view),
  "P1: from popularity 60 a tip suggests raising prices by (popularity − 50) ÷ 2.5 %",
);

console.log(failures ? `\nMENU ORDER QA: ${failures} FAILURE(S)` : "\nMENU ORDER QA: ALL PASS");
process.exit(failures ? 1 : 0);
