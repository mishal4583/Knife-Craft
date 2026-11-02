/**
 * SECOND FLOOR PRICE DIAGNOSIS (developer 2026-11-02, "rebalance Second Floor machine purchase costs").
 * ANALYSIS ONLY: it reads the real game economy (the restaurant campaign simulator, the same one the economy QA suites use) and the
 * real Second Floor table (`restaurant/secondFloor.ts`), and prints what a player has when the floor opens. It changes nothing.
 *
 *   npx tsx scripts/second-floor-price-diagnosis.mts trajectories   # runs the campaign sim for 4 profiles to Level 40 (seconds), caches JSON
 *   npx tsx scripts/second-floor-price-diagnosis.mts facts|afford|sim|report
 *
 * Profiles (the economy QA's own scenarios, all REAL game logic):
 *   saver     = scenario A "Saver (buys no items)"                       - minimises spending before the unlock
 *   typical   = scenario G "Prudent completionist (keeps $500)"          - buys useful items, keeps a pocket
 *   greedy    = scenario C "Completionist": spends everything it can     - a low-balance player
 *   broke     = SimOptions profile "broke": starts with a drained wallet - reaches the unlock with almost nothing
 * "frequent" is the typical economy played faster (more levels an hour); it is a TIME profile, not a different wallet.
 *
 * Everything labelled ASSUMPTION is a guess, not data: minutes per level, the share of income a player puts into the floor,
 * the pocket money kept for food, and the player schedules.
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Pattern } from "./second-floor-cycles-plan-sim.mts";

const CACHE = path.join(os.tmpdir(), "knifecraft-second-floor-price-diagnosis.cache.json");
const TO = 40;
type Point = { level: number; wallet: number; gross: number; operating: number; purchases: number };
const OPTIONAL = [
  "knife-purchase",
  "board-purchase",
  "staff-purchase",
  "kitchen-investment-purchase",
  "blacksmith-upgrade",
  "refrigerator-purchase",
];

async function trajectories() {
  const sim = await import("./restaurantCampaignSim.mts");
  const { dollars } = await import("../src/game/money.ts");
  const profiles: Record<string, { opts: Record<string, unknown> }> = {
    saver: { opts: { profile: "diligent" } },
    typical: { opts: { profile: "completionist", dayStock: true, reserve: dollars(500) } },
    greedy: { opts: { profile: "completionist", dayStock: true } },
    broke: { opts: { profile: "broke" } },
  };
  const out: Record<string, Point[]> = {};
  for (const [name, p] of Object.entries(profiles)) {
    const pts: Point[] = [];
    try {
      sim.run(
        name,
        sim.freshRestaurantSave(),
        1,
        {
          ...(p.opts as object),
          onLevel(n: number, x: import("../src/game/SaveManager.ts").SaveData) {
            const lt = (x.economy.lifetime ?? {}) as Record<string, number | undefined>;
            const gross = Object.values(lt).reduce<number>((a, v) => a + Math.max(0, v ?? 0), 0);
            const spentAll = -Object.values(lt).reduce<number>(
              (a, v) => a + Math.min(0, v ?? 0),
              0,
            );
            const purchases = -OPTIONAL.reduce((a, k) => a + (lt[k] ?? 0), 0);
            pts.push({
              level: n,
              wallet: x.credits,
              gross,
              operating: gross - (spentAll - purchases),
              purchases,
            });
            if (n >= TO) throw new Error("STOP");
          },
        } as never,
        false,
      );
    } catch (e) {
      if (!String(e).includes("STOP")) throw e;
    }
    out[name] = pts;
    console.log(`ran ${name}: ${pts.length} levels`);
  }
  fs.writeFileSync(CACHE, JSON.stringify(out));
}

const mode = process.argv[2] ?? "report";
if (mode === "trajectories") await trajectories();
else await report();

// ------------------------------------------------------------------ report
async function report() {
  const game = await import("../src/game/restaurant/secondFloor.ts");
  const plan = await import("./second-floor-cycles-plan-sim.mts");
  const traj = JSON.parse(fs.readFileSync(CACHE, "utf8")) as Record<string, Point[]>;
  const $ = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
  const D = (d: number) => Math.round(d * 100);
  const RESERVE = D(100); // pocket money kept for food: an ASSUMPTION
  const LEVEL_MIN = Number(process.env.LEVEL_MIN ?? 2.5); // minutes a level takes: an ASSUMPTION, not measured
  // Share of operating income each profile puts into the floor: ASSUMPTIONS.
  const SHARE: Record<string, number> = { saver: 1, typical: 0.25, greedy: 0.25, broke: 0.25 };
  const pts = (n: string) => traj[n]!;
  const at = (n: string, level: number) => pts(n).find((p) => p.level === level)!;
  /** Cumulative operating income since the unlock (after Level 4), by level; linear between levels; beyond Level 40 at the last 10 levels' pace. */
  const opCum = (n: string) => (level: number) => {
    const base = at(n, 4).operating;
    const P = pts(n);
    const last = P[P.length - 1]!;
    if (level >= last.level) {
      const prev = P[P.length - 11]!;
      return (
        last.operating - base + ((level - last.level) * (last.operating - prev.operating)) / 10
      );
    }
    const lo = Math.floor(level);
    const a = lo <= 4 ? 0 : at(n, lo).operating - base;
    const b = at(n, lo + 1).operating - base;
    return a + (level - lo) * (b - a);
  };
  const PROFILES = ["saver", "typical", "greedy", "broke"];
  const LABEL: Record<string, string> = {
    saver: "Saver",
    typical: "Typical (prudent)",
    greedy: "Greedy spender (low balance)",
    broke: "Broke start (low balance)",
  };

  type Ladder = {
    name: string;
    machine: number[];
    staff?: { server: number[]; cleaner: number[] };
  };
  const CURRENT: Ladder = {
    name: "CURRENT GAME (secondFloor.ts)",
    machine: game.STATIONS.map((s) => s.price / 100),
  };
  const PLAN: Ladder = {
    name: "PLAN revision 3 (not built)",
    machine: [25, 75, 250, 650, 1800, 5000],
  };
  const parse = (v: string | undefined, d: number[]) => (v ? (JSON.parse(v) as number[]) : d);
  const PROPOSED: Ladder = {
    name: "PROPOSED",
    machine: parse(process.env.MACHINES, [1000, 3000, 9000, 24000, 60000, 140000]),
    staff: process.env.STAFF
      ? JSON.parse(process.env.STAFF)
      : { server: [350, 3100, 21000], cleaner: [1100, 10000] },
  };
  /** Table, Tier 2 and Tier 3 prices keep the plan's ratio to the machine price, so every payback scales with the machine. */
  const tuneFor = (l: Ladder) => {
    const base = plan.PROPOSAL;
    const ratio = (key: "t2" | "t3" | "table") =>
      l.machine.map((m, i) => {
        const b = base.prices![i]!;
        // RULE: with TABLE / T2 / T3 set, table and tier prices are fixed multiples of the machine price (the "500..4000" run).
        const mult = { table: process.env.TABLE, t2: process.env.T2, t3: process.env.T3 }[key];
        if (mult !== undefined) return Math.round((m * Number(mult)) / 50) * 50;
        // Tables and tiers follow the machine price only partly (exponent TIER_EXP, default 0.5): they are the reinvestment loop.
        const raw = b[key] * Math.pow(m / b.price, Number(process.env.TIER_EXP ?? 0.5));
        const step = raw >= 10000 ? 500 : raw >= 1000 ? 50 : 5;
        return Math.max(step, Math.round(raw / step) * step);
      });
    const t2 = ratio("t2");
    const t3 = ratio("t3");
    const tb = ratio("table");
    return {
      ...base,
      prices: l.machine.map((m, i) => ({ price: m, t2: t2[i]!, t3: t3[i]!, table: tb[i]! })),
      staff: l.staff,
    };
  };

  const NAMES = ["Coffee", "Drinks", "Pizza", "Burger", "Ice Cream", "Hot Food"];
  const fmtT = (min: number) =>
    min < 60
      ? `${Math.round(min)} min`
      : min < 2880
        ? `${(min / 60).toFixed(1)} h`
        : `${(min / 1440).toFixed(1)} d`;

  if (mode === "report" || mode === "facts") {
    console.log(
      "\n== 1. WHAT THE GAME HAS TODAY (restaurant/secondFloor.ts) vs THE PLAN (not built)",
    );
    console.log(
      `Floor opens at Level ${game.SECOND_FLOOR_OPENS_AT} (machines open at ${game.STATIONS_OPEN_AT}). Model today: fixed $/hour per machine, capped 8/9/10 h, a machine earns only with a Floor Server (covers 2), a missing cleaner takes 25 %.`,
    );
    game.STATIONS.forEach((s, i) =>
      console.log(
        `  ${s.name.padEnd(26)} price ${$(s.price).padEnd(7)} upgrades ${$(s.upgradePrices[0])}/${$(s.upgradePrices[1])}  income $${(s.perHour[0] / 100).toFixed(0)}/$${(s.perHour[1] / 100).toFixed(0)}/$${(s.perHour[2] / 100).toFixed(0)} an hour  payback ${fmtT((s.price / s.perHour[0]) * 60)}  | plan: ${$(D(PLAN.machine[i]!))}`,
      ),
    );
    console.log(
      `  Floor Server ${$(game.FLOOR_STAFF.server.price)} (max ${game.FLOOR_STAFF.server.max}), Floor Cleaner ${$(game.FLOOR_STAFF.cleaner.price)} (max ${game.FLOOR_STAFF.cleaner.max}); plan: Server $30/$250/$1,600, Cleaner $100/$900`,
    );
    console.log(
      "  No customer cycles, tables, 4/5/6 h caps or Tier-1 guest prices exist in the game today: they are only in docs/planning/PHASE12-...md and scripts/second-floor-cycles-plan-sim.mts.",
    );

    console.log("\n== 2. WHAT THE FIRST FLOOR GIVES (real campaign simulator, restaurant build)");
    console.log(
      "profile".padEnd(30) +
        "wallet at unlock (done L4)".padEnd(28) +
        `operating income per level: L5-9 | L10-14 | L15-24 | L25-34   (per hour at ${LEVEL_MIN} min/level, L5-9)`,
    );
    for (const n of PROFILES) {
      const o = opCum(n);
      const w = (a: number, b: number) => (o(b) - o(a - 1)) / (b - a + 1);
      console.log(
        `${LABEL[n]!.padEnd(30)}${$(at(n, 4).wallet).padEnd(28)}${$(w(5, 9)).padEnd(8)}| ${$(w(10, 14)).padEnd(8)}| ${$(w(15, 24)).padEnd(8)}| ${$(w(25, 34)).padEnd(8)}  (${$((w(5, 9) * 60) / LEVEL_MIN)}/h)`,
      );
    }
    console.log(
      "  Frequent player = the typical economy played faster (more levels an hour); not a different wallet.",
    );
  }

  const afford = (l: Ladder) => {
    console.log(
      `\n   ${l.name}: machine prices ${l.machine.map((m) => "$" + m.toLocaleString("en-US")).join(" / ")}`,
    );
    console.log("   " + "profile".padEnd(30) + NAMES.map((n) => n.padEnd(17)).join(""));
    for (const n of PROFILES) {
      const w0 = Math.max(0, at(n, 4).wallet - RESERVE);
      const o = opCum(n);
      const cells = l.machine.map((m) => {
        const price = D(m);
        if (w0 >= price) return "now".padEnd(17);
        for (let lv = 4.25; lv < 200; lv += 0.25)
          if (w0 + SHARE[n]! * o(lv) >= price)
            return `${Math.ceil(lv - 4)} lv/${fmtT((lv - 4) * LEVEL_MIN)}`.padEnd(17);
        return ">200 lv".padEnd(17);
      });
      console.log("   " + LABEL[n]!.padEnd(30) + cells.join(""));
    }
  };
  if (mode === "report" || mode === "afford") {
    console.log(
      `\n== 3. CAN THEY BUY IT? ("now" = wallet minus $${RESERVE / 100} pocket covers it; otherwise levels / minutes of play to save it, putting ${Object.entries(
        SHARE,
      )
        .map(([k, v]) => `${k} ${v * 100}%`)
        .join(", ")} of operating income into the floor; ${LEVEL_MIN} min/level assumed)`,
    );
    afford(CURRENT);
    afford(PLAN);
    afford(PROPOSED);
  }

  if (mode === "report" || mode === "table") {
    for (const l of [PROPOSED]) {
      plan.applyTune(tuneFor(l));
      const v = plan.validate();
      console.log(
        "\n== 5. THE PROPOSED PRICE TABLE (machines " +
          l.machine.map((m) => "$" + m.toLocaleString("en-US")).join(" / ") +
          "; tables and tiers follow the machine by exponent " +
          (process.env.TIER_EXP ?? "0.5") +
          "). Calculator validation: " +
          v.checks +
          " checks, " +
          v.failures.length +
          " failure(s)",
      );
      v.failures.forEach((m) => console.log("   FAIL " + m));
      for (const st of plan.STATIONS) {
        const h = [1, 2, 3].map((t) => plan.hourlyOf(st, t, 1));
        const pb = [st.price / h[0]!, st.up[0] / (h[1]! - h[0]!), st.up[1] / (h[2]! - h[1]!)];
        console.log(
          "   " +
            st.name.padEnd(10) +
            " machine " +
            $(st.price).padEnd(9) +
            " Tier 2 " +
            $(st.up[0]).padEnd(8) +
            " Tier 3 " +
            $(st.up[1]).padEnd(9) +
            " table #2 " +
            $(st.table).padEnd(7) +
            " | hourly (1 table, Server) " +
            h.map((x) => "$" + Math.round(x / 100)).join(" / ") +
            " | payback machine " +
            pb.map((x) => fmtT(x * 60)).join(" / ") +
            " | table #2 pays back in " +
            fmtT((st.table / (plan.hourlyOf(st, 1, 2) - h[0]!)) * 60),
        );
      }
      console.log(
        "   Servers " +
          plan.SERVER.prices.map($).join(" / ") +
          " | Cleaners " +
          plan.CLEANER.prices.map($).join(" / "),
      );
      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
      console.log(
        "   One table each: machines " +
          $(sum(plan.STATIONS.map((x) => x.price))) +
          " + Tier 2 " +
          $(sum(plan.STATIONS.map((x) => x.up[0]))) +
          " + Tier 3 " +
          $(sum(plan.STATIONS.map((x) => x.up[1]))) +
          " + staff " +
          $(sum(plan.SERVER.prices) + sum(plan.CLEANER.prices)),
      );
      plan.applyTune(plan.PROPOSAL);
    }
  }

  const GOALS = [
    "buy coffee",
    "server 1",
    "coffee table 2",
    "coffee table 3",
    "buy drinks",
    "drinks table 2",
    "coffee Lv2",
    "buy pizza",
    "server 2",
    "pizza table 2",
    "drinks Lv2",
    "buy burger",
    "cleaner 1",
    "coffee table 4",
    "pizza Lv2",
    "burger table 2",
    "buy iceCream",
    "burger Lv2",
    "server 3",
    "buy hotFood",
    "cleaner 2",
    "iceCream table 2",
    "hotFood table 2",
    "coffee Lv3",
    "drinks Lv3",
    "pizza Lv3",
  ];
  const HEAVY: Pattern = {
    id: "heavy",
    name: "Frequent player (2 x 45 min sessions, floor every 5 min)",
    every: 5,
    sessions: () => [
      { s: 8 * 60, len: 45 },
      { s: 20 * 60, len: 45 },
    ],
  };
  const REGULAR = plan.PATTERNS.find((p) => p.id === "regular")!;
  type SimOpts = { floorOnly?: boolean; pattern?: Pattern; days?: number };
  const simFor = (n: string, l: Ladder, opts: SimOpts) => {
    plan.applyTune(tuneFor(l));
    const w0 = Math.max(0, at(n, 4).wallet - RESERVE);
    const start = opts.floorOnly ? D(l.machine[0]!) + D(l.staff?.server[0] ?? 30) : w0;
    const r = plan.simulate(opts.pattern ?? REGULAR, {
      caps: [4, 5, 6],
      levelMin: LEVEL_MIN,
      assist: opts.floorOnly ? 0 : SHARE[n]!,
      gates: plan.GATE_SETS.M!,
      days: opts.days ?? 60,
      incomeCum: (lv) => opCum(n)(lv),
      startCents: start,
      goals: GOALS,
    });
    plan.applyTune(plan.PROPOSAL);
    return r;
  };
  const MARKS = [
    "buy coffee",
    "server 1",
    "buy drinks",
    "buy pizza",
    "buy burger",
    "buy iceCream",
    "buy hotFood",
  ];
  const simReport = (title: string, l: Ladder, n: string, opts: SimOpts) => {
    const r = simFor(n, l, opts);
    const first = new Map<string, (typeof r.buys)[number]>();
    for (const b of r.buys) if (!first.has(b.what)) first.set(b.what, b);
    const cells = MARKS.map((m) => {
      const b = first.get(m);
      return (
        b ? `${fmtT(b.tMin)} L${b.level} ${Math.round((b.first / b.price) * 100)}%` : "-"
      ).padEnd(17);
    });
    console.log(`   ${title.padEnd(38)}${cells.join("")}`);
    return r;
  };
  if (mode === "report" || mode === "sim") {
    console.log(
      "\n== 4. PROGRESSION SIMULATION (ordered goals, bought strictly in order). Cell = time since the floor opened, the campaign level then, and the % of that price paid with First Floor money (the rest was Second Floor collections)",
    );
    for (const l of [PLAN, PROPOSED]) {
      const st = l.staff ?? { server: [30, 250, 1600], cleaner: [100, 900] };
      console.log(
        `\n   ### ${l.name}: ${l.machine.map((m) => "$" + m.toLocaleString("en-US")).join(" / ")}; Servers ${st.server.map((x) => "$" + x.toLocaleString("en-US")).join(" / ")}; Cleaners ${st.cleaner.map((x) => "$" + x.toLocaleString("en-US")).join(" / ")}`,
      );
      console.log(
        `   ${"".padEnd(38)}${MARKS.map((m) => m.replace("buy ", "").padEnd(17)).join("")}`,
      );
      for (const n of PROFILES) simReport(LABEL[n]!, l, n, {});
      simReport("Frequent (typical wallet, 2 x 45 min)", l, "typical", { pattern: HEAVY });
      simReport("Floor income only after Coffee+Server", l, "typical", { floorOnly: true });
    }
    console.log(
      "\n   Campaign (First Floor) vs Second Floor income, separate and combined, PROPOSED prices, typical wallet. After the ordered goals the player keeps buying by best payback. Caps 4/5/6 h.",
    );
    const SLOW: Pattern = {
      id: "slowfloor",
      name: "slow campaign, regular floor",
      every: 3,
      sessions: () => [8, 12, 16, 20].map((h) => ({ s: h * 60, len: 3, levels: 1 })),
    };
    for (const [title, pat] of [
      ["regular (2 x 20 min)", REGULAR],
      ["frequent (2 x 45 min)", HEAVY],
      ["slow campaign / regular floor", SLOW],
    ] as [string, Pattern][]) {
      const r = simFor("typical", PROPOSED, { days: 90, pattern: pat });
      const e = plan.shareAtEnd(r.rows);
      const dom = plan.dominantFrom(r.rows);
      console.log(
        `     ${title.padEnd(32)} campaign ends day ${e.day}${e.finished ? "" : " (unfinished)"}: First Floor ${$(e.campaign)} | Second Floor ${$(e.floor)} | combined ${$(e.campaign + e.floor)} | floor share ${Math.round(e.share * 100)}% | floor out-earns campaign from ${dom ? `day ${dom.day} (L${dom.level})` : "never"} | floor ${$(r.rows[89]!.hourly)}/h at day 90`,
      );
    }
  }
}
