/**
 * CHEF ART QA (developer 2026-11-25: the Codex sheets of the rival chefs, the prestige emblems and the health inspector were integrated).
 *
 *  A  the 49 rival busts: one file per rival of the city ranking, in `scripts/chef-art-sheets.json` order, no orphan file, each a real WebP of a sane size
 *  B  the 5 prestige emblems and the 4 inspector poses exist, one per tier and per pose
 *  C  the path helpers (game/chefArt.ts): only a rival gets a rival portrait; tier and pose bounds; the grade-to-pose rule
 *  D  the celebration cards carry the portrait (the passed rival's chef, the prestige tier's emblem), the rank card first
 *  E  the screens use them, with the old emoji / icon as the fallback (so a missing file is never a hole)
 *
 * Run: npx tsx scripts/chef-art-qa.mts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { RIVALS } from "../src/game/restaurant/cityRanking.ts";
import { PRESTIGE_TIERS } from "../src/game/restaurant/restaurantPrestige.ts";
import {
  INSPECTOR_POSES,
  PRESTIGE_EMBLEM_COUNT,
  inspectorPath,
  inspectorPoseFor,
  prestigeEmblemPath,
  rivalPortraitPath,
} from "../src/game/chefArt.ts";
import { celebrationFor } from "../src/game/restaurant/celebrations.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const root = new URL("../", import.meta.url);
const pub = (p: string) => new URL(`public/${p}`, root);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const isWebp = (u: URL) => {
  const b = readFileSync(u);
  return (
    b.length > 1000 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"
  );
};

console.log("A. The rival chef busts");
{
  const spec = JSON.parse(read("scripts/chef-art-sheets.json"));
  const ids: string[] = spec.rivals.ids;
  assert(
    JSON.stringify(ids) === JSON.stringify(RIVALS.map((r) => r.id)) && ids.length === 49,
    "A1: the sheet map lists the 49 rivals of the city ranking in ranking order (the cut order cannot drift)",
    { sheet: ids.length, game: RIVALS.length },
  );
  const missing = ids.filter((id) => !existsSync(pub(`portraits/rivals/${id}.webp`)));
  assert(missing.length === 0, "A2: every rival has a bust", missing);
  const dir = readdirSync(pub("portraits/rivals"));
  const orphans = dir.filter((f) => !ids.includes(f.replace(/\.webp$/, "")));
  assert(
    orphans.length === 0 && dir.length === 49,
    "A3: no orphan file in the rivals folder",
    orphans,
  );
  const bad = ids.filter(
    (id) => existsSync(pub(`portraits/rivals/${id}.webp`)) && !isWebp(pub(`portraits/rivals/${id}.webp`)),
  );
  assert(bad.length === 0, "A4: every bust is a real WebP", bad);
  const big = ids.filter((id) => statSync(pub(`portraits/rivals/${id}.webp`)).size > 60_000);
  assert(
    big.length === 0,
    "A5: every bust is under 60 KB (no large assets, CLAUDE.md section 10)",
    big,
  );
  const same = new Set(ids.map((id) => statSync(pub(`portraits/rivals/${id}.webp`)).size));
  assert(
    same.size > 40,
    "A6: the busts are 49 different pictures, not one copied (distinct file sizes)",
    same.size,
  );
}

console.log("B. The prestige emblems and the inspector");
{
  const tiers = Array.from({ length: PRESTIGE_EMBLEM_COUNT }, (_, i) =>
    pub(`progress/prestige/tier-${i}.webp`),
  );
  assert(
    PRESTIGE_TIERS.length === PRESTIGE_EMBLEM_COUNT &&
      tiers.every((u) => existsSync(u) && isWebp(u)),
    "B1: one emblem file per prestige tier, each a real WebP",
    { tiers: PRESTIGE_TIERS.length },
  );
  assert(
    INSPECTOR_POSES.length === 4 &&
      INSPECTOR_POSES.every(
        (p) => existsSync(pub(inspectorPath(p))) && isWebp(pub(inspectorPath(p))),
      ),
    "B2: the inspector has his four poses, each a real WebP",
  );
}

console.log("C. The path helpers");
{
  assert(
    rivalPortraitPath("corner-toast") === "portraits/rivals/corner-toast.webp",
    "C1: a rival id gives its bust",
  );
  assert(
    rivalPortraitPath("you") === null &&
      rivalPortraitPath("player") === null &&
      rivalPortraitPath("nobody") === null &&
      rivalPortraitPath("") === null,
    "C2: the player and unknown ids get no rival portrait (they keep the generic bust)",
  );
  assert(
    prestigeEmblemPath(0) === "progress/prestige/tier-0.webp" &&
      prestigeEmblemPath(4) === "progress/prestige/tier-4.webp" &&
      prestigeEmblemPath(-1) === null &&
      prestigeEmblemPath(5) === null &&
      prestigeEmblemPath(1.5) === null &&
      prestigeEmblemPath(Number.NaN) === null,
    "C3: tiers 0-4 have an emblem, anything else none",
  );
  assert(
    inspectorPoseFor("A") === "pleased" &&
      inspectorPoseFor("B") === "neutral" &&
      inspectorPoseFor("C") === "disappointed",
    "C4: A is pleased, B neutral, C disappointed",
  );
}

console.log("D. The celebration cards");
{
  const base = { popularity: null, spotlessStreak: 0 };
  const rank = celebrationFor({
    ...base,
    rank: { from: 20, to: 19, passed: "x", rivalId: "luigis" },
  })!;
  assert(
    rank.portrait?.kind === "rival" && rank.portrait.id === "luigis",
    "D1: a rank card shows the passed rival's chef",
    rank.portrait,
  );
  const noId = celebrationFor({ ...base, rank: { from: 20, to: 19, passed: "x" } })!;
  assert(noId.portrait === undefined, "D2: with no rival id the card keeps its emoji");
  const pres = celebrationFor({
    ...base,
    rank: null,
    prestige: { tier: "Local Favourite", index: 1 },
  })!;
  assert(
    pres.portrait?.kind === "prestige" && pres.portrait.tier === 1,
    "D3: a prestige card shows the tier's emblem",
    pres.portrait,
  );
  const both = celebrationFor({
    ...base,
    rank: { from: 20, to: 19, passed: "x", rivalId: "luigis" },
    prestige: { tier: "Local Favourite", index: 1 },
  })!;
  assert(
    both.portrait?.kind === "rival",
    "D4: when both happen, the rank card (the headline) keeps the rival's face",
  );
}

console.log("E. The screens use them, with the old picture as the fallback");
{
  const kit = read("src/components/kc/progress/ProgressKit.tsx");
  assert(
    /rivalPortraitPath\(seed\)/.test(kit) &&
      /<PaintedPortrait[\s\S]*?fallback=\{generic\}/.test(kit),
    "E1: ChefFace shows a rival's own chef and falls back to the generic bust",
  );
  const rank = read("src/components/kc/CityRanking.tsx");
  assert(
    /<ChefFace seed=\{row\.rival\.id\}/.test(rank) &&
      /<ChefFace seed=\{r\.id\}/.test(rank) &&
      /function PrestigeEmblem/.test(rank) &&
      /<PrestigeEmblem tier=\{p\.tier\.index\}/.test(rank) &&
      /fallback=\{icon\}/.test(rank),
    "E2: the ranking rows, the league table and the prestige card show them (the emblem falls back to the small painted icon)",
  );
  const insp = read("src/components/kc/restaurant/HealthInspectorCard.tsx");
  assert(
    /inspectorPoseFor\(v\.grade\)/.test(insp) && /pose="arrival"/.test(insp) && /🕵️/.test(insp),
    "E3: the inspector card shows the arrival before the visit and the reaction after, with 🕵️ as the fallback",
  );
  const card = read("src/components/kc/common/CelebrationCard.tsx");
  assert(
    /celebration-portrait/.test(card) &&
      /rivalPortraitPath/.test(card) &&
      /prestigeEmblemPath/.test(card),
    "E4: the celebration card draws the portrait and keeps the emoji as its fallback",
  );
  const img = read("src/components/kc/common/PaintedPortrait.tsx");
  assert(
    /onError/.test(img) && /loading="lazy"/.test(img) && /aria-hidden/.test(img),
    "E5: the picture is lazy, decorative, and swaps to the fallback when it cannot load",
  );
}

console.log(failures ? `\nCHEF ART QA: ${failures} FAILED` : "\nCHEF ART QA: ALL PASS");
process.exit(failures ? 1 : 0);
