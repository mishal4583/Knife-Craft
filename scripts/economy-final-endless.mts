/**
 * ECONOMY FINAL — ENDLESS CANDIDATES (docs/ECONOMY_FINAL.md): the five
 * Endless restaurants of restaurant-endless-qa (30 days each, from the
 * Level-250 completionist save of the final economy, events on) measured
 * day by day, then two open rules compared on the SAME days:
 *
 *  Today's Special bonus — A: $50 flat; B: 10 % of the day's restaurant
 *  revenue, capped at $50; C: 15 %, capped at $50.
 *  BUSY star — A: 100 % of the day's target served; B: ≥ 90 %; C: ≥ 95 %;
 *  D: the whole demand served (the target before the team's capacity).
 *
 * Read-only: nothing here changes a rule; it prints the comparison.
 * Run: npx tsx scripts/economy-final-endless.mts
 */
import { $ } from "./restaurantCampaignSim.mts";
import {
  ALL_CHEFS,
  ALL_ROLES,
  configure,
  endlessStartSave,
  playDay,
} from "./restaurant-endless-qa.mts";
import type { SaveData } from "../src/game/SaveManager.ts";
import { businessCustomersToday } from "../src/game/business/BusinessServiceManager.ts";
import { endlessDemandFor } from "../src/game/restaurant/endlessDemand.ts";
import { demandWithEvents, eventsForDay } from "../src/game/restaurant/restaurantEvents.ts";
import { dollars } from "../src/game/money.ts";

type Day = {
  net: number;
  revenue: number;
  profit: number;
  target: number;
  demand: number;
  served: number;
  special: boolean;
  /** The Today's Special bonus the game paid that day (the shipped rule). */
  bonus: number;
  stars: number;
  profitable: boolean;
  clean: boolean;
};

/** The customers the day would have without the team's cap (demand with events). */
function uncappedDemand(s: SaveData): number {
  const classic = businessCustomersToday({
    ...s,
    business: { ...s.business, restaurantMigration: undefined },
  }).target;
  return demandWithEvents(
    endlessDemandFor(s, classic),
    eventsForDay(s, s.business.calendar.businessDay),
  ).demand;
}

export function endlessDays(start: SaveData): Day[] {
  let s = start;
  const days: Day[] = [];
  for (let d = 0; d < 30; d++) {
    const target = businessCustomersToday(s).target;
    const demand = uncappedDemand(s);
    const before = s.credits;
    const r = playDay(s);
    s = r.save;
    const rec = s.business.finance.history!.at(-1)!;
    days.push({
      net: s.credits - before,
      revenue: rec.revenue,
      profit: rec.profit,
      target,
      demand,
      served: r.served,
      special: s.business.todaysSpecialServedDay === rec.day,
      bonus: r.specialBonus,
      stars: r.stars,
      profitable: !!r.starParts?.profitable,
      clean: !!r.starParts?.clean,
    });
  }
  return days;
}

export const SPECIAL_RULES: Record<string, (revenue: number) => number> = {
  "A $50 flat": () => dollars(50),
  "B 10 % ≤ $50": (rev) => Math.min(dollars(50), Math.round(rev * 0.1)),
  "C 15 % ≤ $50": (rev) => Math.min(dollars(50), Math.round(rev * 0.15)),
};

export const BUSY_RULES: Record<string, (d: Day) => boolean> = {
  "A 100 % of target": (d) => d.target > 0 && d.served >= d.target,
  "B ≥ 90 % of target": (d) => d.target > 0 && d.served >= Math.ceil(d.target * 0.9),
  "C ≥ 95 % of target": (d) => d.target > 0 && d.served >= Math.ceil(d.target * 0.95),
  "D whole demand": (d) => d.demand > 0 && d.served >= d.demand,
};

const L250 = endlessStartSave();
const RESTAURANTS: Array<[string, SaveData]> = [
  ["minimum", configure(L250, [], [], 6)],
  ["medium", configure(L250, ["prep-cook", "server", "line-cook"], [], 20)],
  ["full menu, thin staff", configure(L250, ["prep-cook", "server"], [], 48)],
  ["fully staffed", configure(L250, ALL_ROLES, ALL_CHEFS, 48)],
  ["overstaffed", configure(L250, ALL_ROLES, ALL_CHEFS, 6)],
];

console.log(`Endless, 30 days each from the L250 completionist save (${$(L250.credits)}).`);
console.log("\nToday's Special — net per day (bonus per day, share of the day's net)");
console.log(`| restaurant | ${Object.keys(SPECIAL_RULES).join(" | ")} |`);
console.log(
  `|---|${Object.keys(SPECIAL_RULES)
    .map(() => "---")
    .join("|")}|`,
);
const all: Record<string, Day[]> = {};
for (const [name, start] of RESTAURANTS) {
  const days = endlessDays(start);
  all[name] = days;
  const cells = Object.values(SPECIAL_RULES).map((rule) => {
    let net = 0;
    let bonus = 0;
    for (const d of days) {
      const b = d.special ? rule(d.revenue) : 0;
      net += d.net - d.bonus + b;
      bonus += b;
    }
    const share = net > 0 ? Math.round((bonus / net) * 100) : 0;
    return `${$(net / 30)} (${$(bonus / 30)}, ${share}%)`;
  });
  console.log(`| ${name} | ${cells.join(" | ")} |`);
}

console.log(
  "\nBUSY star — share of days earning it; total stars / 90 (PROFITABLE + CLEAN unchanged)",
);
console.log(`| restaurant | ${Object.keys(BUSY_RULES).join(" | ")} |`);
console.log(
  `|---|${Object.keys(BUSY_RULES)
    .map(() => "---")
    .join("|")}|`,
);
for (const [name, days] of Object.entries(all)) {
  const cells = Object.values(BUSY_RULES).map((busy) => {
    let stars = 0;
    let busyDays = 0;
    for (const d of days) {
      const others = (d.profitable ? 1 : 0) + (d.clean ? 1 : 0);
      const b = busy(d);
      busyDays += b ? 1 : 0;
      stars += others + (b ? 1 : 0);
    }
    return `${Math.round((busyDays / 30) * 100)}% busy · ★ ${stars}/90`;
  });
  console.log(`| ${name} | ${cells.join(" | ")} |`);
}
