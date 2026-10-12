/**
 * HALF WAGES QA — economy F2 (developer 2026-10-12): at closing from Level 41
 * until full operation (L91), each hired waged role is paid half its daily
 * wage, one "business-staff-salary" entry per role; a wage the wallet can't
 * cover is skipped that day (no charge, no entry, the staff stay). Plus F3's
 * menu-guest schedule (+1 from L51), batch-group levels still none.
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
import { menuGuestsPerService } from "../src/game/restaurant/restaurantProgression.ts";

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
const salaryEntries = (s: SaveData) =>
  s.economyLedger.filter((e) => e.category === "business-staff-salary");

console.log("H. Half wages");
{
  const s = saveWith(100_000);
  const before40 = payHalfWages(s, HALF_WAGES_FROM - 1);
  const at91 = payHalfWages(s, 91);
  assert(
    HALF_WAGES_FROM === 41 && before40.paid === 0 && at91.paid === 0 && before40.save === s,
    "H1: nothing before Level 41, and nothing here from full operation (the normal payroll applies there)",
  );
  const r = payHalfWages(s, 60);
  const entries = salaryEntries(r.save);
  assert(
    r.paid === halfPay([...ROLES]) &&
      ROLES.every((role) => halfWage(role) === Math.round(dailyPayroll([role]) / 2)) &&
      entries.length === ROLES.length &&
      entries.map((e) => e.description).join() === ROLES.join() &&
      entries.every((e, i) => e.amount === -halfWage(ROLES[i]!)) &&
      r.save.credits === s.credits - r.paid,
    "H2: Level 41–90 — half of each role's daily wage, one ledger entry per role, the wallet moves by exactly that",
    { paid: r.paid, entries: entries.map((e) => [e.description, e.amount]) },
  );
  const short = saveWith(halfWage("prep-cook"));
  const rs = payHalfWages(short, 60);
  assert(
    rs.save.credits === 0 &&
      rs.skipped.join() === "server" &&
      salaryEntries(rs.save).length === 1 &&
      rs.save.business.staff.hiredRoles.length === 2,
    "H3: a wage the wallet can't cover is skipped that day — no charge, no entry, never below $0, the staff stay",
    { credits: rs.save.credits, skipped: rs.skipped },
  );
  const none = payHalfWages(saveWith(100_000, []), 60);
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
        openingLevel: 60,
      },
    },
  } as SaveData;
  const closed = closeDay(open, 60);
  const twice = closeDay(closed, 60);
  assert(
    salaryEntries(closed).length === ROLES.length &&
      salaryEntries(twice).length === ROLES.length &&
      twice.credits === closed.credits,
    "C1: closing a Level 41–90 day pays the half wages once; closing again (not due) pays nothing more",
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
    [11, 21, 50, 51, 121, 201].map(menuGuestsPerService).join() === "1,2,2,4,5,6",
    "M1: one more menu guest per service from Level 51 (4 / 5 / 6); unchanged before",
  );
}

console.log(failures ? `\nHALF WAGES QA: ${failures} FAILURE(S)` : "\nHALF WAGES QA: ALL PASS");
process.exit(failures ? 1 : 0);
