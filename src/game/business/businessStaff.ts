/**
 * BUSINESS_STAFF — Economy V3 Phase 9. Business-Mode-only restaurant
 * employees — deliberately a SEPARATE catalog from Economy V2's own
 * Campaign staff (`staffDefinitions.ts`'s `STAFF_CATALOG`/
 * `save.ownedStaffIds`/`StaffManager.ts`), which this file never reads,
 * writes, or duplicates. That system stays exactly as CLAUDE.md
 * describes it: purchase-only, no salary, no recurring cost of any kind,
 * three prep-technique roles unlocked by campaign level. The master
 * spec's own "Possible roles" for this phase (Prep Cook, Line Cook, Head
 * Chef, Server, Cleaner, Manager) name none of Campaign's three roles —
 * these are restaurant-OPERATIONS employees, a genuinely different
 * concept, so reusing Campaign's catalog/ids would misrepresent both
 * systems. What IS reused is the ARCHITECTURE: the exact same
 * catalog-plus-manager shape every other Business Mode feature already
 * uses (mirrors `refrigeratorDefinitions.ts`/`RefrigeratorManager.ts`),
 * the existing wallet, and the existing ledger — never a second staff
 * registry's worth of NEW infrastructure.
 *
 * "No Campaign salaries" (master spec) is read literally: Campaign's
 * staff never gets a salary, and Business staff's salary never touches
 * Campaign. Salary is the ONE new mechanic this phase introduces — a
 * recurring Business Day cost, deducted by BusinessDayManager.
 *
 * At most ONE employee per role (six hirable role-slots total) —
 * mirrors the refrigerator's "one owned at a time" simplicity rather
 * than an open-ended named-roster system, which the brief's own "Only
 * implement roles with real business functions" doesn't ask for.
 * `skill`/`specialization`/`experience`/`fatigue`/`schedule` (the master
 * spec's other "Possible fields") are deliberately NOT separate tunable
 * fields — each role's one fixed, documented effect below IS its
 * "skill"; there is no per-recipe specialization, no experience/fatigue
 * simulation, and no partial work-week (an employee is on the payroll
 * every Business Day) because none of Business Mode has the underlying
 * gameplay loop (a live order/serving pipeline, a shift system) those
 * would need to mean anything real yet. This mirrors Phase 6/7/8's own
 * "forward hook" discipline: implement what has a genuine mechanism
 * today, document what doesn't, invent nothing.
 *
 * Every role's effect composes into an ALREADY-WIRED Business Mode
 * system — never a fourth new mechanic invented just for staff:
 *   - Prep Cook: ingredient purchase discount (BusinessInventoryManager)
 *   - Cleaner: reduces the FINANCIAL impact of spoilage (SpoilageManager
 *     already correctly removes the true expired units; Cleaner recovers
 *     a fraction of the recorded value, not the physical units — a
 *     deliberate simplification, documented here rather than touching
 *     Perishability's own age math)
 *   - Line Cook / Head Chef / Server: daily popularity boost
 *     (PopularityManager.dailyPopularityDelta)
 *   - Manager: discounts the REST of the daily payroll (a manager never
 *     discounts their own salary)
 *
 * No Math.random() anywhere — every effect is a deterministic function
 * of which roles are currently hired.
 */
import type { SaveData } from "../SaveManager";

export type BusinessStaffRole =
  "prep-cook" | "line-cook" | "head-chef" | "server" | "cleaner" | "manager";

export type BusinessStaffDefinition = {
  role: BusinessStaffRole;
  name: string;
  description: string;
  /** Whole US cents/hour (Economy V3 Phase 14 — see docs/ECONOMY_V3_MASTER_SPEC.md §24). */
  hourlyWageCents: number;
  /** Scheduled hours per Business Day this role is on shift. */
  scheduledHours: number;
  /** Business Days' worth of whole US cents owed per day this employee is on staff — `round(hourlyWageCents * scheduledHours * EMPLOYER_BURDEN_MULTIPLIER)`. Hiring itself is free — this recurring cost is the real one. */
  salary: number;
};

