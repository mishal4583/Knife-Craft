/**
 * CLEANLINESS & MAINTENANCE (restaurant build, developer 2026-10-10). The
 * whole section — Kitchen, Dining Area, Restroom, their supplies and the
 * Cleaner's rounds — starts together at CLEANING_FROM_LEVEL (10; management
 * controls live in the Business section, open from Level 11).
 *
 * No clock and no decay: dirt comes only from real services. After each
 * service (a first completion — App.completeCampaignLevel, after the
 * wash-up and the service report) `tasksAfterService` adds that service's
 * cleaning tasks; one task per kind (a repeat raises its count). Cleaning a
 * task (`cleanTask`) uses its real supplies from the ONE supplies stock
 * (business.supplies) exactly once and removes it; with a tool or a supply
 * missing it stays open and says what's needed. The Cleaner (the existing
 * Restaurant Team role — no new wage) does the routine tasks of the areas
 * assigned to them at the end of each service (`cleanerRound`), with the
 * same supplies; spills are always the player's.
 *
 * Spotless: when a service starts (`snapshotServiceStart`, App.beginLevel)
 * the open required tasks are recorded; serviceReport counts a service
 * spotless only when none were open (and the existing soap / dirty /
 * cleaning-liquid rules hold). Nothing here blocks a service or moves
 * money; no ledger entry (supplies were paid for in the Market).
 *
 * State: `business.cleanliness` (optional; read through `cleanlinessOf`,
 * which clamps). Pure; deterministic (seeded); never reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import {
  getSupplyItem,
  type BusinessSuppliesState,
  type SupplyId,
} from "../business/businessSupplies";
import { supplyUnits, takeOne } from "../business/BusinessSuppliesManager";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { dishServiceFor } from "./dishService";
import { isSystemLive } from "./restaurantProgression";
import { restaurantDayOf } from "./restaurantDay";
import {
  bottleView,
  handWash,
  restaurantSuppliesOf,
  sinkPieces,
  tablesFor,
} from "./serviceSupplies";
import { isAuditDay } from "./parAudit";
import { remapCampaignThreshold } from "../levels/campaignSelection";
import { BUSINESS_STAFF_CATALOG } from "../business/businessStaff";

/**
 * Cleaning starts with this level's service (developer 2026-10-10: "from level
 * 10"): its tasks, Grandma's cleaning cupboard and the spotless streak. The
 * management screen is in the Business section, which opens at Level 11.
 */
export const CLEANING_FROM_LEVEL = 5;

export const isCleanlinessLive = (levelNumber: number) => levelNumber >= CLEANING_FROM_LEVEL;

export type CleanArea = "kitchen" | "dining" | "restroom";
export const CLEAN_AREAS: readonly CleanArea[] = ["kitchen", "dining", "restroom"];

export type TaskKind =
  | "equipment"
  | "grease"
  | "bins"
  | "floor"
  | "tables"
  | "spill"
  | "toilet"
  | "sink"
  | "paper"
  | "restroom-floor"
  // Shift chores (a real restaurant's day, developer 2026-10-11): opening …
  | "stations"
  | "restroom-check"
  | "lay-tables"
  // … the lull between services …
  | "sanitizer-bucket"
  | "sweep-line"
  | "restroom-refresh"
  // … and closing (the night chores, developer 2026-10-24: "add the same night
  // chores also in the same cleanliness section").
  | "wipe-boards"
  | "spoiled-out"
  | "wrap-fridge"
  | "clear-tables"
  | "degrease"
  | "mop-all"
  | "restroom-disinfect"
  | "condiments"
  | "polish-cutlery"
  // … and, on the designated days, the deep cleans (plan F4).
  | "deep-kitchen"
  | "deep-restroom"
  | "deep-dining";

/** The day's phases that bring their own chores (dayClock.ts's phases). */
export type ShiftPhase = "opening" | "lull" | "closing";

/** Who on the existing Restaurant Team does a routine chore (default: the Cleaner). */
export type ChoreStaff = "cleaner" | "server" | "prep-cook";

export type TaskRule = {
  area: CleanArea;
  label: string;
  /** The task icon's short name on the area card. */
  short: string;
  icon: string;
  /** Supplies used, in uses (see USES_PER_UNIT). */
  uses: readonly { id: SupplyId; n: number }[];
  /** Durable tools that must be owned (never used up). */
  tools: readonly SupplyId[];
  /** The Cleaner may do it; false = the player's (spills). */
  routine: boolean;
  /** A shift chore: the phase that brings it (absent = left by a service). */
  phase?: ShiftPhase;
  /** A shift chore starts at this level (default PHASE_CHORES_FROM). */
  fromLevel?: number;
  /** Who does it when hired (default the Cleaner, in their areas). */
  staff?: ChoreStaff;
  /**
   * A deep clean: an EXTRA closing task only on its designated days (the
   * week's last day, every DEEP_CLEAN_EVERY; the par audit's day, every
   * AUDIT_EVERY). It never replaces a daily chore.
   */
  deep?: DeepClean;
};

export type DeepClean = "weekly" | "audit";

