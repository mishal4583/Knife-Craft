/**
 * STAFF_REQUIREMENTS — the restaurant needs more hands as it grows
 * (Unified Restaurant, developer 2026-10-05 §4): early on the chef runs it
 * alone; then a Prep Cook as services get bigger, a Server once tables fill,
 * a Line Cook for more cuisines and orders, a Cleaner for a bigger closing,
 * a Head Chef and a Manager for a large team — and each cuisine from the
 * Indian chapter on needs its SPECIALIST CHEF.
 *
 * A requirement is never an arbitrary wall:
 *  - it scales with the actual service (orders = the level's own tickets +
 *    its menu guests; dine-in tables; the cuisines on the active menu and in
 *    the tickets), so a small service still runs without it;
 *  - it is announced STAFF_NOTICE_LEVELS ahead (restaurantNews.ts), with its
 *    reason;
 *  - the Pre-Service Check lists it with the reason and "Hire →"; hiring is
 *    free (the existing rule), so it can never soft-lock a service.
 *
 * Specialist chefs are restaurant staff kept in the optional
 * `business.restaurantStaff` (the classic six-role catalog is unchanged).
 * Hiring and firing move no money; from full operation (L91) their daily
 * wage is paid at closing next to the existing payroll — one
 * "business-staff-salary" entry per chef — and, as with payroll, a wallet
 * that can't cover them lays them off (no debt). Their wage reuses the Line
 * Cook's existing daily figure (SPECIALIST_WAGE_FROM_ROLE); not balanced
 * (docs/ECONOMY_TODO.md).
 *
 * Pure; nothing reads RESTAURANT_MODE. Every threshold is in STAFF_RULES.
 */
import type { SaveData } from "../SaveManager";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { BUSINESS_STAFF_CATALOG, type BusinessStaffRole } from "../business/businessStaff";
import { debitWallet } from "../economy/wallet";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import { activeMenuDishes } from "./restaurantMenu";
import { CUISINES, isSystemLive, menuGuestsPerService } from "./restaurantProgression";
import type { OrderService } from "./serviceSupplies";

// ── Configuration ───────────────────────────────────────────────────────

export type StaffRule = {
  role: BusinessStaffRole;
  fromLevel: number;
  /** Needed only when the service has at least this many orders (tickets + menu guests). */
  minOrders?: number;
  /** Needed only with at least this many dine-in orders. */
  minDineIn?: number;
  /** Needed only with at least this many specialist cuisines on the menu. */
  minSpecialistCuisines?: number;
  /** Needed only with at least this many other staff. */
  minTeam?: number;
  /** Why (shown on the check and the notice). */
  why: string;
};

export const STAFF_RULES: readonly StaffRule[] = [
  {
    role: "prep-cook",
    fromLevel: 41,
    minOrders: 3,
    why: "Three or more orders a service is more prep than one chef can do alone.",
  },
  {
    role: "server",
    fromLevel: 46,
    minDineIn: 2,
    why: "With two or more tables, someone has to take orders and carry the plates.",
  },
  {
    role: "line-cook",
    fromLevel: 61,
    minOrders: 4,
    why: "Four or more orders need a second cook on the line.",
  },
  {
    role: "cleaner",
    fromLevel: 91,
    why: "A bigger restaurant's closing needs a cleaner — the day-end inspection checks it.",
  },
  {
    role: "head-chef",
    fromLevel: 121,
    minSpecialistCuisines: 3,
    why: "Three or more cuisines in one kitchen need a Head Chef to run it.",
  },
  {
    role: "manager",
    fromLevel: 161,
    minTeam: 5,
    why: "A team of five or more needs a Manager.",
  },
];

/** How many levels ahead a staff requirement (or a specialist) is announced. */
export const STAFF_NOTICE_LEVELS = 5;

/** A specialist's daily wage is this role's existing daily figure (not balanced). */
export const SPECIALIST_WAGE_FROM_ROLE: BusinessStaffRole = "line-cook";

