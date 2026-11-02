/**
 * Second Floor INCOME MODEL v4 (planning calculator, not game code).
 *
 * Rebuilds what a machine earns using the rules the top idle games share (see docs/planning/SECOND-FLOOR-IDLE-GAME-RESEARCH-...md):
 *   - income grows (near) linearly with the units owned, cost grows exponentially (1.07-1.15 per unit);
 *   - the first unit of each new business pays back a little slower than the one before (x1.2-1.6 per business);
 *   - milestones at owned counts multiply the whole business;
 *   - the player buys the best payback available, and a new business appears when the old one's next unit gets dearer than it.
 *
 *   npx tsx scripts/second-floor-income-model-v4.mts [tables|sim|all]
 *   Env: PAYX (guest price multiplier, default 3) ALPHA (units exponent, 1 = linear) GROWTH (JSON per station)
 *        MS (JSON [[tables, mult]...]) TIERPAY, TIERCYC (JSON) LEVEL_MIN (minutes a level takes)
 */
import { campaignCum, LAST_LEVEL } from "./second-floor-cycles-plan-sim.mts";

const num = (v: string | undefined, d: number) => (v === undefined ? d : Number(v));
const json = <T,>(v: string | undefined, d: T): T => (v === undefined ? d : (JSON.parse(v) as T));

export const NAMES = ["Coffee", "Drinks", "Pizza", "Burger", "Ice Cream", "Hot Food"];
export const PRICE = [500, 1000, 1500, 2000, 2500, 4000]; // dollars: the developer's machine prices
const CYCLE = [12, 18, 30, 45, 65, 100]; // seconds, Tier 1 (unchanged)
const OLD_GUEST = [0.2, 0.4, 0.8, 1.3, 2.0, 3.2]; // dollars per guest, the Phase 12 plan
export const PAYX = num(process.env.PAYX, 1);
export const ALPHA = num(process.env.ALPHA, 0.5);
export const GROWTH = json<number[]>(process.env.GROWTH, [1.3, 1.27, 1.25, 1.22, 1.2, 1.18]);
export const MS = json<[number, number][]>(process.env.MS, [
  [5, 1.25],
  [10, 1.5],
  [25, 2],
  [50, 3],
]);
export const TIERPAY = json<number[]>(process.env.TIERPAY, [1, 1.25, 1.5]);
export const TIERCYC = json<number[]>(process.env.TIERCYC, [1, 0.94, 0.9]);
export const MAXT = json<number[]>(process.env.MAXT, [6, 8, 10]); // most tables a station seats at Tier 1 / 2 / 3
export const CAPS = [4, 5, 6]; // hours the counter holds, Tier 1 / 2 / 3
const GUEST = OLD_GUEST.map((g) => Math.round(g * PAYX * 100) / 100); // dollars
// TSCALE stretches the table and tier prices only (the machine prices are the developer's and stay fixed).
const TSCALE = num(process.env.TSCALE, 2.5);
// Knobs (fractions of the machine price): TF = table #2, T2M = Tier 2, T3M = Tier 3. Defaults = the "x2.5" proposal.
const TF = num(process.env.TF, 0.9 * TSCALE);
const T2M = num(process.env.T2M, 3 * TSCALE);
const T3M = num(process.env.T3M, 9 * TSCALE);
const TABLE = PRICE.map((p) => Math.max(10, Math.round((p * TF) / 10) * 10)); // table #2
export const T2 = PRICE.map((p) => p * T2M);
export const T3 = PRICE.map((p) => p * T3M);
/** Campaign level each machine needs (soft gates), the level the floor opens at, and the wallet the player brings. */
export const GATES = json<number[]>(process.env.GATES, [0, 0, 0, 0, 0, 0]);
export const UNLOCK = num(process.env.UNLOCK, 5);
export const START_CASH = num(process.env.START_CASH, 508);
export const SERVER = [200, 1200, 6000]; // bought with the first machine of each pair

export const msMult = (n: number) => MS.filter(([t]) => n >= t).pop()?.[1] ?? 1;
/** Dollars per hour of station i at a tier with n tables (staffed, no cleaner). */
export const hourly = (i: number, tier: number, n: number) =>
  (3600 / (CYCLE[i]! * TIERCYC[tier - 1]!)) *
  GUEST[i]! *
  TIERPAY[tier - 1]! *
  Math.pow(n, ALPHA) *
  msMult(n);