export const TASK_RULES: Record<TaskKind, TaskRule> = {
  equipment: {
    area: "kitchen",
    label: "Clean the cooking equipment",
    short: "Equipment",
    icon: "🍳",
    uses: [
      { id: "disinfectant", n: 1 },
      { id: "sponges-cloths", n: 1 },
    ],
    tools: [],
    routine: true,
  },
  grease: {
    area: "kitchen",
    label: "Degrease the stove and fryer",
    short: "Grease",
    icon: "🔥",
    uses: [
      { id: "disinfectant", n: 1 },
      { id: "sponges-cloths", n: 1 },
    ],
    tools: [],
    routine: true,
  },
  bins: {
    area: "kitchen",
    label: "Empty the bins (new liners)",
    short: "Bins",
    icon: "🗑️",
    uses: [{ id: "bin-liners", n: 3 }],
    tools: [],
    routine: true,
  },
  floor: {
    area: "dining",
    label: "Sweep and mop the dining floor",
    short: "Floor",
    icon: "🧹",
    uses: [{ id: "floor-cleaner", n: 1 }],
    tools: ["brooms", "mop-bucket"],
    routine: true,
  },
  tables: {
    area: "dining",
    label: "Wipe and sanitize the tables",
    short: "Tables",
    icon: "🍽️",
    uses: [
      { id: "disinfectant", n: 1 },
      { id: "sponges-cloths", n: 1 },
    ],
    tools: [],
    routine: true,
  },
  spill: {
    area: "dining",
    label: "Clean up a spill",
    short: "Spills",
    icon: "💧",
    uses: [
      { id: "floor-cleaner", n: 1 },
      { id: "sponges-cloths", n: 1 },
    ],
    tools: ["mop-bucket"],
    routine: false,
  },
  toilet: {
    area: "restroom",
    label: "Clean the toilet",
    short: "Toilet",
    icon: "🚽",
    uses: [{ id: "disinfectant", n: 1 }],
    tools: ["toilet-brushes"],
    routine: true,
  },
  sink: {
    area: "restroom",
    label: "Refill the hand soap",
    short: "Sink",
    icon: "🧼",
    uses: [{ id: "hand-soap", n: 1 }],
    tools: [],
    routine: true,
  },
  paper: {
    area: "restroom",
    label: "Restock toilet paper and towels",
    short: "Paper",
    icon: "🧻",
    uses: [
      { id: "toilet-paper", n: 1 },
      { id: "paper-towels", n: 50 },
    ],
    tools: [],
    routine: true,
  },
  "restroom-floor": {
    area: "restroom",
    label: "Mop the restroom floor",
    short: "Floor",
    icon: "🪣",
    uses: [{ id: "floor-cleaner", n: 1 }],
    tools: ["mop-bucket"],
    routine: true,
  },
  // ── Opening: prepare ──
  stations: {
    area: "kitchen",
    label: "Set up the stations and the sanitizer",
    short: "Stations",
    icon: "🧑‍🍳",
    uses: [{ id: "disinfectant", n: 1 }],
    tools: [],
    routine: true,
    phase: "opening",
    staff: "prep-cook",
  },
  "restroom-check": {
    area: "restroom",
    label: "Morning restroom check",
    short: "Check",
    icon: "🔎",
    uses: [{ id: "paper-towels", n: 25 }],
    tools: [],
    routine: true,
    phase: "opening",
  },
  "lay-tables": {
    area: "dining",
    label: "Lay the tables",
    short: "Lay tables",
    icon: "🍴",
    uses: [],
    tools: [],
    routine: true,
    phase: "opening",
    fromLevel: remapCampaignThreshold(31),
    staff: "server",
  },
  // ── Lull: reset ──
  "sanitizer-bucket": {
    area: "kitchen",
    label: "Fresh sanitizer bucket",
    short: "Sanitizer",
    icon: "🪣",
    uses: [{ id: "disinfectant", n: 1 }],
    tools: [],
    routine: true,
    phase: "lull",
    staff: "prep-cook",
  },
  "sweep-line": {
    area: "kitchen",
    label: "Sweep the line",
    short: "Sweep",
    icon: "🧹",
    uses: [],
    tools: ["brooms"],
    routine: true,
    phase: "lull",
  },
  "restroom-refresh": {
    area: "restroom",
    label: "Refresh the restroom",
    short: "Refresh",
    icon: "✨",
    uses: [{ id: "paper-towels", n: 25 }],
    tools: [],
    routine: true,
    phase: "lull",
  },
  // ── Closing: clean and plan ──
  // The night chores that were Closing Time's own taps (developer 2026-10-24):
  // real tasks now, in their areas, done like any other — the boards and the
  // dining room in the cleaning game. Their supplies stay where they were
  // (the wipe-down's cleaning liquid and the wrap are used by closeDay), so
  // they use nothing here and the economy is unchanged.
  "wipe-boards": {
    area: "kitchen",
    label: "Wipe down the boards and counters",
    short: "Boards",
    icon: "🧽",
    uses: [],
    tools: [],
    routine: true,
    phase: "closing",
  },
  "spoiled-out": {
    area: "kitchen",
    label: "Throw out spoiled food",
    short: "Spoiled",
    icon: "🗑️",
    uses: [],
    tools: [],
    routine: true,
    phase: "closing",
    staff: "prep-cook",
  },
  "wrap-fridge": {
    area: "kitchen",
    label: "Wrap and label what's left in the fridge",
    short: "Wrap",
    icon: "🥡",
    uses: [],
    tools: [],
    routine: true,
    phase: "closing",
    staff: "prep-cook",
  },
  "clear-tables": {
    area: "dining",
    label: "Clear and reset the dining room",
    short: "Reset",
    icon: "🍽️",
    uses: [],
    tools: [],
    routine: true,
    phase: "closing",
    fromLevel: remapCampaignThreshold(31),
    staff: "server",
  },
  degrease: {
    area: "kitchen",
    label: "Degrease the hot equipment",
    short: "Degrease",
    icon: "🔥",
    uses: [
      { id: "disinfectant", n: 1 },
      { id: "sponges-cloths", n: 1 },
    ],
    tools: [],
    routine: true,
    phase: "closing",
  },
  "mop-all": {
    area: "dining",
    label: "Mop all the floors",
    short: "Mop",
    icon: "🪣",
    uses: [{ id: "floor-cleaner", n: 2 }],
    tools: ["mop-bucket"],
    routine: true,
    phase: "closing",
  },
  "restroom-disinfect": {
    area: "restroom",
    label: "Disinfect the restroom",
    short: "Disinfect",
    icon: "🧴",
    uses: [{ id: "disinfectant", n: 1 }],
    tools: ["toilet-brushes"],
    routine: true,
    phase: "closing",
  },
  condiments: {
    area: "dining",
    label: "Top up the condiments",
    short: "Condiments",
    icon: "🧂",
    uses: [],
    tools: [],
    routine: true,
    phase: "closing",
    fromLevel: remapCampaignThreshold(31),
    staff: "server",
  },
  "polish-cutlery": {
    area: "dining",
    label: "Polish and stack the cutlery",
    short: "Cutlery",
    icon: "🥄",
    uses: [{ id: "sponges-cloths", n: 1 }],
    tools: [],
    routine: true,
    phase: "closing",
    fromLevel: remapCampaignThreshold(31),
    staff: "server",
  },
  // Deep cleans (a real restaurant's weekly / monthly deep clean, developer 2026-10-11):
  // their own task kinds, so each is added once and its supplies used once.
  "deep-kitchen": {
    area: "kitchen",
    label: "Deep clean: descale the dish machine, boil out the fryer",
    short: "Deep kitchen",
    icon: "🧽",
    uses: [
      { id: "disinfectant", n: 3 },
      { id: "sponges-cloths", n: 2 },
    ],
    tools: [],
    routine: true,
    phase: "closing",
    fromLevel: remapCampaignThreshold(31),
    deep: "weekly",
  },
  "deep-restroom": {
    area: "restroom",
    label: "Deep clean: scrub the restroom tiles and grout",
    short: "Deep restroom",
    icon: "🧽",
    uses: [
      { id: "disinfectant", n: 2 },
      { id: "floor-cleaner", n: 2 },
    ],
    tools: ["toilet-brushes"],
    routine: true,
    phase: "closing",
    fromLevel: remapCampaignThreshold(31),
    deep: "weekly",
  },
  "deep-dining": {
    area: "dining",
    label: "Deep clean: the walk-in shelves and the seat upholstery",
    short: "Deep dining",
    icon: "🧽",
    uses: [
      { id: "disinfectant", n: 2 },
      { id: "sponges-cloths", n: 2 },
    ],
    tools: [],
    routine: true,
    phase: "closing",
    fromLevel: remapCampaignThreshold(31),
    deep: "audit",
  },
};

