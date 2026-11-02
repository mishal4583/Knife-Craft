/**
 * Second Floor SESSION simulator (planning, not game code): what a player can buy while SITTING and playing.
 * Levels take LEVEL_MIN minutes; each level end pays the campaign's income (share S goes into the floor); the floor
 * earns in real time while the player plays (no counter cap online). Greedy best-payback buying at each level end.
 *   npx tsx scripts/second-floor-session-sim.mts
 */
process.argv[2] = "none"; // the v4 module prints its tables only for tables|sim|all
const v4 = await import("./second-floor-income-model-v4.mts");
const plan = await import("./second-floor-cycles-plan-sim.mts");
const { NAMES, PRICE, hourly, tableCost, MAXT, T2, T3, SERVER, GATES, UNLOCK, START_CASH } = v4;
const FLOOD_MIN = Number(process.env.FLOOD ?? 0); // free minutes of floor income paid after each level (Flood)
const AD_FLOOD_MIN = Number(process.env.AD_FLOOD ?? 0); // minutes when the player takes the ad
const AD_TAKE = Number(process.env.AD_TAKE ?? 0.35); // share of levels where the ad is taken
const FIRST_FREE_SERVER = process.env.FIRST_FREE_SERVER === "1"; // Coffee needs no Server
const LEVEL_MIN = Number(process.env.LEVEL_MIN ?? 2.5);
type Own = { n: number; tier: number; polish: number };
// "Polish": ten cheap upgrades per station (decor, training, menu) that each add POLISH_GAIN of its income; they fill every gap with an affordable buy.
const POLISH = process.env.POLISH === "1";
const POLISH_COST = Number(process.env.POLISH_COST ?? 0.08);
const POLISH_GROWTH = Number(process.env.POLISH_GROWTH ?? 1.3);
const POLISH_GAIN = Number(process.env.POLISH_GAIN ?? 0.06);
const POLISH_MAX = 10;

function run(share: number, minutes: number, rush = 1) {
  const own: (Own | null)[] = NAMES.map(() => null);
  let cash = START_CASH;
  let level = UNLOCK;
  const buys: { t: number; label: string }[] = [];
  const perLevel: number[] = [];
  let floorEarned = 0;
  let campaignPaid = 0;
  const rate = () =>
    own.reduce((a, o, i) => a + (o ? hourly(i, o.tier, o.n) * (1 + POLISH_GAIN * o.polish) : 0), 0); // $/h
  const options = () => {
    const out: { label: string; cost: number; gain: number; apply: () => void }[] = [];
    NAMES.forEach((name, i) => {
      const o = own[i];
      if (!o) {
        if (i > 0 && !own[i - 1]) return;
        if (level < GATES[i]!) return;
        const srv = i % 2 === 0 && !(i === 0 && FIRST_FREE_SERVER) ? SERVER[i / 2]! : 0;
        out.push({
          label: `${name} machine`,
          cost: PRICE[i]! + srv,
          gain: hourly(i, 1, 1),
          apply: () => (own[i] = { n: 1, tier: 1, polish: 0 }),
        });
      } else {
        if (POLISH && o.polish < POLISH_MAX)
          out.push({
            label: `${name} polish ${o.polish + 1}`,
            cost: PRICE[i]! * POLISH_COST * Math.pow(POLISH_GROWTH, o.polish),
            gain: hourly(i, o.tier, o.n) * POLISH_GAIN,
            apply: () => o.polish++,
          });
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
  for (let m = 0; m < minutes; m += LEVEL_MIN) {
    const t = m + LEVEL_MIN;
    const flood = (rate() / 60) * (FLOOD_MIN * (1 - AD_TAKE) + AD_FLOOD_MIN * AD_TAKE);
    const earned = (rate() / 60) * LEVEL_MIN * rush + flood;
    floorEarned += earned;
    const pay = ((plan.campaignCum(level) - plan.campaignCum(level - 1)) / 100) * share;
    campaignPaid += pay;
    cash += earned + pay;
    level++;
    let n = 0;
    for (let g = 0; g < 100; g++) {
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
      buys.push({ t, label: pick.label });
      n++;
    }
    perLevel.push(n);
  }
  return { buys, perLevel, floorPerMin: rate() / 60, floorEarned, campaignPaid, cash, own };
}

const first = (r: ReturnType<typeof run>, name: string) =>
  r.buys.find((b) => b.label.startsWith(name))?.t;
console.log(
  `Level = ${LEVEL_MIN} min. Start: Level ${UNLOCK}, $${START_CASH}. 'share' = share of each level's pay put into the floor.\n`,
);
console.log(
  "| Share | Session | Purchases | Levels with a buy | Longest gap between buys | Floor $/min at end | Floor earned in session | Drinks / Pizza / Burger / Ice / Hot at (min) |",
);
console.log("|---|---:|---:|---:|---:|---:|---:|---|");
for (const share of [0.25, 0.5, 1]) {
  for (const minutes of [10, 30, 60, 120]) {
    const r = run(share, minutes);
    let gap = 0;
    let prev = 0;
    for (const b of r.buys) {
      gap = Math.max(gap, b.t - prev);
      prev = b.t;
    }
    gap = Math.max(gap, minutes - prev);
    const f = ["Drinks", "Pizza", "Burger", "Ice Cream", "Hot Food"]
      .map((n) => first(r, n) ?? "-")
      .join(" / ");
    console.log(
      `| ${share * 100}% | ${minutes} min | ${r.buys.length} | ${r.perLevel.filter((x) => x > 0).length}/${r.perLevel.length} | ${gap.toFixed(1)} min | $${r.floorPerMin.toFixed(1)} | $${Math.round(r.floorEarned).toLocaleString("en-US")} | ${f} |`,
    );
  }
}
const r = run(0.5, 30);
console.log("\nFirst 30 minutes at 50%:");
console.log(
  r.buys
    .slice(0, 18)
    .map((b) => `${b.t.toFixed(1)}m ${b.label}`)
    .join("; "),
);
const rr = run(0.5, 30, 5);
console.log(
  `\nSame with a 5x floor speed for the whole session: floor earned $${Math.round(rr.floorEarned)} vs campaign money into floor $${Math.round(rr.campaignPaid)} (no rush: $${Math.round(r.floorEarned)} vs $${Math.round(r.campaignPaid)}).`,
);
