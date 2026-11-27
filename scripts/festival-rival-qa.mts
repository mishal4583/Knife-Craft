/**
 * FESTIVAL FAIRNESS QA (CLAUDE.md: every mini-game level solvable by construction, QA proves it). A simulated player (game/festival/bot.ts) plays the
 * real rules at every pace, 40 rounds each, with no power-ups.
 *
 *  A  the ramp (developer 2026-11-27: "start from 5 or something, then gradually increase the toughness ... reduce the cooking time ... add more
 *     customers"): customers and customers at once never fall, cooking and the window before food spoils never grow, the rival never eases
 *  B  every round ends; a quick player (a tap each 0.8 s) wins every pace almost every time; an average one (1.2 s) the first eight; a slow one
 *     (1.6 s) the first five; a very slow one (2.2 s) the first three; a player who does nothing always loses
 *  C  the rival: fixed before the round from the round alone, never changed by the player, climbing to exactly its final score
 *  E  the stages themselves (developer 2026-11-28): the Burger Festival's three, and all 45 stage paces on the Burger kitchen (a stand-in until each
 *     festival has its own, which must then be proved again)
 *  D  nobody is left waiting: an empty counter fills at once, and a round is short (a quick player: Event 1 under a minute, Event 15 under 3 minutes)
 *
 * Run: npx tsx scripts/festival-rival-qa.mts
 */
import { burgerRound } from "../src/game/festival/burger.ts";
import { PACES, stagePace } from "../src/game/festival/tiers.ts";
import { FESTIVAL_EVENTS, paceOfStage } from "../src/game/festival/events.ts";
import { BOT_STEP_MS, playRound } from "../src/game/festival/bot.ts";
import { resultOf, startState, tick } from "../src/game/festival/kitchen.ts";
import { rivalAt, rivalPlan, type RivalPlan } from "../src/game/festival/rival.ts";
import type { Pace } from "../src/game/festival/types.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const SEEDS = 40;

console.log("A. The ramp");
{
  const never = (pick: (p: Pace) => number, way: "falls" | "grows") =>
    PACES.every((p, i) =>
      i === 0
        ? true
        : way === "falls"
          ? pick(p) >= pick(PACES[i - 1]!)
          : pick(p) <= pick(PACES[i - 1]!),
    );
  assert(
    PACES.length === 15 && PACES[0]!.orders === 5 && PACES[14]!.orders === 20,
    "A1: from 5 customers to 20",
  );
  assert(
    never((p) => p.orders, "falls") &&
      never((p) => p.atOnce, "falls") &&
      PACES[0]!.atOnce === 2 &&
      PACES[14]!.atOnce === 4,
    "A2: more customers, and more of them at once (2 to 4), never fewer",
  );
  assert(
    never((p) => p.cookSpeed, "grows") &&
      never((p) => p.overMs, "grows") &&
      PACES[14]!.cookSpeed <= 0.7,
    "A3: cooking gets quicker and food spoils sooner",
  );
  assert(
    never((p) => p.rivalShare, "falls") &&
      never((p) => p.grillSlots, "falls") &&
      never((p) => p.plates, "falls"),
    "A4: the rival never eases, and the counter only grows",
  );
}

console.log("B. Winnable at every pace (40 rounds each, no power-ups)");
const rounds = PACES.map((pace) =>
  Array.from({ length: SEEDS }, (_, k) => {
    const round = burgerRound(pace, k + 1);
    return { round, plan: rivalPlan(round, k + 1) };
  }),
);
const rate = (tier: number, reaction: number) => {
  let wins = 0;
  let unfinished = 0;
  let ms = 0;
  for (const { round, plan } of rounds[tier - 1]!) {
    const run = playRound(round, reaction);
    if (!run.state.done) unfinished++;
    if (resultOf(round, run.state, plan.final).won) wins++;
    ms += run.ms;
  }
  return { wins: wins / SEEDS, unfinished, seconds: ms / SEEDS / 1000 };
};
const table = (reaction: number, tiers: number[]) =>
  tiers.map((t) => ({ tier: t, ...rate(t, reaction) }));
const all = PACES.map((p) => p.tier);
const show = (rows: { tier: number; wins: number }[]) =>
  rows.map((r) => `${r.tier}:${Math.round(r.wins * 100)}%`).join(" ");
{
  const quick = table(800, all);
  assert(
    quick.every((r) => r.unfinished === 0),
    "B1: every round ends",
    quick.filter((r) => r.unfinished),
  );
  assert(
    quick.every((r) => r.wins >= 0.92),
    `B2: a tap each 0.8 s wins every pace (${show(quick)})`,
  );
  const average = table(1200, all.slice(0, 8));
  assert(
    average.every((r) => r.wins >= 0.9),
    `B3: a tap each 1.2 s wins the first eight (${show(average)})`,
  );
  const slow = table(1600, all.slice(0, 5));
  assert(
    slow.every((r) => r.wins >= 0.85),
    `B4: a tap each 1.6 s wins the first five (${show(slow)})`,
  );
  const slowest = table(2200, all.slice(0, 3));
  assert(
    slowest.every((r) => r.wins >= 0.85) && slowest[0]!.wins === 1,
    `B5: a tap each 2.2 s wins the first three, the first every time (${show(slowest)})`,
  );
  const hard = rate(15, 1600);
  assert(hard.wins <= 0.2, "B6: and the last is a real challenge for a slow player", hard);
  let idleWins = 0;
  for (const pace of PACES)
    for (const { round, plan } of rounds[pace.tier - 1]!.slice(0, 5)) {
      let state = startState(round);
      while (!state.done && state.now < 20 * 60_000) state = tick(round, state, 500).state;
      if (resultOf(round, state, plan.final).won || !state.done) idleWins++;
    }
  assert(idleWins === 0, "B7: doing nothing never wins, and the round still ends");
}