/** The weekly deep clean: the week's last day (Day 7, 14, 21 …). */
export const DEEP_CLEAN_EVERY = 7;

/** Whether `day` is a deep-clean day of that kind (the audit's is parAudit.ts's day). */
export function isDeepCleanDay(kind: DeepClean, day: number): boolean {
  return kind === "audit" ? isAuditDay(day) : day > 0 && day % DEEP_CLEAN_EVERY === 0;
}

/** The deep cleans that come with `day`'s closing at `levelNumber` (none on other days). */
export function deepCleansFor(day: number, levelNumber: number): TaskKind[] {
  return phaseChores("closing", levelNumber, day).filter((k) => !!TASK_RULES[k].deep);
}

/** Shift chores (opening / lull / closing) come with the day's ceremony, from Level 21. */
export const PHASE_CHORES_FROM = CLEANING_FROM_LEVEL;

export const TASK_KINDS = Object.keys(TASK_RULES) as TaskKind[];

/** How many task uses one stock unit gives (a bottle of floor cleaner mops 30 floors); 1 when absent. */
export const USES_PER_UNIT: Partial<Record<SupplyId, number>> = {
  "floor-cleaner": 30,
  disinfectant: 20,
  "hand-soap": 17,
  "sponges-cloths": 25,
};
export const usesPerUnit = (id: SupplyId) => USES_PER_UNIT[id] ?? 1;

export const CLEANING_RULES = {
  /** Restroom refills come with the guests: hand soap every this many customers, paper every this many. */
  sinkEvery: 6,
  paperEvery: 8,
  /** A messy dine-in dish (curry, fried, skewer) spills with this chance (seeded). */
  spillChance: 0.35,
  /** A task's count never grows past this. */
  maxCount: 9,
  /** Each open task (× its count, capped at 3) takes this much off its area's meter. */
  meterPerTask: 12,
};

export type CleaningTask = { kind: TaskKind; count: number; since: number };

export type CleanlinessState = {
  tasks: CleaningTask[];
  /** Uses left in each opened unit (an opened bottle / pack). */
  open: Partial<Record<SupplyId, number>>;
  /** Customers since the last restroom refills. */
  counters: { sink: number; paper: number };
  cleanerAreas: CleanArea[];
  introSeen: boolean;
  /** The level Grandma's cleaning cupboard came at (once); null = not yet. */
  cupboardAt: number | null;
  /**
   * What was open when the last service started (the spotless check): cleaning
   * tasks, and the pieces still dirty after the start's wash-up (no soap) —
   * since the sink game (2026-10-23) a service's own dishes wait in the sink.
   */
  lastStart: {
    level: number;
    open: number;
    /** Open cleaning tasks, without the morning's setup (the hygiene penalty reads this). */
    cleaning: number;
    areas: CleanArea[];
    dirty: number;
  } | null;
  cleaned: number;
  byCleaner: number;
  /** The shift-chore batches already added ("day:phase:services"), so a phase never repeats. */
  choreKeys: string[];
  /** The restaurant day a Cleaner was hired for one day (paid or for an ad); null = none. */
  dayCleanerDay: number | null;
};

