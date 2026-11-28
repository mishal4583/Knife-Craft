/**
 * PAIGE'S CHECKLIST (developer 2026-11-28: "the paige notebook should be like a check list for task to be done and let the old completed task
 * disappear after the day is completed and new task appear ... make sure paige doesnt show any wrong information").
 *
 * The notebook used to list the tips she had already said, so an old line ("Upgrade your kitchen") stayed for ever. Now every line is a job read
 * from the SAVE, with two rules per job: when it is OPEN (the game's own rule for it) and when it is DONE (proof in the save, never "it stopped
 * applying"). No text is saved: only today's job ids (`business.assistant.list`), so a line is always worded and judged from what is true now.
 * A closed service starts a new day (`playDayOf`): yesterday's ticks are gone and the new day's jobs are listed.
 *
 *  - the "Before you open" steps that are waiting (business/deliveryFlow.ts);
 *  - food for the next service (marketPlan.ts), and cleaning the player can do now (cleanliness.ts);
 *  - up to `GOALS_SHOWN` goals from the Restaurant Guide's rules (restaurantGuide.ts), only ones the player can do now;
 *  - last, always: serve the next guests (it closes the day, so it is never ticked).
 *
 * Pure and deterministic. It moves no money, stock or ledger.
 */
import type { SaveData } from "../SaveManager";
import { playDayOf } from "../business/playDay";
import { flowSteps, type FlowStepId } from "../business/deliveryFlow";
import { getSupplyItem, type SupplyId } from "../business/businessSupplies";
import { BUSINESS_STAFF_CATALOG, type BusinessStaffRole } from "../business/businessStaff";
import { REFRIGERATOR_CATALOG } from "../business/refrigeratorDefinitions";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { getKnifePurchaseState } from "../knives/KnifeManager";
import { BLACKSMITH_STATS, getKnifeUpgrades } from "../knives/blacksmith";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import { getBoardPurchaseState } from "../boards/BoardManager";
import { KITCHEN_UPGRADE_CATALOG } from "../kitchen/kitchenUpgradeDefinitions";
import { getKitchenUpgradeState } from "../kitchen/KitchenUpgradeManager";
import { nextKitchenUpgrade } from "../kitchen/nextKitchenUpgrade";
import { collectableTotal } from "../progression/achievements";
import { marketPlanFor } from "./marketPlan";
import { cleanlinessOf, isCleanlinessLive, taskNeeds } from "./cleanliness";
import { CHECK_TASK, isFridgeCheckOpen } from "./fridgeCheck";
import { FLOOR_STAFF, secondFloorOf } from "./secondFloor";
import { restaurantStaffOf } from "./staffRequirements";
import { guideStepsApplying, type GuideStep } from "./restaurantGuide";
import { restaurantLevelOf } from "./restaurantMenu";
import { assistantHired, assistantOf, TASK_IDS_KEPT } from "./assistant";

export type PaigeTask = {
  /** `step:<routine step>`, `restock`, `clean`, `serve`, or a guide goal such as `kitchen:<tier>`. */
  id: string;
  text: string;
  /** The screen its arrow opens (a ScreenId; "shop" is the Market's Ingredients tab). */
  go: string;
  /** A staff goal: the role the Staff screen scrolls to. */
  focus?: string;
  /** A restock goal: the supply card the Market opens on. */
  supply?: SupplyId;
};

/** At most this many goals (shopping, hiring, upgrades) are listed at once. */
export const GOALS_SHOWN = 3;
/** At most this many ticked jobs are shown (the newest first). */
export const DONE_SHOWN = 6;

export const SERVE_TASK: PaigeTask = {
  id: "serve",
  text: "Serve your next guests.",
  go: "kitchen",
};