// ── Specialist chefs ────────────────────────────────────────────────────

export type SpecialistChef = {
  id: string;
  title: string;
  /** The first level any of its cuisines opens. */
  firstLevel: number;
  /** The cuisines it cooks. */
  cuisines: string[];
  /** Daily wage, whole cents (paid at closing from full operation). */
  dailyWage: number;
};

export const SPECIALIST_CHEFS: readonly SpecialistChef[] = (() => {
  const out: SpecialistChef[] = [];
  for (const c of CUISINES) {
    if (!c.specialist) continue;
    const existing = out.find((s) => s.id === c.specialist!.id);
    if (existing) {
      existing.cuisines.push(c.name);
      existing.firstLevel = Math.min(existing.firstLevel, c.firstLevel);
    } else
      out.push({
        id: c.specialist.id,
        title: c.specialist.title,
        firstLevel: c.firstLevel,
        cuisines: [c.name],
        dailyWage: BUSINESS_STAFF_CATALOG[SPECIALIST_WAGE_FROM_ROLE].salary,
      });
  }
  return out;
})();

export function getSpecialist(id: string): SpecialistChef | undefined {
  return SPECIALIST_CHEFS.find((s) => s.id === id);
}

export type RestaurantStaffState = { specialists: string[] };

/** The save's specialist chefs (known ids only; none for old saves and the classic game). */
export function restaurantStaffOf(save: SaveData): RestaurantStaffState {
  const raw = save.business.restaurantStaff?.specialists;
  const ids = Array.isArray(raw) ? raw.filter((id) => !!getSpecialist(id)) : [];
  return { specialists: [...new Set(ids)] };
}

const withSpecialists = (save: SaveData, specialists: string[]): SaveData => ({
  ...save,
  business: { ...save.business, restaurantStaff: { specialists } },
});

export type HireSpecialistResult =
  { ok: true; save: SaveData } | { ok: false; reason: "unknown" | "alreadyHired" | "notYet" };

/** Free (no money, no ledger), like every hire. Only once one of its cuisines has opened. */
export function hireSpecialist(
  save: SaveData,
  id: string,
  restaurantLevel: number,
): HireSpecialistResult {
  const chef = getSpecialist(id);
  if (!chef) return { ok: false, reason: "unknown" };
  if (restaurantLevel < chef.firstLevel) return { ok: false, reason: "notYet" };
  const { specialists } = restaurantStaffOf(save);
  if (specialists.includes(id)) return { ok: false, reason: "alreadyHired" };
  return { ok: true, save: withSpecialists(save, [...specialists, id]) };
}

export function fireSpecialist(save: SaveData, id: string): SaveData {
  const { specialists } = restaurantStaffOf(save);
  return specialists.includes(id)
    ? withSpecialists(
        save,
        specialists.filter((s) => s !== id),
      )
    : save;
}

/**
 * Closing from full operation (L91): the specialists' daily wages, one
 * "business-staff-salary" entry each (description = the chef's id). A
 * wallet that can't cover all of them lays them all off and pays nothing
 * (the payroll rule — never debt). Before L91 closing moves no money.
 */
export function paySpecialists(
  save: SaveData,
  levelNumber: number,
): { save: SaveData; paid: number; laidOff: string[] } {
  const { specialists } = restaurantStaffOf(save);
  if (!isSystemLive("full-operation", levelNumber) || specialists.length === 0)
    return { save, paid: 0, laidOff: [] };
  const total = specialists.reduce((n, id) => n + getSpecialist(id)!.dailyWage, 0);
  const debit = debitWallet(save, total);
  if (!debit.ok) return { save: withSpecialists(save, []), paid: 0, laidOff: specialists };
  let next = debit.save;
  for (const id of specialists)
    next = appendLedgerEntry(next, "business-staff-salary", -getSpecialist(id)!.dailyWage, id);
  return { save: next, paid: total, laidOff: [] };
}

// ── Requirements for a service ──────────────────────────────────────────

