/**
 * CHEF CARDS QA (the "Chef Pride" plan, Phase 6, developer 2026-11-23: shareable chef cards).
 *
 *  A  the cards: four builders (title, prestige, league, rival), each a KitchenMoment with its own kind, heading, badge, short facts and share text; unique run keys so
 *     the same achievement is never two cards;
 *  B  the copy is true and short: only facts of the achievement, no population claim, no money, no personal data, short lines;
 *  C  the celebrations carry the cards: a title, a prestige tier, a rival passed and a league PROMOTION offer a card; a calm league week and a plain popularity card offer none;
 *  D  never by itself: a card is drawn and shared only after a tap (the button), the button is hidden where sharing is not allowed, nothing is uploaded, copied or opened;
 *  E  the existing rules hold: the same canvas renderer and preview as the Kitchen Moment, no new library, no external call, no clipboard, the preview's Share needs
 *     `sharingAllowed()`; the share is measured (`moment_shared`) with only the kind and the method;
 *  F  the dish moments are unchanged (four kinds still earned by a dish; the chef kinds are never earned by one).
 *
 * Run: npx tsx scripts/chef-cards-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { leagueCard, prestigeCard, rivalCard, titleCard } from "../src/game/chefCards.ts";
import {
  CHEF_MOMENT_KINDS,
  MOMENT_KIND_LABEL,
  momentsForRun,
  type KitchenMoment,
} from "../src/game/kitchenMoments.ts";
import { celebrationFor, leagueCelebration } from "../src/game/restaurant/celebrations.ts";
import { PRESTIGE_TIERS } from "../src/game/restaurant/restaurantPrestige.ts";

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

const title = titleCard({ title: "Precision Chef", identity: "Precision" });
const prestige = prestigeCard({ tier: "City Landmark" });
const league = leagueCard({
  nowLeague: "Silver",
  nowIdentity: "Skilled Chef",
  rank: 2,
  size: 10,
  points: 140,
});
const rival = rivalCard({
  passed: "🥙 The Pita Pocket",
  rankTo: 46,
  chefLine: "Chef Dario: “...Nice plating. Don't get used to it.”",
});
const all: KitchenMoment[] = [title, prestige, league, rival];

console.log("A. The cards");
{
  assert(
    all.map((c) => c.kind).join() === "title,prestige,league,rival",
    "A1: four cards, four kinds",
  );
  assert(
    all.every(
      (c) => CHEF_MOMENT_KINDS.includes(c.kind) && MOMENT_KIND_LABEL[c.kind].title.length > 0,
    ),
    "A2: each kind has a label and is a chef kind",
  );
  assert(
    all.every(
      (c) =>
        c.heading &&
        c.badge &&
        c.lines.length >= 1 &&
        c.lines.length <= 3 &&
        c.shareText &&
        c.emoji,
    ),
    "A3: heading, badge, one to three facts, share text, emoji",
  );
  assert(
    title.heading === "Precision Chef" && title.badge === "Chef title · Precision",
    "A4: the title card carries the title and its identity",
  );
  assert(
    prestige.heading === "City Landmark" && prestige.lines[0] === PRESTIGE_TIERS[2]!.feel,
    "A5: the prestige card carries the tier and its feel line",
  );
  assert(
    league.heading === "Silver League" &&
      /Promoted/.test(league.badge) &&
      league.lines[0] === "Finished #2 of 10 this week",
    "A6: the league card carries the league, the promotion and the place",
  );
  assert(
    rival.heading === "Passed The Pita Pocket" &&
      !/\p{Extended_Pictographic}/u.test(rival.heading) &&
      rival.badge === "City ranking · #46",
    "A7: the rival card carries the restaurant (no emoji in the heading) and the new rank",
  );
  assert(
    new Set(all.map((c) => c.runKey)).size === 4 && all.every((c) => c.runKey.startsWith("chef:")),
    "A8: each card has its own key",
  );
  assert(
    titleCard({ title: "Precision Chef", identity: "Precision" }).runKey === title.runKey,
    "A9: the same achievement is the same card, never two",
  );
  assert(
    all.every((c) =>
      /^[a-z0-9-]+$/.test(
        c.dishName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      ),
    ),
    "A10: the heading makes a clean file name",
  );
}

console.log("B. True and short");
{
  const text = all.flatMap((c) => [c.heading, c.badge, ...c.lines, c.shareText]);
  assert(
    text.every((t) => !/\bonly\s+\d+\s*%|% of (chefs|players|restaurants)|top\s+\d+\s*%/i.test(t)),
    "B1: no population claim",
  );
  assert(
    text.every((t) => !/\$|dollar|cash|coins|€/i.test(t)),
    "B2: no money on a card",
  );
  assert(
    text.every((t) => !/@|https?:|www\.|\.com/i.test(t)),
    "B3: no address, handle or link",
  );
  assert(
    all.every(
      (c) =>
        c.heading.length <= 40 &&
        c.badge.length <= 40 &&
        c.lines.every((l) => l.length <= 80) &&
        c.shareText.length <= 100,
    ),
    "B4: short lines",
  );
  assert(
    all.every((c) => /KnifeCraft/.test(c.shareText)),
    "B5: the share text names the game",
  );
  assert(
    all.every((c) => !/\bI beat|better than|top chef|number one/i.test(c.shareText)),
    "B6: no boast about other players",
  );
}

console.log("C. The celebrations carry the cards");
{
  const t = celebrationFor({
    rank: null,
    popularity: null,
    spotlessStreak: 0,
    title: { title: "Steady Hand", identity: "Precision" },
  })!;
  assert(
    t.shares?.length === 1 && t.shares[0]!.kind === "title",
    "C1: a title celebration offers its card",
  );
  const p = celebrationFor({
    rank: null,
    popularity: null,
    spotlessStreak: 0,
    prestige: { tier: "Local Favourite" },
  })!;
  assert(
    p.shares?.[0]?.kind === "prestige" && p.shares[0].heading === "Local Favourite",
    "C2: a prestige celebration offers its card",
  );
  const r = celebrationFor({
    rank: { from: 47, to: 46, passed: "🥙 The Pita Pocket", rival: "Chef Dario: “Fine.”" },
    popularity: null,
    spotlessStreak: 0,
  })!;
  assert(
    r.shares?.[0]?.kind === "rival" && r.shares[0].lines[0] === "Chef Dario: “Fine.”",
    "C3: a rival passed offers its card with the chef's reply",
  );
  const many = celebrationFor({
    rank: { from: 5, to: 4, passed: "x" },
    popularity: null,
    spotlessStreak: 0,
    prestige: { tier: "City Landmark" },
    title: { title: "Steady Hand", identity: "Precision" },
  })!;
  assert(
    many.shares?.map((s) => s.kind).join() === "rival,prestige,title",
    "C4: several achievements at once are several cards on one celebration, in a fixed order",
  );
  const promo = leagueCelebration({
    league: "Bronze",
    identity: "Apprentice Chef",
    nowLeague: "Silver",
    nowIdentity: "Skilled Chef",
    rank: 2,
    size: 10,
    points: 140,
    promoted: true,
  });
  assert(promo.shares?.[0]?.kind === "league", "C5: a league promotion offers its card");
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
  assert(calm.shares === undefined, "C6: a calm league week offers no card");
  const pop = celebrationFor({
    rank: null,
    popularity: { before: 40, after: 60 },
    spotlessStreak: 0,
  })!;
  const spot = celebrationFor({ rank: null, popularity: null, spotlessStreak: 3 })!;
  assert(
    pop.shares === undefined && spot.shares === undefined,
    "C7: a popularity or spotless card is not a chef achievement: no card",
  );
}

console.log("D. Never by itself");
{
  const card = code("src/components/kc/common/CelebrationCard.tsx");
  assert(
    /data-testid="celebration-share"/.test(card) &&
      /onClick=\{\(\) => setPreview\(true\)\}/.test(card),
    "D1: the card's Share button only opens the preview when tapped",
  );
  assert(
    /sharingAllowed\(\) \? \(celebration\.shares \?\? \[\]\) : \[\]/.test(card),
    "D2: the button is hidden where sharing is not allowed (YouTube)",
  );
  assert(
    /preview && shares\.length/.test(card) && /stopPropagation/.test(card),
    "D3: the preview is only mounted after the tap, and its taps do not close the celebration",
  );
  const all6 = [
    "src/game/chefCards.ts",
    "src/game/restaurant/celebrations.ts",
    "src/components/kc/common/CelebrationCard.tsx",
  ]
    .map(code)
    .join("\n");
  assert(
    !/navigator\.share|navigator\.clipboard|toBlob|createObjectURL|\.download\b|fetch\(|XMLHttpRequest|window\.open|location\./.test(
      all6,
    ),
    "D4: neither the builders nor the celebration share, copy, download, upload or open anything",
  );
}

console.log("E. The existing rules hold");
{
  const prev = code("src/components/kc/moments/MomentPreview.tsx");
  assert(
    /sharingAllowed\(\) &&\s*!!f &&/.test(prev) &&
      /const canShareText = !canShareFile && sharingAllowed\(\)/.test(prev),
    "E1: the preview's Share still needs sharingAllowed()",
  );
  assert(
    /sendAnalyticsEvent\("moment_shared", \{ kind: m\.kind, method: "share" \}\)/.test(prev) &&
      /sendAnalyticsEvent\("moment_shared", \{ kind: m\.kind, method: "save" \}\)/.test(prev),
    "E2: a share or a saved image is measured with only the kind and the method",
  );
  const card = code("src/components/kc/moments/momentCard.ts");
  assert(
    /A CHEF ACHIEVEMENT/.test(card) && /CHEF_MOMENT_KINDS\.includes\(m\.kind\)/.test(card),
    "E3: a chef card says it is a chef achievement; same canvas renderer",
  );
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
  assert(
    !Object.keys(pkg.dependencies).some((d) =>
      /html2canvas|html-to-image|dom-to-image|canvas-confetti|qrcode/i.test(d),
    ),
    "E4: no capture or image library (the card is drawn on a canvas)",
  );
  const sources = [
    "src/game/chefCards.ts",
    "src/components/kc/moments/momentCard.ts",
    "src/components/kc/moments/MomentPreview.tsx",
  ]
    .map(code)
    .join("\n");
  assert(
    !/navigator\.clipboard|ClipboardItem|execCommand|window\.bridge|social\.share/.test(sources),
    "E5: no clipboard, and nothing reaches the Bridge except through the SDK",
  );
}

console.log("F. The dish moments are unchanged");
{
  const dish = momentsForRun({
    runKey: "r1",
    dishName: "Tomato Plate",
    dishEmoji: "🍅",
    score: 96,
    grade: "Masterful",
    previousBest: 80,
    perfects: [{ combo: 6 }],
    bestCombo: 6,
    variant: null,
    tierReached: null,
  });
  assert(
    dish.length >= 1 && dish.every((m) => !CHEF_MOMENT_KINDS.includes(m.kind)),
    "F1: a finished dish earns dish moments only, never a chef card",
  );
  assert(
    ["perfect", "special", "best", "customer"].every((k) => k in MOMENT_KIND_LABEL),
    "F2: the four dish kinds are all still there",
  );
}

console.log(failures === 0 ? "\nCHEF CARDS QA: ALL PASS" : `\nCHEF CARDS QA: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
