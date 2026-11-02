/**
 * PLANNING CALCULATOR for docs/planning/PHASE12-SECOND-FLOOR-CUSTOMER-CYCLES-PLAN-2026-11-02.md (revision 3, developer 2026-11-02).
 * NOT game code and NOT a QA suite: it prints the proposed Second Floor economy so the plan's tables are computed, not guessed.
 * It imports nothing from src/ (the proposal is not built). Every figure is an ESTIMATE of a proposal; the assumptions are the
 * constants below and the player patterns, all labelled. In particular LEVEL_MIN (minutes a level takes) is an ASSUMPTION, not data.
 *
 * Money model (the shape the game would use): a station makes `millsPerCycle` (an INTEGER, computed once from the guest price, the
 * guests-per-cycle permille table, the milestone permille and the cleaner permille) every `cycleMs`. Pending money while the player
 * is away is modelled as a continuous rate capped at the counter hours (the real game would be an exact whole-cycle count; the
 * difference is under one cycle's cents).
 *
 * Run:  npx tsx scripts/second-floor-cycles-plan-sim.mts <mode>
 *   modes: validate | stations | tables | guided | patterns | compare | sensitivity | buys | all
 *   env:   CAPS=new|old (default new = 4/5/6 h)  LEVEL_MIN=2.5  ASSIST=0.05  GATES=A|B|C  DAYS=90
 */
// ---------------------------------------------------------------- the proposal
export type St = {
  id: string;
  name: string;
  /** Tier 1 cycle seconds and guest price (cents per guest per table). */
  cycle: number;
  payout: number;
  /** Machine price, Tier 2 and Tier 3 upgrade prices, and the price of table #2 (cents). */
  price: number;
  up: [number, number];
  table: number;
};
const D = (d: number) => Math.round(d * 100);
/**
 * The tuning levers (guest prices and the cycle length of Tier 1 stay fixed: the developer's approved decisions). `applyTune` swaps them
 * so one process can compare several tunings.
 */
export type Tune = {
  /** Optional staff prices in dollars: Server 1-3 and Cleaner 1-2. */
  staff?: { server: number[]; cleaner: number[] };
  /** Optional multipliers on each station's guest price (LAST RESORT lever; the proposal leaves them at 1). */
  payoutScale?: number[];
  /** Optional Tier 1 cycle seconds per station (Coffee stays 12 s, the developer's decision). */
  cycles?: number[];
  /** Optional price overrides per station (dollars): machine, Tier 2, Tier 3, table #2. */
  prices?: { price: number; t2: number; t3: number; table: number }[];
  tierPay: readonly number[];
  tierCycle: readonly number[];
  growth: number;
  milestones: [number, number][];
};
export const BASE_TUNE: Tune = {
  tierPay: [1, 1.4, 1.9],
  tierCycle: [1, 0.9, 0.8],
  growth: 1.15,
  milestones: [
    [3, 1050],
    [5, 1100],
    [10, 1200],
    [25, 1350],
    [50, 1500],
  ],
};
let TIER_PAY: readonly number[] = BASE_TUNE.tierPay;
let TIER_CYCLE: readonly number[] = BASE_TUNE.tierCycle;
let TABLE_GROWTH = BASE_TUNE.growth;
export function applyTune(t: Tune) {
  SERVER.prices = (t.staff?.server ?? [30, 250, 1600]).map(D);
  CLEANER.prices = (t.staff?.cleaner ?? [100, 900]).map(D);
  STATIONS.forEach((s, i) => {
    const o = t.prices?.[i];
    const b = BASE_STATIONS[i]!;
    s.price = o ? D(o.price) : b.price;
    s.up = o ? [D(o.t2), D(o.t3)] : [...b.up];
    s.table = o ? D(o.table) : b.table;
    s.cycle = t.cycles?.[i] ?? b.cycle;
    s.payout = Math.round(b.payout * (t.payoutScale?.[i] ?? 1));
  });
  TIER_PAY = t.tierPay;
  TIER_CYCLE = t.tierCycle;
  TABLE_GROWTH = t.growth;
  MILESTONES = t.milestones;
}
export const MAX_TABLES = 50;
/** Guests per cycle with n tables, as INTEGER PERMILLE (a fixed lookup table in the game, never Math.log at run time). */
export const guestsPermille = (n: number) =>
  Math.round(1000 * (1 + 0.55 * Math.log(Math.max(1, n))));
/** Milestones: tables -> that station's income multiplier in permille (absolute, not stacked). */
export let MILESTONES: [number, number][] = BASE_TUNE.milestones;
export const milestonePermille = (n: number) =>
  MILESTONES.filter(([t]) => n >= t).pop()?.[1] ?? 1000;
export const FLOOR_OPENS_AT = 5;
export const LAST_LEVEL = 148;
export const UNSTAFFED_SPEED = 0.5;
export const UNSTAFFED_TRAY_MIN = 10;
export const CAP_SETS = { old: [8, 9, 10], new: [4, 5, 6] } as const;
export const SERVER = { prices: [D(30), D(250), D(1600)], covers: 2 };
export const CLEANER = { prices: [D(100), D(900)], covers: 3, permille: 1100 };

export const STATIONS: St[] = [
  {
    id: "coffee",
    name: "Coffee",
    cycle: 12,
    payout: D(0.2),
    price: D(25),
    up: [D(90), D(320)],
    table: D(30),
  },
  {
    id: "drinks",
    name: "Drinks",
    cycle: 18,
    payout: D(0.4),
    price: D(75),
    up: [D(250), D(850)],
    table: D(80),
  },
  {
    id: "pizza",
    name: "Pizza",
    cycle: 28,
    payout: D(0.8),
    price: D(220),
    up: [D(700), D(2300)],
    table: D(210),
  },
  {
    id: "burger",
    name: "Burger",
    cycle: 40,
    payout: D(1.3),
    price: D(520),
    up: [D(1600), D(5200)],
    table: D(480),
  },
  {
    id: "iceCream",
    name: "Ice Cream",
    cycle: 55,
    payout: D(2.0),
    price: D(1100),
    up: [D(3400), D(11000)],
    table: D(1000),
  },
  {
    id: "hotFood",
    name: "Hot Food",
    cycle: 80,
    payout: D(3.2),
    price: D(2300),
    up: [D(7000), D(23000)],
    table: D(2000),
  },
];