export const tableCost = (i: number, owned: number) => TABLE[i]! * Math.pow(GROWTH[i]!, owned - 1);
const $ = (x: number) =>
  "$" + (x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : Math.round(x).toLocaleString("en-US"));
const dur = (h: number) =>
  h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`;

const mode = process.argv[2] ?? "all";

if (mode === "tables" || mode === "all") {
  console.log("## A. The new income of each machine");
  console.log(
    `Guest price x${PAYX} of the Phase 12 plan; income ~ tables^${ALPHA}; tables cost x${GROWTH.join("/")} each; milestones ${MS.map(([t, m]) => `${t}->x${m}`).join(", ")}; tiers pay x${TIERPAY.join("/")} and cycle x${TIERCYC.join("/")}.\n`,
  );
  console.log(
    "| Machine | Price | Cycle | Guest pays | Per cycle | Per hour | Per day (24 h) | Pays back | Table growth |",
  );
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  NAMES.forEach((n, i) => {
    const h = hourly(i, 1, 1);
    console.log(
      `| ${n} | ${$(PRICE[i]!)} | ${CYCLE[i]} s | ${$(GUEST[i]!)} | ${$(GUEST[i]!)} | ${$(h)} | ${$(h * 24)} | ${dur(PRICE[i]! / h)} | x${GROWTH[i]} |`,
    );
  });
  const ns = [1, 2, 3, 4, 6, 8, 10];
  for (const [label, fn] of [
    ["per HOUR", (h: number) => h],
    ["per DAY if never stopping (24 h)", (h: number) => h * 24],
  ] as [string, (h: number) => number][]) {
    console.log(`\n### Income ${label}, staffed`);
    console.log("| Machine | Tier | " + ns.map((n) => `${n} tbl`).join(" | ") + " |");
    console.log("|---|---|" + ns.map(() => "---:").join("|") + "|");
    NAMES.forEach((name, i) => {
      for (let t = 1; t <= 3; t++)
        console.log(
          `| ${t === 1 ? name : ""} | ${t} | ${ns.map((n) => (n > MAXT[t - 1]! ? "-" : $(fn(hourly(i, t, n))))).join(" | ")} |`,
        );
    });
  }
  console.log("\n### What one visit collects (counter caps 4 / 5 / 6 h at Tier 1 / 2 / 3)");
  const ns2 = [1, 3, 6, 8, 10];
  console.log("| Machine | Tier | Cap | " + ns2.map((n) => `${n} tbl`).join(" | ") + " |");
  console.log("|---|---|---:|" + ns2.map(() => "---:").join("|") + "|");
  NAMES.forEach((name, i) => {
    for (let t = 1; t <= 3; t++)
      console.log(
        `| ${t === 1 ? name : ""} | ${t} | ${CAPS[t - 1]} h | ${ns2.map((n) => (n > MAXT[t - 1]! ? "-" : $(hourly(i, t, n) * CAPS[t - 1]!))).join(" | ")} |`,
      );
  });
  console.log(
    "\n### Cost of the next unit and how long it takes to repay (the 'which one do I buy next' curve)",
  );
  console.log("| Machine | Table #2 | #3 | #4 | #6 | #8 | #10 | All 10 | Payback #2 | #4 | #6 |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  NAMES.forEach((name, i) => {
    const pb = (n: number) => dur(tableCost(i, n - 1) / (hourly(i, 1, n) - hourly(i, 1, n - 1)));
    console.log(
      `| ${name} | ${[2, 3, 4, 6, 8, 10].map((n) => $(tableCost(i, n - 1))).join(" | ")} | ${$([...Array(9).keys()].reduce((a, k) => a + tableCost(i, k + 1), 0))} | ${[2, 4, 6].map(pb).join(" | ")} |`,
    );
  });
  console.log("\n### Tier upgrades: price and payback at 1 / 3 / 6 tables");
  console.log(
    "| Machine | Tier 2 price | repays (1 / 3 / 6 tbl) | Tier 3 price | repays (1 / 3 / 6 tbl) |",
  );
  console.log("|---|---:|---|---:|---|");
  NAMES.forEach((name, i) => {
    const r = (t: number, price: number) =>
      [1, 3, 6].map((n) => dur(price / (hourly(i, t, n) - hourly(i, t - 1, n)))).join(" / ");
    console.log(`| ${name} | ${$(T2[i]!)} | ${r(2, T2[i]!)} | ${$(T3[i]!)} | ${r(3, T3[i]!)} |`);
  });
}