export const DEFAULT_CLEANLINESS: CleanlinessState = {
  tasks: [],
  open: {},
  counters: { sink: 0, paper: 0 },
  cleanerAreas: [...CLEAN_AREAS],
  introSeen: false,
  cupboardAt: null,
  lastStart: null,
  cleaned: 0,
  byCleaner: 0,
  choreKeys: [],
  dayCleanerDay: null,
};

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const isArea = (a: unknown): a is CleanArea => CLEAN_AREAS.includes(a as CleanArea);

/** The save's cleanliness state (clamped; defaults when absent or odd). */
export function cleanlinessOf(save: SaveData): CleanlinessState {
  const raw = save.business.cleanliness as Partial<CleanlinessState> | undefined;
  if (!raw || typeof raw !== "object") return DEFAULT_CLEANLINESS;
  const tasks: CleaningTask[] = [];
  if (Array.isArray(raw.tasks))
    for (const t of raw.tasks) {
      if (!t || !TASK_RULES[t.kind as TaskKind] || tasks.some((x) => x.kind === t.kind)) continue;
      const count = Math.min(CLEANING_RULES.maxCount, whole(t.count));
      if (count > 0) tasks.push({ kind: t.kind, count, since: whole(t.since) });
    }
  const open: CleanlinessState["open"] = {};
  if (raw.open && typeof raw.open === "object")
    for (const [id, n] of Object.entries(raw.open))
      if (getSupplyItem(id) && whole(n) > 0)
        open[id as SupplyId] = Math.min(usesPerUnit(id as SupplyId), whole(n));
  const areas = Array.isArray(raw.cleanerAreas) ? raw.cleanerAreas.filter(isArea) : null;
  const ls = raw.lastStart;
  return {
    tasks,
    open,
    counters: { sink: whole(raw.counters?.sink), paper: whole(raw.counters?.paper) },
    cleanerAreas: areas ? CLEAN_AREAS.filter((a) => areas.includes(a)) : [...CLEAN_AREAS],
    introSeen: raw.introSeen === true,
    cupboardAt: raw.cupboardAt == null ? null : whole(raw.cupboardAt),
    lastStart:
      ls && typeof ls === "object"
        ? {
            level: whole(ls.level),
            open: whole(ls.open),
            cleaning: whole((ls as { cleaning?: unknown }).cleaning ?? ls.open),
            areas: Array.isArray(ls.areas) ? ls.areas.filter(isArea) : [],
            dirty: whole((ls as { dirty?: unknown }).dirty),
          }
        : null,
    cleaned: whole(raw.cleaned),
    byCleaner: whole(raw.byCleaner),
    choreKeys: Array.isArray(raw.choreKeys)
      ? raw.choreKeys.filter((k): k is string => typeof k === "string").slice(-CHORE_KEYS_KEPT)
      : [],
    dayCleanerDay: raw.dayCleanerDay == null ? null : whole(raw.dayCleanerDay),
  };
}

const CHORE_KEYS_KEPT = 12;

const withState = (save: SaveData, cleanliness: CleanlinessState): SaveData => ({
  ...save,
  business: { ...save.business, cleanliness },
});

// ── Supplies ────────────────────────────────────────────────────────────

/** Uses available of a supply: what's left in the open unit + every unit in stock. */
export function usesAvailable(save: SaveData, id: SupplyId): number {
  return (
    (cleanlinessOf(save).open[id] ?? 0) + supplyUnits(save.business.supplies, id) * usesPerUnit(id)
  );
}

/** Takes `n` uses of a supply (opening stock units as needed — cleaning lifetime "used"). Not enough → null. */
function takeUses(
  supplies: BusinessSuppliesState,
  open: CleanlinessState["open"],
  id: SupplyId,
  n: number,
): { supplies: BusinessSuppliesState; open: CleanlinessState["open"] } | null {
  let left = n;
  let stock = supplies.stock;
  let opened = open[id] ?? 0;
  let unitsUsed = 0;
  let usedCost = 0;
  while (left > 0) {
    if (opened === 0) {
      const took = takeOne(stock, id);
      if (!took) return null;
      stock = took.stock;
      opened = usesPerUnit(id);
      unitsUsed++;
      usedCost += took.cost;
    }
    const use = Math.min(opened, left);
    opened -= use;
    left -= use;
  }
  const totals = supplies.lifetime.cleaning;
  const nextOpen = { ...open };
  if (opened > 0) nextOpen[id] = opened;
  else delete nextOpen[id];
  return {
    supplies: {
      stock,
      lifetime: {
        ...supplies.lifetime,
        cleaning: {
          ...totals,
          unitsUsed: totals.unitsUsed + unitsUsed,
          usedCost: totals.usedCost + usedCost,
        },
      },
    },
    open: nextOpen,
  };
}

/** What a task still lacks to be done now: the tools not owned and the supplies short. */
export function taskNeeds(save: SaveData, kind: TaskKind): SupplyId[] {
  const rule = TASK_RULES[kind];
  return [
    ...rule.tools.filter((id) => supplyUnits(save.business.supplies, id) < 1),
    ...rule.uses.filter((u) => usesAvailable(save, u.id) < u.n).map((u) => u.id),
  ];
}

// ── Tasks ───────────────────────────────────────────────────────────────

/**
 * The cleaning a service leaves behind (deterministic): the kitchen's
 * equipment and bins every service, grease when a dish fries, sautés or
 * grills; the dining floor every service, the tables when guests ate in, a
 * spill now and then from a messy dish; the restroom's toilet and floor,
 * and refills as the customers add up.
 */
