/**
 * RESTAURANT PROGRESS REDESIGN QA (developer 2026-11-25: "make the restaurant progress page exactly like this in the document ... also optimize the page, there are multiple rankings
 * and other things, check if they are actually required"; docs/planning/RESTAURANT-PROGRESS-REDESIGN-PLAN-2026-11-25.md).
 *
 *  A  every painted picture the page names is a real "<sheet>/<slug>" of scripts/progress-sheets.json (the Codex sheets), and every sheet fits its grid;
 *  B  the art loader draws a picture only when its file exists and never when it is missing or failed (the page falls back to today's icons);
 *  C  the audit's cuts: the restaurant build draws no "city benchmark", no Popularity card, no summary list, no "Restaurant Complete" row, no "Remaining wealth", no plain campaign bar;
 *  D  the kept cards keep their testids, the standing card shows the restaurant's own name, nothing is hard-coded from the mock-up ("Copper Pan");
 *  E  Milestones shows the next six first and opens in full on "Show all";
 *  F  the page is display only (no wallet, ledger, random, clock), and the delivered pictures stay inside the image budget.
 *
 * Run: npx tsx scripts/restaurant-progress-redesign-qa.mts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PROGRESS_ART_FILES } from "../src/game/progressArtFiles.ts";
import { hasProgressArt, markProgressArtFailed, progressArtUrl } from "../src/game/progressArt.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const read = (p: string) => readFileSync(p, "utf8");
const sheets = JSON.parse(read("scripts/progress-sheets.json")).sheets as Record<
  string,
  { cols: number; rows: number; slugs: string[] }
>;
const page = read("src/components/kc/RestaurantProgress.tsx");
const ranking = read("src/components/kc/CityRanking.tsx");
const kit = read("src/components/kc/progress/ProgressKit.tsx");
const sources = { page, ranking, kit };

console.log("A. The pictures the page names exist in the sheet list");
{
  const known = new Set<string>();
  for (const [id, s] of Object.entries(sheets))
    for (const slug of s.slugs) known.add(`${id}/${slug}`);
  const named = new Set<string>();
  const unknown: string[] = [];
  for (const [file, src] of Object.entries(sources)) {
    for (const m of src.matchAll(
      /"((?:icons-a|icons-b|icons-c|medals|storefronts|goals|knives|boards|pieces|wide)\/[a-z0-9-]+)"/g,
    )) {
      named.add(m[1]!);
      if (!known.has(m[1]!)) unknown.push(`${file}: ${m[1]}`);
    }
  }
  assert(named.size >= 50, `A1: the page names a good set of pictures (${named.size})`, named.size);
  assert(
    unknown.length === 0,
    "A2: every named picture is in scripts/progress-sheets.json",
    unknown,
  );
  // the pictures built from a template: a kit / ranking / page prefix must still be a real sheet with those slugs
  const templated: [string, string[]][] = [
    ["medals/rank-", ["1", "2", "3"]],
    ["medals/medal-", ["0", "1", "2", "3", "4"]],
    ["medals/badge-", ["0", "1", "2", "3", "4"]],
    ["storefronts/podium-", ["1", "2", "3"]],
    ["storefronts/stage-", ["0", "1", "2", "3", "4", "5"]],
    ["icons-b/prestige-", ["0", "1", "2", "3", "4"]],
    ["icons-b/chef-", ["0", "1", "2", "3", "4"]],
    [
      "knives/",
      ["chef", "santoku", "nakiri", "paring", "bread", "cleaver", "damascus", "obsidian"],
    ],
    [
      "boards/",
      ["walnut", "maple", "herb", "marble", "darkoak", "copper", "butcherblock", "seafoodslate"],
    ],
  ];
  const missing = templated.flatMap(([prefix, tails]) =>
    tails.filter((t) => !known.has(prefix + t)).map((t) => prefix + t),
  );
  assert(
    missing.length === 0,
    "A3: the templated pictures (medals, podium, stage, prestige, chefs, knives, boards) all have a slot",
    missing,
  );
  const badGrid = Object.entries(sheets).filter(
    ([, s]) => s.slugs.length > s.cols * s.rows || new Set(s.slugs).size !== s.slugs.length,
  );
  assert(
    badGrid.length === 0,
    "A4: every sheet fits its grid and has unique names",
    badGrid.map(([id]) => id),
  );
  const prompts = read("docs/planning/RESTAURANT-PROGRESS-CODEX-PROMPTS-2026-11-25.md");
  assert(
    Object.keys(sheets).every((id) => prompts.includes(`## RP-${id}:`)),
    "A5: every sheet has its Codex prompt",
  );
  // the real knife and board ids are the slugs (the page looks the picture up by id)
  const knives = read("src/game/knives/knifeDefinitions.ts");
  const boards = read("src/game/boards/boardDefinitions.ts");
  assert(
    sheets["knives"]!.slugs.every((s) => new RegExp(`id: "${s}"`).test(knives)) &&
      sheets["boards"]!.slugs.every((s) => new RegExp(`id: "${s}"`).test(boards)),
    "A6: the knife and board picture names are the game's own knife and board ids",
  );
}

console.log("B. A picture is drawn only when its file exists");
{
  const all = new Set(
    Object.entries(sheets).flatMap(([id, s]) => s.slugs.map((slug) => `${id}/${slug}`)),
  );
  assert(
    PROGRESS_ART_FILES.every((n) => all.has(n)),
    "B1: the delivered file list only names pictures of the sheet list",
  );
  const absent = [...all].find((n) => !PROGRESS_ART_FILES.includes(n));
  assert(
    !absent || (progressArtUrl(absent) === null && !hasProgressArt(absent)),
    "B2: a picture with no file gives no URL (the fallback icon is drawn)",
    absent,
  );
  const present = PROGRESS_ART_FILES[0];
  if (present) {
    assert(progressArtUrl(present) !== null, "B3: a delivered picture has a URL");
    markProgressArtFailed(present);
    assert(
      progressArtUrl(present) === null,
      "B4: a picture that failed to load falls back from then on",
    );
  } else console.log("  --   B3/B4: no picture is delivered yet (the page shows today's icons)");
  assert(
    /fallback/.test(kit) && /onError=/.test(kit) && /markProgressArtFailed/.test(kit),
    "B5: the picture component carries a fallback and handles a load error",
  );
}

console.log("C. What the audit removed");
{
  const restaurantBranch = page.slice(
    page.indexOf("RESTAURANT_MODE ? ("),
    page.indexOf(") : (", page.indexOf("RESTAURANT_MODE ? (")),
  );
  assert(
    !/Benchmark|PopularityCard|<Summary|<RankHero/.test(restaurantBranch),
    "C1: the restaurant build draws no city benchmark, no Popularity card, no summary list",
  );
  assert(
    /<Benchmark p=\{p\} \/>/.test(page) && /<Summary p=\{p\} \/>/.test(page),
    "C2: the classic build keeps its own cards",
  );
  const standing = page.slice(
    page.indexOf("function StandingCard"),
    page.indexOf("function goalArt"),
  );
  assert(
    !/label="Restaurant Complete"/.test(standing) && /label="Endless Restaurant"/.test(standing),
    "C3: Standing has the Endless row and no 'Restaurant Complete' row",
  );
  const earnings = page.slice(
    page.indexOf("function Earnings"),
    page.indexOf("function RewardsPlaque"),
  );
  assert(
    /RESTAURANT_MODE \? null/.test(earnings) && /Remaining wealth/.test(earnings),
    "C4: 'Remaining wealth' is only in the classic build",
  );
  const campaign = page.slice(
    page.indexOf("function CampaignCard"),
    page.indexOf("function JourneyTrack"),
  );
  assert(
    !/<Bar\b/.test(campaign) &&
      /label="Chapters"/.test(campaign) &&
      /label="Recipes cooked"/.test(campaign),
    "C5: Campaign has no plain bar and has the chapter and recipe bars",
  );
  assert(
    !/label="Staff"/.test(page.slice(0, page.indexOf("function RankHero"))),
    "C6: no Staff row on the restaurant page",
  );
}

console.log("D. The cards that stay");
{
  const ids = [
    "city-rank-hero",
    "rival-chef-line",
    "rival-chef-respect",
    "city-leaderboard",
    "chef-title-card",
    "chef-title-name",
    "chef-title-goal",
    "chef-title-records",
    "chef-title-chips",
    "prestige-card",
    "prestige-tier",
    "prestige-goal",
    "prestige-parts",
    "league-card",
    "league-name",
    "league-goal",
    "league-table",
    "league-last",
    "restaurant-standing",
    "endless-stars",
    "restaurant-numbers",
    "achievements-entry-note",
  ];
  const text = page + ranking;
  const lost = ids.filter((id) => !text.includes(`data-testid="${id}"`));
  assert(lost.length === 0, "D1: every testid of the kept cards is still there", lost);
  assert(
    /restaurantNameOf\(save\)/.test(
      page.slice(page.indexOf("function StandingCard"), page.indexOf("function goalArt")),
    ),
    "D2: the standing card shows the restaurant's own name",
  );
  assert(
    !/Copper Pan|Lightning Chef|Bronze League|1,395,671/.test(page + ranking + kit),
    "D3: no sample value of the mock-up is written into the code",
  );
}

console.log("E. Milestones: the next six first");
{
  assert(/MILESTONES_SHOWN = 6/.test(page), "E1: six milestones are shown first");
  assert(
    /filter\(\(m\) => !m\.done\)\.slice\(0, MILESTONES_SHOWN\)/.test(page),
    "E2: they are the next ones still to earn",
  );
  assert(
    /Show all \$\{p\.milestones\.length\}/.test(page) && /RESTAURANT_MODE && !all/.test(page),
    "E3: 'Show all' opens the whole table (restaurant build only)",
  );
}

console.log("F. Display only, inside the image budget");
{
  const bad = Object.entries(sources)
    .filter(([, s]) =>
      /Math\.random|Date\.now|new Date|economyLedger|localStorage|window\.bridge|fetch\(/.test(s),
    )
    .map(([f]) => f);
  assert(
    bad.length === 0,
    "F1: the page and its kit have no random, clock, ledger, storage, bridge or network call",
    bad,
  );
  const dir = "public/progress";
  if (existsSync(dir)) {
    const files: { f: string; kb: number }[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else files.push({ f: p, kb: statSync(p).size / 1024 });
      }
    };
    walk(dir);
    const total = files.reduce((t, x) => t + x.kb, 0);
    assert(
      total <= 2048 && files.every((x) => x.kb <= 90),
      `F2: the delivered pictures are ${Math.round(total)} KB in total, none over 90 KB`,
      files.filter((x) => x.kb > 90).map((x) => x.f),
    );
  } else console.log("  --   F2: no pictures delivered yet (budget: 2 MB in total, 90 KB each)");
}

console.log(
  failures
    ? `\nRESTAURANT PROGRESS REDESIGN QA: ${failures} FAILED`
    : "\nRESTAURANT PROGRESS REDESIGN QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