// ---------------------------------------------------------------- progression simulation
type Own = { n: number; tier: number };
type Pattern = { name: string; levelsPerDay: number; visits: number[] /* hours of day */ };
const PATTERNS: Pattern[] = [
  { name: "Regular (2 x 20 min a day, 2 floor visits)", levelsPerDay: 16, visits: [8, 20] },
  { name: "Frequent (2 x 45 min a day, 2 floor visits)", levelsPerDay: 36, visits: [8, 20] },
  {
    name: "Slow campaign, 4 floor visits a day (1 level each)",
    levelsPerDay: 4,
    visits: [0, 6, 12, 18],
  },
];
const SHARE = 0.25; // share of campaign income the player puts into the floor (assumption, as in the diagnosis)
const START = START_CASH; // typical wallet at the unlock minus a $100 reserve

function simulate(p: Pattern, days = 60) {
  const own: (Own | null)[] = NAMES.map(() => null);
  let cash = START;
  let servers = 0;
  let floorTotal = 0;
  const firstDay: (number | null)[] = NAMES.map(() => null);
  const dayIncome: number[] = [];
  const log: string[] = [];
  let lastVisit = 0; // hours since start
  let level = UNLOCK;
  const lvAt = (d: number) => Math.min(LAST_LEVEL, UNLOCK + (p.levelsPerDay * d) / 1);
  const options = () => {
    const out: { label: string; cost: number; gain: number; apply: () => void }[] = [];
    NAMES.forEach((name, i) => {
      const o = own[i];
      if (!o) {
        if (i > 0 && !own[i - 1]) return;
        if (level < GATES[i]!) return;
        const needServer = i % 2 === 0 ? SERVER[i / 2]! : 0;
        out.push({
          label: `${name} machine`,
          cost: PRICE[i]! + needServer,
          gain: hourly(i, 1, 1),
          apply: () => {
            own[i] = { n: 1, tier: 1 };
            if (needServer) servers++;
          },
        });
      } else {
        if (o.n < MAXT[o.tier - 1]!)
          out.push({
            label: `${name} table #${o.n + 1}`,
            cost: tableCost(i, o.n),
            gain: hourly(i, o.tier, o.n + 1) - hourly(i, o.tier, o.n),
            apply: () => o.n++,
          });
        if (o.tier < 3 && (o.tier === 1 || level >= 30))
          out.push({
            label: `${name} Tier ${o.tier + 1}`,
            cost: o.tier === 1 ? T2[i]! : T3[i]!,
            gain: hourly(i, o.tier + 1, o.n) - hourly(i, o.tier, o.n),
            apply: () => o.tier++,
          });
      }
    });
    return out;
  };
  for (let d = 0; d < days; d++) {
    let dayTotal = 0;
    for (const vh of p.visits) {
      const t = d * 24 + vh;
      if (t <= 0 && d === 0 && vh === 0) {
        /* first visit at hour 0 only buys */
      }
      const gap = t - lastVisit;
      let collected = 0;
      NAMES.forEach((_, i) => {
        const o = own[i];
        if (o) collected += hourly(i, o.tier, o.n) * Math.min(gap, CAPS[o.tier - 1]!);
      });
      lastVisit = t;
      level = lvAt(t / 24);
      const feed =
        (SHARE *
          (campaignCum(Math.min(LAST_LEVEL, Math.round(lvAt((t + 12) / 24)))) -
            campaignCum(Math.min(LAST_LEVEL, Math.round(lvAt(t / 24)))))) /
        100 /
        1; // dollars arriving across the next half day of play
      void feed;
      const dayFeed =
        (SHARE * (campaignCum(Math.round(lvAt(d + 1))) - campaignCum(Math.round(lvAt(d))))) /
        100 /
        p.visits.length;
      cash += collected + (d === 0 && vh === p.visits[0] && false ? 0 : dayFeed);
      floorTotal += collected;
      dayTotal += collected;
      // spend: best payback if affordable, else the best affordable within 1.5x of the best payback
      for (let guard = 0; guard < 200; guard++) {
        const opts = options();
        if (!opts.length) break;
        const score = (o: { cost: number; gain: number }) => o.cost / o.gain;
        const best = [...opts].sort((a, b) => score(a) - score(b))[0]!;
        const pick =
          best.cost <= cash
            ? best
            : opts
                .filter((o) => o.cost <= cash && score(o) <= score(best) * 1.5)
                .sort((a, b) => score(a) - score(b))[0];
        if (!pick) break;
        cash -= pick.cost;
        pick.apply();
        NAMES.forEach((n, i) => {
          if (own[i] && firstDay[i] === null) firstDay[i] = d + (vh + 0.001) / 24;
        });
        if (d < 40) log.push(`day ${(t / 24).toFixed(1)}: ${pick.label} (${$(pick.cost)})`);
      }
    }
    dayIncome.push(dayTotal);
  }
  return { own, firstDay, dayIncome, floorTotal, log, servers, lvAt };
}

