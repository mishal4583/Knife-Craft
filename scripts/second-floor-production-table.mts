/**
 * Second Floor PRODUCTION TABLE (analysis only, not game code).
 *
 * Uses the Phase 12 calculator's own formulas (cycle time, guest price, guests per cycle, milestones, tier speed-ups) with the
 * developer's machine prices, and prints what each machine earns per tier, per table count, per hour and per day, like an idle game.
 *
 *   npx tsx scripts/second-floor-production-table.mts
 *   PRICES='[500,1000,1500,2000,2500,4000]' TABLE=0.9 T2=3 T3=9 npx tsx scripts/second-floor-production-table.mts
 */
import {
  PROPOSAL,
  STATIONS,
  applyTune,
  cycleMs,
  guestPay,
  guestsPermille,
  hourlyOf,
  milestonePermille,
  millsPerCycle,
  tableCost,
  CAP_SETS,
  UNSTAFFED_SPEED,
  UNSTAFFED_TRAY_MIN,
} from "./second-floor-cycles-plan-sim.mts";

const PRICES: number[] = JSON.parse(process.env.PRICES ?? "[500,1000,1500,2000,2500,4000]");
const TABLE = Number(process.env.TABLE ?? 0.9);
const T2 = Number(process.env.T2 ?? 3);
const T3 = Number(process.env.T3 ?? 9);
const nice = (x: number) => Math.round(x / 50) * 50;

applyTune({
  ...PROPOSAL,
  prices: PRICES.map((p) => ({
    price: p,
    t2: nice(p * T2),
    t3: nice(p * T3),
    table: nice(p * TABLE),
  })),
});

const $ = (cents: number) =>
  "$" +
  (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 && Math.abs(cents) < 10000 ? 2 : 0,
    maximumFractionDigits: Math.abs(cents) < 10000 ? 2 : 0,
  });
const H = (s: number, t: number, n: number, staffed = true, cleaner = false) =>
  hourlyOf(STATIONS[s]!, t, n, staffed, cleaner);
const TABLES = [1, 3, 5, 10, 25, 50];
const out: string[] = [];
const p = (s = "") => out.push(s);

p("## 1. Prices used");
p("| Machine | Machine | Table #2 | Tier 2 | Tier 3 | Tier 1 cycle | Guest pays (T1) |");
p("|---|---:|---:|---:|---:|---:|---:|");
STATIONS.forEach((s) =>
  p(
    `| ${s.name} | ${$(s.price)} | ${$(s.table)} | ${$(s.up[0])} | ${$(s.up[1])} | ${s.cycle} s | ${$(s.payout)} |`,
  ),
);
p("");
p(
  `Tables cost x1.17 more each. Guests per cycle: ` +
    [1, 2, 3, 5, 10, 25, 50]
      .map((n) => `${n} tables = ${(guestsPermille(n) / 1000).toFixed(2)}`)
      .join(", ") +
    `. Milestone bonus: ` +
    [3, 5, 10, 25, 50]
      .map((n) => `${n} tables = +${(milestonePermille(n) - 1000) / 10}%`)
      .join(", ") +
    ".",
);

p("");
p("## 2. One table, one Server (staffed): what a machine makes");
p(
  "| Machine | Tier | Cycle | Pays per cycle | per minute | per hour | per day (24 h) | Pays back (1 table) | Tier pays back at 10 tables |",
);
p("|---|---|---:|---:|---:|---:|---:|---:|---:|");
STATIONS.forEach((s, i) => {
  for (let t = 1; t <= 3; t++) {
    const mills = millsPerCycle(s, t, 1);
    const perH = H(i, t, 1);
    const prev = t === 1 ? 0 : H(i, t - 1, 1);
    const cost = t === 1 ? s.price : s.up[t - 2]!;
    const gain = perH - prev;
    const pb = cost / gain;
    const pb10 = t === 1 ? null : cost / (H(i, t, 10) - H(i, t - 1, 10));
    const fmt = (h: number) => (h < 48 ? h.toFixed(1) + " h" : (h / 24).toFixed(1) + " d");
    p(
      `| ${t === 1 ? s.name : ""} | ${t} | ${(cycleMs(s, t) / 1000).toFixed(1)} s | $${(mills / 100000).toFixed(2)} | ${$(Math.round(perH / 60))} | ${$(Math.round(perH))} | ${$(Math.round(perH * 24))} | ${fmt(pb)} | ${pb10 === null ? "-" : fmt(pb10)} |`,
    );
  }
});

