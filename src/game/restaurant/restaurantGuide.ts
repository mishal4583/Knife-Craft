/**
 * RESTAURANT GUIDE — "what to do next, and why" (developer 2026-10-29: "the game
 * still feels like just cutting and serving; there is no tutorial to visit the
 * second floor, buy a machine, hire staff; no one motivates the player to make
 * the restaurant No. 1; no instruction to collect achievements").
 *
 * A short list of rules read from the save and the level: each one, when it
 * applies, gives one step — an icon, a title, why it matters and the screen that
 * does it. The Kitchen offers the first applicable step at a calm moment, at
 * most once per level. A step is DONE when its rule stops applying (the machine
 * bought, the server hired, the rewards collected), so a finished step never
 * comes back. "Later" / "Show me" write `business.guideSeen` ("id@level"): a
 * step is not offered again until REMIND_EVERY_LEVELS later (never, for a
 * one-off intro). Presentation only: no money moves, nothing is bought here.
 * Pure and deterministic; reuses the existing sections, prices and rankings.
 */
import type { SaveData } from "../SaveManager";
import { collectableTotal } from "../progression/achievements";
import { nextKitchenUpgrade } from "../kitchen/nextKitchenUpgrade";
import { fridgeUsage } from "./fridgeUsage";
import { REFRIGERATOR_CATALOG } from "../business/refrigeratorDefinitions";
import { restaurantLevelOf } from "./restaurantMenu";
import {
  FLOOR_STAFF,
  STATIONS,
  isSecondFloorOpen,
  isStationUnlocked,
  secondFloorOf,
} from "./secondFloor";
import { STAFF_RULES, restaurantStaffOf } from "./staffRequirements";
import { BUSINESS_STAFF_CATALOG } from "../business/businessStaff";
import { cityRanking } from "./cityRanking";
import { cleanlinessOf, hasCleaner, isCleanlinessLive, taskNeeds } from "./cleanliness";
import { getSupplyItem, type SupplyId } from "../business/businessSupplies";
import { isSystemLive } from "./restaurantProgression";
import { formatUsd } from "../money";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import { getKnifeUpgrades, upgradeCost, BLACKSMITH_STATS } from "../knives/blacksmith";

export type GuideStep = {
  id: string;
  icon: string;
  title: string;
  /** Why it matters — one or two short lines. */
  why: string;
  /** The button's words, and the screen it opens (a ScreenId). */
  button: string;
  to: string;
  /** A one-off introduction: offered once, never again. */
  once?: boolean;
};

/** A step the player put off is offered again after this many levels (while it still applies). */
export const REMIND_EVERY_LEVELS = 10;

/** The kitchen-upgrade step appears once the wallet holds this share of the tier's price. */
export const KITCHEN_STEP_FROM_SHARE = 0.3;

type Rule = (save: SaveData, level: number) => GuideStep | null;

const unlockedStations = (level: number) => STATIONS.filter((s) => isStationUnlocked(s, level));

