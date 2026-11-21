/**
 * DISH ART QA (developer 2026-11-21: the starting card like his mock-up, and dish pictures for the card and the plates on the tables).
 *  A. The sheets' manifest (scripts/dish-sheets.json) lists every one of the 221 recipes exactly once, in 4 x 4 sheets, and every id is a real recipe.
 *  B. The registry (src/game/dishArtFiles.ts) only names dishes that are in the manifest and that have their file in public/dishes/; no picture is orphaned.
 *  C. The lookup returns a picture only for a registered dish, and null (the icon on a plate) otherwise, never a broken address.
 *  D. The card (OrderArrivalCard.tsx) is the mock-up's: the banner with the hat and leaves, the dish row, the line, the plate on a cloth, "Start cooking" between two laurels, the
 *     Prep Cook button and the Auto switch (each button at least 48 px), nothing taller than the screen; ServiceFloor uses it and its plates use the dish picture.
 * Run: npx tsx scripts/dish-art-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { DISH_ART_IDS } from "../src/game/dishArtFiles.ts";
import { dishArtUrl } from "../src/game/dishArt.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail).slice(0, 300));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const recipes = (CAMPAIGN_RECIPES as unknown as { id: string }[]).map((r) => r.id);

console.log("A. The sheets");
const sheets = JSON.parse(read("scripts/dish-sheets.json")) as {
  sheet: string;
  cols: number;
  rows: number;
  dishes: { id: string }[];
}[];
{
  const ids = sheets.flatMap((s) => s.dishes.map((d) => d.id));
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const missing = recipes.filter((id) => !ids.includes(id));
  const unknown = ids.filter((id) => !recipes.includes(id));
  assert(
    ids.length === recipes.length &&
      dup.length === 0 &&
      missing.length === 0 &&
      unknown.length === 0,
    `A1: all ${recipes.length} recipes are in the manifest exactly once`,
    { dup, missing, unknown },
  );
  assert(
    sheets.every(
      (s) => s.cols === 4 && s.rows === 4 && s.dishes.length <= 16 && /^DS-\d\d$/.test(s.sheet),
    ),
    `A2: ${sheets.length} sheets of at most 16 dishes in 4 x 4 cells`,
  );
}

console.log("B. The registry");
{
  const known = new Set(sheets.flatMap((s) => s.dishes.map((d) => d.id)));
  const dir = path.join(ROOT, "public/dishes");
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".webp"))
        .map((f) => f.slice(0, -5))
    : [];
  const registered = [...DISH_ART_IDS];
  assert(
    registered.every((id) => known.has(id) && files.includes(id)),
    "B1: every registered dish is in the manifest and has its file",
    registered.filter((id) => !known.has(id) || !files.includes(id)),
  );
  assert(
    files.every((f) => DISH_ART_IDS.has(f)),
    "B2: every picture in public/dishes/ is registered (none orphaned)",
    files.filter((f) => !DISH_ART_IDS.has(f)),
  );
  // developer 2026-11-21: all 14 sheets are delivered and cut, so every one of the recipes has its picture, each under 40 KB (320 x 320 webp)
  assert(
    files.length === known.size,
    `B3: every one of the ${known.size} recipes has its dish picture (${files.length} in public/dishes/)`,
    [...known].filter((id) => !files.includes(id)).slice(0, 5),
  );
  const heavy = files.filter((f) => fs.statSync(path.join(dir, `${f}.webp`)).size > 40 * 1024);
  assert(heavy.length === 0, "B4: every dish picture is under 40 KB", heavy.slice(0, 5));
}

console.log("C. The lookup");
{
  assert(
    dishArtUrl(undefined) === null && dishArtUrl(null) === null && dishArtUrl("") === null,
    "C1: no id: no picture",
  );
  assert(
    dishArtUrl("camp-not-a-dish") === null,
    "C2: an unregistered dish: no picture (the card shows the icon on a plate)",
  );
  const some = [...DISH_ART_IDS][0];
  assert(
    !some || /\/dishes\/[a-z0-9-]+\.webp$/.test(dishArtUrl(some) ?? ""),
    "C3: a registered dish: its own file",
  );
}

console.log("D. The card");
{
  const card = read("src/components/kc/game/OrderArrivalCard.tsx");
  const css = read("src/components/kc/game/orderCard.css");
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  assert(
    [
      "oc-banner",
      "oc-hat",
      "oc-sprig",
      "oc-dishrow",
      "oc-line",
      "oc-divider",
      "oc-start",
      "oc-laurel",
      "oc-prep",
      "oc-auto",
    ].every((c) => card.includes(c)),
    // RULE CHANGE 2026-11-21 (developer: "don't show the dish photo before cooking"): the starting card no longer has the plate on a cloth; the dish picture is on the Served card (E)
    "D1: the card has the banner with hat and leaves, the dish row, the line, Start cooking between laurels, Prep Cook and Auto (no dish picture before cooking)",
  );
  assert(
    /Start cooking/.test(card) &&
      /Prep Cook cuts it/.test(card) &&
      /Auto: (on|off)|"Auto: on" : "Auto: off"/.test(card),
    "D2: the buttons keep their texts (the browser suites click them by text)",
  );
  assert(
    /\.oc-start\s*\{[^}]*min-height: max\(48px/.test(css) &&
      /\.oc-prep,\s*\.oc-auto\s*\{[^}]*min-height: max\(48px/.test(css),
    "D3: every button is at least 48 px tall",
  );
  assert(
    /<OrderArrivalCard/.test(floor) && /compact=\{!wide\}/.test(floor),
    "D4: ServiceFloor shows the card (compact on an upright phone)",
  );
  assert(
    /function PlateFace/.test(floor) &&
      (floor.match(/<PlateFace/g) ?? []).length >= 2 &&
      /dishArtUrl\(id\)/.test(floor),
    "D5: the plates set on the tables use the dish's own picture when it has one",
  );
  assert(
    !/dishArtUrl|oc-dish(?!row)|oc-plate|<img/.test(card) &&
      !/\.oc-plate|\.oc-dish(?!row)|\.oc-cloth/.test(css),
    "D7: the starting card shows no dish picture before cooking (developer 2026-11-21)",
  );
  assert(
    /\.oc-prep,\s*\.oc-auto\s*\{[^}]*font-size: 0\.98em/.test(css) &&
      /\.oc-row2\s*\{[^}]*max-width: 25em/.test(css),
    "D8: the Prep Cook and Auto buttons are slightly smaller (developer 2026-11-21), still at least 48 px tall",
  );
  assert(
    /id: view\.recipeId/.test(read("src/components/kc/game/Preparation.tsx")) &&
      /id: r\.id/.test(read("src/App.tsx")),
    "D6: the recipe id reaches the card and the party's dishes",
  );
}
console.log("E. The Served card (developer 2026-11-21, from his concept)");
{
  const sv = read("src/components/kc/game/ServiceOrderComplete.tsx");
  const css = read("src/components/kc/game/servedCard.css");
  assert(
    /dishArtUrl\(recipe\.id\)/.test(sv) &&
      /data-testid="served-dish-art"/.test(sv) &&
      /sv-cloth/.test(sv) &&
      /sv-glow/.test(sv),
    "E1: the Served card shows the dish's own picture on its cloth with a glow, after the customer's line",
  );
  assert(
    /className="sv-wrap"/.test(sv) &&
      /<Hat \/>/.test(sv) &&
      /data-testid="served-close"/.test(sv) &&
      /<Laurel \/>/.test(sv) &&
      /<Laurel flip \/>/.test(sv),
    "E2: in a wide window the card stands in the middle with the chef's hat, leaves, a round close button and the wallet between laurels",
  );
  assert(
    /land:absolute land:inset-0/.test(sv) &&
      /\[data-orient="landscape"\] \.sv-wrap\s*\{[^}]*left: 50%[^}]*top: 50%/.test(css),
    "E3: the dining room fills the wide window and the card is centred over it (upright phone: the sheet under the room, unchanged)",
  );
  assert(
    /max-height: 700px/.test(css) && /max-height: 580px/.test(css),
    "E4: a short window gets a compact card so both buttons stay in view",
  );
  assert(
    />\s*\{nextLabel\}/.test(sv) &&
      /Back to Kitchen/.test(sv) &&
      /className="sv-btn-ico sv-wide-only"/.test(sv),
    "E5: the buttons keep their exact texts (the icons are drawings, not text; the browser suites click them by text)",
  );
}
console.log(failures === 0 ? "\nDISH ART QA: ALL PASS" : `\nDISH ART QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