console.log("C. The rival");
{
  const bad: string[] = [];
  for (const pace of PACES)
    for (const [k, { round, plan }] of rounds[pace.tier - 1]!.entries()) {
      const again: RivalPlan = rivalPlan(round, k + 1);
      const m = plan.moments;
      if (JSON.stringify(again) !== JSON.stringify(plan))
        bad.push(`t${pace.tier}: not the same twice`);
      if (
        m.length !== pace.orders ||
        m.at(-1)!.score !== plan.final ||
        m.at(-1)!.orders !== pace.orders
      )
        bad.push(`t${pace.tier}: does not end at its final score`);
      if (!m.every((x, i) => i === 0 || (x.at > m[i - 1]!.at && x.score >= m[i - 1]!.score)))
        bad.push(`t${pace.tier}: goes backwards`);
      if (m.filter((x) => x.slip).length !== Math.min(pace.rivalSlips, pace.orders - 2))
        bad.push(`t${pace.tier}: slips`);
      if (!(plan.final > 0 && plan.final < plan.par))
        bad.push(`t${pace.tier}: final ${plan.final} par ${plan.par}`);
    }
  assert(
    bad.length === 0,
    "C1: the same round, the same rival; it only climbs, to exactly its final score, under the fast player's",
    bad.slice(0, 5),
  );
  const plan = rounds[0]![0]!.plan;
  assert(
    rivalAt(plan, 0).score === 0 && rivalAt(plan, 10 ** 9).score === plan.final,
    "C2: it starts at nothing and ends at its final score",
  );
}

console.log("D. Nobody waits");
{
  const quickFirst = rate(1, 800).seconds;
  const quickLast = rate(15, 800).seconds;
  assert(
    quickFirst < 60 && quickLast < 180,
    `D1: rounds are short for a quick player (Event 1 ${quickFirst.toFixed(0)} s, Event 15 ${quickLast.toFixed(0)} s)`,
  );
  let longestEmpty = 0;
  for (const { round } of rounds[0]!.slice(0, 10)) {
    let state = startState(round);
    let empty = 0;
    // serve everyone the moment they arrive (by taking them away): the next must come at once
    while (!state.done && state.now < 60_000) {
      state = tick(round, state, BOT_STEP_MS).state;
      if (state.customers.length === 0) empty += BOT_STEP_MS;
      else {
        longestEmpty = Math.max(longestEmpty, state.next > 1 ? empty : 0);
        empty = 0;
        state = { ...state, customers: [] };
      }
    }
  }
  assert(
    longestEmpty <= BOT_STEP_MS * 2,
    "D2: after the first, an empty counter is filled at once",
    longestEmpty,
  );
}

console.log("E. The stages");
{
  const of = (pace: Pace, reaction: number) => {
    let wins = 0;
    let idle = 0;
    let ms = 0;
    for (let k = 1; k <= SEEDS; k++) {
      const round = burgerRound(pace, k);
      const plan = rivalPlan(round, k);
      const run = playRound(round, reaction);
      if (run.state.done && resultOf(round, run.state, plan.final).won) wins++;
      ms += run.ms;
      if (k <= 3) {
        let state = startState(round);
        while (!state.done && state.now < 30 * 60_000) state = tick(round, state, 500).state;
        if (!state.done || resultOf(round, state, plan.final).won) idle++;
      }
    }
    return { wins: wins / SEEDS, idle, seconds: ms / SEEDS / 1000 };
  };
  const burger = FESTIVAL_EVENTS[0]!;
  const rows = [1, 2, 3].map((s) => {
    const pace = paceOfStage(burger, s);
    return { s, quick: of(pace, 800), average: of(pace, 1200), slow: of(pace, 1600) };
  });
  const line = (pick: (r: (typeof rows)[number]) => number) =>
    rows.map((r) => `${Math.round(pick(r) * 100)}%`).join(" ");
  assert(
    rows.every((r) => r.quick.wins >= 0.95 && r.average.wins >= 0.9 && r.quick.idle === 0),
    `E1: the Burger Festival's three stages: a tap each 0.8 s (${line((r) => r.quick.wins)}) or 1.2 s (${line((r) => r.average.wins)}) wins; doing nothing never does`,
  );
  assert(
    rows[0]!.slow.wins >= 0.95 && rows[1]!.slow.wins >= 0.9 && rows[2]!.slow.wins >= 0.6,
    `E2: a tap each 1.6 s still wins them, the third more often than not (${line((r) => r.slow.wins)})`,
  );
  const all = FESTIVAL_EVENTS.flatMap((e) =>
    [1, 2, 3].map((s) => ({ at: `${e.number}.${s}`, ...of(stagePace(e.number, s), 800) })),
  );
  const hard = all.filter((r) => r.wins < 0.92 || r.idle > 0);
  assert(
    hard.length === 0,
    `E3: all 45 stage paces are won by a tap each 0.8 s, never by doing nothing (lowest ${Math.round(Math.min(...all.map((r) => r.wins)) * 100)}%)`,
    hard,
  );
  const longest = Math.max(...all.map((r) => r.seconds));
  assert(
    longest < 200,
    `E4: the longest round stays under 200 s for that player (${longest.toFixed(0)} s)`,
  );
}

console.log(
  failures ? `\nFESTIVAL FAIRNESS QA: ${failures} FAILED` : "\nFESTIVAL FAIRNESS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