export type StaffRequirement = {
  /** A role id or a specialist id. */
  id: string;
  kind: "role" | "specialist";
  title: string;
  why: string;
  met: boolean;
};

export type ServiceShape = {
  orders: number;
  dineIn: number;
  /** Specialist ids the service's cuisines need. */
  specialists: string[];
  specialistCuisines: number;
};

/**
 * The service's shape: the level's own remaining tickets plus its menu
 * guests (orders; dine-in ones from the dine-in stage), and the cuisines
 * on the active menu and in the tickets.
 */
export function serviceShape(
  save: SaveData,
  levelNumber: number,
  tickets: readonly RecipeDefinition[],
  services: readonly (OrderService | null)[],
): ServiceShape {
  const guests = menuGuestsPerService(levelNumber);
  const dineIn =
    services.filter((s) => s === "dine-in").length +
    (isSystemLive("dine-in", levelNumber) ? guests : 0);
  const cuisineIds = new Set<string>([
    ...activeMenuDishes(save.business.menuActivation, levelNumber).map(
      (d) => d.cuisineId ?? "home",
    ),
    ...tickets.map((r) => r.cuisineId ?? "home"),
  ]);
  const open = CUISINES.filter(
    (c) =>
      c.specialist && levelNumber >= c.firstLevel && c.cuisineIds.some((k) => cuisineIds.has(k)),
  );
  return {
    orders: tickets.length + guests,
    dineIn,
    specialists: [...new Set(open.map((c) => c.specialist!.id))],
    specialistCuisines: open.length,
  };
}

/** Every staff requirement of this service, met or not (empty before the staff stage). */
export function staffRequirementsFor(
  save: SaveData,
  levelNumber: number,
  shape: ServiceShape,
): StaffRequirement[] {
  const hired = new Set(save.business.staff.hiredRoles);
  const team = hired.size + restaurantStaffOf(save).specialists.length;
  const out: StaffRequirement[] = [];
  const chefs = new Set(restaurantStaffOf(save).specialists);
  for (const id of shape.specialists) {
    const chef = getSpecialist(id)!;
    out.push({
      id,
      kind: "specialist",
      title: chef.title,
      why: `${chef.cuisines.join(", ")} dishes are on today's menu — only the ${chef.title} cooks them.`,
      met: chefs.has(id),
    });
  }
  for (const rule of STAFF_RULES) {
    if (levelNumber < rule.fromLevel) continue;
    if (rule.minOrders !== undefined && shape.orders < rule.minOrders) continue;
    if (rule.minDineIn !== undefined && shape.dineIn < rule.minDineIn) continue;
    if (
      rule.minSpecialistCuisines !== undefined &&
      shape.specialistCuisines < rule.minSpecialistCuisines
    )
      continue;
    if (rule.minTeam !== undefined && team < rule.minTeam) continue;
    out.push({
      id: rule.role,
      kind: "role",
      title: BUSINESS_STAFF_CATALOG[rule.role].name,
      why: rule.why,
      met: hired.has(rule.role),
    });
  }
  return out;
}

export type StaffNotice = { level: number; title: string; why: string };

/** Staff the restaurant will start needing within STAFF_NOTICE_LEVELS after `levelNumber`. */
export function staffComingUp(levelNumber: number): StaffNotice[] {
  const soon = (from: number) => from > levelNumber && from - levelNumber <= STAFF_NOTICE_LEVELS;
  return [
    ...STAFF_RULES.filter((r) => soon(r.fromLevel)).map((r) => ({
      level: r.fromLevel,
      title: BUSINESS_STAFF_CATALOG[r.role].name,
      why: r.why,
    })),
    ...SPECIALIST_CHEFS.filter((s) => soon(s.firstLevel)).map((s) => ({
      level: s.firstLevel,
      title: s.title,
      why: `${s.cuisines[0]} dishes join the menu at Level ${s.firstLevel} — they need the ${s.title}.`,
    })),
  ].sort((a, b) => a.level - b.level);
}