export function tasksAfterService(
  save: SaveData,
  levelNumber: number,
  service: {
    recipes: readonly (RecipeDefinition | null | undefined)[];
    dineIn: number;
    customers: number;
  },
): SaveData {
  if (!isCleanlinessLive(levelNumber)) return save;
  const st = cleanlinessOf(save);
  const add: TaskKind[] = ["equipment", "bins", "floor", "toilet", "restroom-floor"];
  const recipes = service.recipes.filter((r): r is RecipeDefinition => !!r);
  if (recipes.some((r) => dishServiceFor(r).cooking.some((c) => c !== "oven" && c !== "pot")))
    add.push("grease");
  if (service.dineIn > 0 && isSystemLive("dine-in", levelNumber)) add.push("tables");
  const rand = makeSeededRand(levelNumber * 7_727 + 31);
  for (const r of recipes)
    if (dishServiceFor(r).messy && rand() < CLEANING_RULES.spillChance) add.push("spill");
  const sink = st.counters.sink + service.customers;
  const paper = st.counters.paper + service.customers;
  if (sink >= CLEANING_RULES.sinkEvery) add.push("sink");
  if (paper >= CLEANING_RULES.paperEvery) add.push("paper");
  const tasks = st.tasks.map((t) => ({ ...t }));
  for (const kind of add) {
    const t = tasks.find((x) => x.kind === kind);
    if (t) t.count = Math.min(CLEANING_RULES.maxCount, t.count + 1);
    else tasks.push({ kind, count: 1, since: levelNumber });
  }
  return withState(save, {
    ...st,
    tasks,
    counters: {
      sink: sink >= CLEANING_RULES.sinkEvery ? sink % CLEANING_RULES.sinkEvery : sink,
      paper: paper >= CLEANING_RULES.paperEvery ? paper % CLEANING_RULES.paperEvery : paper,
    },
  });
}

export type CleanResult = { save: SaveData; ok: boolean; needs: SupplyId[] };

/**
 * Cleans one task: its tools must be owned and its supplies there; uses
 * them once and removes the task. A task that isn't open (a second tap)
 * changes nothing.
 */
export function cleanTask(
  save: SaveData,
  kind: TaskKind,
  by: "player" | "cleaner" = "player",
): CleanResult {
  const st = cleanlinessOf(save);
  if (!st.tasks.some((t) => t.kind === kind)) return { save, ok: false, needs: [] };
  const needs = taskNeeds(save, kind);
  if (needs.length) return { save, ok: false, needs };
  let supplies = save.business.supplies;
  let open = st.open;
  for (const u of TASK_RULES[kind].uses) {
    const took = takeUses(supplies, open, u.id, u.n);
    if (!took) return { save, ok: false, needs: [u.id] };
    supplies = took.supplies;
    open = took.open;
  }
  // A night chore also does the day's leftovers of its kind in the same pass (CLOSING_COVERS):
  // they are cleaned together with it, never dropped.
  const alsoDone = (CLOSING_COVERS[kind] ?? []).filter((k) => st.tasks.some((t) => t.kind === k));
  return {
    save: {
      ...save,
      business: {
        ...save.business,
        supplies,
        cleanliness: {
          ...st,
          open,
          tasks: st.tasks.filter((t) => t.kind !== kind && !alsoDone.includes(t.kind)),
          cleaned: st.cleaned + 1 + alsoDone.length,
          byCleaner: st.byCleaner + (by === "cleaner" ? 1 + alsoDone.length : 0),
        },
      },
    },
    ok: true,
    needs: [],
  };
}

/** Cleans every open task it can (optionally only some areas / routine ones); each once. */
export function cleanAll(
  save: SaveData,
  opts: { areas?: readonly CleanArea[]; routineOnly?: boolean; by?: "player" | "cleaner" } = {},
): { save: SaveData; cleaned: TaskKind[] } {
  let s = save;
  const cleaned: TaskKind[] = [];
  for (const t of cleanlinessOf(save).tasks) {
    const rule = TASK_RULES[t.kind];
    if (opts.areas && !opts.areas.includes(rule.area)) continue;
    if (opts.routineOnly && !rule.routine) continue;
    const r = cleanTask(s, t.kind, opts.by);
    if (r.ok) {
      s = r.save;
      cleaned.push(t.kind);
    }
  }
  return { save: s, cleaned };
}

/** Whether the existing Restaurant Team has a Cleaner. */
export const hasCleaner = (save: SaveData) => save.business.staff.hiredRoles.includes("cleaner");

/**
 * A Cleaner for one day (developer 2026-10-17: instead of "Clean everything
 * I can", hire a Cleaner for the day — pay the day's wage, or watch an ad).
 * They work like the hired Cleaner until the restaurant day ends: the
 * routine tasks now and after each service, in the Cleaner's areas. Spills,
 * and anything short of supplies, stay the player's.
 */
export const dayCleanerToday = (save: SaveData) =>
  cleanlinessOf(save).dayCleanerDay === restaurantDayOf(save).day;

/** A Cleaner is working today: hired for good, or for the day. */
export const cleanerOnDuty = (save: SaveData) => hasCleaner(save) || dayCleanerToday(save);

/** A fresh id for one day-Cleaner ad (never sent as a placement — placements are fixed per spot). */
export function newDayCleanerRewardId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `knifecraft-day-cleaner-${uuid}`;
}

/** A day's Cleaner costs the hired Cleaner's day wage (businessStaff.ts), paid at once. */
export const dayCleanerPrice = (): number => BUSINESS_STAFF_CATALOG.cleaner.salary;

/** What App reports back to the screen for a day-Cleaner tap. */
export type DayCleanerOutcome =
  | { ok: true; cleaned: number }
  | {
      ok: false;
      reason:
        | "hired"
        | "alreadyToday"
        | "locked"
        | "insufficientFunds"
        | "notRewarded"
        | "unavailable"
        | "busy";
    };

/** What the Cleanliness screen gets to offer a day's Cleaner (App wires it). */
export type DayCleanerOffer = {
  price: number;
  adAvailable: boolean;
  onPay: () => DayCleanerOutcome;
  onAd: () => Promise<DayCleanerOutcome>;
};