const STEP_TEXT: Record<FlowStepId, string> = {
  inspect: "Check today's delivery.",
  unpack: "Sort the delivery into the fridge.",
  shelves: "Put the new supplies on the shelves.",
  "fridge-check": "Do the Fridge Check.",
  sauce: "Make today's sauce.",
  carpark: "Clear the car park.",
};
/** Where a ticked step's arrow goes: a screen that is always safe to open (its game has nothing left to do). */
const STEP_DONE_GO: Record<FlowStepId, string> = {
  inspect: "inventory",
  unpack: "inventory",
  shelves: "inventory-supplies",
  "fridge-check": "business-cleanliness",
  sauce: "inventory",
  carpark: "kitchen",
};
const isStepId = (s: string): s is FlowStepId => s in STEP_TEXT;

const split = (id: string): [string, string, string] => {
  const [kind = "", a = "", b = ""] = id.split(":");
  return [kind, a, b];
};

const forged = (save: SaveData, knifeId: string): number => {
  const levels = getKnifeUpgrades(save, knifeId);
  return BLACKSMITH_STATS.reduce((n, s) => n + levels[s], 0);
};

/** A job's words and destination, from its id alone (so a ticked job is worded the same as the open one). Null for an id the game no longer knows. */
export function taskById(id: string): PaigeTask | null {
  const [kind, a] = split(id);
  const task = (text: string, go: string, extra: Partial<PaigeTask> = {}): PaigeTask => ({
    id,
    text,
    go,
    ...extra,
  });
  switch (kind) {
    case "serve":
      return SERVE_TASK;
    case "step":
      return isStepId(a) ? task(STEP_TEXT[a], STEP_DONE_GO[a]) : null;
    case "restock":
      return task("Buy food for your next service.", "shop");
    case "clean":
      return task("Clean up the restaurant.", "business-cleanliness");
    case "achievements":
      return task("Collect your achievement rewards.", "achievements");
    case "floor-machine":
      return task("Buy your first machine on the Second Floor.", "second-floor");
    case "floor-machine2":
      return task("Add a second machine on the Second Floor.", "second-floor");
    case "floor-server":
      return task("Hire a Floor Server for the Second Floor.", "second-floor");
    case "knife": {
      const k = KNIFE_CATALOG.find((x) => x.id === a);
      return k ? task(`Buy the ${k.name} in the Market.`, "shop") : null;
    }
    case "board": {
      const b = BOARD_CATALOG.find((x) => x.id === a);
      return b ? task(`Buy the ${b.name} in the Market.`, "shop") : null;
    }
    case "blacksmith":
      return task("Upgrade your knife at the Blacksmith.", "shop");
    case "kitchen": {
      const k = KITCHEN_UPGRADE_CATALOG.find((x) => x.id === a);
      return k ? task(`Upgrade to the ${k.name}.`, "business-kitchen-upgrades") : null;
    }
    case "fridge":
      return task("Get a bigger fridge: yours is nearly full.", "business-refrigerator");
    case "prep-cook-cuts":
      return task("Hire a Prep Cook to cut for you.", "business-staff", { focus: "prep-cook" });
    case "staff": {
      const role = BUSINESS_STAFF_CATALOG[a as BusinessStaffRole];
      return role ? task(`Hire a ${role.name}.`, "business-staff", { focus: a }) : null;
    }
    case "staff-first":
      return task("Hire your first helper.", "business-staff");
    case "supplies": {
      const item = getSupplyItem(a as SupplyId);
      return item
        ? task(`Restock ${item.name} in the Market.`, "shop-supplies", { supply: a as SupplyId })
        : null;
    }
    case "supplier":
      return task("Sign a supplier contract.", "business-suppliers");
    default:
      return null;
  }
}