const BASE_STATIONS = STATIONS.map((s) => ({
  payout: s.payout,
  cycle: s.cycle,
  price: s.price,
  up: [...s.up] as [number, number],
  table: s.table,
}));

/** LEVEL GATES: how many tables a station may have, and the highest tier, at campaign level L. */
export type Gates = {
  name: string;
  tablesBase: number;
  perLevels: number;
  tier2: number;
  tier3: number;
};
export const GATE_SETS: Record<string, Gates> = {
  A: { name: "A (round-2 gates)", tablesBase: 3, perLevels: 7, tier2: 12, tier3: 40 },
  B: { name: "B (looser)", tablesBase: 4, perLevels: 5, tier2: 8, tier3: 25 },
  C: { name: "C (no gates at all)", tablesBase: 50, perLevels: 1, tier2: 1, tier3: 1 },
  M: {
    name: "M (tier 3 from Level 30, nothing else gated)",
    tablesBase: 50,
    perLevels: 1,
    tier2: 1,
    tier3: 30,
  },
};
const tablesMaxAt = (g: Gates, level: number) =>
  Math.min(MAX_TABLES, g.tablesBase + Math.floor((level - FLOOR_OPENS_AT) / g.perLevels));
const tierMaxAt = (g: Gates, level: number) => (level >= g.tier3 ? 3 : level >= g.tier2 ? 2 : 1);

// ---------------------------------------------------------------- integer money
export const cycleMs = (s: St, tier: number, staffed = true) =>
  Math.round((s.cycle * TIER_CYCLE[tier - 1]! * 1000) / (staffed ? 1 : UNSTAFFED_SPEED));
export const guestPay = (s: St, tier: number) => Math.round(s.payout * TIER_PAY[tier - 1]!);
/**
 * What one cycle pays, in MILLS (1/1000 of a cent) as an INTEGER: guest price x guests x milestone x cleaner. Whole cents were tried
 * first and failed the validator: at 20 cents a guest, table 19 and later add less than a cent per cycle and rounded to nothing.
 * Pending money = floor(cycles x mills / 1000) cents, so every collection is whole cents and online equals offline.
 */
export const millsPerCycle = (s: St, tier: number, tables: number, cleaner = false) =>
  Math.floor(
    (guestPay(s, tier) *
      guestsPermille(tables) *
      milestonePermille(tables) *
      (cleaner ? CLEANER.permille : 1000)) /
      1e6,
  );
export const hourlyOf = (s: St, tier: number, tables: number, staffed = true, cleaner = false) =>
  (millsPerCycle(s, tier, tables, cleaner) * 3_600_000) / 1000 / cycleMs(s, tier, staffed);
export const tableCost = (s: St, owned: number) =>
  Math.round(s.table * Math.pow(TABLE_GROWTH, owned - 1)); // table #owned+1

// ---------------------------------------------------------------- the campaign (ESTIMATED from economy-final-sim scenario A, the Saver)
/** Cumulative campaign income in cents at level L: linear between $256 / $5,269 / $15,438 / $32,422 / $51,832 / $80,021 at L1/10/20/30/40/50. */
export const campaignCum = (level: number) => {
  const L = Math.min(level, LAST_LEVEL);
  const pts: [number, number][] = [
    [0, 0],
    [1, 256],
    [10, 5269],
    [20, 15438],
    [30, 32422],
    [40, 51832],
    [50, 80021],
  ];
  for (let i = 1; i < pts.length; i++)
    if (L <= pts[i]![0])
      return (
        (pts[i - 1]![1] +
          ((L - pts[i - 1]![0]) / (pts[i]![0] - pts[i - 1]![0])) * (pts[i]![1] - pts[i - 1]![1])) *
        100
      );
  return (80021 + ((L - 50) * (80021 - 51832)) / 10) * 100;
};

// ---------------------------------------------------------------- the floor
type Own = { tier: number; tables: number };
export type Floor = { own: Record<string, Own>; servers: number; cleaners: number };
export const order = (f: Floor) => STATIONS.filter((s) => f.own[s.id]);
export const staffedSet = (f: Floor) =>
  new Set(
    order(f)
      .slice(0, f.servers * SERVER.covers)
      .map((s) => s.id),
  );
export const cleanSet = (f: Floor) =>
  new Set(
    order(f)
      .slice(0, f.cleaners * CLEANER.covers)
      .map((s) => s.id),
  );
export function floorHourly(f: Floor): number {
  const st = staffedSet(f);
  const cl = cleanSet(f);
  return order(f).reduce(
    (t, s) => t + hourlyOf(s, f.own[s.id]!.tier, f.own[s.id]!.tables, st.has(s.id), cl.has(s.id)),
    0,
  );
}
export type Opt = { label: string; price: number; gate: number; apply: (f: Floor) => Floor };
/** Every purchase the floor offers now, with the level that opens it (`gate`). */
export function allOptions(f: Floor, g: Gates): Opt[] {
  const out: Opt[] = [];
  const lvlForTables = (k: number) => {
    for (let l = FLOOR_OPENS_AT; l < 400; l++) if (tablesMaxAt(g, l) >= k) return l;
    return 400;
  };
  for (const s of STATIONS) {
    const o = f.own[s.id];
    if (!o) {
      out.push({
        label: `buy ${s.id}`,
        price: s.price,
        gate: FLOOR_OPENS_AT,
        apply: (x) => ({ ...x, own: { ...x.own, [s.id]: { tier: 1, tables: 1 } } }),
      });
      continue;
    }
    if (o.tier < 3)
      out.push({
        label: `${s.id} Lv${o.tier + 1}`,
        price: s.up[o.tier - 1]!,
        gate: o.tier === 1 ? g.tier2 : g.tier3,
        apply: (x) => ({ ...x, own: { ...x.own, [s.id]: { ...o, tier: o.tier + 1 } } }),
      });
    if (o.tables < MAX_TABLES)
      out.push({
        label: `${s.id} table ${o.tables + 1}`,
        price: tableCost(s, o.tables),
        gate: lvlForTables(o.tables + 1),
        apply: (x) => ({ ...x, own: { ...x.own, [s.id]: { ...o, tables: o.tables + 1 } } }),
      });
  }
  if (f.servers < 3 && order(f).length > 0)
    out.push({
      label: `server ${f.servers + 1}`,
      price: SERVER.prices[f.servers]!,
      gate: FLOOR_OPENS_AT,
      apply: (x) => ({ ...x, servers: x.servers + 1 }),
    });
  if (f.cleaners < 2 && order(f).length > 0)
    out.push({
      label: `cleaner ${f.cleaners + 1}`,
      price: CLEANER.prices[f.cleaners]!,
      gate: FLOOR_OPENS_AT,
      apply: (x) => ({ ...x, cleaners: x.cleaners + 1 }),
    });
  return out;
}

