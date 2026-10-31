/**
 * HALF WAGES QA — economy F2 (developer 2026-10-12): at closing from the
 * Prep Cook (old L41 → L29 of the 150-level campaign, developer 2026-10-15)
 * until full operation (old L91 → L56), each hired waged role is paid half its daily
 * wage, one "business-staff-salary" entry per role; a wage the wallet can't
 * cover is skipped that day (no charge, no entry, the staff stay). Plus F3's
 * menu-guest schedule (+1 from old L51 → L35), batch-group levels still none.
 * 2026-10-17: re-baselined to the 150-level numbers (they were the 250-level ones).
 *
 * Run: npx tsx scripts/restaurant-half-wages-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { dailyPayroll } from "../src/game/business/businessStaff.ts";
import {
  HALF_WAGES_FROM,
  closingWage,
  halfPay,
  halfWage,
  payHalfWages,
} from "../src/game/restaurant/staffRequirements.ts";
import { closeDay } from "../src/game/restaurant/restaurantDay.ts";
import {
  menuGuestsPerService,
  restaurantSystem,
} from "../src/game/restaurant/restaurantProgression.ts";
import { STAFF_RULES } from "../src/game/restaurant/staffRequirements.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const ROLES = ["prep-cook", "server"] as const;
const saveWith = (credits: number, roles: readonly string[] = ROLES): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  credits,
  business: {
    ...structuredClone(DEFAULT_SAVE.business),
    staff: { hiredRoles: [...roles] as never },
  },
});
const FULL = restaurantSystem("full-operation").firstLevel; // 56
const MID = 40; // a half-wage level (L29–55)
const salaryEntries = (s: SaveData) =>
  s.economyLedger.filter((e) => e.category === "business-staff-salary");

console.log("H. Half wages");
{
  const s = saveWith(100_000);
  const before40 = payHalfWages(s, HALF_WAGES_FROM - 1);
  const atFull = payHalfWages(s, FULL);
  // Rule changed (developer 2026-10-30): the Prep Cook is paid by the hour only — no hiring fee, his full shift wage at every closing.
  assert(
    HALF_WAGES_FROM === 27 &&
      // Rule changed (developer 2026-10-31): the Prep Cook is hired from level 30, so the half wages (27) now start
      // a little before the first Prep Cook can be on the payroll, never after.
      HALF_WAGES_FROM <= STAFF_RULES.find((r) => r.role === "prep-cook")!.fromLevel &&
      FULL === 54 &&
      before40.paid === dailyPayroll(["prep-cook"]) &&
      salaryEntries(before40.save)
        .map((e) => e.description)
        .join() === "prep-cook" &&
      atFull.paid === 0,
    "H1: before Level 27 only the Prep Cook is paid (his full shift wage); nothing here from full operation (L54; the normal payroll applies there)",
    { before: before40.paid, atFull: atFull.paid },
  );
  const r = payHalfWages(s, MID);
  const entries = salaryEntries(r.save);
  assert(
    r.paid === dailyPayroll(["prep-cook"]) + halfPay(["server"]) &&
      ROLES.every((role) => halfWage(role) === Math.round(dailyPayroll([role]) / 2)) &&
      entries.length === ROLES.length &&
      entries.map((e) => e.description).join() === ROLES.join() &&
      entries.every((e, i) => e.amount === -closingWage(ROLES[i]!, MID)) &&
      r.save.credits === s.credits - r.paid,
    "H2: Level 29–55 — half of each role's daily wage (the Prep Cook his full wage), one ledger entry per role, the wallet moves by exactly that",
    { paid: r.paid, entries: entries.map((e) => [e.description, e.amount]) },
  );
  const short = saveWith(closingWage("prep-cook", MID));
  const rs = payHalfWages(short, MID);
  assert(
    rs.save.credits === 0 &&
      rs.skipped.join() === "server" &&
      salaryEntries(rs.save).length === 1 &&
      rs.save.business.staff.hiredRoles.length === 2,
    "H3: a wage the wallet can't cover is skipped that day — no charge, no entry, never below $0, the staff stay",
    { credits: rs.save.credits, skipped: rs.skipped },
  );
  const none = payHalfWages(saveWith(100_000, []), MID);
  assert(none.paid === 0 && salaryEntries(none.save).length === 0, "H4: no team, nothing charged");
}

console.log("C. Closing");
{
  const s = saveWith(100_000);
  const open = {
    ...s,
    business: {
      ...s.business,
      restaurantDay: {
        day: 30,
        opened: true,
        servicesDone: 3,
        servicesPlanned: 3,
        closingDue: true,
        openingCredits: 100_000,
        openingLevel: MID,
      },
    },
  } as SaveData;
  const closed = closeDay(open, MID);
  const twice = closeDay(closed, MID);
  assert(
    salaryEntries(closed).length === ROLES.length &&
      salaryEntries(twice).length === ROLES.length &&
      twice.credits === closed.credits,
    "C1: closing a Level 29–55 day pays the half wages once; closing again (not due) pays nothing more",
  );
  const src = fs.readFileSync(
    path.join(path.resolve(import.meta.dirname, ".."), "src/game/restaurant/restaurantDay.ts"),
    "utf8",
  );
  assert(/payHalfWages\(next, levelNumber\)/.test(src), "C2: closeDay calls payHalfWages");
}

console.log("M. Menu guests (F3)");
{
  assert(
    // Rule changed (developer 2026-10-25, early game phase 2): guests from L5 (was L11).
    [4, 5, 14, 32, 33, 74, 115].map(menuGuestsPerService).join() === "0,1,2,2,4,5,6",
    "M1: menu guests 1 / 2 from L5 / L14, one more per service from L33 (4 / 5 / 6 at L33 / L74 / L115)",
  );
}

console.log(failures ? `\nHALF WAGES QA: ${failures} FAILURE(S)` : "\nHALF WAGES QA: ALL PASS");
process.exit(failures ? 1 : 0);