/** Whether the save PROVES a listed job was done. Never true just because the job stopped being offered. */
export function taskDone(save: SaveData, id: string): boolean {
  const [kind, a, b] = split(id);
  const level = restaurantLevelOf(save.levelProgress);
  const hired = save.business.staff.hiredRoles as readonly string[];
  const machines = () => Object.keys(secondFloorOf(save).stations).length;
  switch (kind) {
    case "step":
      return isStepId(a) && !flowSteps(save, level).some((s) => s.id === a);
    case "restock":
      return marketPlanFor(save, 1).rows.length === 0;
    case "clean":
      return cleaningJobs(save, level).length === 0;
    case "achievements":
      return collectableTotal(save) === 0;
    case "floor-machine":
      return machines() >= 1;
    case "floor-machine2":
      return machines() >= 2;
    case "floor-server":
      return (secondFloorOf(save).servers ?? 0) >= 1;
    case "knife": {
      const s = getKnifePurchaseState(save, a);
      return s === "owned" || s === "equipped";
    }
    case "board": {
      const s = getBoardPurchaseState(a, save);
      return s === "owned" || s === "equipped";
    }
    case "blacksmith":
      return b !== "" && forged(save, a) > Number(b);
    case "kitchen": {
      const s = getKitchenUpgradeState(a, save);
      return s === "current" || s === "past";
    }
    case "fridge": {
      const rank = (fridge: string) => REFRIGERATOR_CATALOG.findIndex((r) => r.id === fridge);
      return rank(save.business.refrigerator.refrigeratorId) > rank(a);
    }
    case "prep-cook-cuts":
      return hired.includes("prep-cook");
    case "staff":
      return hired.includes(a);
    case "staff-first":
      return hired.length + restaurantStaffOf(save).specialists.length > 0;
    case "supplies":
      // in stock AND no job on the board is still short of it (one unit can be too little)
      return (
        (save.business.supplies.stock[a as SupplyId]?.units ?? 0) > 0 &&
        !cleanlinessOf(save).tasks.some((t) => taskNeeds(save, t.kind).includes(a as SupplyId))
      );
    case "supplier":
      return save.business.supplierContract !== null;
    default:
      return false;
  }
}

/** The cleaning jobs on the board (the Fridge Check's two chores are their own routine step). */
function cleaningJobs(save: SaveData, level: number) {
  if (!isCleanlinessLive(level)) return [];
  return cleanlinessOf(save).tasks.filter(
    (t) =>
      !(
        (t.kind === CHECK_TASK.sort || t.kind === CHECK_TASK.wrap) &&
        isFridgeCheckOpen(save, level, t.kind)
      ),
  );
}

/** A guide step as a checklist goal, or null: only what the player can do NOW (an upgrade or a hire he cannot pay for is not a job yet). */
function goalFrom(save: SaveData, step: GuideStep): string | null {
  const [kind, a] = split(step.id);
  switch (kind) {
    case "achievements":
    case "floor-machine":
    case "floor-machine2":
    case "knife":
    case "board":
    case "prep-cook-cuts":
    case "staff":
    case "staff-first":
    case "supplier":
      return step.id;
    case "floor-server":
      return save.credits >= FLOOR_STAFF.server.price ? step.id : null;
    case "blacksmith":
      return `blacksmith:${save.equippedKnifeId}:${forged(save, save.equippedKnifeId)}`;
    case "kitchen": {
      const next = nextKitchenUpgrade(save);
      return next && next.id === a && next.ready ? step.id : null;
    }
    case "fridge": {
      const bigger = REFRIGERATOR_CATALOG[REFRIGERATOR_CATALOG.findIndex((r) => r.id === a) + 1];
      return bigger && save.credits >= bigger.price ? step.id : null;
    }
    case "cleaning-supplies":
      return step.supply ? `supplies:${step.supply}` : null;
    default:
      // the one-off introductions, the ranking line and "cleaning is piling up" (the cleaning job says that) are not jobs
      return null;
  }
}

/**
 * Which goals take the few places first: what the restaurant needs, then the big steps of building it up (the Second Floor, the kitchen).
 * Knives, boards, the Blacksmith and the rest follow in the guide's own order.
 */
const GOALS_FIRST = [
  "staff",
  "supplies",
  "fridge",
  "achievements",
  "floor-machine",
  "floor-machine2",
  "floor-server",
  "kitchen",
];