// ---------------------------------------------------------------- player patterns (ALL ASSUMPTIONS)
export type Session = { s: number; len: number; levels?: number };
export type Pattern = {
  id: string;
  name: string;
  sessions: (day: number) => Session[];
  every: number;
};
export const PATTERNS: Pattern[] = [
  {
    id: "short",
    name: "Short session, once daily (10 min at 20:00)",
    every: 5,
    sessions: () => [{ s: 20 * 60, len: 10 }],
  },
  {
    id: "regular",
    name: "Regular, twice daily (2 x 20 min: 8:00, 20:00)",
    every: 5,
    sessions: () => [
      { s: 8 * 60, len: 20 },
      { s: 20 * 60, len: 20 },
    ],
  },
  {
    id: "frequent",
    name: "Frequent check-ins (6 x 5 min, every 3 h)",
    every: 5,
    sessions: () => [8, 11, 14, 17, 20, 23].map((h) => ({ s: h * 60, len: 5 })),
  },
  {
    id: "long",
    name: "Long-session player (1 x 90 min at 19:00)",
    every: 5,
    sessions: () => [{ s: 19 * 60, len: 90 }],
  },
  {
    id: "slowfloor",
    name: "Slow campaign, regular floor (4 visits a day, 1 level each)",
    every: 3,
    sessions: () => [8, 12, 16, 20].map((h) => ({ s: h * 60, len: 3, levels: 1 })),
  },
  {
    id: "fastrare",
    name: "Fast campaign, rare floor (60 min every 3rd day, floor at start and end)",
    every: 60,
    sessions: (d) => (d % 3 === 0 ? [{ s: 19 * 60, len: 60 }] : []),
  },
];

export type Cfg = {
  caps: readonly number[];
  levelMin: number;
  assist: number;
  gates: Gates;
  days: number;
  /** First Floor money the player puts into the floor: cumulative income by level (default: the Saver's campaign pay). */
  incomeCum?: (level: number) => number;
  /** First Floor money available when the floor opens (cents). Default: exactly the first Coffee machine. */
  startCents?: number;
  /** Buy strictly in this order of purchase labels ("buy coffee", "server 1", "coffee table 2"...) instead of by best payback. */
  goals?: string[];
};
export type Row = {
  day: number;
  level: number;
  floorDay: number;
  campaignDay: number;
  floorCum: number;
  campaignCum: number;
  hourly: number;
  tables: number;
  spent: number;
};
export type Run = {
  rows: Row[];
  buys: {
    tMin: number;
    day: number;
    level: number;
    what: string;
    price: number;
    /** How much of the price came from First Floor money and how much from Second Floor collections. */
    first: number;
    second: number;
  }[];
  checkIns: number;
  gateBlocked: number;
  lostToCap: number; // share of potential floor income lost because the counter was full
};
export function simulate(p: Pattern, cfg: Cfg): Run {
  let f: Floor = { own: {}, servers: 0, cleaners: 0 };
  // Two purses: First Floor money (the start wallet and the share of level pay put into the floor) and Second Floor collections.
  let cashA = cfg.startCents ?? STATIONS[0]!.price;
  let cashB = 0;
  const income = cfg.incomeCum ?? campaignCum;
  const bought = new Set<string>();
  let floorCum = 0;
  let spent = 0;
  let potential = 0;
  let actual = 0;
  let checkIns = 0;
  let gateBlocked = 0;
  const buys: Run["buys"] = [];
  const rows: Row[] = [];
  const pile = new Map<string, number>();
  let lastMin = 0;
  let levelBase = FLOOR_OPENS_AT; // level at the start of the current session
  let lastLevel = FLOOR_OPENS_AT;
  let t0 = -1;
  let floorYesterday = 0;
  let campaignYesterday = 0;
  const advance = (toMin: number) => {
    const dtH = Math.max(0, toMin - lastMin) / 60;
    const st = staffedSet(f);
    const cl = cleanSet(f);
    for (const s of order(f)) {
      const o = f.own[s.id]!;
      const staffed = st.has(s.id);
      const h = hourlyOf(s, o.tier, o.tables, staffed, cl.has(s.id));
      const capH = staffed ? cfg.caps[o.tier - 1]! : UNSTAFFED_TRAY_MIN / 60;
      const before = pile.get(s.id) ?? 0;
      const after = Math.min(h * capH, before + h * dtH);
      potential += h * dtH;
      actual += after - before;
      pile.set(s.id, after);
    }
    lastMin = toMin;
  };
  const visit = (tMin: number, level: number, day: number) => {
    advance(tMin);
    checkIns++;
    cashA += cfg.assist * (income(level) - income(lastLevel));
    lastLevel = level;
    for (const [id, c] of pile) {
      const whole = Math.floor(c);
      cashB += whole;
      floorCum += whole;
      pile.set(id, 0);
    }
    const L = Math.floor(level);
    for (let guard = 0; guard < 500; guard++) {
      const goalLabel = cfg.goals?.find((g) => !bought.has(g));
      if (goalLabel) {
        const o = allOptions(f, cfg.gates).find((x) => x.label === goalLabel);
        const cashNow = cashA + cashB;
        if (!o || o.gate > L || o.price > cashNow) break;
        const fromA = cashNow > 0 ? o.price * (cashA / cashNow) : 0;
        cashA -= fromA;
        cashB -= o.price - fromA;
        spent += o.price;
        f = o.apply(f);
        bought.add(goalLabel);
        buys.push({
          tMin,
          day,
          level: L,
          what: goalLabel,
          price: o.price,
          first: fromA,
          second: o.price - fromA,
        });
        continue;
      }
      const opts = allOptions(f, cfg.gates).filter((o) => o.gate <= L);
      const base = floorHourly(f);
      const scored = opts
        .map((o) => ({ o, gain: Math.max(0.0001, floorHourly(o.apply(f)) - base) }))
        .map((x) => ({ ...x, payback: x.o.price / x.gain }))
        .sort((a, b) => a.payback - b.payback);
      const cash = cashA + cashB;
      const best =
        order(f).length === 0 ? scored.find((x) => x.o.label === "buy coffee") : scored[0];
      if (!best) break;
      const pick =
        best.o.price <= cash
          ? best
          : order(f).length === 0
            ? undefined
            : scored.find((x) => x.o.price <= cash && x.payback <= best.payback * 1.5);
      if (!pick) break;
      // Pay proportionally from the two purses so the report can say which floor funded which machine.
      const fromA = cash > 0 ? pick.o.price * (cashA / cash) : 0;
      const fromB = pick.o.price - fromA;
      cashA -= fromA;
      cashB -= fromB;
      spent += pick.o.price;
      f = pick.o.apply(f);
      buys.push({
        tMin,
        day,
        level: L,
        what: pick.o.label,
        price: pick.o.price,
        first: fromA,
        second: fromB,
      });
    }
    // Did a level gate leave money idle? (an affordable purchase that exists, but only at a higher level)
    const gated = allOptions(f, cfg.gates).filter((o) => o.gate > L && o.price <= cashA + cashB);
    if (gated.length) gateBlocked++;
  };
  for (let day = 0; day < cfg.days; day++) {
    for (const ses of p.sessions(day)) {
      const levelsInSession = ses.levels ?? ses.len / cfg.levelMin;
      const n = Math.max(1, Math.round(ses.len / p.every));
      for (let i = 0; i <= n; i++) {
        const dt = i === n ? ses.len : i * p.every;
        const tAbs = day * 1440 + ses.s + dt;
        if (t0 < 0) t0 = tAbs;
        const level = Math.min(LAST_LEVEL, levelBase + (levelsInSession * dt) / ses.len);
        visit(tAbs - t0, level, day + 1);
      }
      levelBase = Math.min(LAST_LEVEL, levelBase + levelsInSession);
    }
    const campaignNow = income(levelBase) - income(FLOOR_OPENS_AT);
    rows.push({
      day: day + 1,
      level: Math.floor(levelBase),
      floorDay: floorCum - floorYesterday,
      campaignDay: campaignNow - campaignYesterday,
      floorCum,
      campaignCum: campaignNow,
      hourly: floorHourly(f),
      tables: Object.values(f.own).reduce((t, o) => t + o.tables, 0),
      spent,
    });
    floorYesterday = floorCum;
    campaignYesterday = campaignNow;
  }
  return {
    rows,
    buys,
    checkIns,
    gateBlocked,
    lostToCap: potential > 0 ? 1 - actual / potential : 0,
  };
}

