/**
 * CLEANLINESS & MAINTENANCE (restaurant build, developer 2026-10-10). The
 * whole section — Kitchen, Dining Area, Restroom, their supplies and the
 * Cleaner's rounds — opens together at CLEANING_FROM_LEVEL (21, with the
 * fridge and closing time).
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
import { isSystemLive, restaurantSystem } from "./restaurantProgression";
import { bottleView, restaurantSuppliesOf, tablesFor } from "./serviceSupplies";

/** The whole Cleanliness section opens here (with the fridge and closing time). */
export const CLEANING_FROM_LEVEL = restaurantSystem("fridge-freshness").firstLevel;

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
  | "restroom-floor";

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
};

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
};

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
  /** What was open when the last service started (the spotless check). */
  lastStart: { level: number; open: number; areas: CleanArea[] } | null;
  cleaned: number;
  byCleaner: number;
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
            areas: Array.isArray(ls.areas) ? ls.areas.filter(isArea) : [],
          }
        : null,
    cleaned: whole(raw.cleaned),
    byCleaner: whole(raw.byCleaner),
  };
}

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
  return {
    save: {
      ...save,
      business: {
        ...save.business,
        supplies,
        cleanliness: {
          ...st,
          open,
          tasks: st.tasks.filter((t) => t.kind !== kind),
          cleaned: st.cleaned + 1,
          byCleaner: st.byCleaner + (by === "cleaner" ? 1 : 0),
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

/** The Cleaner's round after a service: the routine tasks of their areas (spills stay the player's). */
export function cleanerRound(save: SaveData): { save: SaveData; cleaned: TaskKind[] } {
  if (!hasCleaner(save)) return { save, cleaned: [] };
  return cleanAll(save, {
    areas: cleanlinessOf(save).cleanerAreas,
    routineOnly: true,
    by: "cleaner",
  });
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
    lastStart: { level: levelNumber, open: st.tasks.length, areas },
  });
}

/** Level Complete's cleaning line: what the Cleaner did and what's left (empty before the section). */
export function cleaningLines(save: SaveData, byCleaner: number): string[] {
  const open = cleanlinessOf(save).tasks.length;
  if (byCleaner === 0 && open === 0) return [];
  const parts = [
    ...(byCleaner > 0
      ? [`🧑‍🔧 Your Cleaner did ${byCleaner} ${byCleaner === 1 ? "task" : "tasks"}`]
      : []),
    open > 0
      ? `🧹 ${open} cleaning ${open === 1 ? "task" : "tasks"} waiting — Restaurant → Cleanliness`
      : "🧹 All clean for the next service",
  ];
  return [parts.join(" · ")];
}

// ── Grandma's cleaning cupboard ─────────────────────────────────────────

/** What Grandma's cupboard holds (once, at CLEANING_FROM_LEVEL; cost 0, no ledger). */
export const GRANDMAS_CUPBOARD: readonly { id: SupplyId; units: number }[] = [
  { id: "mop-bucket", units: 1 },
  { id: "brooms", units: 1 },
  { id: "toilet-brushes", units: 1 },
  { id: "floor-cleaner", units: 1 },
  { id: "disinfectant", units: 2 },
  { id: "hand-soap", units: 1 },
  { id: "toilet-paper", units: 4 },
  { id: "paper-towels", units: 500 },
  { id: "sponges-cloths", units: 3 },
  { id: "bin-liners", units: 30 },
];

/** Gives Grandma's cleaning cupboard once the section opens (an older save gets it on its next level). */
export function giveGrandmasCupboard(save: SaveData, reachedLevel: number): SaveData {
  const st = cleanlinessOf(save);
  if (st.cupboardAt !== null || !isCleanlinessLive(reachedLevel)) return save;
  const stock = { ...save.business.supplies.stock };
  for (const { id, units } of GRANDMAS_CUPBOARD) {
    const e = stock[id];
    stock[id] = { units: (e?.units ?? 0) + units, costBasis: e?.costBasis ?? 0 };
  }
  return {
    ...save,
    business: {
      ...save.business,
      supplies: { ...save.business.supplies, stock },
      cleanliness: { ...st, cupboardAt: reachedLevel },
    },
  };
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
  | { kind: "areas"; areas: CleanArea[] }
  | { kind: "intro-seen" };

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
    case "areas":
      return { save: setCleanerAreas(save, action.areas), cleaned: [], needs: [] };
    case "intro-seen":
      return { save: markCleanlinessIntroSeen(save), cleaned: [], needs: [] };
  }
}