/** The jobs to do now, in order, WITHOUT "serve". `skip`: goals already ticked today that must not be offered a second time the same day. */
export function openTaskIds(save: SaveData, skip: ReadonlySet<string> = new Set()): string[] {
  const level = restaurantLevelOf(save.levelProgress);
  const out: string[] = flowSteps(save, level).map((s) => `step:${s.id}`);
  if (marketPlanFor(save, 1).rows.length > 0) out.push("restock");
  // (what is on the board is the player's, with or without a Cleaner; a job short of supplies is the restock goal's)
  if (cleaningJobs(save, level).some((t) => taskNeeds(save, t.kind).length === 0))
    out.push("clean");
  const goals = guideStepsApplying(save)
    .map((s) => goalFrom(save, s))
    .filter((id): id is string => !!id && !skip.has(split(id)[0]));
  const rank = (id: string) => {
    const i = GOALS_FIRST.indexOf(split(id)[0]);
    return i < 0 ? GOALS_FIRST.length : i;
  };
  // (a stable sort: the guide's own order holds within each group)
  out.push(...[...goals].sort((x, y) => rank(x) - rank(y)).slice(0, GOALS_SHOWN));
  return out;
}

/** Today's listed ids (none when the list belongs to an earlier day). */
function listedToday(save: SaveData): string[] {
  const list = assistantOf(save).list;
  return list && list.day === playDayOf(save) ? list.ids : [];
}

/** One Blacksmith job a day: after the tick, the next upgrade is not listed again as if the tick were wrong. */
const ticked = (save: SaveData, ids: readonly string[]): Set<string> =>
  new Set(
    ids.filter((id) => id.startsWith("blacksmith:") && taskDone(save, id)).map(() => "blacksmith"),
  );

/**
 * The save with today's open jobs written down, so a job can be ticked after it is done. The same save back when nothing is new. A new day
 * (a closed service) starts a new list. Called by the app's one save path and at load; it changes only `business.assistant.list`.
 */
export function trackPaigeTasks(save: SaveData): SaveData {
  if (!assistantHired(save)) return save;
  const before = listedToday(save);
  const add = openTaskIds(save, ticked(save, before)).filter((id) => !before.includes(id));
  const day = playDayOf(save);
  const old = assistantOf(save).list;
  if (add.length === 0 && (!old || old.day === day)) return save;
  // over the limit the oldest go first
  const ids = [...before, ...add].slice(-TASK_IDS_KEPT);
  return {
    ...save,
    business: { ...save.business, assistant: { ...assistantOf(save), list: { day, ids } } },
  };
}

export type PaigeChecklist = {
  /** Ticked today, the newest first. */
  done: PaigeTask[];
  /** Still to do, in order; "serve" is always last. */
  todo: PaigeTask[];
};

export function paigeChecklist(save: SaveData): PaigeChecklist {
  const listed = listedToday(save);
  const open = openTaskIds(save, ticked(save, listed));
  const done = listed
    .filter((id) => !open.includes(id) && taskDone(save, id))
    .reverse()
    .map(taskById)
    .filter((t): t is PaigeTask => !!t);
  const level = restaurantLevelOf(save.levelProgress);
  const steps = flowSteps(save, level);
  const guide = guideStepsApplying(save);
  const todo = open
    .map((id): PaigeTask | null => {
      const t = taskById(id);
      if (!t) return null;
      // an open routine step goes to its own game, and a staff goal keeps the card the guide scrolls to
      const [kind, a] = split(id);
      if (kind === "step") return { ...t, go: steps.find((s) => s.id === a)?.to ?? t.go };
      const from = guide.find((s) => s.id === id);
      return from?.focus ? { ...t, focus: from.focus } : t;
    })
    .filter((t): t is PaigeTask => !!t);
  // two ids can word the same job (a ticked one and the open one): the open one wins
  const openText = new Set(todo.map((t) => t.text));
  return {
    done: done.filter((t) => !openText.has(t.text)).slice(0, DONE_SHOWN),
    todo: [...todo, SERVE_TASK],
  };
}
