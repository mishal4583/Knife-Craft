/**
 * DINNER RUSH QA (developer 2026-11-26, first-20-levels plan row 18; the developer chose the opt-in version: Hype and a badge, no money, no timer, once).
 *
 *  A  the rules (restaurant/dinnerRush.ts): which service is a rush, when it is cleared, what clearing does (and never does)
 *  B  the badge and the memory (`chefRecord.rushes`, the Rush Hour Hero ladder)
 *  C  the wiring (the Kitchen card, the guest button, the completion reward)
 *
 * Run: npx tsx scripts/dinner-rush-qa.mts
 */
import { readFileSync } from "node:fs";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  DINNER_RUSH,
  dinnerRushCelebration,
  dinnerRushFor,
  rushCleared,
  rushLabel,
  withRushCleared,
} from "../src/game/restaurant/dinnerRush.ts";
import { serviceNameAt } from "../src/game/restaurant/guestDemand.ts";
import { serviceGuestPlan } from "../src/game/restaurant/menuGuests.ts";
import { servicesForDayAt } from "../src/game/restaurant/restaurantProgression.ts";
import { chefRecordOf } from "../src/game/restaurant/chefRecord.ts";
import { addHype, secondFloorOf } from "../src/game/restaurant/secondFloor.ts";
import { achievementsFor } from "../src/game/progression/achievements.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** A save whose service `n` is the `index`-th service of an open day (so its meal is that day's `index`-th name), with a team that can take guests. */
function saveAt(n: number, index: number, credits = 100_000): SaveData {
  const s = structuredClone(DEFAULT_SAVE) as SaveData;
  s.credits = credits;
  s.business = {
    ...s.business,
    restaurantDay: {
      ...(s.business.restaurantDay ?? {}),
      day: 1,
      opened: true,
      servicesDone: index,
      servicesPlanned: 6,
      closingDue: false,
      openingCredits: null,
      openingLevel: n - index,
      closingDone: [],
    } as never,
    staff: { hiredRoles: ["server", "cashier", "prep-cook", "line-cook", "head-chef"] } as never,
    popularity: { ...(s.business.popularity ?? {}), score: 80 } as never,
  };
  return s;
}
/** The position of "Dinner" in the day that holds service `n`, found by trying each position. */
const dinnerIndex = (n: number) => {
  // (only real positions of the day: `serviceNameAt` clamps a position past the last meal to the last meal)
  const len = servicesForDayAt(n).length;
  for (let i = 0; i < len; i++) if (serviceNameAt(saveAt(n, i), n) === "Dinner") return i;
  return -1;
};

console.log("A. The rules");
{
  assert(
    DINNER_RUSH.fromLevel === 18 &&
      DINNER_RUSH.service === "Dinner" &&
      DINNER_RUSH.minGuests === 2 &&
      DINNER_RUSH.hype === 30,
    "A1: from Level 18, the Dinner service, at least two guests, 30 Hype",
  );
  const n = 18;
  const di = dinnerIndex(n);
  assert(di >= 0, "A2: some service of a day at Level 18 is the Dinner", di);
  const dinner = saveAt(n, di);
  const rush = dinnerRushFor(dinner, n, true);
  assert(
    !!rush && rush.guests >= 2 && rush.guests === serviceGuestPlan(dinner, n).total,
    "A3: a first play of the Dinner service with enough guests is a rush, counted from the service's own guests",
    rush,
  );
  const notDinner = Array.from({ length: servicesForDayAt(n).length }, (_, i) => i)
    .filter((i) => i !== di)
    .map((i) => dinnerRushFor(saveAt(n, i), n, true));
  assert(
    notDinner.every((r) => r === null),
    "A4: no other meal of the day is a rush",
  );
  assert(dinnerRushFor(dinner, n, false) === null, "A5: a replay is never a rush");
  assert(
    dinnerRushFor(saveAt(17, Math.max(0, dinnerIndex(17))), 17, true) === null,
    "A6: before Level 18 there is none",
  );
  const later = dinnerIndex(25);
  assert(
    later >= 0 && !!dinnerRushFor(saveAt(25, later), 25, true),
    "A7: a later Dinner (Level 25) is a rush too, if none was cleared before",
  );
  const lonely = saveAt(n, di);
  lonely.business = { ...lonely.business, staff: { hiredRoles: [] } as never };
  const lonelyPlan = serviceGuestPlan(lonely, n).total;
  assert(
    lonelyPlan >= 2 || dinnerRushFor(lonely, n, true) === null,
    "A8: a service of fewer than two guests is not a rush",
    lonelyPlan,
  );

  const r = { guests: 4 };
  assert(
    rushCleared(r, 4, 0) &&
      rushCleared(r, 5, 0) &&
      !rushCleared(r, 3, 0) &&
      !rushCleared(r, 4, 1) &&
      !rushCleared(r, 4, null) &&
      !rushCleared(r, 0, 0),
    "A9: cleared = every guest handled AND nobody walked out; with no door queue to ask it is never cleared",
  );

  const before = dinner;
  const after = addHype(withRushCleared(before), DINNER_RUSH.hype);
  assert(
    chefRecordOf(after).rushes === 1 &&
      after.credits === before.credits &&
      after.economyLedger.length === before.economyLedger.length &&
      JSON.stringify(after.business.inventory ?? null) ===
        JSON.stringify(before.business.inventory ?? null) &&
      (secondFloorOf(after).hype ?? 0) - (secondFloorOf(before).hype ?? 0) === DINNER_RUSH.hype,
    "A10: clearing adds the counter and the Hype, and moves NO money, ledger entry or stock",
  );
  assert(
    dinnerRushFor(after, n, true) === null && dinnerRushFor(after, 25, true) === null,
    "A11: once cleared it never comes again",
  );
  const card = dinnerRushCelebration(["x"]);
  assert(
    card.kind === "rush" &&
      card.emoji === "🔥" &&
      card.lines[0] === "⚡ +30 Hype" &&
      card.lines.includes("🏅 Rush Hour Hero") &&
      card.lines.at(-1) === "x" &&
      card.paige.length > 0,
    "A12: the card names the Hype and the badge and keeps any extra line",
    card,
  );
  assert(rushLabel(2, 4) === "🔥 Rush 2/4", "A13: the guest button reads Rush n/total");
}

