/**
 * AUDIT 2026-11-18 QA: source guards for the fixes of the deep check (developer: "find out everything and fix it one by one"). The behaviour of each fix has
 * its own suite where it can run in Node (save-safety-qa, sauce-station-qa U/T7, crate-dispatch-qa D4, loading-screen-qa B4/D6/D7, mini-games-qa); this
 * file guards the ones that live in a screen.
 *
 *  A. The rules files count their "today" by the day that really advances (playDayOf), not by the food calendar that stands still before Level 10.
 *  B. Screens: the Car Park lot is built once per visit; nothing is finished after the player leaves the Sauce Station; the Stockroom hint says why it waits.
 *  C. Copy and touch rules (CLAUDE.md section 10): the restaurant build never names a level in the free-play lock notice; the buttons are 48 px.
 *  D. Stale comments are corrected (the real first levels).
 *
 * Run: npx tsx scripts/audit-2026-11-18-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

console.log("A. The day the mini-games count by");
{
  const files = [
    "src/game/business/sauceStation.ts",
    "src/game/business/carPark.ts",
    "src/game/business/deliveryFlow.ts",
    "src/game/business/deliveryInspection.ts",
  ];
  const bad = files.filter((f) => {
    const s = read(f);
    return (
      /save\.business\.calendar\.businessDay/.test(s) ||
      !/import \{ playDayOf \} from "\.\/playDay"/.test(s)
    );
  });
  assert(
    bad.length === 0,
    "A1: the Sauce Station, the Car Park, the delivery check and the skip counter all read playDayOf(save)",
    bad,
  );
  const pd = read("src/game/business/playDay.ts");
  assert(
    /Math\.max\(/.test(pd) && /restaurantDay\?\.day/.test(pd) && /calendar\.businessDay/.test(pd),
    "A2: playDayOf is the larger of the food calendar's day and the restaurant day (the food calendar stays on day 1 before Level 10)",
  );
}

console.log("B. Screens");
{
  const car = read("src/components/kc/inventory/CarParkGame.tsx");
  assert(
    /const \[initial\] = useState\(\(\) => lotFor\(save, playerLevel\)\)/.test(car) &&
      !/useMemo\(\(\) => lotFor/.test(car),
    "B1: the Car Park lot is built once per visit (it was rebuilt on every save change, a hitch of up to a few hundred ms, and 'Try again' could land on another lot)",
  );
  const sauce = read("src/components/kc/sauce/SauceStationGame.tsx");
  assert(
    /aliveRef\.current = false/.test(sauce) && /if \(!aliveRef\.current\) return;/.test(sauce),
    "B2: nothing is finished or paid after the player left the Sauce Station during the pause after a bottle",
  );
  const stock = read("src/components/kc/inventory/StockroomSortGame.tsx");
  assert(
    /The hint wakes up after a short pause/.test(stock) &&
      /aria-disabled=\{!hintOn \|\| undefined\}/.test(stock),
    "B3: the Stockroom hint is not a dead grey icon: a tap says it wakes up after a short pause",
  );
  const crate = read("src/game/business/crateDispatch.ts");
  assert(
    (
      crate.match(
        /return undoRound\(\{ \.\.\.round, history: round\.history\.slice\(0, -1\) \}\)/g,
      ) ?? []
    ).length === 2,
    "B4: an Undo that can no longer be done is dropped and the older one is tried (both the drag and the crate-that-left cases)",
  );
}

console.log("C. Copy and touch targets");
{
  const app = read("src/App.tsx");
  assert(
    /opens \$\{unlockText\(restaurantLevelOf\(saveRef\.current\.levelProgress\)\)\.when\(freePlayFrom\)\}/.test(
      app,
    ) && !/opens at Level \$\{freePlayFrom\}/.test(app),
    "C1: the free-play lock notice says 'in N services', never a level",
  );
  const small: [string, RegExp][] = [
    [
      "src/components/kc/inventory/DeliveryInspectionGame.tsx",
      /h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-\[#e6b866\]/,
    ],
    [
      "src/components/kc/inventory/FridgeSortGame.tsx",
      /h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-\[#d6b46a\]/,
    ],
    [
      "src/components/kc/inventory/StockroomSortGame.tsx",
      /h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-\[#d6b46a\]/,
    ],
    [
      "src/components/kc/restaurant/FridgeCheckGame.tsx",
      /h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-\[#9fd0e0\]/,
    ],
    ["src/components/kc/restaurant/PreServiceCheck.tsx", /-mr-1 -mt-1 grid h-8 w-8/],
    ["src/components/kc/moments/MomentChip.tsx", /min-h-11 w-9 place-items-center/],
    [
      "src/components/kc/DailyMaintenance.tsx",
      /press min-h-10 shrink-0 rounded-full bg-walnut px-3/,
    ],
    ["src/components/kc/restaurant/FridgeCheckHowTo.tsx", /mt-1\.5 min-h-10 px-3/],
  ];
  const still = small.filter(([f, re]) => re.test(read(f))).map(([f]) => f);
  assert(
    still.length === 0,
    "C2: the 'how to play' buttons, the dismiss buttons and the maintenance buttons are at least 48 px (they were 32 to 40)",
    still,
  );
}

console.log("D. Stale comments");
{
  const data = read("src/components/kc/data.ts");
  assert(
    !/Optional, from Level 14/.test(data) &&
      !/from Level 23/.test(data) &&
      /FRIDGE_SORT_FIRST_LEVEL/.test(data) &&
      /SAUCE_FIRST_LEVEL/.test(data),
    "D1: ScreenId's comments name the real first levels (Fridge Sort 4, Sauce Station 7), not the old 14 and 23",
  );
  assert(
    !/the game has no music/.test(read("src/game/SaveManager.ts")),
    "D2: SaveManager no longer says the game has no music",
  );
}

console.log(
  failures ? `\nAUDIT 2026-11-18 QA: ${failures} FAILED` : "\nAUDIT 2026-11-18 QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