/** The first day the campaign is finished (Level 148 reached), or null within the run. */
export const campaignEndDay = (rows: Row[]) => rows.find((r) => r.level >= LAST_LEVEL)?.day ?? null;
/**
 * Floor "dominance" is judged WHILE THE CAMPAIGN RUNS (after Level 148 the campaign pays nothing, so any floor is "dominant"):
 * the first day from which the floor out-earns the campaign over every 7-day window up to the day the campaign ends (or the run ends).
 */
export function dominantFrom(rows: Row[]): { day: number; level: number } | null {
  const end = campaignEndDay(rows) ?? rows.length;
  const win = (i: number) => {
    let fl = 0;
    let ca = 0;
    for (let k = Math.max(0, i - 6); k <= i; k++) {
      fl += rows[k]!.floorDay;
      ca += rows[k]!.campaignDay;
    }
    return { fl, ca };
  };
  let from = -1;
  for (let i = end - 1; i >= 6; i--) {
    const w = win(i);
    if (w.fl > w.ca) from = i;
    else break;
  }
  return from < 0 ? null : { day: rows[from]!.day, level: rows[from]!.level };
}
/** Floor share of the cumulative combined income on the day the campaign ends (or the last day). */
export function shareAtEnd(rows: Row[]) {
  const end = campaignEndDay(rows) ?? rows.length;
  const r = rows[end - 1]!;
  return {
    day: end,
    finished: campaignEndDay(rows) !== null,
    share: r.floorCum / (r.floorCum + r.campaignCum),
    floor: r.floorCum,
    campaign: r.campaignCum,
  };
}

// ---------------------------------------------------------------- formatting
const $ = (c: number) =>
  c >= 1e8
    ? `$${(c / 1e8).toFixed(2)}M`
    : c >= 1e7
      ? `$${Math.round(c / 1e5)}k`
      : `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: c < 10000 ? 2 : 0 })}`;
const fmtT = (min: number) =>
  min < 60
    ? `${min.toFixed(0)} min`
    : min < 2880
      ? `${(min / 60).toFixed(1)} h`
      : `${(min / 1440).toFixed(1)} d`;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const cfgFromEnv = (): Cfg => ({
  caps: process.env.CAPS === "old" ? CAP_SETS.old : CAP_SETS.new,
  levelMin: Number(process.env.LEVEL_MIN ?? 2.5),
  assist: Number(process.env.ASSIST ?? 0.05),
  gates: GATE_SETS[process.env.GATES ?? "M"]!,
  days: Number(process.env.DAYS ?? 90),
});