export type DayCleanerResult =
  | { ok: true; save: SaveData; cleaned: TaskKind[] }
  | { ok: false; reason: "hired" | "alreadyToday" | "locked" };

/**
 * Puts a Cleaner on today (the payment, or the ad, is the caller's: App
 * debits the day's wage with one ledger entry, or grants it only on a
 * rewarded ad) and runs their round at once.
 */
export function hireDayCleaner(save: SaveData, levelNumber: number): DayCleanerResult {
  if (!isCleanlinessLive(levelNumber)) return { ok: false, reason: "locked" };
  if (hasCleaner(save)) return { ok: false, reason: "hired" };
  if (dayCleanerToday(save)) return { ok: false, reason: "alreadyToday" };
  const st = cleanlinessOf(save);
  const round = cleanerRound(withState(save, { ...st, dayCleanerDay: restaurantDayOf(save).day }));
  return { ok: true, save: round.save, cleaned: round.cleaned };
}

/** Who does a routine task when hired: its own role (server, prep cook) or the Cleaner. */
const staffFor = (kind: TaskKind): ChoreStaff => TASK_RULES[kind].staff ?? "cleaner";

/**
 * The team's round (after a service, and when a phase's chores arrive): every
 * routine task whose role is hired — the Cleaner in their assigned areas, the
 * Server the dining room's chores, the Prep Cook the line's. Spills, and
 * anything short of supplies, stay the player's. No new wage: these are the
 * existing Restaurant Team roles (businessStaff.ts).
 */
export function cleanerRound(save: SaveData): { save: SaveData; cleaned: TaskKind[] } {
  const hired = save.business.staff.hiredRoles as readonly string[];
  const st = cleanlinessOf(save);
  let s = save;
  const cleaned: TaskKind[] = [];
  const cleanerToday = cleanerOnDuty(save);
  for (const t of st.tasks) {
    const rule = TASK_RULES[t.kind];
    if (!rule.routine) continue;
    const role = staffFor(t.kind);
    if (role === "cleaner" ? !cleanerToday : !hired.includes(role)) continue;
    if (role === "cleaner" && !st.cleanerAreas.includes(rule.area)) continue;
    const r = cleanTask(s, t.kind, "cleaner");
    if (r.ok) {
      s = r.save;
      cleaned.push(t.kind);
    }
  }
  return { save: s, cleaned };
}

/**
 * The restroom job a hired Cleaner can do right now, or null (developer
 * 2026-10-16: the map's Cleaner is in the restroom only when hired AND cleaning
 * is needed, and really cleans). Same rules as `cleanerRound`: a routine task
 * that is the Cleaner's, in an area assigned to them, with its tools and
 * supplies there. The map shows them at it, then `cleanTask(…, "cleaner")`.
 */
export function cleanerRestroomJob(save: SaveData): TaskKind | null {
  if (!cleanerOnDuty(save)) return null;
  const st = cleanlinessOf(save);
  if (!st.cleanerAreas.includes("restroom")) return null;
  for (const t of st.tasks) {
    const rule = TASK_RULES[t.kind];
    if (rule.area !== "restroom" || !rule.routine || staffFor(t.kind) !== "cleaner") continue;
    if (taskNeeds(save, t.kind).length === 0) return t.kind;
  }
  return null;
}

/**
 * The shift chores a phase brings at `levelNumber` (from PHASE_CHORES_FROM);
 * a deep clean only on its designated `day` (never without a day).
 */
export function phaseChores(phase: ShiftPhase, levelNumber: number, day?: number): TaskKind[] {
  if (levelNumber < PHASE_CHORES_FROM) return [];
  return TASK_KINDS.filter((k) => {
    const rule = TASK_RULES[k];
    if (rule.phase !== phase || levelNumber < (rule.fromLevel ?? PHASE_CHORES_FROM)) return false;
    return !rule.deep || (day !== undefined && isDeepCleanDay(rule.deep, day));
  });
}

/**
 * What a night chore also does (developer 2026-10-29: "I cleaned some portions
 * at night and they came back in the morning"): doing the closing pass also
 * cleans the day's leftover tasks of the same kind in the same pass, so nothing
 * is cleaned twice. Nothing is deleted: until the pass is done, every task stays.
 */
export const CLOSING_COVERS: Partial<Record<TaskKind, readonly TaskKind[]>> = {
  "mop-all": ["floor", "restroom-floor", "spill"],
  "restroom-disinfect": ["toilet", "restroom-refresh"],
  "clear-tables": ["tables"],
  degrease: ["grease", "equipment"],
  "wipe-boards": ["sweep-line", "sanitizer-bucket"],
};

/**
 * A phase's chores, added ONCE per restaurant day and phase (the key
 * "day:phase:services" is remembered): a reload, a second tap or a repeated
 * opening never adds them again. `day` / `servicesDone`: the restaurant
 * day's own (restaurantDay.ts).
 */
export function addPhaseChores(
  save: SaveData,
  phase: ShiftPhase,
  levelNumber: number,
  day: number,
  servicesDone: number,
): SaveData {
  const st = cleanlinessOf(save);
  // The morning never repeats the night: the restroom check only comes when the night's
  // restroom pass is still open (it was not done).
  const kinds = phaseChores(phase, levelNumber, day).filter(
    (k) =>
      !(
        phase === "opening" &&
        k === "restroom-check" &&
        !st.tasks.some((t) => t.kind === "restroom-disinfect")
      ),
  );
  if (kinds.length === 0) return save;
  const key = `${day}:${phase}:${servicesDone}`;
  if (st.choreKeys.includes(key)) return save;
  const tasks = st.tasks.map((t) => ({ ...t }));
  for (const kind of kinds) {
    const t = tasks.find((x) => x.kind === kind);
    if (t) t.count = Math.min(CLEANING_RULES.maxCount, t.count + 1);
    else tasks.push({ kind, count: 1, since: levelNumber });
  }
  return withState(save, {
    ...st,
    tasks,
    choreKeys: [...st.choreKeys, key].slice(-CHORE_KEYS_KEPT),
  });
}