/** In priority order: the first that applies and is not put off is the step. */
const RULES: readonly Rule[] = [
  // Money already earned and waiting.
  (save, level) => {
    const total = level >= 6 ? collectableTotal(save) : 0;
    return total > 0
      ? {
          id: "achievements",
          icon: "🏆",
          title: "Achievement rewards are waiting",
          why: `You've earned ${formatUsd(total)}. Open Achievements and tap Collect to put it in your wallet.`,
          button: "Collect rewards",
          to: "achievements",
        }
      : null;
  },
  // Early goals (the first levels): a better knife and board you can afford now, then the Blacksmith.
  (save, level) => {
    if (level < 3) return null;
    const owned = new Set(save.ownedKnifeIds);
    const knife = [...KNIFE_CATALOG]
      .filter((k) => k.price > 0 && !owned.has(k.id) && k.price <= save.credits)
      .sort((a, b) => a.price - b.price)[0];
    return knife
      ? {
          id: `knife:${knife.id}`,
          icon: "🔪",
          title: `You can afford the ${knife.name}`,
          why: `${formatUsd(knife.price)} in the Market. A better knife cuts cleaner, and cleaner cuts score higher and pay more.`,
          button: "Open the Market",
          to: "shop",
        }
      : null;
  },
  (save, level) => {
    if (level < 4) return null;
    const owned = new Set(save.ownedBoardIds);
    const board = [...BOARD_CATALOG]
      .filter((b) => b.price > 0 && !owned.has(b.id) && b.price <= save.credits)
      .sort((a, b) => a.price - b.price)[0];
    return board
      ? {
          id: `board:${board.id}`,
          icon: "🪵",
          title: `You can afford the ${board.name}`,
          why: `${formatUsd(board.price)} in the Market. A better board makes every cut easier to land.`,
          button: "Open the Market",
          to: "shop",
        }
      : null;
  },
  (save, level) => {
    if (level < 6) return null;
    const levels = getKnifeUpgrades(save, save.equippedKnifeId);
    const next = BLACKSMITH_STATS.map((stat) => upgradeCost(levels[stat])).filter(
      (c): c is number => c !== null,
    );
    const cheapest = next.length ? Math.min(...next) : null;
    return cheapest !== null && cheapest <= save.credits
      ? {
          id: "blacksmith",
          icon: "⚒️",
          title: "Sharpen your knife at the Blacksmith",
          why: `An upgrade costs from ${formatUsd(cheapest)}: sharper, faster or easier to handle. Every step makes your cuts better.`,
          button: "Open the Blacksmith",
          to: "shop",
        }
      : null;
  },
  // Kitchen: the next tier, once it can be built.
  (save) => {
    const next = nextKitchenUpgrade(save);
    // Only once it is within reach (a third saved): a $0 player is not sent shopping for $60,000.
    if (!next || next.state !== "available" || next.progress < KITCHEN_STEP_FROM_SHARE) return null;
    return {
      id: `kitchen:${next.id}`,
      icon: "🏠",
      title: `Upgrade to the ${next.name}`,
      why: next.ready
        ? `A bigger, better kitchen for ${formatUsd(next.price)} — you can afford it now.`
        : `A bigger, better kitchen for ${formatUsd(next.price)}. You have ${Math.floor(next.progress * 100)}% of it — keep serving.`,
      button: "Kitchen upgrades",
      to: "business-kitchen-upgrades",
    };
  },
  // Fridge: nearly full and a bigger one exists.
  (save) => {
    const u = fridgeUsage(save);
    const idx = REFRIGERATOR_CATALOG.findIndex(
      (r) => r.id === save.business.refrigerator.refrigeratorId,
    );
    const bigger = idx >= 0 ? REFRIGERATOR_CATALOG[idx + 1] : undefined;
    if (u.status === "ok" || !bigger) return null;
    return {
      id: `fridge:${save.business.refrigerator.refrigeratorId}`,
      icon: "🧊",
      title: "Your fridge is nearly full",
      why: `The ${bigger.name} holds ${bigger.capacity} instead of ${u.capacity} (${formatUsd(bigger.price)}). More room, fewer trips to the Market.`,
      button: "Upgrade the fridge",
      to: "business-refrigerator",
    };
  },
  // Staff the restaurant now needs.
  (save, level) => {
    const hired = new Set(save.business.staff.hiredRoles);
    const rule = STAFF_RULES.find(
      (r) =>
        level >= r.fromLevel &&
        r.minOrders === undefined &&
        r.minDineIn === undefined &&
        r.minSpecialistCuisines === undefined &&
        r.minTeam === undefined &&
        !hired.has(r.role),
    );
    if (rule)
      return {
        id: `staff:${rule.role}`,
        icon: "🧑‍🍳",
        title: `Hire a ${BUSINESS_STAFF_CATALOG[rule.role].name}`,
        why: rule.why,
        button: "Open Staff",
        to: "business-staff",
      };
    const team = hired.size + restaurantStaffOf(save).specialists.length;
    return level >= 8 && team === 0
      ? {
          id: "staff-first",
          icon: "🧑‍🍳",
          title: "Hire your first helper",
          why: "Staff do the routine work so you can focus on cooking. A hire costs three days' wages, then the daily wage.",
          button: "Open Staff",
          to: "business-staff",
        }
      : null;
  },
  // The Second Floor: a machine, then someone to run it.
  (save, level) => {
    if (!isSecondFloorOpen(level)) return null;
    const floor = secondFloorOf(save);
    const owned = Object.keys(floor.stations).length;
    if (owned === 0) {
      const list = unlockedStations(level);
      if (list.length === 0) return null;
      const cheapest = list.reduce((a, b) => (b.price < a.price ? b : a));
      return {
        id: "floor-machine",
        icon: "⬆️",
        title: "Go up to the 2nd floor",
        why: `Machines there earn money while you cook. The ${cheapest.name} starts at ${formatUsd(cheapest.price)}.`,
        button: "Go upstairs",
        to: "second-floor",
      };
    }
    if ((floor.servers ?? 0) === 0)
      return {
        id: "floor-server",
        icon: "🧑‍🍳",
        title: "Hire a Floor Server",
        why: `Your machine only earns when a Floor Server runs it (${formatUsd(FLOOR_STAFF.server.price)}, hired for good).`,
        button: "Go upstairs",
        to: "second-floor",
      };
    return null;
  },
  // Out of cleaning supplies or tools: say what to restock (the cause of tasks left undone).
  (save, level) => {
    if (!isCleanlinessLive(level)) return null;
    const missing = new Set<SupplyId>();
    for (const t of cleanlinessOf(save).tasks)
      for (const id of taskNeeds(save, t.kind)) missing.add(id);
    if (missing.size === 0) return null;
    const names = [...missing]
      .slice(0, 3)
      .map((id) => getSupplyItem(id)?.name ?? id)
      .join(", ");
    return {
      id: "cleaning-supplies",
      icon: "🧴",
      title: "You're out of cleaning supplies",
      why: `${names}${missing.size > 3 ? " and more" : ""} — buy ${missing.size > 1 ? "them" : "it"} in the Market (Cleaning) so the restaurant can be cleaned. Tasks you have no supplies for never cost you tips.`,
      button: "Open the Market",
      to: "shop-supplies",
    };
  },
  // Cleaning is piling up.
  (save, level) =>
    isCleanlinessLive(level) && !hasCleaner(save) && cleanlinessOf(save).tasks.length >= 4
      ? {
          id: "cleaner",
          icon: "🧽",
          title: "Cleaning is piling up",
          why: "A Cleaner does the routine tasks for you — or hire one for just today.",
          button: "Open Cleanliness",
          to: "business-cleanliness",
        }
      : null,
  // Cheaper ingredients.
  (save, level) =>
    isSystemLive("fridge-freshness", level) && save.business.supplierContract === null
      ? {
          id: "supplier",
          icon: "🤝",
          title: "Sign a supplier contract",
          why: "A contract lowers what your ingredients cost for days at a time.",
          button: "Open Suppliers",
          to: "business-suppliers",
        }
      : null,
  // One-off: what achievements are.
  (_save, level) =>
    level >= 6
      ? {
          id: "achievements-intro",
          icon: "🏆",
          title: "Collect achievements",
          why: "Milestones pay real cash — tap Collect in Progress → Achievements to claim each one.",
          button: "See achievements",
          to: "achievements",
          once: true,
        }
      : null,
  // Why keep going: the city's ranking.
  (save, level) => {
    if (level < 8) return null;
    const r = cityRanking(save);
    const tier = r.rank === 1 ? "no1" : r.rank <= 3 ? "top3" : r.rank <= 10 ? "top10" : "climb";
    const ahead = r.next
      ? `${r.next.emoji} ${r.next.name} is next — ${Math.max(1, r.next.reputation - r.reputation)} more reputation to pass them.`
      : "Keep serving to stay on top.";
    return {
      id: `rank:${tier}`,
      icon: "🥇",
      title:
        r.rank === 1 ? "You're the city's No. 1!" : `Your restaurant is #${r.rank} of ${r.total}`,
      why: `${ahead} Every level you finish climbs the ranking — make yours the best in town.`,
      button: "See the ranking",
      to: "rack",
    };
  },
];