// ---------------------------------------------------------------- consistency checks
export function validate(): { checks: number; failures: string[]; notes: string[] } {
  const failures: string[] = [];
  const notes: string[] = [];
  let checks = 0;
  const ok = (c: boolean, msg: string) => {
    checks++;
    if (!c) failures.push(msg);
  };
  let prevBuyPayback = 0;
  let prevHourly = 0;
  STATIONS.forEach((s, i) => {
    ok(
      i === 0 || s.price > STATIONS[i - 1]!.price,
      `${s.id}: machine price rises with the station`,
    );
    // Relaxed on 2026-11-02 (price rebalance): tables and tiers follow the machine price at half the exponent, so Tier 2 may cost less than the machine; Tier 3 still costs more than both.
    ok(s.price < s.up[1] && s.up[0] < s.up[1], `${s.id}: machine and Tier 2 cost less than Tier 3`);
    ok(
      cycleMs(s, 1) > cycleMs(s, 2) && cycleMs(s, 2) > cycleMs(s, 3),
      `${s.id}: cycle shortens with each tier`,
    );
    ok(
      guestPay(s, 1) < guestPay(s, 2) && guestPay(s, 2) < guestPay(s, 3),
      `${s.id}: guest price rises with each tier`,
    );
    const h = [1, 2, 3].map((t) => hourlyOf(s, t, 1));
    ok(h[0]! < h[1]! && h[1]! < h[2]!, `${s.id}: hourly rises with each tier`);
    ok(h[0]! > prevHourly, `${s.id}: Tier 1 hourly is above the previous station's`);
    prevHourly = h[0]!;
    const pb = [s.price / h[0]!, s.up[0] / (h[1]! - h[0]!), s.up[1] / (h[2]! - h[1]!)];
    ok(
      pb[0]! >= prevBuyPayback,
      `${s.id}: machine payback does not fall below the previous station's`,
    );
    prevBuyPayback = pb[0]!;
    ok(
      pb[1]! > pb[0]! && pb[2]! > pb[1]!,
      `${s.id}: each upgrade pays back slower than the one before`,
    );
    // table prices and diminishing capacity
    let prevCost = 0;
    let prevGain = Infinity;
    let prevPay = 0;
    let dips = 0;
    for (let k = 2; k <= MAX_TABLES; k++) {
      const cost = tableCost(s, k - 1);
      ok(
        Number.isInteger(cost) && cost > prevCost,
        `${s.id}: table ${k} price is an integer and rises`,
      );
      prevCost = cost;
      const gain = hourlyOf(s, 1, k) - hourlyOf(s, 1, k - 1);
      ok(gain > 0, `${s.id}: table ${k} adds income (also across a milestone)`);
      const pay = cost / gain;
      if (pay < prevPay) dips++;
      prevPay = pay;
      const base = 0.55 * Math.log(k / (k - 1)); // exact marginal guests of table k (the permille table is within 0.5 permille of it)
      ok(base < prevGain, `${s.id}: table ${k} adds fewer guests than the one before`);
      ok(
        Math.abs(guestsPermille(k) - 1000 * (1 + 0.55 * Math.log(k))) <= 0.5 + 1e-9,
        `${s.id}: permille table ${k} is the rounded exact value`,
      );
      prevGain = base;
    }
    if (dips)
      notes.push(
        `${s.id}: table payback dips ${dips} time(s), at milestone steps (expected: a milestone is a bonus)`,
      );
    // integer rounding loss
    let worst = 0;
    for (const t of [1, 2, 3])
      for (let n = 1; n <= MAX_TABLES; n++) {
        const exact = guestPay(s, t) * (guestsPermille(n) / 1000) * (milestonePermille(n) / 1000);
        worst = Math.max(worst, 1 - millsPerCycle(s, t, n) / 1000 / exact);
      }
    ok(
      worst <= 0.005,
      `${s.id}: mill-precision payouts lose at most 0.5% (worst ${(worst * 100).toFixed(2)}%)`,
    );
    notes.push(`${s.id}: worst mill rounding loss ${(worst * 100).toFixed(3)}%`);
  });
  ok(
    MILESTONES.every(([, m], i) => i === 0 || m > MILESTONES[i - 1]![1]),
    "milestone multipliers rise",
  );
  ok(
    CAP_SETS.new.every((h, i) => h < CAP_SETS.old[i]!),
    "the new caps are shorter than the old ones",
  );
  ok(
    SERVER.prices[0]! <= tableCost(STATIONS[0]!, 1),
    "the first Server costs no more than the first extra table",
  );
  for (const s of STATIONS)
    ok(
      s.cycle * TIER_CYCLE[2]! * 1000 * 1 >= 8000,
      `${s.id}: even Tier 3 cycles stay at least 8 s (so the animation can show each guest)`,
    );
  return { checks, failures, notes };
}