/** The open tasks of a phase (its checklist), with what each still needs. */
export function phaseChecklist(save: SaveData, phase: ShiftPhase) {
  return cleanlinessOf(save)
    .tasks.filter((t) => TASK_RULES[t.kind].phase === phase)
    .map((t) => ({ ...t, rule: TASK_RULES[t.kind], needs: taskNeeds(save, t.kind) }));
}

/** Assigns the Cleaner's areas (the screen's chips). */
export function setCleanerAreas(save: SaveData, areas: readonly CleanArea[]): SaveData {
  return withState(save, {
    ...cleanlinessOf(save),
    cleanerAreas: CLEAN_AREAS.filter((a) => areas.includes(a)),
  });
}

export function markCleanlinessIntroSeen(save: SaveData): SaveData {
  const st = cleanlinessOf(save);
  return st.introSeen ? save : withState(save, { ...st, introSeen: true });
}

/** When a service starts (first plays): what's still open — serviceReport's spotless check. */
export function snapshotServiceStart(save: SaveData, levelNumber: number): SaveData {
  if (!isCleanlinessLive(levelNumber)) return save;
  const st = cleanlinessOf(save);
  const areas = CLEAN_AREAS.filter((a) => st.tasks.some((t) => TASK_RULES[t.kind].area === a));
  return withState(save, {
    ...st,
    lastStart: {
      level: levelNumber,
      open: st.tasks.length,
      // Only tasks the player could have done: one short of a supply or a tool is not their fault
      // (and never costs them tips) — the guide tells them what to restock instead.
      cleaning: st.tasks.filter(
        (t) => TASK_RULES[t.kind].phase !== "opening" && taskNeeds(save, t.kind).length === 0,
      ).length,
      areas,
      dirty: sinkPieces(save),
    },
  });
}

/**
 * Hygiene and tips (developer 2026-10-29, 2026-10-30): a restaurant that opened a service with
 * cleaning the player could have done left undone tips half (`DIRTY_TIP_SHARE`); one that opened
 * fully clean (every task done, no dirty dishes) tips a quarter more (`CLEAN_TIP_SHARE`). Tasks
 * short of a supply or a tool never count against the player.
 */
export const DIRTY_TIP_SHARE = 0.5;
export const CLEAN_TIP_SHARE = 1.25;
export function tipHygieneShare(save: SaveData, levelNumber: number): number {
  if (!isCleanlinessLive(levelNumber)) return 1;
  const ls = cleanlinessOf(save).lastStart;
  if (!ls || ls.level !== levelNumber) return 1;
  if (ls.cleaning > 0) return DIRTY_TIP_SHARE;
  return ls.open === 0 && ls.dirty === 0 ? CLEAN_TIP_SHARE : 1;
}

/** Level Complete's cleaning line: what the Cleaner did and what's left (empty before the section). */
export function cleaningLines(save: SaveData, byCleaner: number): string[] {
  const open = cleanlinessOf(save).tasks.length;
  if (byCleaner === 0 && open === 0) return [];
  const parts = [
    ...(byCleaner > 0
      ? [`🧑‍🔧 Your team did ${byCleaner} ${byCleaner === 1 ? "task" : "tasks"}`]
      : []),
    open > 0
      ? `🧹 ${open} cleaning ${open === 1 ? "task" : "tasks"} waiting — Restaurant → Cleanliness`
      : "🧹 All clean for the next service",
  ];
  return [parts.join(" · ")];
}

// ── What the screen shows ───────────────────────────────────────────────

export type SpotStatus = "ok" | "todo" | "blocked";
export type AreaSpot = {
  id: string;
  label: string;
  icon: string;
  status: SpotStatus;
  note?: string;
};
export type AreaView = {
  area: CleanArea;
  /** 0–100; never 100 while a task is open. */
  meter: number;
  status: "clean" | "attention" | "dirty";
  spots: AreaSpot[];
  tasks: (CleaningTask & { rule: TaskRule; needs: SupplyId[] })[];
};

