/**
 * CITY LEAGUE QA (the "Chef Pride" plan, Phase 5, developer 2026-11-23: a LOCAL weekly league against the city's rivals).
 *
 *  A  the leagues and the weeks: five leagues with rising rival scale; the week is Monday to Sunday of the calendar (month and year boundaries too);
 *  B  the rivals: nine distinct restaurants a week, the same every time for the same week and league, different from week to week; their points stay in the spread;
 *     the table has ten rows, best first, ties to the rival, and builds up through the week;
 *  C  the points: from Level 10 only, a perfect cut 1, a Clean plate 2, a service 10, a spotless service 15 more;
 *  D  the settlement: the top three go up one league, a poor week changes nothing (NO demotion), an empty week leaves no result, Diamond stays Diamond, a gap of several
 *     weeks settles once, the result is kept (not shown yet) and shown once;
 *  E  fairness: a player who earns a little more than the best a rival can earn always finishes first; a player with nothing finishes last; so promotion is never impossible;
 *  F  the view: nothing before Level 10; the league above; the points to reach third place;
 *  G  pure and honest: nothing stored outside business.chefRecord, no wallet, ledger, clock or random, no new top-level save field, a damaged state is clamped, the card says
 *     it is the city's restaurants and not other players;
 *  H  wiring: points from a plate and a service, the week settled and told once on the Kitchen, the card on Progress, measured.
 *
 * Run: npx tsx scripts/city-league-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE } from "../src/game/SaveManager.ts";
import {
  LEAGUES,
  LEAGUE_FROM_LEVEL,
  LEAGUE_SIZE,
  POINTS,
  PROMOTION_RANK,
  RIVAL_SPREAD,
  addLeaguePoints,
  dayOfWeek,
  leagueView,
  markLeagueShown,
  pendingLeagueResult,
  pointsForPlate,
  pointsForService,
  rivalWeekPoints,
  settleLeague,
  weekRivals,
  weekStartOf,
  weekTable,
} from "../src/game/restaurant/cityLeague.ts";
import {
  DEFAULT_CHEF_RECORD,
  clampChefRecord,
  type ChefRecord,
} from "../src/game/restaurant/chefRecord.ts";
import { leagueCelebration } from "../src/game/restaurant/celebrations.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(
    `  ${cond ? "ok " : "FAIL"} ${msg}${!cond && detail !== undefined ? ` ${JSON.stringify(detail).slice(0, 300)}` : ""}`,
  );
  if (!cond) failures++;
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const MON = "2026-11-23"; // a Monday
const WEEK = "2026-11-23";
const NEXT_WEEK_DAY = "2026-12-01"; // a Tuesday of the following week
const lvl = LEAGUE_FROM_LEVEL;
const rec = (league: ChefRecord["league"]): ChefRecord => ({ ...DEFAULT_CHEF_RECORD, league });
const tableBest = (week: string, tier: number) =>
  Math.max(...weekRivals(week, tier).map((r) => rivalWeekPoints(week, tier, r.id)));

console.log("A. Leagues and weeks");
{
  assert(
    LEAGUES.length === 5 && LEAGUES.every((l, i) => l.tier === i),
    "A1: five leagues in order",
  );
  assert(
    LEAGUES.every((l, i) => i === 0 || l.rivalBase > LEAGUES[i - 1]!.rivalBase),
    "A2: the rivals' scale rises with each league",
  );
  assert(
    new Set(LEAGUES.map((l) => l.name)).size === 5 &&
      LEAGUES[0]!.name === "Bronze" &&
      LEAGUES[4]!.identity === "Legendary Chef",
    "A3: Bronze to Diamond, Apprentice to Legendary Chef",
  );
  assert(
    weekStartOf("2026-11-23") === "2026-11-23" &&
      weekStartOf("2026-11-25") === "2026-11-23" &&
      weekStartOf("2026-11-29") === "2026-11-23",
    "A4: Monday to Sunday is one week",
  );
  assert(weekStartOf("2026-11-30") === "2026-11-30", "A5: the next Monday starts a new week");
  assert(
    weekStartOf("2027-01-01") === "2026-12-28" && weekStartOf("2026-03-01") === "2026-02-23",
    "A6: month and year boundaries",
  );
  assert(
    dayOfWeek("2026-11-23") === 1 && dayOfWeek("2026-11-29") === 7 && dayOfWeek("2026-11-26") === 4,
    "A7: Monday is 1, Sunday 7",
  );
}

console.log("B. The rivals and the table");
{
  const r1 = weekRivals(WEEK, 0);
  assert(
    r1.length === 9 && new Set(r1.map((r) => r.id)).size === 9,
    "B1: nine distinct rivals",
    r1.length,
  );
  assert(
    JSON.stringify(weekRivals(WEEK, 0).map((r) => r.id)) === JSON.stringify(r1.map((r) => r.id)),
    "B2: the same week and league always draw the same rivals",
  );
  const other = weekRivals("2026-11-30", 0)
    .map((r) => r.id)
    .join();
  assert(
    other !== r1.map((r) => r.id).join() &&
      weekRivals(WEEK, 1)
        .map((r) => r.id)
        .join() !== r1.map((r) => r.id).join(),
    "B3: a different week or league draws other rivals",
  );
  const [lo, hi] = RIVAL_SPREAD;
  let inSpread = true;
  for (const tier of [0, 1, 2, 3, 4])
    for (const w of ["2026-11-23", "2026-11-30", "2026-12-07"])
      for (const r of weekRivals(w, tier)) {
        const p = rivalWeekPoints(w, tier, r.id);
        const base = LEAGUES[tier]!.rivalBase;
        if (
          p < Math.floor(base * lo) ||
          p > Math.ceil(base * hi) ||
          p !== rivalWeekPoints(w, tier, r.id)
        )
          inSpread = false;
      }
  assert(
    inSpread,
    "B4: a rival's week stays in the spread of the league's scale and never changes",
  );
  const t = weekTable(WEEK, 0, 80, "2026-11-26");
  assert(
    t.length === LEAGUE_SIZE && t.filter((r) => r.player).length === 1,
    "B5: ten rows, one of them the player",
  );
  assert(
    t.every((r, i) => i === 0 || r.points <= t[i - 1]!.points),
    "B6: best first",
  );
  const tie = weekTable(WEEK, 0, tableBest(WEEK, 0), "final");
  const topRow = tie[0]!;
  assert(
    !topRow.player ||
      weekRivals(WEEK, 0).every((r) => rivalWeekPoints(WEEK, 0, r.id) < tableBest(WEEK, 0)),
    "B7: on a tie the rival is ahead",
  );
  const mon = weekTable(WEEK, 2, 0, "2026-11-23")
    .filter((r) => !r.player)
    .reduce((s, r) => s + r.points, 0);
  const sun = weekTable(WEEK, 2, 0, "2026-11-29")
    .filter((r) => !r.player)
    .reduce((s, r) => s + r.points, 0);
  const fin = weekTable(WEEK, 2, 0, "final")
    .filter((r) => !r.player)
    .reduce((s, r) => s + r.points, 0);
  assert(
    mon < sun && sun === fin && mon > 0,
    "B8: the rivals build up through the week and have all of it by Sunday",
    [mon, sun, fin],
  );
}

console.log("C. The points");
{
  assert(
    pointsForPlate({ score: 90, perfects: 3 }) === 3 * POINTS.perfectCut + POINTS.cleanPlate,
    "C1: perfect cuts and a Clean plate",
  );
  assert(
    pointsForPlate({ score: 70, perfects: 0 }) === 0,
    "C2: a weaker plate with no perfect cut earns nothing",
  );
  assert(
    pointsForService({ spotless: false }) === POINTS.service &&
      pointsForService({ spotless: true }) === POINTS.service + POINTS.spotless,
    "C3: a service, and more when spotless",
  );
  assert(
    addLeaguePoints(DEFAULT_CHEF_RECORD, MON, lvl - 1, 50) === DEFAULT_CHEF_RECORD,
    "C4: nothing before Level 10",
  );
  assert(
    addLeaguePoints(DEFAULT_CHEF_RECORD, MON, lvl, 0) === DEFAULT_CHEF_RECORD,
    "C5: nothing for zero",
  );
  const a = addLeaguePoints(
    addLeaguePoints(DEFAULT_CHEF_RECORD, MON, lvl, 12),
    "2026-11-25",
    lvl,
    8,
  );
  assert(
    a.league?.points === 20 && a.league.tier === 0 && a.league.week === WEEK,
    "C6: points add up through the week, starting in Bronze",
  );
}

console.log("D. The settlement");
{
  const week = rec({ week: WEEK, tier: 0, points: 500, last: null }); // far above any Bronze rival
  const settled = settleLeague(week, NEXT_WEEK_DAY);
  assert(
    settled.league?.tier === 1 &&
      settled.league.points === 0 &&
      settled.league.week === "2026-11-30",
    "D1: a top finish goes up a league and the new week starts empty",
  );
  assert(
    settled.league?.last?.rank === 1 &&
      settled.league.last.promoted === true &&
      settled.league.last.shown === false &&
      settled.league.last.points === 500,
    "D2: the result is kept, not shown yet",
  );
  assert(settleLeague(week, "2026-11-26") === week, "D3: the same week settles nothing");
  const poor = settleLeague(rec({ week: WEEK, tier: 2, points: 1, last: null }), NEXT_WEEK_DAY);
  assert(
    poor.league?.tier === 2 &&
      poor.league.last?.promoted === false &&
      poor.league.last.rank === LEAGUE_SIZE,
    "D4: a poor week changes nothing: no demotion, a last place is still just a result",
  );
  const empty = settleLeague(rec({ week: WEEK, tier: 3, points: 0, last: null }), NEXT_WEEK_DAY);
  assert(
    empty.league?.tier === 3 && empty.league.last === null && empty.league.week === "2026-11-30",
    "D5: an empty week leaves no result and no change",
  );
  const top = settleLeague(rec({ week: WEEK, tier: 4, points: 5000, last: null }), NEXT_WEEK_DAY);
  assert(
    top.league?.tier === 4 && top.league.last?.promoted === false,
    "D6: Diamond stays Diamond",
  );
  const gap = settleLeague(rec({ week: WEEK, tier: 0, points: 500, last: null }), "2026-12-30");
  assert(
    gap.league?.tier === 1 && gap.league.week === "2026-12-28",
    "D7: a gap of several weeks settles the one week that was played, once",
  );
  const added = addLeaguePoints(week, NEXT_WEEK_DAY, lvl, 7);
  assert(
    added.league?.tier === 1 && added.league.points === 7 && added.league.last?.promoted === true,
    "D8: earning points in a new week settles the old one first",
  );
  assert(
    pendingLeagueResult(settled)?.rank === 1 &&
      pendingLeagueResult(markLeagueShown(settled)) === null,
    "D9: the result is told once",
  );
  assert(
    markLeagueShown(DEFAULT_CHEF_RECORD) === DEFAULT_CHEF_RECORD,
    "D10: nothing to mark when there is no result",
  );
}

console.log("E. Fairness");
{
  let always = true;
  let never = true;
  for (const tier of [0, 1, 2, 3, 4])
    for (let w = 0; w < 30; w++) {
      const week = `2027-${String(1 + (w % 12)).padStart(2, "0")}-${String(1 + (w % 28)).padStart(2, "0")}`;
      const wk = weekStartOf(week);
      const best = tableBest(wk, tier);
      const win = weekTable(
        wk,
        tier,
        Math.ceil(LEAGUES[tier]!.rivalBase * RIVAL_SPREAD[1]) + 1,
        "final",
      );
      if (!win[0]!.player) always = false;
      const none = weekTable(wk, tier, 0, "final");
      if (!none[none.length - 1]!.player || best < 0) never = false;
    }
  assert(
    always,
    "E1: a little more than the best a rival can earn always finishes first (promotion is never impossible)",
  );
  assert(never, "E2: a player with nothing finishes last");
  const typical = Math.round(LEAGUES[0]!.rivalBase);
  assert(
    weekTable(WEEK, 0, typical, "final").findIndex((r) => r.player) + 1 <= 6,
    "E3: a week at the league's own scale lands in the upper half",
  );
}

console.log("F. The view");
{
  assert(leagueView(DEFAULT_CHEF_RECORD, MON, lvl - 1) === null, "F1: nothing before Level 10");
  const v = leagueView(DEFAULT_CHEF_RECORD, "2026-11-26", lvl)!;
  assert(
    v.league.tier === 0 &&
      v.next?.name === "Silver" &&
      v.points === 0 &&
      v.table.length === LEAGUE_SIZE,
    "F2: a new player is in Bronze, Silver is next",
  );
  assert(
    v.rank > PROMOTION_RANK && (v.toPromotion ?? 0) >= 1,
    "F3: outside the top three, the points to reach it are named",
    v.toPromotion,
  );
  const ahead = leagueView(
    rec({ week: WEEK, tier: 0, points: 5000, last: null }),
    "2026-11-26",
    lvl,
  )!;
  assert(
    ahead.rank === 1 && ahead.toPromotion === null,
    "F4: inside the top three there is nothing more to reach",
  );
  const reach = leagueView(
    rec({ week: WEEK, tier: 0, points: v.toPromotion! > 0 ? 0 : 0, last: null }),
    "2026-11-26",
    lvl,
  )!;
  const need = reach.toPromotion!;
  const made = leagueView(
    rec({ week: WEEK, tier: 0, points: need, last: null }),
    "2026-11-26",
    lvl,
  )!;
  assert(
    made.rank <= PROMOTION_RANK,
    "F5: earning the named points does put the player in the top three",
    [need, made.rank],
  );
  assert(
    leagueView(rec({ week: WEEK, tier: 4, points: 0, last: null }), "2026-11-26", lvl)!.next ===
      null,
    "F6: Diamond has no league above",
  );
  const stale = leagueView(
    rec({ week: "2026-11-02", tier: 1, points: 90, last: null }),
    "2026-11-26",
    lvl,
  )!;
  assert(
    stale.points === 0 && stale.league.tier >= 1,
    "F7: an old week's points are not this week's",
  );
}

console.log("G. Pure and honest");
{
  const src = code("src/game/restaurant/cityLeague.ts");
  assert(
    !/credits|appendLedgerEntry|economyLedger|Math\.random|Date\.now|new Date\(\)|performance\.now|window\.|localStorage|fetch\(/.test(
      src,
    ),
    "G1: no wallet, ledger, clock, random or storage in the rule file",
  );
  assert(!/cityLeague/.test(code("src/game/SaveManager.ts")), "G2: no save field of its own");
  const bad = clampChefRecord({ league: { week: "last week", tier: 2, points: 5, last: null } });
  const big = clampChefRecord({
    league: {
      week: WEEK,
      tier: 99,
      points: -4,
      last: { week: WEEK, tier: 99, rank: 99, points: 1, promoted: true, shown: 1 },
    },
  });
  assert(
    bad.league === null &&
      big.league?.tier === 4 &&
      big.league.points === 0 &&
      big.league.last?.rank === 10 &&
      big.league.last.shown === false,
    "G3: a damaged league state is dropped or clamped",
  );
  const cr = code("src/components/kc/CityRanking.tsx");
  assert(
    /The city's restaurants compete each week\. Nobody drops down a league\./.test(cr),
    "G4: the card says it is the city's restaurants and that nobody drops down",
  );
  assert(
    JSON.stringify(
      Object.keys({
        ...DEFAULT_SAVE,
        business: {
          ...DEFAULT_SAVE.business,
          chefRecord: addLeaguePoints(DEFAULT_CHEF_RECORD, MON, lvl, 9),
        },
      }),
    ) === JSON.stringify(Object.keys(DEFAULT_SAVE)),
    "G5: no new top-level save field",
  );
  const c = leagueCelebration({
    league: "Bronze",
    identity: "Apprentice Chef",
    nowLeague: "Silver",
    nowIdentity: "Skilled Chef",
    rank: 2,
    size: 10,
    points: 140,
    promoted: true,
    rival: { name: "X", line: "Chef Dario: “Next week I'm not going easy.”" },
  });
  const calm = leagueCelebration({
    league: "Gold",
    identity: "Master Chef",
    nowLeague: "Gold",
    nowIdentity: "Master Chef",
    rank: 8,
    size: 10,
    points: 60,
    promoted: false,
  });
  assert(
    c.kind === "league" && c.title === "Promoted to Silver League!" && c.lines.length === 3,
    "G6: a promotion is a celebration with the league, the place and the rival's line",
    c,
  );
  assert(
    calm.title === "Week finished #8 of 10" &&
      calm.pose === "clap" &&
      !/drop|demot|relegat|lost/i.test(calm.lines.join(" ") + calm.paige),
    "G7: any other finish is calm, never a penalty",
  );
}

console.log("H. Wiring");
{
  const app = code("src/App.tsx");
  assert(
    /addLeaguePoints\(\s*rec,/.test(app) && /pointsForPlate\(run\)/.test(app),
    "H1: a finished plate earns league points in the same save as its result",
  );
  assert(
    /pointsForService\(\{ spotless: spotlessStreak > 0 \}\)/.test(app),
    "H2: a finished service earns league points (more when spotless)",
  );
  assert(
    /settleLeague\(rec, dailyKeyFor\(new Date\(\)\)\)/.test(app) &&
      /pendingLeagueResult\(rec\)/.test(app) &&
      /markLeagueShown\(rec\)/.test(app),
    "H3: the Kitchen settles an ended week and tells the result once",
  );
  assert(/sendAnalyticsEvent\("league_week_end"/.test(app), "H4: the week's end is measured");
  assert(
    /<LeagueCard save=\{save\} \/>/.test(code("src/components/kc/RestaurantProgress.tsx")) &&
      /data-testid="league-card"/.test(cr0()),
    "H5: Restaurant Progress shows the league card",
  );
}
function cr0() {
  return code("src/components/kc/CityRanking.tsx");
}

console.log(failures === 0 ? "\nCITY LEAGUE QA: ALL PASS" : `\nCITY LEAGUE QA: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