// ---------------------------------------------------------------- reports
function printValidate() {
  const v = validate();
  console.log(`\nVALIDATION: ${v.checks} checks, ${v.failures.length} failure(s)`);
  v.failures.forEach((m) => console.log("  FAIL " + m));
  v.notes.forEach((m) => console.log("  note " + m));
}
function printStations() {
  console.log("\nSTATIONS (Tier 1 / 2 / 3), ONE table, with a Server");
  for (const s of STATIONS) {
    const row = [1, 2, 3].map(
      (t) =>
        `${(cycleMs(s, t) / 1000).toFixed(1)}s x ${$(guestPay(s, t))} = ${$(hourlyOf(s, t, 1))}/h`,
    );
    const h = [1, 2, 3].map((t) => hourlyOf(s, t, 1));
    const pb = [s.price / h[0]!, s.up[0] / (h[1]! - h[0]!), s.up[1] / (h[2]! - h[1]!)];
    console.log(
      `${s.name.padEnd(10)} buy ${$(s.price).padEnd(7)} T2 ${$(s.up[0]).padEnd(7)} T3 ${$(s.up[1]).padEnd(8)}| ${row.join(" | ")} | payback ${pb.map((x) => fmtT(x * 60)).join(" / ")} | table #2 ${$(s.table)}`,
    );
  }
  const sum1 = STATIONS.reduce((t, s) => t + s.price, 0);
  const sum2 = STATIONS.reduce((t, s) => t + s.up[0], 0);
  const sum3 = STATIONS.reduce((t, s) => t + s.up[1], 0);
  console.log(
    `Totals: machines ${$(sum1)} + Tier 2 ${$(sum2)} + Tier 3 ${$(sum3)} = ${$(sum1 + sum2 + sum3)}; staff ${$(SERVER.prices.reduce((a, b) => a + b, 0) + CLEANER.prices.reduce((a, b) => a + b, 0))}`,
  );
  console.log(
    `Server ${SERVER.prices.map($).join(" / ")} (covers ${SERVER.covers}), Cleaner ${CLEANER.prices.map($).join(" / ")} (covers ${CLEANER.covers}, +${(CLEANER.permille - 1000) / 10}% tips)`,
  );
  console.log(
    `Counter caps new ${CAP_SETS.new.join("/")} h, old ${CAP_SETS.old.join("/")} h; unstaffed: ${UNSTAFFED_SPEED}x speed, ${UNSTAFFED_TRAY_MIN} min tray`,
  );
}
function printTables() {
  console.log("\nGUESTS PER CYCLE / MILESTONE (permille) and TABLE PRICES");
  console.log(
    "tables:  " +
      [1, 2, 3, 4, 5, 8, 10, 15, 25, 50]
        .map(
          (n) => `${n}: x${(guestsPermille(n) / 1000).toFixed(2)} m${milestonePermille(n) / 1000}`,
        )
        .join(" | "),
  );
  for (const s of STATIONS) {
    const ks = [2, 3, 5, 10, 25, 50];
    const total = Array.from({ length: MAX_TABLES - 1 }, (_, i) => tableCost(s, i + 1)).reduce(
      (a, b) => a + b,
      0,
    );
    console.log(
      `${s.name.padEnd(10)} ` +
        ks
          .map(
            (k) =>
              `#${k} ${$(tableCost(s, k - 1))} (+${$(hourlyOf(s, 1, k) - hourlyOf(s, 1, k - 1))}/h, ${fmtT((tableCost(s, k - 1) / (hourlyOf(s, 1, k) - hourlyOf(s, 1, k - 1))) * 60)})`,
          )
          .join(" | ") +
        ` | all 50: ${$(total)}`,
    );
  }
}
const GUIDED = [
  "buy coffee",
  "server 1",
  "coffee table 2",
  "buy drinks",
  "coffee table 3",
  "drinks table 2",
  "coffee table 4",
  "buy pizza",
  "coffee table 5",
  "drinks table 3",
  "server 2",
  "coffee Lv2",
  "drinks Lv2",
  "buy burger",
  "cleaner 1",
  "coffee table 6",
  "pizza table 2",
  "pizza Lv2",
  "buy iceCream",
  "coffee table 7",
  "burger Lv2",
  "buy hotFood",
  "server 3",
  "cleaner 2",
  "coffee Lv3",
  "coffee table 8",
];
/** The onboarding order for an ACTIVE player who keeps playing levels (LEVEL_MIN minutes a level). Time = price / (floor + assist income per minute), never before the gate. */
export function guidedPath(cfg: Cfg) {
  let f: Floor = { own: {}, servers: 0, cleaners: 0 };
  let t = 0;
  const rows: {
    step: string;
    price: number;
    waitMin: number;
    atMin: number;
    level: number;
    gain: number;
    payback: number;
    hourly: number;
    gated: boolean;
  }[] = [];
  for (const label of GUIDED) {
    const o = allOptions(f, cfg.gates).find((x) => x.label === label);
    if (!o) continue;
    const levelAt = (m: number) => FLOOR_OPENS_AT + m / cfg.levelMin;
    const assistPerMin =
      (cfg.assist * (campaignCum(levelAt(t) + 1) - campaignCum(levelAt(t)))) / cfg.levelMin;
    const rate = floorHourly(f) / 60 + assistPerMin;
    let wait = label === "buy coffee" ? 0 : o.price / rate;
    let gated = false;
    const readyAt = (o.gate - FLOOR_OPENS_AT) * cfg.levelMin;
    if (t + wait < readyAt) {
      wait = readyAt - t;
      gated = true;
    }
    const before = floorHourly(f);
    t += wait;
    f = o.apply(f);
    rows.push({
      step: label,
      price: o.price,
      waitMin: wait,
      atMin: t,
      level: Math.floor(levelAt(t)),
      gain: floorHourly(f) - before,
      payback: o.price / Math.max(1e-9, floorHourly(f) - before),
      hourly: floorHourly(f),
      gated,
    });
  }
  return rows;
}
function printGuided() {
  const cfg = cfgFromEnv();
  console.log(
    `\nGUIDED PATH (active player, level takes ${cfg.levelMin} min, ${pct(cfg.assist)} of campaign pay into the floor, gates ${cfg.gates.name})`,
  );
  for (const r of guidedPath(cfg))
    console.log(
      `${r.step.padEnd(16)} ${$(r.price).padEnd(9)} wait ${fmtT(r.waitMin).padEnd(8)} at ${fmtT(r.atMin).padEnd(8)} L${String(r.level).padEnd(3)} +${$(r.gain).padEnd(7)} payback ${fmtT(r.payback * 60).padEnd(8)} -> ${$(r.hourly)}/h${r.gated ? "  [gate]" : ""}`,
    );
}
function printPatterns() {
  const cfg = cfgFromEnv();
  console.log(
    `\nPATTERNS - caps ${cfg.caps.join("/")} h, level ${cfg.levelMin} min, assist ${pct(cfg.assist)}, gates ${cfg.gates.name}`,
  );
  console.log(
    "campaign = campaign pay for the levels played since Level 5; floor = Second Floor collections; combined = both. All cents -> dollars.",
  );
  for (const p of PATTERNS) {
    const r = simulate(p, cfg);
    const dom = dominantFrom(r.rows);
    console.log(`\n== ${p.name}`);
    for (const d of [1, 3, 7, 14, 30, 60, 90].filter((x) => x <= cfg.days)) {
      const w = r.rows[d - 1]!;
      const comb = w.campaignCum + w.floorCum;
      console.log(
        `  day ${String(d).padEnd(3)} L${String(w.level).padEnd(4)} campaign ${$(w.campaignCum).padEnd(9)} floor ${$(w.floorCum).padEnd(9)} combined ${$(comb).padEnd(9)} floor share ${pct(comb ? w.floorCum / comb : 0).padEnd(4)} | that day: campaign ${$(w.campaignDay).padEnd(8)} floor ${$(w.floorDay).padEnd(8)} | floor ${$(w.hourly)}/h tables ${w.tables}`,
      );
    }
    console.log(
      `  floor out-earns the campaign over every week from: ${dom ? `day ${dom.day} (Level ${dom.level})` : "never within the run"}; counter-full loss ${pct(r.lostToCap)}; level-gate-blocked visits ${pct(r.gateBlocked / r.checkIns)} of ${r.checkIns}`,
    );
  }
}
function printCompare() {
  const base = cfgFromEnv();
  console.log(`
CAPS COMPARE (level ${base.levelMin} min, assist ${pct(base.assist)}, gates ${base.gates.name}, ${base.days} days). "share" = floor share of combined income on the day the campaign ends.`);
  console.log(
    "pattern".padEnd(11) +
      "caps".padEnd(10) +
      "campaign ends".padEnd(15) +
      "share then".padEnd(12) +
      "floor then".padEnd(12) +
      "floor@90".padEnd(11) +
      "lost-to-cap".padEnd(13) +
      "dominant from",
  );
  for (const p of PATTERNS)
    for (const caps of [CAP_SETS.old, [4, 5, 6], [3, 4, 5], [2, 3, 4]]) {
      const r = simulate(p, { ...base, caps });
      const e = shareAtEnd(r.rows);
      const dom = dominantFrom(r.rows);
      console.log(
        p.id.padEnd(11) +
          caps.join("/").padEnd(10) +
          (e.finished ? `day ${e.day}` : "unfinished").padEnd(15) +
          pct(e.share).padEnd(12) +
          $(e.floor).padEnd(12) +
          $(r.rows[Math.min(90, r.rows.length) - 1]!.floorCum).padEnd(11) +
          pct(r.lostToCap).padEnd(13) +
          (dom ? `day ${dom.day} (L${dom.level})` : "never"),
      );
    }
}
function printSensitivity() {
  const base = cfgFromEnv();
  console.log(`
SENSITIVITY to the level duration (ASSUMPTION): caps ${base.caps.join("/")} h, gates ${base.gates.name}, assist ${pct(base.assist)}. levels per session = session minutes / minutes per level (fixed 1 for "slowfloor"). Cell: campaign end day | floor share of combined THEN | floor dominant from`);
  console.log(
    "pattern".padEnd(11) + [1.5, 2.5, 4, 6].map((m) => `${m} min/level`.padEnd(40)).join(""),
  );
  for (const p of PATTERNS) {
    const cells = [1.5, 2.5, 4, 6].map((m) => {
      const r = simulate(p, { ...base, levelMin: m });
      const dom = dominantFrom(r.rows);
      const e = shareAtEnd(r.rows);
      return `${e.finished ? `d${e.day}` : "d>" + e.day} | ${pct(e.share)} | ${dom ? `d${dom.day}/L${dom.level}` : "never"}`.padEnd(
        40,
      );
    });
    console.log(p.id.padEnd(11) + cells.join(""));
  }
}
export const TUNES: Record<
  string,
  { tune: Tune; gates: Gates; caps: readonly number[]; note: string }