/** One area's card (read-only): its spots, open tasks, meter and status. */
export function areaView(save: SaveData, area: CleanArea, levelNumber: number): AreaView {
  const st = cleanlinessOf(save);
  const tasks = st.tasks
    .filter((t) => TASK_RULES[t.kind].area === area)
    .map((t) => ({ ...t, rule: TASK_RULES[t.kind], needs: taskNeeds(save, t.kind) }));
  const spot = (kind: TaskKind): AreaSpot => {
    const t = tasks.find((x) => x.kind === kind);
    return {
      id: kind,
      label: TASK_RULES[kind].short,
      icon: TASK_RULES[kind].icon,
      status: !t ? "ok" : t.needs.length ? "blocked" : "todo",
    };
  };
  const dineIn = isSystemLive("dine-in", levelNumber);
  const spots: AreaSpot[] = [];
  if (area === "kitchen") {
    // Derived from the existing systems (not tasks): the wash-up and the closing wipe-down.
    const dirty = Object.values(restaurantSuppliesOf(save).dirty).reduce((n, v) => n + (v ?? 0), 0);
    const soap = bottleView(save, "dish-soap");
    const liquid = bottleView(save, "cleaning-liquid");
    spots.push(
      {
        id: "counters",
        label: "Counters",
        icon: "🧽",
        status: dineIn && liquid.status === "empty" ? "blocked" : "ok",
        ...(dineIn && liquid.status === "empty"
          ? { note: "No cleaning liquid for tonight's wipe-down" }
          : {}),
      },
      spot("equipment"),
      {
        id: "dishwashing",
        label: "Dishes",
        icon: "🫧",
        status: dirty > 0 ? (dineIn && soap.status === "empty" ? "blocked" : "todo") : "ok",
        ...(dirty > 0 ? { note: `${dirty} pieces wait for the wash-up` } : {}),
      },
      spot("grease"),
      spot("bins"),
    );
  } else if (area === "dining") {
    spots.push(spot("floor"));
    if (dineIn) {
      spots.push(spot("tables"));
      const napkins = supplyUnits(save.business.supplies, "paper-napkins");
      spots.push({
        id: "table-items",
        label: "Table items",
        icon: "🧂",
        status: napkins > 0 ? "ok" : "blocked",
        ...(napkins > 0 ? {} : { note: "No napkins" }),
      });
    }
    spots.push(spot("spill"));
  } else {
    spots.push(spot("toilet"), spot("sink"), spot("paper"), spot("restroom-floor"));
  }
  const weight = tasks.reduce((n, t) => n + Math.min(3, t.count), 0) * CLEANING_RULES.meterPerTask;
  const derived =
    spots.filter((s) => !TASK_RULES[s.id as TaskKind] && s.status !== "ok").length * 6;
  const meter = Math.max(5, Math.min(tasks.length ? 94 : 100, 100 - weight - derived));
  return {
    area,
    meter,
    status: tasks.length === 0 && derived === 0 ? "clean" : meter >= 60 ? "attention" : "dirty",
    spots,
    tasks,
  };
}

export const AREA_META: Record<CleanArea, { title: string; icon: string }> = {
  kitchen: { title: "Kitchen", icon: "👨‍🍳" },
  dining: { title: "Dining Area", icon: "🍽️" },
  restroom: { title: "Restroom", icon: "🚻" },
};

/** The cleaning supplies the screen's strip shows (the section's consumables first, then the two bottles). */
export const STRIP_SUPPLIES: readonly SupplyId[] = [
  "floor-cleaner",
  "disinfectant",
  "hand-soap",
  "toilet-paper",
  "paper-towels",
  "sponges-cloths",
  "bin-liners",
];

/** A supply's stock as the strip shows it: uses left and a 0–1 fill (against a few services' worth). */
export function supplyGauge(
  save: SaveData,
  id: SupplyId,
): { uses: number; fill: number; low: boolean } {
  const uses = usesAvailable(save, id);
  const perService = TASK_KINDS.reduce(
    (n, k) => n + (TASK_RULES[k].uses.find((u) => u.id === id)?.n ?? 0),
    0,
  );
  const target = Math.max(1, perService * 5);
  return { uses, fill: Math.min(1, uses / target), low: uses < Math.max(1, perService * 2) };
}

// ── The screen's actions (App applies them and saves) ───────────────────

export type CleanlinessAction =
  | { kind: "clean"; task: TaskKind }
  | { kind: "clean-all" }
  | { kind: "phase-all"; phase: ShiftPhase }
  | { kind: "areas"; areas: CleanArea[] }
  | { kind: "intro-seen" }
  /** The sink game (2026-10-23): these lines washed by hand (soap, nothing breaks). */
  | { kind: "wash"; ids: SupplyId[] };

export type CleanlinessActionResult = { save: SaveData; cleaned: TaskKind[]; needs: SupplyId[] };

/** One player action on the Cleanliness screen; `cleaned` = tasks done, `needs` = what's missing. */
export function applyCleanlinessAction(
  save: SaveData,
  action: CleanlinessAction,
): CleanlinessActionResult {
  switch (action.kind) {
    case "clean": {
      const r = cleanTask(save, action.task);
      return { save: r.save, cleaned: r.ok ? [action.task] : [], needs: r.needs };
    }
    case "clean-all": {
      const r = cleanAll(save);
      const needs = [
        ...new Set(cleanlinessOf(r.save).tasks.flatMap((t) => taskNeeds(r.save, t.kind))),
      ];
      return { save: r.save, cleaned: r.cleaned, needs };
    }
    case "phase-all": {
      let x = save;
      const cleaned: TaskKind[] = [];
      for (const t of phaseChecklist(save, action.phase)) {
        const r = cleanTask(x, t.kind);
        if (r.ok) {
          x = r.save;
          cleaned.push(t.kind);
        }
      }
      const needs = [...new Set(phaseChecklist(x, action.phase).flatMap((t) => t.needs))];
      return { save: x, cleaned, needs };
    }
    case "areas":
      return { save: setCleanerAreas(save, action.areas), cleaned: [], needs: [] };
    case "intro-seen":
      return { save: markCleanlinessIntroSeen(save), cleaned: [], needs: [] };
    case "wash": {
      const w = handWash(save, action.ids);
      return { save: w.save, cleaned: [], needs: w.noSoap ? ["dish-soap"] : [] };
    }
  }
}

// ── The day's phases (App / the sim call these) ─────────────────────────

/** After a service: the lull's chores (or, after the day's last service, closing's), then the team's round. */
export function choresAfterService(save: SaveData, levelNumber: number): SaveData {
  const d = restaurantDayOf(save);
  if (!d.opened && !d.closingDue) return save;
  return addPhaseChores(
    save,
    d.closingDue ? "closing" : "lull",
    levelNumber,
    d.day,
    d.servicesDone,
  );
}

/** After closing for the night: the next morning's opening chores (`nextLevel` opens the day), then the team's round. */
export function choresAfterClose(
  save: SaveData,
  nextLevel: number,
): { save: SaveData; cleaned: TaskKind[] } {
  const d = restaurantDayOf(save);
  if (d.closingDue) return { save, cleaned: [] };
  return cleanerRound(addPhaseChores(save, "opening", nextLevel, d.day, 0));
}