/**
 * Economy V3 Phase 14 — REAL-WORLD RECALIBRATION. Payroll = hourly wage x
 * scheduled hours + documented employer burden, per the phase brief's own
 * formula. `EMPLOYER_BURDEN_MULTIPLIER` (1.25 = 25% on top of gross wages)
 * is the documented midpoint of the researched 20%-30% FICA/FUTA/SUTA +
 * benefits range (docs/ECONOMY_V3_MASTER_SPEC.md §24). Hourly wages:
 * Line Cook uses the BLS national average ($18.14/hr, May 2025 OOH data)
 * directly; Prep Cook is a modest step below it (a narrower, entry-level
 * role); Head Chef and Manager are estimated above it (supervisory/
 * higher-skill roles, consistent with BLS's own "Chefs and Head Cooks"
 * category earning noticeably more than "Cooks"); Server uses a
 * full-service-equivalent base wage (this game has no tip mechanic, so a
 * server's real base-plus-tips economics are simplified to one full
 * wage); Cleaner works a shorter shift than the kitchen roles (Economy
 * V2.5: every role is paid for one service shift — SERVICE_SHIFT_HOURS below). Every non-BLS-cited figure here is a labeled estimate, not an
 * individually-fetched source, consistent with §24's own methodology.
 */
const EMPLOYER_BURDEN_MULTIPLIER = 1.25;

/**
 * Economy V2.5 — hours paid per Business day. A KnifeCraft Business day is
 * ONE service of 4–12 guests, not a full trading day, so staff are paid for
 * that service shift at their (unchanged, real-world) hourly wage: 2 hours,
 * 1.5 for the Cleaner (who worked the shorter shift before too). At the old
 * 8-hour day every hire cost more than the restaurant's whole daily revenue
 * (~$130) and was laid off within weeks in the 365-day simulation.
 */
const SERVICE_SHIFT_HOURS = 2;
const CLEANER_SHIFT_HOURS = 1.5;

function dailySalaryFor(hourlyWageCents: number, scheduledHours: number): number {
  return Math.round(hourlyWageCents * scheduledHours * EMPLOYER_BURDEN_MULTIPLIER);
}

const PREP_COOK_PURCHASE_DISCOUNT = 0.03;
const LINE_COOK_POPULARITY_BOOST = 1;
const HEAD_CHEF_POPULARITY_BOOST = 3;
const SERVER_POPULARITY_BOOST = 2;
const CLEANER_SPOILAGE_VALUE_REDUCTION = 0.2;
const MANAGER_PAYROLL_DISCOUNT = 0.1;

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

/**
 * V3-16 player-experience audit: every description states the role's
 * ACTUAL effect, built from the same constants the effect functions below
 * use (so the text can never drift from the rule). The earlier flavour
 * text overstated several roles — e.g. "keeps customers coming back" for
 * a role whose only effect is a daily popularity bump.
 */
export const BUSINESS_STAFF_CATALOG: Record<BusinessStaffRole, BusinessStaffDefinition> = {
  "prep-cook": {
    role: "prep-cook",
    name: "Prep Cook",
    description: `Buys and preps carefully — ${pct(PREP_COOK_PURCHASE_DISCOUNT)} off every ingredient purchase.`,
    hourlyWageCents: 1600,
    scheduledHours: SERVICE_SHIFT_HOURS,
    salary: dailySalaryFor(1600, SERVICE_SHIFT_HOURS),
  },
  "line-cook": {
    role: "line-cook",
    name: "Line Cook",
    description: `Keeps service steady — +${LINE_COOK_POPULARITY_BOOST} popularity each business day.`,
    hourlyWageCents: 1814,
    scheduledHours: SERVICE_SHIFT_HOURS,
    salary: dailySalaryFor(1814, SERVICE_SHIFT_HOURS),
  },
  "head-chef": {
    role: "head-chef",
    name: "Head Chef",
    description: `The biggest reputation boost on staff — +${HEAD_CHEF_POPULARITY_BOOST} popularity each business day.`,
    hourlyWageCents: 2800,
    scheduledHours: SERVICE_SHIFT_HOURS,
    salary: dailySalaryFor(2800, SERVICE_SHIFT_HOURS),
  },
  server: {
    role: "server",
    name: "Server",
    description: `Attentive front-of-house — +${SERVER_POPULARITY_BOOST} popularity each business day.`,
    hourlyWageCents: 1500,
    scheduledHours: SERVICE_SHIFT_HOURS,
    salary: dailySalaryFor(1500, SERVICE_SHIFT_HOURS),
  },
  cleaner: {
    role: "cleaner",
    name: "Cleaner",
    description: `Kitchen Cleanliness always passes inspection, and recorded spoilage losses are ${pct(CLEANER_SPOILAGE_VALUE_REDUCTION)} lower.`,
    hourlyWageCents: 1500,
    scheduledHours: CLEANER_SHIFT_HOURS,
    salary: dailySalaryFor(1500, CLEANER_SHIFT_HOURS),
  },
  manager: {
    role: "manager",
    name: "Manager",
    description: `Runs a tighter ship — ${pct(MANAGER_PAYROLL_DISCOUNT)} off everyone else's daily pay.`,
    hourlyWageCents: 2400,
    scheduledHours: SERVICE_SHIFT_HOURS,
    salary: dailySalaryFor(2400, SERVICE_SHIFT_HOURS),
  },
};