if (mode === "sim" || mode === "all") {
  console.log(
    "\n## B. Progression: when each machine is bought, what the floor earns, floor against campaign",
  );
  console.log(
    "Typical wallet at the Level 5 unlock ($608, $100 kept back). 25% of campaign income goes into the floor. Greedy best-payback buying, Servers bought with each pair of machines, Tier 3 from Level 30.\n",
  );
  for (const p of PATTERNS) {
    const r = simulate(p);
    const camp = (d: number) =>
      campaignCum(Math.min(LAST_LEVEL, Math.round(UNLOCK + p.levelsPerDay * d)));
    const endDay = (LAST_LEVEL - UNLOCK) / p.levelsPerDay;
    const sum = (d: number) => r.dayIncome.slice(0, Math.ceil(d)).reduce((a, b) => a + b, 0);
    if (process.env.BRIEF) {
      const fl = sum(endDay);
      const f = (i: number) => (r.firstDay[i] === null ? "never" : r.firstDay[i]!.toFixed(1));
      console.log(
        `${p.name.split(" ")[0].padEnd(9)} drinks d${f(1)} pizza d${f(2)} burger d${f(3)} ice d${f(4)} hot d${f(5)} | d10 ${$(r.dayIncome[9]!)}/day d30 ${$(r.dayIncome[29]!)}/day | everything built day ${r.dayIncome.findIndex((x) => x >= 0.99 * Math.max(...r.dayIncome)) + 1} | floor by campaign end ${$(fl)} share ${Math.round((100 * fl) / (fl + camp(endDay) / 100))}%`,
      );
      continue;
    }
    if (process.env.LOG && p === PATTERNS[0]) {
      // group the purchases by visit
      const byVisit = new Map<string, string[]>();
      for (const l of r.log) {
        const m = /^day ([\d.]+): (.*)$/.exec(l)!;
        byVisit.set(m[1]!, [...(byVisit.get(m[1]!) ?? []), m[2]!]);
      }
      console.log(`### Purchase log, ${p.name}`);
      let k = 0;
      for (const [day, items] of byVisit) {
        if (k++ > 24) break;
        console.log(
          `- day ${day} (${items.length} buys): ${items.slice(0, 7).join("; ")}${items.length > 7 ? "; ..." : ""}`,
        );
      }
      continue;
    }
    console.log(`### ${p.name}`);
    console.log(
      "Machines bought on day: " +
        NAMES.map(
          (n, i) => `${n} ${r.firstDay[i] === null ? "never" : r.firstDay[i]!.toFixed(1)}`,
        ).join(", "),
    );
    console.log(
      "Floor income per day: " +
        [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60]
          .map((d) => `d${d} ${$(r.dayIncome[d - 1] ?? 0)}`)
          .join(", "),
    );
    const o = r.own
      .map((x, i) => (x ? `${NAMES[i]} ${x.n}t/T${x.tier}` : null))
      .filter(Boolean)
      .join(", ");
    console.log("Floor at day 60: " + o);
    console.log(
      `Campaign ends day ${endDay.toFixed(0)} with ${$(camp(endDay) / 100)}; the floor had earned ${$(sum(endDay))} by then => floor share ${Math.round((100 * sum(endDay)) / (sum(endDay) + camp(endDay) / 100))}%. By day 30: floor ${$(sum(30))} vs campaign ${$(camp(Math.min(30, endDay)) / 100)}. Day 60 floor total ${$(r.floorTotal)}.\n`,
    );
  }
}