console.log("B. The badge and the memory");
{
  const s = saveAt(18, 0);
  assert(chefRecordOf(s).rushes === 0, "B1: a fresh record has no rush cleared");
  assert(chefRecordOf(withRushCleared(s)).rushes === 1, "B2: clearing counts one");
  const bad = {
    ...s,
    business: { ...s.business, chefRecord: { rushes: -5 } },
  } as unknown as SaveData;
  const junk = {
    ...s,
    business: { ...s.business, chefRecord: { rushes: "x" } },
  } as unknown as SaveData;
  assert(
    chefRecordOf(bad).rushes === 0 && chefRecordOf(junk).rushes === 0,
    "B3: a bad saved value reads as 0",
  );
  const old = structuredClone(s) as SaveData;
  delete (old.business as { chefRecord?: unknown }).chefRecord;
  assert(chefRecordOf(old).rushes === 0, "B4: an old save without the record reads 0");
  const after = achievementsFor(withRushCleared(s)).find((a) => /dinner-rush/.test(a.id));
  const before = achievementsFor(s).find((a) => /dinner-rush/.test(a.id));
  assert(
    !!after &&
      after.reward === 0 &&
      !!before &&
      before.reward === 0 &&
      /Rush Hour Hero/.test(JSON.stringify(after)),
    "B5: the Rush Hour Hero badge exists, pays nothing, and is listed before and after",
    { after, before },
  );
}

console.log("C. The wiring");
{
  const app = read("src/App.tsx");
  assert(
    /dinnerRushFor\(\s*save,\s*levelNumber\(campaignLevelForSession\.id\)/.test(app) &&
      /rushLabel\(/.test(app),
    "C1: the guest button reads Rush n/total while it is on",
  );
  assert(
    /rushCleared\(\s*rush,[\s\S]*?doorView\(rushDoor\)\.walkedOut : null/.test(app) &&
      /addHype\(withRushCleared\(nextSave\), DINNER_RUSH\.hype\)/.test(app),
    "C2: completing the level on a first play pays the Hype and the counter, asking the door queue for walk-outs",
  );
  assert(
    /dinnerRushCelebration\(/.test(app) && /"dinner_rush_cleared"/.test(app),
    "C3: a cleared rush shows its card and is measured",
  );
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /data-testid="kitchen-rush"/.test(kitchen) &&
      /dinnerRushFor\(save, levelNumber\(todayLevel\.id\), true\)/.test(kitchen) &&
      /rush && !orderCardExpanded \? "🔥 "/.test(kitchen),
    "C4: the Kitchen's Next Customer details announce it, with a marker on View Details while closed",
  );
  const code = read("src/game/restaurant/dinnerRush.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(
    !/Math\.random|Date\.now|new Date|credits|appendLedger|economyLedger|wallet|localStorage/.test(
      code,
    ),
    "C5: the rule file is pure: no money, ledger, wallet, clock or random",
  );
}

console.log(failures ? `\nDINNER RUSH QA: ${failures} FAILED` : "\nDINNER RUSH QA: ALL PASS");
process.exit(failures ? 1 : 0);