const parse = (entry: string): { id: string; level: number } => {
  const at = entry.lastIndexOf("@");
  return at < 0
    ? { id: entry, level: 0 }
    : { id: entry.slice(0, at), level: Number(entry.slice(at + 1)) || 0 };
};

/** Whether a step may be offered at `level` given what the player already put off. */
export function guideStepDue(step: GuideStep, seen: readonly string[], level: number): boolean {
  const last = seen.map(parse).filter((e) => e.id === step.id);
  if (last.length === 0) return true;
  if (step.once) return false;
  return level >= Math.max(...last.map((e) => e.level)) + REMIND_EVERY_LEVELS;
}

/** The step to offer now, or null (nothing applies, or everything was put off lately). */
export function guideStepFor(save: SaveData): GuideStep | null {
  const level = restaurantLevelOf(save.levelProgress);
  const seen = save.business.guideSeen ?? [];
  for (const rule of RULES) {
    const step = rule(save, level);
    if (step && guideStepDue(step, seen, level)) return step;
  }
  return null;
}

/** Every step that applies right now (done ones are not here), for tests. */
export function guideStepsApplying(save: SaveData): GuideStep[] {
  const level = restaurantLevelOf(save.levelProgress);
  return RULES.map((r) => r(save, level)).filter((s): s is GuideStep => s !== null);
}

const SEEN_KEPT = 60;

/** The save with `step` marked as offered at the player's level (Later or Show me). */
export function markGuideSeen(save: SaveData, step: GuideStep): SaveData {
  const level = restaurantLevelOf(save.levelProgress);
  const seen = (save.business.guideSeen ?? []).filter((e) => parse(e).id !== step.id);
  return {
    ...save,
    business: { ...save.business, guideSeen: [...seen, `${step.id}@${level}`].slice(-SEEN_KEPT) },
  };
}
