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
  identityStatus,
  leadingTitle,
  nextTitleGoal,
  titleAchievementId,
  titleSeenId,
  unseenTitles,
} from "../src/game/progression/chefTitles.ts";
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
  const at = (n: number) => identityStatus(withRecord({ perfectCuts: n }), p);
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
    {
      ...DEFAULT_SAVE,
      business: {
        ...DEFAULT_SAVE.business,
        popularity: { ...DEFAULT_SAVE.business.popularity, score: 80 },
      },
    },
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
  const s1 = withRecord({ perfectCuts: 30 });
  assert(leadingTitle(s1)?.title === "Steady Hand", "C2: the one earned is worn");
  const s2 = withRecord({ perfectCuts: 120, quickClean: 12 });
  assert(
    leadingTitle(s2)?.title === "Precision Chef",
    "C3: the highest tier wins (Precision 2 over Speed 1)",
    leadingTitle(s2),
  );
  const s3 = withRecord({ perfectCuts: 30, quickClean: 12 });
  assert(
    leadingTitle(s3)?.identity.id === "precision",
    "C4: a tie goes to the identity listed first",
  );
  const goal = nextTitleGoal(withRecord({ perfectCuts: 20, quickClean: 2 }));
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
  const s = withRecord({ perfectCuts: 120, quickClean: 12 }); // Precision 2 tiers, Speed 1 tier
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
  const later = withRecord({ ...chefRecordOf(a.save), perfectCuts: 300 }, a.save);
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
  const rich = withRecord({ perfectCuts: 900, quickClean: 400 });
  const chef = achievementsFor(rich).filter((a) => a.id.startsWith("ach-chef-"));
  assert(chef.length === 24, "E1: 24 title achievements", chef.length);
  assert(
    chef.every((a) => a.reward === 0 && !a.automatic),
    "E2: every one is a badge (reward 0), never automatic",
  );
  assert(
    chef.find((a) => a.id === "ach-chef-precision-800")?.reached === true &&
      chef.find((a) => a.id === "ach-chef-speed-300")?.reached === true,
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
    /data-testid="kitchen-chef-title"/.test(kit) &&
      /\[@media\(min-height:700px\)\]:inline/.test(kit),
    "H3: the Kitchen shows the title only on a tall window",
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
