/**
 * CHEF TITLES QA (the "Chef Pride" plan, Phase 3a, developer 2026-11-23: "what kind of chef am I?").
 *
 *  A  the cast: six identities, four tiers each, strictly rising targets, every title name unique, achievement ids `ach-chef-<identity>-<target>`;
 *  B  the tier maths: the exact thresholds, progress towards the next tier, a full identity;
 *  C  the title worn: none before the first tier, the highest tier earned, a tie goes to the first identity; the one to chase is the closest;
 *  D  announcing: every earned tier is announced ONCE (a marker in chefRecord.seen), the headline is the best new one, an old save that earned several is told about
 *     one and all are marked, and a second call says nothing;
 *  E  the achievements: the titles list as BADGE-ONLY achievements (reward 0): no money to collect, the economy untouched;
 *  F  the Speed counter: a Clean-or-better plate under 30 s counts, a slow, weak or too-short plate does not;
 *  G  pure and honest: no wallet, ledger, clock or random in the rule file, no new top-level save field, no population claim in the copy;
 *  H  wiring: the Progress card, the Kitchen chip on a tall window, the celebration and the announcement at the end of a service.
 *
 * Run: npx tsx scripts/chef-titles-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  CHEF_IDENTITIES,
  CHEF_TITLES_FROM_LEVEL,
  announceTitles,
  chefTitleStatus,
  identityProgressText,
  identityStatus,
  LEGEND_STARS,
  tierEarned,
  leadingTitle,
  nextTitleGoal,
  titleAchievementId,
  titleSeenId,
  unseenTitles,
} from "../src/game/progression/chefTitles.ts";
import { DEFAULT_RESTAURANT_RECORD } from "../src/game/restaurant/serviceReport.ts";
import {
  QUICK_MS,
  chefRecordOf,
  recordRun,
  DEFAULT_CHEF_RECORD,
} from "../src/game/restaurant/chefRecord.ts";
import { achievementsFor, collectableTotal } from "../src/game/progression/achievements.ts";
import { celebrationFor } from "../src/game/restaurant/celebrations.ts";

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
const withRecord = (
  r: Partial<ReturnType<typeof chefRecordOf>>,
  base: SaveData = DEFAULT_SAVE,
): SaveData => ({
  ...base,
  business: { ...base.business, chefRecord: { ...DEFAULT_CHEF_RECORD, ...r } },
});
const id = (n: string) => CHEF_IDENTITIES.find((i) => i.id === n)!;
// RULE CHANGE (developer 2026-11-23, audit Batch 4): a title tier needs its identity's SECOND requirement as well as its main value (Precision: plates of 95%+, Cleanliness:
// best streak, Customer Favourite: tips, Restaurateur's top tier: Endless stars), and Speed is the fastest plate (fastestMs), not a count of quick plates. The tests below that
// are about the MAIN value keep asserting exactly what they did, on saves that already meet the second requirement (`RICH`); section I tests each second requirement and each
// boundary on its own.
const RICH = { masterful: 9999 };
const withTips = (base: SaveData, cents: number): SaveData => ({
  ...base,
  economy: { ...base.economy, lifetime: { ...base.economy.lifetime, "customer-tip": cents } },
});

console.log("A. The cast");
{
  assert(CHEF_IDENTITIES.length === 6, "A1: six identities");
  assert(
    CHEF_IDENTITIES.every((i) => i.tiers.length === 4),
    "A2: four tiers each",
  );
  assert(
    CHEF_IDENTITIES.every((i) =>
      i.tiers.every((t, k) => k === 0 || t.target > i.tiers[k - 1]!.target),
    ),
    "A3: the targets rise strictly",
  );
  const names = CHEF_IDENTITIES.flatMap((i) => i.tiers.map((t) => t.title));
  assert(
    new Set(names).size === names.length && names.length === 24,
    "A4: 24 different title names",
  );
  assert(new Set(CHEF_IDENTITIES.map((i) => i.id)).size === 6, "A5: identity ids are unique");
  assert(
    titleAchievementId("precision", 25) === "ach-chef-precision-25",
    "A6: achievement id shape",
  );
  assert(
    names.every((n) => n.length <= 24 && !/\d/.test(n)),
    "A7: short names with no digits",
  );
  assert(
    CHEF_IDENTITIES.every((i) =>
      i.tiers.every((t) => i.describe(t.target).split(/\s+/).length <= 14),
    ),
    "A8: each description is at most 14 words (the copy rule)",
  );
}

console.log("B. Tier maths");
{
  const p = id("precision");
  const at = (n: number) => identityStatus(withRecord({ perfectCuts: n, ...RICH }), p);
  assert(
    at(0).tier === 0 && at(0).title === null && at(0).next?.target === 25,
    "B1: nothing earned at 0",
  );
  assert(
    at(24).tier === 0 && at(25).tier === 1 && at(25).title === "Steady Hand",
    "B2: 25 perfect cuts is the first tier",
  );
  assert(
    at(99).tier === 1 && at(100).tier === 2 && at(100).title === "Precision Chef",
    "B3: 100 is the second",
  );
  assert(
    at(300).tier === 3 && at(800).tier === 4 && at(800).title === "Knife Legend",
    "B4: 300 and 800",
  );
  assert(
    at(5000).tier === 4 && at(5000).next === null && at(5000).fraction === 1,
    "B5: a full identity has no next tier",
  );
  const half = at(62);
  assert(
    half.fraction > 0.45 && half.fraction < 0.55,
    "B6: progress is measured from the tier before (62 is half way from 25 to 100)",
    half.fraction,
  );
  const fav = identityStatus(
    withTips(
      {
        ...DEFAULT_SAVE,
        business: {
          ...DEFAULT_SAVE.business,
          popularity: { ...DEFAULT_SAVE.business.popularity, score: 80 },
        },
      },
      10_000_00,
    ),
    id("favourite"),
  );
  assert(
    fav.tier === 2 && fav.title === "Crowd Pleaser",
    "B7: popularity 80 is the second Customer Favourite tier",
    fav,
  );
}

console.log("C. The title worn and the one to chase");
{
  assert(leadingTitle(DEFAULT_SAVE) === null, "C1: no title on a fresh save");
  const s1 = withRecord({ perfectCuts: 30, ...RICH });
  assert(leadingTitle(s1)?.title === "Steady Hand", "C2: the one earned is worn");
  const s2 = withRecord({ perfectCuts: 120, fastestMs: 50_000, ...RICH });
  assert(
    leadingTitle(s2)?.title === "Precision Chef",
    "C3: the highest tier wins (Precision 2 over Speed 1)",
    leadingTitle(s2),
  );
  const s3 = withRecord({ perfectCuts: 30, fastestMs: 50_000, ...RICH });
  assert(
    leadingTitle(s3)?.identity.id === "precision",
    "C4: a tie goes to the identity listed first",
  );
  const goal = nextTitleGoal(withRecord({ perfectCuts: 20, fastestMs: 85_000, ...RICH }));
  assert(
    goal?.identity.id === "precision",
    "C5: the title to chase is the closest to its next tier (20 of 25 beats 2 of 10)",
    goal?.identity.id,
  );
  assert(
    nextTitleGoal(DEFAULT_SAVE) !== null,
    "C6: there is always something to chase on a fresh save",
  );
  const all = chefTitleStatus(DEFAULT_SAVE);
  assert(
    all.length === 6 &&
      all.every(
        (s) => s.tier === 0 || s.identity.id === "restaurateur" || s.identity.id === "favourite",
      ),
    "C7: a fresh save has no kitchen title",
    all.map((s) => `${s.identity.id}:${s.tier}`),
  );
  assert(
    CHEF_TITLES_FROM_LEVEL >= 2 && CHEF_TITLES_FROM_LEVEL <= 5,
    "C8: the card opens in the first levels",
  );
}

console.log("D. Announcing");
{
  const s = withRecord({ perfectCuts: 120, fastestMs: 50_000, ...RICH }); // Precision 2 tiers, Speed 1 tier
  const fresh = unseenTitles(s);
  assert(
    fresh.length === 3,
    "D1: three tiers are earned and unannounced",
    fresh.map((f) => f.title),
  );
  const a = announceTitles(s);
  assert(
    a.headline?.title === "Precision Chef" && a.headline.tier === 2,
    "D2: the headline is the highest new tier",
    a.headline,
  );
  assert(unseenTitles(a.save).length === 0, "D3: every earned tier is marked as seen");
  assert(
    announceTitles(a.save).headline === null && announceTitles(a.save).save === a.save,
    "D4: a second call says nothing and returns the same save",
  );
  assert(
    chefRecordOf(a.save).seen.includes(titleSeenId("precision", 100)),
    "D5: the marker is in chefRecord.seen",
  );
  const later = withRecord({ ...chefRecordOf(a.save), perfectCuts: 300, ...RICH }, a.save);
  const b = announceTitles(later);
  assert(
    b.headline?.title === "Master of the Edge" && unseenTitles(b.save).length === 0,
    "D6: a new tier is announced when it is earned",
    b.headline,
  );
  assert(announceTitles(DEFAULT_SAVE).headline === null, "D7: nothing earned, nothing announced");
}

console.log("E. Badge-only achievements");
{
  const rich = withRecord({ perfectCuts: 900, fastestMs: 10_000, ...RICH });
  const chef = achievementsFor(rich).filter((a) => a.id.startsWith("ach-chef-"));
  assert(chef.length === 24, "E1: 24 title achievements", chef.length);
  assert(
    chef.every((a) => a.reward === 0 && !a.automatic),
    "E2: every one is a badge (reward 0), never automatic",
  );
  assert(
    chef.find((a) => a.id === "ach-chef-precision-800")?.reached === true &&
      chef.find((a) => a.id === "ach-chef-speed-75")?.reached === true,
    "E3: earned tiers read as reached",
  );
  assert(
    collectableTotal(rich) === collectableTotal(DEFAULT_SAVE),
    "E4: earning titles adds nothing to collect (the economy does not move)",
  );
  assert(
    chef.find((a) => a.id === "ach-chef-precision-25")?.title === "Steady Hand",
    "E5: the achievement carries the tier's title",
  );
}

console.log("F. The Speed counter");
{
  const run = (score: number, ms: number, cuts = 12) => ({
    score,
    perfects: 0,
    bestCombo: 0,
    cuts,
    ms,
  });
  const q = (r: ReturnType<typeof run>) => recordRun(DEFAULT_CHEF_RECORD, r).quickClean;
  assert(q(run(90, 20000)) === 1, "F1: a Clean plate in 20 s is a quick plate");
  assert(q(run(84, 20000)) === 0, "F2: a plate under Clean is not");
  assert(
    q(run(95, QUICK_MS)) === 0 && q(run(95, QUICK_MS - 1)) === 1,
    "F3: the line is 30 seconds",
  );
  assert(
    q(run(95, 2000)) === 0 && q(run(95, 0)) === 0 && q(run(95, 20000, 1)) === 0,
    "F4: a too-short plate, an unknown time or one cut never counts",
  );
}

console.log("I. The identities' own inputs (audit Batch 4, developer 2026-11-23)");
{
  const status = (save: SaveData, name: string) => identityStatus(save, id(name));
  const tierOf = (save: SaveData, name: string) => status(save, name).tier;

  // I1 Precision: perfect cuts AND plates of 95% or better (chefRecord.masterful)
  const prec = (cuts: number, plates: number) =>
    tierOf(withRecord({ perfectCuts: cuts, masterful: plates }), "precision");
  assert(
    prec(25, 2) === 0 && prec(25, 3) === 1 && prec(24, 99) === 0,
    "I1a: Steady Hand needs 25 perfect cuts AND 3 plates of 95%+ (either alone is not enough)",
  );
  assert(
    prec(100, 9) === 1 && prec(100, 10) === 2 && prec(300, 29) === 2 && prec(300, 30) === 3,
    "I1b: the 95% plates rise with the tiers (10, 30)",
  );
  assert(
    prec(800, 99) === 3 && prec(800, 100) === 4 && prec(799, 100) === 3,
    "I1c: Knife Legend needs 800 perfect cuts AND 100 plates of 95%+ (boundaries 99/100 and 799/800)",
  );
  assert(
    /plates of 95%\+ 2 of 3/.test(
      identityProgressText(
        withRecord({ perfectCuts: 30, masterful: 2 }),
        status(withRecord({ perfectCuts: 30, masterful: 2 }), "precision"),
      ),
    ),
    "I1d: the card says which one is missing ('plates of 95%+ 2 of 3')",
  );

  // I2 Speed: the fastest fair plate (fastestMs), not quick-clean plates
  const spd = (ms: number, quick = 0) =>
    tierOf(withRecord({ fastestMs: ms, quickClean: quick }), "speed");
  assert(
    spd(0) === 0 && spd(0, 9999) === 0,
    "I2a: no fast plate yet earns nothing, whatever the quick-clean counter says",
  );
  assert(
    spd(60_000) === 0 && spd(59_999) === 1 && spd(40_000) === 1 && spd(39_999) === 2,
    "I2b: 'under 60 s' and 'under 40 s' are strict at the millisecond",
  );
  assert(
    spd(25_000) === 2 && spd(24_999) === 3 && spd(15_000) === 3 && spd(14_999) === 4,
    "I2c: 'under 25 s' and 'under 15 s' are strict at the millisecond",
  );
  assert(
    spd(Number.NaN) === 0 && spd(-5) === 0 && spd(Number.POSITIVE_INFINITY) === 0,
    "I2d: an invalid time earns nothing",
  );
  assert(
    /Fastest plate 34 s, goal under 25 s/.test(
      identityProgressText(
        withRecord({ fastestMs: 34_000 }),
        status(withRecord({ fastestMs: 34_000 }), "speed"),
      ).replace(/^Fastest plate 34 s, goal under 40 s/, "x") || "",
    ) ||
      /Fastest plate 34 s, goal under 25 s/.test(
        identityProgressText(
          withRecord({ fastestMs: 34_000 }),
          status(withRecord({ fastestMs: 34_000 }), "speed"),
        ),
      ),
    "I2e: the card reads the plate time and the goal in seconds",
  );
  assert(
    id("speed").describe(id("speed").tiers[0]!.target) === "Finish a plate in under 60 seconds.",
    "I2f: the achievement says 'a plate under N seconds'",
  );

  // I3 Cleanliness: spotless services AND the best streak
  const withClean = (spotless: number, bestStreak: number): SaveData => ({
    ...DEFAULT_SAVE,
    business: {
      ...DEFAULT_SAVE.business,
      restaurantRecord: { ...DEFAULT_RESTAURANT_RECORD, spotless, streak: 0, bestStreak },
    },
  });
  assert(
    tierOf(withClean(5, 1), "cleanliness") === 0 &&
      tierOf(withClean(5, 2), "cleanliness") === 1 &&
      tierOf(withClean(4, 99), "cleanliness") === 0,
    "I3a: Clean Counter needs 5 spotless services AND a best streak of 2",
  );
  assert(
    tierOf(withClean(150, 19), "cleanliness") === 3 &&
      tierOf(withClean(150, 20), "cleanliness") === 4,
    "I3b: Sparkle Legend needs 150 spotless services AND a best streak of 20 (19 is not enough)",
  );

  // I4 Customer Favourite: popularity AND lifetime tips
  const fav = (score: number, dollars: number): SaveData =>
    withTips(
      {
        ...DEFAULT_SAVE,
        business: {
          ...DEFAULT_SAVE.business,
          popularity: { ...DEFAULT_SAVE.business.popularity, score },
        },
      },
      Math.round(dollars * 100),
    );
  assert(
    tierOf(fav(65, 24.99), "favourite") === 0 &&
      tierOf(fav(65, 25), "favourite") === 1 &&
      tierOf(fav(64, 9999), "favourite") === 0,
    "I4a: Local Favourite needs popularity 65 AND $25 in tips (boundaries $24.99 / $25.00)",
  );
  assert(
    tierOf(fav(100, 1199.99), "favourite") === 3 && tierOf(fav(100, 1200), "favourite") === 4,
    "I4b: Beloved needs popularity 100 AND $1,200 in tips",
  );
  assert(
    tierOf(DEFAULT_SAVE, "favourite") === 0,
    "I4c: a fresh save (no tips recorded) earns nothing",
  );

  // I5 Restaurateur: the top tier ALSO needs Endless stars
  const stars = (total: number): SaveData => ({
    ...DEFAULT_SAVE,
    business: { ...DEFAULT_SAVE.business, endlessStars: { total, days: 10, bestDay: 3 } },
  });
  const top = id("restaurateur").tiers[3]!;
  assert(
    top.title === "Legendary Restaurateur" && top.target === 49 && top.also?.need === LEGEND_STARS,
    "I5a: Legendary Restaurateur is #1 of 50 AND the Endless stars goal",
  );
  assert(
    !tierEarned(stars(LEGEND_STARS - 1), 49, top) &&
      tierEarned(stars(LEGEND_STARS), 49, top) &&
      !tierEarned(stars(999), 48, top),
    "I5b: 29 stars is not enough, 30 is; the stars cannot replace the rank",
  );
  assert(
    tierEarned(DEFAULT_SAVE, 47, id("restaurateur").tiers[2]!),
    "I5c: the lower Restaurateur tiers need no stars (Executive Chef at 47 places)",
  );

  // I6 achievements and old saves
  const achs = (save: SaveData) =>
    achievementsFor(save).filter((a) => a.id.startsWith("ach-chef-"));
  const noMasterful = achs(withRecord({ perfectCuts: 25, masterful: 2 }));
  const withMasterful = achs(withRecord({ perfectCuts: 25, masterful: 3 }));
  assert(
    noMasterful.find((a) => a.id === "ach-chef-precision-25")?.reached === false &&
      withMasterful.find((a) => a.id === "ach-chef-precision-25")?.reached === true &&
      /plates of 95%\+ 2 \/ 3/.test(
        noMasterful.find((a) => a.id === "ach-chef-precision-25")?.note ?? "",
      ),
    "I6a: the badge needs both numbers and its note says which is missing",
  );
  assert(
    achs(DEFAULT_SAVE).length === 24 && achs(DEFAULT_SAVE).every((a) => a.reward === 0),
    "I6b: still 24 badge-only title achievements",
  );
  const oldSave = {
    ...DEFAULT_SAVE,
    economy: undefined,
    business: {
      ...DEFAULT_SAVE.business,
      endlessStars: undefined,
      restaurantRecord: undefined,
      chefRecord: undefined,
    },
  } as unknown as SaveData;
  let threw = false;
  try {
    chefTitleStatus(oldSave);
    achs(oldSave);
  } catch {
    threw = true;
  }
  assert(
    !threw,
    "I6c: an old save with no economy lifetime, Endless stars, restaurant record or chef record never throws",
  );
  // tiers count in order: a later tier does not count while an earlier one is not earned
  assert(
    tierOf(withClean(150, 1), "cleanliness") === 0,
    "I6d: tiers are earned in order (a huge count with no streak is still tier 0)",
  );
}

console.log("J. Where the inputs come from, and the InfoTips (audit Batch 4)");
{
  const src = code("src/game/progression/chefTitles.ts");
  assert(
    !/quickClean/.test(src) && /chefRecordOf\(s\)\.fastestMs/.test(src),
    "J1: Speed reads the fastest plate (fastestMs), not the quick-clean counter",
  );
  assert(
    /chefRecordOf\(s\)\.masterful/.test(src) &&
      /restaurantRecordOf\(s\)\.bestStreak/.test(src) &&
      /customer-tip/.test(src) &&
      /endlessStarsOf\(s\)\.total/.test(src),
    "J2: Precision reads Masterful plates, Cleanliness the best streak, Customer Favourite the lifetime tips, Restaurateur the Endless stars",
  );
  assert(
    id("precision").tiers.every((t) => t.also?.label === "plates of 95%+") &&
      id("cleanliness").tiers.every((t) => t.also?.label === "best streak") &&
      id("favourite").tiers.every((t) => t.also?.label === "tips") &&
      id("restaurateur").tiers.filter((t) => t.also).length === 1 &&
      id("speed").tiers.every((t) => !t.also) &&
      id("organizer").tiers.every((t) => !t.also),
    "J3: the second requirements are exactly where the plan puts them",
  );
  const cr = code("src/components/kc/CityRanking.tsx");
  const tip = (name: string) => new RegExp(`<InfoTip label="${name}">`).test(cr);
  assert(
    tip("How chef titles are earned") &&
      tip("How prestige works") &&
      tip("How the city league works"),
    "J4: the chef title, prestige and league cards keep their longer explanations behind an ⓘ",
  );
  assert(
    /The city's restaurants compete each week\. Nobody drops down a league\./.test(cr) &&
      (cr.match(/<InfoTip /g) ?? []).length >= 3,
    "J5: the short league line stays visible, the rules are in the InfoTip",
  );
  assert(
    /identityProgressText\(save, goal\)/.test(cr),
    "J6: the title card says which of the two numbers is missing",
  );
}

console.log("G. Pure and honest");
{
  const src = code("src/game/progression/chefTitles.ts");
  assert(
    !/credits|appendLedgerEntry|economyLedger|Math\.random|Date\.now|new Date|performance\.now|window\.|localStorage|fetch\(/.test(
      src,
    ),
    "G1: no wallet, ledger, clock, random, storage in the rule file",
  );
  const all = CHEF_IDENTITIES.flatMap((i) => [
    i.name,
    i.unit,
    ...i.tiers.map((t) => t.title),
    ...i.tiers.map((t) => i.describe(t.target)),
  ]);
  assert(
    all.every((t) => !/\bonly\s+\d+\s*%|% of (chefs|players)|top\s+\d+\s*%/i.test(t)),
    "G2: no population claim",
  );
  assert(!/chefTitles/.test(code("src/game/SaveManager.ts")), "G3: no save field of its own");
  assert(
    JSON.stringify(Object.keys(withRecord({ perfectCuts: 1 }))) ===
      JSON.stringify(Object.keys(DEFAULT_SAVE)),
    "G4: a title adds no top-level save field",
  );
}

console.log("H. Wiring");
{
  const cr = code("src/components/kc/CityRanking.tsx");
  assert(
    /export function ChefTitleCard/.test(cr) &&
      /data-testid="chef-title-card"/.test(cr) &&
      /CHEF_TITLES_FROM_LEVEL/.test(cr),
    "H1: the Progress card exists and opens from its level",
  );
  assert(
    /<ChefTitleCard save=\{save\} \/>/.test(code("src/components/kc/RestaurantProgress.tsx")),
    "H2: Restaurant Progress shows it under the city ranking",
  );
  const kit = code("src/components/kc/Kitchen.tsx");
  assert(
    // RULE CHANGE (developer 2026-11-23, audit Batch 4): the plan's own line is "a window 600 px tall or more", not 700. The chip sits INLINE on the rank line (no extra height), so
    // 600 costs nothing: measured at 360x640 the rank card stays 105 px (68-173) and nothing moves. The rival chef's LINE adds a row, so it stays at 700 (rival-chefs-qa F2).
    /data-testid="kitchen-chef-title"/.test(kit) &&
      /\[@media\(min-height:600px\)\]:inline/.test(kit),
    "H3: the Kitchen shows the title only on a window 600 px tall or more",
  );
  const app = code("src/App.tsx");
  assert(
    /announceTitles\(nextSave\)/.test(app) && /sendAnalyticsEvent\("title_earned"/.test(app),
    "H4: a service announces what was earned (and measures it)",
  );
  const c = celebrationFor({
    rank: null,
    popularity: null,
    spotlessStreak: 0,
    title: { title: "Steady Hand", identity: "Precision" },
  });
  assert(
    c?.kind === "title" &&
      c.title === "New title: Steady Hand!" &&
      c.lines.includes("🏅 New title: Steady Hand (Precision)"),
    "H5: a title gets its own celebration card",
    c,
  );
  const both = celebrationFor({
    rank: { from: 5, to: 4, passed: "x" },
    popularity: null,
    spotlessStreak: 0,
    title: { title: "Steady Hand", identity: "Precision" },
  });
  assert(
    both?.kind === "rank" && both.lines.some((l) => l.includes("New title")),
    "H6: with a rank rise too, one card carries both",
  );
}

console.log(failures === 0 ? "\nCHEF TITLES QA: ALL PASS" : `\nCHEF TITLES QA: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
