/**
 * SERVICE QUALITY QA (Phase 8C + 8D, developer 2026-11-01):
 *   Q. The star report of a service (restaurant/serviceQuality.ts):
 *      - stars 1..5 from the visible parts (dishes, waits, clean); a part a service did not have is left out;
 *      - kept as the last 7 in restaurantDay.serviceResults (optional, old saves read, garbage clamps), a service
 *        is reported once, a new day keeps the list;
 *      - the day's popularity nudge is ±1 and 0 without results, the popularity breakdown still adds up;
 *      - it never touches money: no tip, price or pay reads it, the module has no wallet or ledger;
 *      - the closing card lines and the tip for next time; the App wiring (dine-in only, analytics name);
 *      - the Pace card reads the next service's guests and the last stars (restaurant/guestReport.ts).
 *
 * Run: npx tsx scripts/service-quality-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => void Object.keys(store).forEach((k) => delete store[k]),
  key: () => null,
  length: 0,
} as Storage;

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const Q = await import("../src/game/restaurant/serviceQuality.ts");
const { openDay, recordService, closeDay, restaurantDayOf } =
  await import("../src/game/restaurant/restaurantDay.ts");
const { endOfDayPopularity } = await import("../src/game/business/PopularityManager.ts");
const { qualityFor } = await import("../src/game/CutEvaluator.ts");
const GR = await import("../src/game/restaurant/guestReport.ts");

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const perfect = {
  scores: [97, 96],
  walkedOut: 0,
  waitsMs: [10_000, 20_000],
  patienceMs: 100_000,
  spotless: true as boolean | null,
};

// ── the rating ───────────────────────────────────────────────────────────
{
  const r = Q.rateService(perfect)!;
  check(
    "Q1 every part won: 5 stars (dishes 2, waits 1, clean 1) and the average wait in seconds",
    r.stars === 5 && r.dishes === 2 && r.waits === 1 && r.clean === 1 && r.avgWaitSec === 15,
    r,
  );
  const worst = Q.rateService({
    scores: [40],
    walkedOut: 2,
    waitsMs: [90_000],
    patienceMs: 100_000,
    spotless: false,
  })!;
  check(
    "Q2 nothing won: 1 star, never 0; a walk-out or a long wait loses the waits part",
    worst.stars === 1 && worst.dishes === 0 && worst.waits === 0 && worst.clean === 0,
    worst,
  );
  const slow = Q.rateService({ ...perfect, waitsMs: [60_000] })!;
  const left = Q.rateService({ ...perfect, walkedOut: 1 })!;
  check(
    "Q3 waits: under half the patience and nobody left = 1; slower, or a walk-out = 0",
    slow.waits === 0 && left.waits === 0 && Q.rateService(perfect)!.waits === 1,
  );
  const noClock = Q.rateService({ ...perfect, patienceMs: null, waitsMs: [] })!;
  const noClean = Q.rateService({ ...perfect, spotless: null })!;
  const noDishes = Q.rateService({ ...perfect, scores: [] })!;
  check(
    "Q4 a part the service did not have is left out, not counted as lost: perfect plates without a queue clock or a hygiene verdict are still 5 stars",
    noClock.waits === null &&
      noClock.avgWaitSec === null &&
      noClock.stars === 5 &&
      noClean.clean === null &&
      noClean.stars === 5 &&
      noDishes.dishes === null &&
      noDishes.stars === 5,
  );
  check(
    "Q5 no part to judge: no report at all",
    Q.rateService({ scores: [], walkedOut: 0, waitsMs: [], patienceMs: null, spotless: null }) ===
      null,
  );
  const stars = new Set<number>();
  for (const score of [20, 80, 90, 99])
    for (const walkedOut of [0, 1])
      for (const spotless of [true, false, null])
        for (const wait of [5_000, 80_000]) {
          const r = Q.rateService({
            scores: [score],
            walkedOut,
            waitsMs: [wait],
            patienceMs: 100_000,
            spotless,
          })!;
          stars.add(r.stars);
        }
  check(
    "Q6 stars are always whole numbers 1..5, and every one of them can be earned",
    [...stars].every((n) => Number.isInteger(n) && n >= 1 && n <= 5) && stars.size === 5,
    [...stars].sort(),
  );
  check(
    "Q7 the dishes part uses the game's own grades: 95 Masterful = 2, 85 Clean = 1, below = 0",
    Q.dishPoints(95) === 2 &&
      Q.dishPoints(94.9) === 1 &&
      Q.dishPoints(85) === 1 &&
      Q.dishPoints(84.9) === 0 &&
      qualityFor(95) === "Masterful" &&
      qualityFor(85) === "Clean",
  );
}

// ── kept in the day state ────────────────────────────────────────────────
const result = (
  level: number,
  stars = 4,
): import("../src/game/restaurant/serviceQuality.ts").ServiceResult => ({
  level,
  stars,
  dishes: 2,
  waits: 1,
  clean: 1,
  covers: 5,
  walkedOut: 0,
  turnedAway: 0,
  avgWaitSec: 12,
});
const dayOpen = (n: number): SaveData => openDay(structuredClone(DEFAULT_SAVE), n);
{
  check(
    "Q8 an old save has no results",
    Q.serviceResultsOf(structuredClone(DEFAULT_SAVE)).length === 0,
  );
  let s = dayOpen(40);
  for (let n = 40; n < 50; n++) s = Q.withRecordedResult(s, result(n));
  const kept = Q.serviceResultsOf(s);
  check(
    "Q9 the last 7 are kept, oldest first",
    kept.length === Q.RESULTS_KEPT && kept[0]!.level === 43 && kept.at(-1)!.level === 49,
    kept.map((r) => r.level),
  );
  const again = Q.withRecordedResult(s, result(49, 2));
  check(
    "Q10 a service is reported once: a second report of the same service replaces the first",
    Q.serviceResultsOf(again).length === Q.RESULTS_KEPT &&
      Q.serviceResultsOf(again).filter((r) => r.level === 49).length === 1 &&
      Q.serviceResultsOf(again).at(-1)!.stars === 2,
  );
  const messy = structuredClone(dayOpen(40));
  (messy.business.restaurantDay as unknown as { serviceResults: unknown }).serviceResults = [
    null,
    "x",
    { level: 3, stars: 99, dishes: 7, waits: -2, clean: "no", covers: -4, avgWaitSec: "z" },
    { level: 0, stars: 3 },
  ];
  const got = Q.serviceResultsOf(messy);
  check(
    "Q11 garbage in a save is clamped, never thrown: stars 1..5, parts inside their range, unusable rows dropped",
    got.length === 1 &&
      got[0]!.stars === 5 &&
      got[0]!.dishes === 2 &&
      got[0]!.waits === 0 &&
      got[0]!.clean === null &&
      got[0]!.covers === 0 &&
      got[0]!.avgWaitSec === null,
    got,
  );
  check(
    "Q12 no day state, no write: recording on a save without a restaurant day changes nothing",
    Q.withRecordedResult(
      {
        ...DEFAULT_SAVE,
        business: { ...DEFAULT_SAVE.business, restaurantDay: undefined },
      } as SaveData,
      result(3),
    ).business.restaurantDay === undefined,
  );
}
{
  // A day that closes keeps the list; the next day's own results are told by its opening level.
  let s = dayOpen(5);
  s = Q.withRecordedResult(s, result(5, 5));
  for (let i = 0; i < 3; i++) s = recordService(s, 5 + i);
  const due = restaurantDayOf(s).closingDue;
  const closed = closeDay(s, 5);
  check(
    "Q13 closing the day keeps the kept results, and a new day starts with none of its own",
    due &&
      Q.serviceResultsOf(closed).length === 1 &&
      Q.dayResults(closed).length === 0 &&
      restaurantDayOf(closed).day === restaurantDayOf(s).day + 1,
  );
}

// ── popularity ───────────────────────────────────────────────────────────
{
  const withStars = (avgStars: number[]) => {
    let s = dayOpen(40);
    avgStars.forEach((st, i) => (s = Q.withRecordedResult(s, result(40 + i, st))));
    return s;
  };
  const good = withStars([4, 5]);
  const bad = withStars([2, 1]);
  const mid = withStars([3, 3]);
  const none = dayOpen(40);
  check(
    "Q14 the day's popularity nudge: +1 averaging 4+, −1 averaging 2 or less, 0 between and 0 without results",
    Q.serviceQualityDelta(good) === 1 &&
      Q.serviceQualityDelta(bad) === -1 &&
      Q.serviceQualityDelta(mid) === 0 &&
      Q.serviceQualityDelta(none) === 0,
  );
  const a = endOfDayPopularity(none, "PASS", 3).breakdown;
  const g = endOfDayPopularity(good, "PASS", 3).breakdown;
  const b = endOfDayPopularity(bad, "PASS", 3).breakdown;
  check(
    "Q15 the popularity breakdown still adds up, the service term moves by exactly the nudge, a save without results is unchanged (+3)",
    a.service === 3 &&
      g.service === 4 &&
      b.service === 2 &&
      [a, g, b].every((x) => x.total === x.operations + x.inspection + x.service + x.pull),
    { a: a.service, g: g.service, b: b.service },
  );
  // Results of an earlier day (a lower service number than today's opening) do not count today.
  let old = dayOpen(40);
  old = Q.withRecordedResult(old, result(30, 5));
  check(
    "Q16 only today's services count for today's nudge",
    Q.dayResults(old).length === 0 && Q.serviceQualityDelta(old) === 0,
  );
}

// ── never money ──────────────────────────────────────────────────────────
{
  const mod = code("src/game/restaurant/serviceQuality.ts");
  const readers = [
    "src/game/economy/customerTips.ts",
    "src/game/economy/EconomySettlement.ts",
    "src/game/business/BusinessServiceManager.ts",
    "src/game/economy/wallet.ts",
  ].filter((p) => fs.existsSync(path.join(process.cwd(), p)));
  check(
    "Q17 never money: the module has no wallet, ledger, save write or random, and no tip, settlement, payment or wallet module reads it",
    !/EconomyLedger|economy\/wallet|debitWallet|appendLedgerEntry|Math\.random|SaveManager\./.test(
      mod,
    ) &&
      readers.length >= 3 &&
      readers.every((p) => !/serviceQuality|serviceResult/.test(read(p))),
    readers,
  );
}

// ── the card ─────────────────────────────────────────────────────────────
{
  const lines = Q.serviceResultLines({ ...result(50, 3), clean: 0, walkedOut: 2, turnedAway: 1 });
  const first = lines[0]!;
  check(
    "Q18 the closing card: stars, the three parts ticked, then the numbers, then one tip",
    first.includes("★★★☆☆") &&
      first.includes("Dishes ✓") &&
      first.includes("Clean ✗") &&
      lines[1]!.includes("5 served") &&
      lines[1]!.includes("2 left") &&
      lines[1]!.includes("1 turned away") &&
      lines.length === 3 &&
      lines[2]!.startsWith("💡"),
    lines,
  );
  const tips = [
    Q.serviceTip({ ...result(1), walkedOut: 1, turnedAway: 2, clean: 0 }),
    Q.serviceTip({ ...result(1), turnedAway: 2, clean: 0 }),
    Q.serviceTip({ ...result(1), clean: 0 }),
    Q.serviceTip({ ...result(1), dishes: 1 }),
    Q.serviceTip(result(1)),
  ];
  check(
    "Q19 the tip is the one thing that cost the most: walk-outs, then turned away, then not spotless, then the grade, else none",
    /left the queue/.test(tips[0]!) &&
      /turned away/.test(tips[1]!) &&
      /spotless/.test(tips[2]!) &&
      /Masterful/.test(tips[3]!) &&
      tips[4] === null,
    tips,
  );
  check("Q20 stars as text", Q.starsText(4) === "★★★★☆" && Q.starsText(1) === "★☆☆☆☆");
}

// ── wiring ───────────────────────────────────────────────────────────────
{
  const app = read("src/App.tsx");
  const i = app.indexOf("function completeCampaignLevel");
  const body = app.slice(i, i + 9000);
  check(
    "Q21 App: the report is made at a first completion, from dine-in only, kept with the day, shown on the closing card, sent as `service_report`",
    /isSystemLive\("dine-in", n\)/.test(body) &&
      /rateService\(/.test(body) &&
      /withRecordedResult\(/.test(body) &&
      /serviceResultLines\(/.test(body) &&
      /sendAnalyticsEvent\("service_report"/.test(body) &&
      /walked_out/.test(body) &&
      /turned_away/.test(body),
  );
  check(
    "Q22 App: a served plate's score is noted for the report (campaign orders and menu guests), never for a replay",
    /noteServedScore\(campaignServiceSession\.levelId, order\.preparationScore, isReplay\)/.test(
      app,
    ) &&
      /noteServedScore\(level\.id, session\.current\?\.order\.preparationScore, false\)/.test(app),
  );
  const pace = read("src/components/kc/business/PaceCard.tsx");
  check(
    "Q23 the Pace card shows the next service's guests and the last stars",
    /nextServiceGuests/.test(pace) && /lastServiceResult/.test(pace) && /pace-guests/.test(pace),
  );
}
{
  const early = structuredClone(DEFAULT_SAVE);
  check(
    "Q24 before the menu opens there are no guests to tell about",
    GR.nextServiceGuests(early) === null,
  );
  const late: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    levelProgress: {
      currentLevelId: "level-90",
      highestUnlockedLevelId: "level-90",
      completedLevelIds: Array.from({ length: 89 }, (_, i) => `level-${i + 1}`),
    },
  };
  const g = GR.nextServiceGuests(late)!;
  check(
    "Q25 the Pace card's numbers add up: timetable + seats + pull parts; chips only for parts that pull",
    !!g &&
      g.level === 90 &&
      g.served <= g.base + g.seats + g.pull.total + 1 &&
      GR.pullChips(g.pull).length ===
        [g.pull.reputation, g.pull.menu, g.pull.hour, g.pull.spotless].filter((x) => x > 0)
          .length &&
      GR.lastServiceResult(late) === null,
    g,
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
