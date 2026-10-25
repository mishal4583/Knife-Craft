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
  assert(
    HALF_WAGES_FROM === 29 &&
      HALF_WAGES_FROM === STAFF_RULES.find((r) => r.role === "prep-cook")!.fromLevel &&
      FULL === 56 &&
      before40.paid === 0 &&
      atFull.paid === 0 &&
      before40.save === s,
    "H1: nothing before Level 29 (the Prep Cook), and nothing here from full operation (L56; the normal payroll applies there)",
  );
  const r = payHalfWages(s, MID);
  const entries = salaryEntries(r.save);
  assert(
    r.paid === halfPay([...ROLES]) &&
      ROLES.every((role) => halfWage(role) === Math.round(dailyPayroll([role]) / 2)) &&
      entries.length === ROLES.length &&
      entries.map((e) => e.description).join() === ROLES.join() &&
      entries.every((e, i) => e.amount === -halfWage(ROLES[i]!)) &&
      r.save.credits === s.credits - r.paid,
    "H2: Level 29–55 — half of each role's daily wage, one ledger entry per role, the wallet moves by exactly that",
    { paid: r.paid, entries: entries.map((e) => [e.description, e.amount]) },
  );
  const short = saveWith(halfWage("prep-cook"));
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
    [4, 5, 16, 34, 35, 76, 117].map(menuGuestsPerService).join() === "0,1,2,2,4,5,6",
    "M1: menu guests 1 / 2 from L5 / L16, one more per service from L35 (4 / 5 / 6 at L35 / L76 / L117)",
  );
}

console.log(failures ? `\nHALF WAGES QA: ${failures} FAILURE(S)` : "\nHALF WAGES QA: ALL PASS");
process.exit(failures ? 1 : 0);