p("");
p("## 3. Income per HOUR as tables grow (staffed, no Cleaner)");
p("| Machine | Tier | " + TABLES.map((n) => `${n} tbl`).join(" | ") + " |");
p("|---|---|" + TABLES.map(() => "---:").join("|") + "|");
STATIONS.forEach((s, i) => {
  for (let t = 1; t <= 3; t++) {
    p(
      `| ${t === 1 ? s.name : ""} | ${t} | ${TABLES.map((n) => $(Math.round(H(i, t, n)))).join(" | ")} |`,
    );
  }
});

p("");
p("## 4. Income per DAY if the station never stops (24 h, staffed)");
p("| Machine | Tier | " + TABLES.map((n) => `${n} tbl`).join(" | ") + " |");
p("|---|---|" + TABLES.map(() => "---:").join("|") + "|");
STATIONS.forEach((s, i) => {
  for (let t = 1; t <= 3; t++) {
    p(
      `| ${t === 1 ? s.name : ""} | ${t} | ${TABLES.map((n) => $(Math.round(H(i, t, n) * 24))).join(" | ")} |`,
    );
  }
});

p("");
p(
  `## 5. What a real player collects: the counter holds ${CAP_SETS.new.join(" / ")} h (Tier 1 / 2 / 3), unstaffed ${UNSTAFFED_SPEED}x speed and a ${UNSTAFFED_TRAY_MIN}-min tray`,
);
p(
  "Per visit = hourly x cap hours. Per day = visits x that (a visit can never collect more than the cap, however long you stay away).",
);
p("");
p("**10 tables, per station**");
p(
  "| Machine | Tier | Cap | Per visit (full) | 1 visit/day | 3 visits/day | Visits to run 24 h | Always-open 24 h | Unstaffed (per visit) |",
);
p("|---|---|---:|---:|---:|---:|---:|---:|---:|");
STATIONS.forEach((s, i) => {
  for (let t = 1; t <= 3; t++) {
    const cap = CAP_SETS.new[t - 1]!;
    const visit = H(i, t, 10) * cap;
    const un = H(i, t, 10, false) * (UNSTAFFED_TRAY_MIN / 60);
    p(
      `| ${t === 1 ? s.name : ""} | ${t} | ${cap} h | ${$(Math.round(visit))} | ${$(Math.round(visit))} | ${$(Math.round(visit * 3))} | ${Math.ceil(24 / cap)} | ${$(Math.round(H(i, t, 10) * 24))} | ${$(Math.round(un))} |`,
    );
  }
});

p("");
p("## 6. Whole floor, three example builds (every machine at the same tier and table count)");
p("| Build | Cost to build | per hour | per day (24 h) | 1 visit/day | 3 visits/day |");
p("|---|---:|---:|---:|---:|---:|");
const build = (label: string, count: number, tier: number, n: number) => {
  let cost = 0;
  let perH = 0;
  let perVisit = 0;
  for (let i = 0; i < count; i++) {
    const s = STATIONS[i]!;
    cost += s.price;
    for (let o = 1; o < n; o++) cost += tableCost(s, o);
    for (let t = 2; t <= tier; t++) cost += s.up[t - 2]!;
    perH += H(i, tier, n);
    perVisit += H(i, tier, n) * CAP_SETS.new[tier - 1]!;
  }
  p(
    `| ${label} | ${$(cost)} | ${$(Math.round(perH))} | ${$(Math.round(perH * 24))} | ${$(Math.round(perVisit))} | ${$(Math.round(perVisit * 3))} |`,
  );
};
build("First machine only: Coffee, Tier 1, 1 table", 1, 1, 1);
build("Coffee, Tier 1, 5 tables", 1, 1, 5);
build("Coffee + Drinks, Tier 1, 3 tables", 2, 1, 3);
build("Four machines, Tier 1, 5 tables", 4, 1, 5);
build("All six, Tier 1, 1 table", 6, 1, 1);
build("All six, Tier 1, 5 tables", 6, 1, 5);
build("All six, Tier 2, 10 tables", 6, 2, 10);
build("All six, Tier 3, 10 tables", 6, 3, 10);
build("(theoretical) All six, Tier 3, 25 tables", 6, 3, 25);

p("");
p("## 7. Cost to add tables (what the table ladder looks like)");
p("| Machine | Table #2 | #3 | #5 | #10 | #25 | #50 | Total for 10 | Total for 25 |");
p("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
STATIONS.forEach((s) => {
  const sum = (n: number) => {
    let c = 0;
    for (let o = 1; o < n; o++) c += tableCost(s, o);
    return c;
  };
  p(
    `| ${s.name} | ${[1, 2, 4, 9, 24, 49].map((o) => $(tableCost(s, o))).join(" | ")} | ${$(sum(10))} | ${$(sum(25))} |`,
  );
});

console.log(out.join("\n"));