> = {
  R2: {
    tune: BASE_TUNE,
    gates: GATE_SETS.A!,
    caps: CAP_SETS.new,
    note: "round-2 numbers with the new 4/5/6 h caps",
  },
  T1: {
    tune: {
      tierPay: [1, 1.3, 1.6],
      tierCycle: [1, 0.92, 0.85],
      growth: 1.2,
      milestones: [
        [3, 1030],
        [5, 1060],
        [10, 1120],
        [25, 1200],
        [50, 1300],
      ],
    },
    gates: { name: "T1", tablesBase: 3, perLevels: 8, tier2: 12, tier3: 50 },
    caps: CAP_SETS.new,
    note: "softer tiers, softer milestones, tables x1.20, slower gates",
  },
  T2: {
    tune: {
      tierPay: [1, 1.3, 1.6],
      tierCycle: [1, 0.92, 0.85],
      growth: 1.25,
      milestones: [
        [3, 1030],
        [5, 1060],
        [10, 1120],
        [25, 1200],
        [50, 1300],
      ],
    },
    gates: { name: "T2", tablesBase: 3, perLevels: 10, tier2: 12, tier3: 60 },
    caps: [3, 4, 5],
    note: "T1 with tables x1.25, gates 10, tier 3 from L60, caps 3/4/5",
  },
  T3: {
    tune: {
      tierPay: [1, 1.3, 1.6],
      tierCycle: [1, 0.92, 0.85],
      growth: 1.3,
      milestones: [
        [3, 1030],
        [5, 1060],
        [10, 1120],
        [25, 1200],
        [50, 1300],
      ],
    },
    gates: { name: "T3", tablesBase: 3, perLevels: 12, tier2: 12, tier3: 70 },
    caps: [3, 4, 5],
    note: "tables x1.30, gates 12, tier 3 from L70, caps 3/4/5",
  },
};
const SOFT_MILE: [number, number][] = [
  [3, 1030],
  [5, 1060],
  [10, 1120],
  [25, 1200],
  [50, 1300],
];
const P_LADDER = [
  { price: 25, t2: 90, t3: 300, table: 30 },
  { price: 75, t2: 270, t3: 900, table: 80 },
  { price: 250, t2: 850, t3: 2000, table: 230 },
  { price: 650, t2: 2300, t3: 5300, table: 600 },
  { price: 1800, t2: 5200, t3: 12000, table: 1700 },
  { price: 5000, t2: 11500, t3: 26000, table: 4500 },
];
Object.assign(TUNES, {
  P1: {
    tune: {
      prices: P_LADDER,
      tierPay: [1, 1.3, 1.6],
      tierCycle: [1, 0.92, 0.85],
      growth: 1.3,
      milestones: SOFT_MILE,
    },
    gates: { name: "M (tier 3 from L30 only)", tablesBase: 50, perLevels: 1, tier2: 1, tier3: 30 },
    caps: CAP_SETS.new,
    note: "payback ladder prices, tables x1.30, soft milestones, almost no gates, caps 4/5/6",
  },
  P2: {
    tune: {
      prices: P_LADDER,
      tierPay: [1, 1.3, 1.6],
      tierCycle: [1, 0.92, 0.85],
      growth: 1.4,
      milestones: SOFT_MILE,
    },
    gates: { name: "M (tier 3 from L30 only)", tablesBase: 50, perLevels: 1, tier2: 1, tier3: 30 },
    caps: CAP_SETS.new,
    note: "P1 with tables x1.40",
  },
  P3: {
    tune: {
      prices: P_LADDER,
      tierPay: [1, 1.3, 1.6],
      tierCycle: [1, 0.92, 0.85],
      growth: 1.5,
      milestones: SOFT_MILE,
    },
    gates: { name: "M (tier 3 from L30 only)", tablesBase: 50, perLevels: 1, tier2: 1, tier3: 30 },
    caps: CAP_SETS.new,
    note: "P1 with tables x1.50",
  },
});
const SLOW_CYCLES = [12, 18, 30, 45, 65, 100];
const mk = (
  cycles: number[] | undefined,
  tp: number[],
  tc: number[],
  caps: readonly number[],
  note: string,
) => ({
  tune: {
    cycles,
    prices: P_LADDER,
    tierPay: tp,
    tierCycle: tc,
    growth: 1.3,
    milestones: SOFT_MILE,
  } as Tune,
  gates: {
    name: "M (tier 3 from L30 only)",
    tablesBase: 50,
    perLevels: 1,
    tier2: 1,
    tier3: 30,
  } as Gates,
  caps,
  note,
});
/** THE PROPOSAL (revision 3): payback-ladder prices, slower late cycles, soft tiers and milestones, tables x1.30, almost no gates. */
export const PROPOSAL: Tune = {
  cycles: [12, 18, 30, 45, 65, 100],
  prices: P_LADDER,
  tierPay: [1, 1.25, 1.5],
  tierCycle: [1, 0.94, 0.9],
  growth: 1.17,
  milestones: SOFT_MILE,
};
applyTune(PROPOSAL);
Object.assign(TUNES, {
  G13: {
    ...mk(SLOW_CYCLES, [1, 1.25, 1.5], [1, 0.94, 0.9], [4, 5, 6], "proposal but tables x1.30"),
    tune: { ...PROPOSAL, growth: 1.3 },
  },
  G15: {
    ...mk(SLOW_CYCLES, [1, 1.25, 1.5], [1, 0.94, 0.9], [4, 5, 6], "proposal but tables x1.15"),
    tune: { ...PROPOSAL, growth: 1.15 },
  },
  PROP: {
    ...mk(SLOW_CYCLES, [1, 1.25, 1.5], [1, 0.94, 0.9], [4, 5, 6], "THE PROPOSAL (tables x1.17)"),
    tune: PROPOSAL,
  },
  Q3a: {
    ...mk(
      [12, 18, 30, 45, 70, 100],
      [1, 1.25, 1.5],
      [1, 0.94, 0.9],
      [4, 5, 6],
      "LAST RESORT: guest price of Pizza..Hot Food x0.6",
    ),
    tune: { ...PROPOSAL, payoutScale: [1, 1, 0.6, 0.6, 0.6, 0.6] },
  },
  Q3b: {
    ...mk(
      [12, 18, 30, 45, 70, 100],
      [1, 1.25, 1.5],
      [1, 0.94, 0.9],
      [4, 5, 6],
      "LAST RESORT: guest price of Pizza..Hot Food x0.4",
    ),
    tune: { ...PROPOSAL, payoutScale: [1, 1, 0.4, 0.4, 0.4, 0.4] },
  },
  Q1o: mk(
    SLOW_CYCLES,
    [1, 1.3, 1.6],
    [1, 0.92, 0.85],
    CAP_SETS.old,
    "slower late cycles, OLD caps 8/9/10",
  ),
  Q1a: mk(SLOW_CYCLES, [1, 1.3, 1.6], [1, 0.92, 0.85], [4, 5, 6], "slower late cycles, caps 4/5/6"),
  Q1b: mk(SLOW_CYCLES, [1, 1.3, 1.6], [1, 0.92, 0.85], [3, 4, 5], "slower late cycles, caps 3/4/5"),
  Q1c: mk(SLOW_CYCLES, [1, 1.3, 1.6], [1, 0.92, 0.85], [2, 3, 4], "slower late cycles, caps 2/3/4"),
  Q2a: mk(
    SLOW_CYCLES,
    [1, 1.25, 1.5],
    [1, 0.94, 0.9],
    [4, 5, 6],
    "Q1 + softer tiers (x1.25 / x1.5), caps 4/5/6",
  ),
  Q2b: mk(SLOW_CYCLES, [1, 1.25, 1.5], [1, 0.94, 0.9], [3, 4, 5], "Q1 + softer tiers, caps 3/4/5"),
});
function printTune() {
  const base = cfgFromEnv();
  const names = (process.env.TUNES ?? Object.keys(TUNES).join(",")).split(",");
  console.log(`
TUNING SCAN (level ${base.levelMin} min, assist ${pct(base.assist)}, ${base.days} days). Per pattern: day the campaign ends | floor share of combined THEN | floor dominant (while campaign runs) from | gate-blocked visits | counter loss | floor $/h at day ${base.days}`);
  for (const n of names) {
    const t = TUNES[n]!;
    applyTune(t.tune);
    console.log(`
### ${n}: ${t.note}; caps ${t.caps.join("/")}`);
    for (const p of PATTERNS) {
      const r = simulate(p, { ...base, caps: t.caps, gates: t.gates });
      const e = shareAtEnd(r.rows);
      const dom = dominantFrom(r.rows);
      console.log(
        `  ${p.id.padEnd(10)} campaign ${e.finished ? `ends day ${e.day}` : `unfinished at day ${e.day}`} | floor share ${pct(e.share).padEnd(4)} (floor ${$(e.floor)} vs campaign ${$(e.campaign)}) | dominant ${dom ? `from day ${dom.day} (L${dom.level})` : "never"} | gate-blocked ${pct(r.gateBlocked / r.checkIns)} | counter loss ${pct(r.lostToCap)} | ${$(r.rows[r.rows.length - 1]!.hourly)}/h`,
      );
    }
  }
  applyTune(PROPOSAL);
}
function printBuys() {
  const cfg = cfgFromEnv();
  const marks = [
    "buy coffee",
    "server 1",
    "coffee table 2",
    "buy drinks",
    "coffee table 3",
    "buy pizza",
    "server 2",
    "coffee Lv2",
    "buy burger",
    "cleaner 1",
    "buy iceCream",
    "buy hotFood",
    "coffee table 10",
  ];
  console.log(
    `\nTIME TO PURCHASE (minutes/hours/days since the floor opened at Level 5; "-" = not within ${cfg.days} days). caps ${cfg.caps.join("/")}, level ${cfg.levelMin} min, gates ${cfg.gates.name}`,
  );
  console.log("pattern".padEnd(11) + marks.map((m) => m.replace("buy ", "").padEnd(9)).join(""));
  for (const p of PATTERNS) {
    const r = simulate(p, cfg);
    const first = new Map<string, number>();
    for (const b of r.buys) if (!first.has(b.what)) first.set(b.what, b.tMin);
    console.log(
      p.id.padEnd(11) +
        marks.map((m) => (first.has(m) ? fmtT(first.get(m)!) : "-").padEnd(9)).join(""),
    );
  }
}

const mode = process.argv[2] ?? "all";
if (process.argv[1]?.endsWith("second-floor-cycles-plan-sim.mts")) {
  if (mode === "validate" || mode === "all") printValidate();
  if (mode === "stations" || mode === "all") printStations();
  if (mode === "tables" || mode === "all") printTables();
  if (mode === "guided" || mode === "all") printGuided();
  if (mode === "patterns" || mode === "all") printPatterns();
  if (mode === "compare" || mode === "all") printCompare();
  if (mode === "sensitivity" || mode === "all") printSensitivity();
  if (mode === "buys" || mode === "all") printBuys();
  if (mode === "tune") printTune();
}