export const ALL_STAFF_ROLES: readonly BusinessStaffRole[] = Object.keys(
  BUSINESS_STAFF_CATALOG,
) as BusinessStaffRole[];

export function getStaffDefinition(role: string): BusinessStaffDefinition | undefined {
  return (BUSINESS_STAFF_CATALOG as Record<string, BusinessStaffDefinition>)[role];
}

export function getAllStaffDefinitions(): BusinessStaffDefinition[] {
  return ALL_STAFF_ROLES.map((role) => BUSINESS_STAFF_CATALOG[role]);
}

/** Sparse — an unhired role is simply absent from the list, never a placeholder entry (mirrors `save.ownedStaffIds`'s own shape). */
export type BusinessStaffState = {
  hiredRoles: BusinessStaffRole[];
};

export const DEFAULT_STAFF_STATE: BusinessStaffState = { hiredRoles: [] };

export function isHired(state: BusinessStaffState, role: BusinessStaffRole): boolean {
  return state.hiredRoles.includes(role);
}

/** The one place a purchase's staff discount is computed — 0 (unchanged price) whenever no Prep Cook is on staff. Composes as the FINAL layer in BusinessInventoryManager's pricing pipeline, after the event and contract layers. */
export function staffUnitCostDiscount(
  baseUnitCost: number,
  hiredRoles: readonly BusinessStaffRole[],
): number {
  if (!hiredRoles.includes("prep-cook")) return baseUnitCost;
  return Math.max(0, Math.round(baseUnitCost * (1 - PREP_COOK_PURCHASE_DISCOUNT)));
}

/** Composes directly into PopularityManager.dailyPopularityDelta — never a separate, second popularity pipeline. */
export function staffPopularityDelta(hiredRoles: readonly BusinessStaffRole[]): number {
  let delta = 0;
  if (hiredRoles.includes("line-cook")) delta += LINE_COOK_POPULARITY_BOOST;
  if (hiredRoles.includes("head-chef")) delta += HEAD_CHEF_POPULARITY_BOOST;
  if (hiredRoles.includes("server")) delta += SERVER_POPULARITY_BOOST;
  return delta;
}

/** Applied by BusinessDayManager to the RECORDED spoiled value only — the physically-expired units are still removed by SpoilageManager exactly as before; a Cleaner recovers part of the financial loss (better triage/salvage), never the units themselves. 1.0 (no change) whenever no Cleaner is on staff. */
export function staffSpoilageValueMultiplier(hiredRoles: readonly BusinessStaffRole[]): number {
  return hiredRoles.includes("cleaner") ? 1 - CLEANER_SPOILAGE_VALUE_REDUCTION : 1;
}

/** The one place the day's total payroll is computed. A Manager discounts every OTHER role's salary (never their own) — order-independent, since every role's base salary is fixed data, not affected by hiring order. */
export function dailyPayroll(hiredRoles: readonly BusinessStaffRole[]): number {
  const hasManager = hiredRoles.includes("manager");
  let total = 0;
  for (const role of hiredRoles) {
    const salary = getStaffDefinition(role)!.salary;
    total +=
      hasManager && role !== "manager"
        ? Math.round(salary * (1 - MANAGER_PAYROLL_DISCOUNT))
        : salary;
  }
  return total;
}

/** Every currently-hired role's own definition, for QA/UI convenience. */
export function hiredStaffDefinitions(save: SaveData): BusinessStaffDefinition[] {
  return save.business.staff.hiredRoles.map((role) => getStaffDefinition(role)!);
}
