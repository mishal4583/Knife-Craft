/**
 * RIVAL CHEFS QA (the "Chef Pride" plan, Phase 2, developer 2026-11-23: "the next restaurant to pass should be a person the player wants to beat").
 *
 *  A  the cast: every one of the 49 city rivals has exactly one chef with a name, a dare and a beaten line; no stray chef, unique names;
 *  B  the copy is playful, never an insult: length, no population claim ("only 8% of chefs"), no digit-statistics, no insult or slur words, no shouting;
 *  C  Paige's rival beats: only for the featured rivals, spaced at least 3 levels apart, each shown only from the ranking news (Level 8), only while that rival is
 *     really the next to pass, once each, two short plain-English lines that pass the assistant's copy rule;
 *  D  the celebration card carries the passed rival's reply when a rival is passed, and nothing extra otherwise;
 *  E  nothing is stored for it, no money moves, the rule file is pure (copy only);
 *  F  wiring: Progress shows the chef under "Next: pass ...", the Kitchen card on a tall window only, the celebration call passes the reply, from Level 8.
 *
 * Run: npx tsx scripts/rival-chefs-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { RIVALS, cityRanking } from "../src/game/restaurant/cityRanking.ts";
import {
  FEATURED_RIVALS,
  RIVAL_CHEFS,
  chefCallName,
  chefSays,
  rivalChefOf,
} from "../src/game/restaurant/rivalChefs.ts";
import { ASSISTANT_BEATS, MAX_LINE_CHARS } from "../src/game/restaurant/assistant.ts";
import { celebrationFor } from "../src/game/restaurant/celebrations.ts";
import { RANKING_NEWS_FROM_LEVEL } from "../src/game/config/earlyLevels.ts";

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
const at = (completed: number): SaveData => ({
  ...DEFAULT_SAVE,
  levelProgress: {
    currentLevelId: `level-${completed + 1}`,
    highestUnlockedLevelId: `level-${completed + 1}`,
    completedLevelIds: Array.from({ length: completed }, (_, i) => `level-${i + 1}`),
  },
});

console.log("A. The cast");
{
  const ids = new Set(RIVALS.map((r) => r.id));
  assert(RIVAL_CHEFS.length === RIVALS.length, "A1: one chef for every rival restaurant", [
    RIVAL_CHEFS.length,
    RIVALS.length,
  ]);
  assert(
    RIVALS.every((r) => rivalChefOf(r.id)),
    "A2: every rival id has a chef",
  );
  assert(
    RIVAL_CHEFS.every((c) => ids.has(c.id)),
    "A3: no chef for an unknown restaurant",
  );
  assert(
    new Set(RIVAL_CHEFS.map((c) => c.id)).size === RIVAL_CHEFS.length,
    "A4: no restaurant has two chefs",
  );
  assert(
    new Set(RIVAL_CHEFS.map((c) => c.chef)).size === RIVAL_CHEFS.length,
    "A5: every chef has their own name",
  );
  assert(
    RIVAL_CHEFS.every(
      (c) => c.chef.trim().split(/\s+/).length >= 2 && c.dare.trim() && c.beaten.trim(),
    ),
    "A6: a full name, a dare and a beaten line each",
  );
  assert(
    chefCallName(rivalChefOf("pita-pocket")!) === "Chef Dario",
    "A7: the game says 'Chef <first name>'",
  );
  assert(
    chefSays(rivalChefOf("pita-pocket")!, "dare").startsWith("Chef Dario: "),
    "A8: a line carries the chef's name",
  );
}

console.log("B. The copy is playful, never an insult");
{
  const all = RIVAL_CHEFS.flatMap((c) => [c.dare, c.beaten]);
  assert(
    all.every((t) => t.length <= 70),
    "B1: at most 70 characters a line",
    all.filter((t) => t.length > 70),
  );
  assert(
    all.every(
      (t) => !/\bonly\s+\d+\s*%|% of (chefs|players)|top\s+\d+\s*%|better than \d+/i.test(t),
    ),
    "B2: no population claim (the game has no population data)",
  );
  assert(
    all.every((t) => !/\d/.test(t)) ||
      all
        .filter((t) => /\d/.test(t))
        .every((t) => /\b(fifty|hundred|thousand)\b/i.test(t) === false),
    "B3: no digits posing as statistics",
    all.filter((t) => /\d/.test(t)),
  );
  assert(
    all.every(
      (t) =>
        !/\b(stupid|idiot|loser|pathetic|useless|terrible|worthless|trash|garbage|noob|dumb|ugly|fat|hate|kill|die|suck|bad chef|you can't cook|you cannot cook)\b/i.test(
          t,
        ),
    ),
    "B4: no insult words",
  );
  assert(
    all.every((t) => !/!{2,}|[A-Z]{6,}/.test(t)),
    "B5: no shouting",
  );
  assert(
    RIVAL_CHEFS.every((c) => /[.?!]$/.test(c.dare) && /[.?!]$/.test(c.beaten)),
    "B6: every line is a finished sentence",
  );
  assert(new Set(all).size === all.length, "B7: no line is repeated word for word");
}

console.log("C. Paige's rival beats");
{
  const beats = ASSISTANT_BEATS.filter((b) => b.id.startsWith("rival:"));
  assert(
    beats.length === FEATURED_RIVALS.length && beats.length >= 10 && beats.length <= 16,
    "C1: one beat for each featured rival (a dozen or so, not all 49)",
    beats.length,
  );
  const featuredLevels = FEATURED_RIVALS.map(
    (c) => RIVALS.find((r) => r.id === c.id)!.passedAtLevel,
  ).sort((a, b) => a - b);
  const gaps = featuredLevels.slice(1).map((l, i) => l - featuredLevels[i]!);
  assert(
    gaps.every((g) => g >= 3),
    "C2: featured rivals are at least 3 levels apart (it never nags)",
    featuredLevels,
  );
  assert(
    featuredLevels.every((l) => l > RANKING_NEWS_FROM_LEVEL),
    "C3: the first featured rival comes after the ranking news opens",
    featuredLevels,
  );
  const mamas = beats.find((b) => b.id === "rival:harbor-grill")!;
  const m = RIVALS.find((r) => r.id === "harbor-grill")!;
  const completedFor = (level: number) => level - 1;
  assert(
    mamas.when(at(completedFor(m.passedAtLevel)), m.passedAtLevel) &&
      !mamas.when(at(completedFor(m.passedAtLevel + 1)), m.passedAtLevel + 1) &&
      !mamas.when(at(completedFor(m.passedAtLevel - 3)), m.passedAtLevel - 3),
    "C4: it shows in the level that passes the rival (and the one before it when they are already the next), not after and not long before",
  );
  assert(
    cityRanking(at(completedFor(m.passedAtLevel))).next?.id === "harbor-grill",
    "C5: at that level the rival really is the next to pass",
  );
  // the ranking news gate: a featured rival below Level 8 would not speak (none is, but the rule is in the function)
  const asEarly = beats.every((b) => !b.when(at(3), 3));
  assert(asEarly, "C6: nothing rival-related is said before the ranking news (Level 8)");
  const emoji = /\p{Extended_Pictographic}/gu;
  const bad = beats.flatMap((b) =>
    b.lines.flatMap((l) => [
      ...(l.text.length > MAX_LINE_CHARS ? [`${b.id}: ${l.text.length} chars`] : []),
      ...((l.text.match(emoji) ?? []).length > 1 ? [`${b.id}: emoji`] : []),
      ...(!/^[\x20-\x7e’]+$/.test(l.text) ? [`${b.id}: not plain English`] : []),
    ]),
  );
  assert(
    bad.length === 0 && beats.every((b) => b.lines.length === 2 && b.go === "rack"),
    "C7: two plain-English lines, sent to Progress",
    bad,
  );
  assert(
    beats.every((b) => b.priority < 50),
    "C8: a rival beat never outranks a teaching tip",
  );
}

console.log("D. The celebration");
{
  const base = {
    rank: { from: 6, to: 5, passed: "🥙 The Pita Pocket" },
    popularity: null,
    spotlessStreak: 0,
  };
  const plain = celebrationFor(base)!;
  const withRival = celebrationFor({
    ...base,
    rank: { ...base.rank, rival: chefSays(rivalChefOf("pita-pocket")!, "beaten") },
  })!;
  assert(
    withRival.lines.length === plain.lines.length + 1,
    "D1: the passed rival's reply is one extra line",
  );
  assert(
    withRival.lines.at(-1) === "Chef Dario: “...Nice plating. Don't get used to it.”",
    "D2: it is the chef's beaten line",
    withRival.lines,
  );
  assert(
    celebrationFor({ rank: null, popularity: null, spotlessStreak: 0 }) === null,
    "D3: nothing without a rank rise, popularity or a spotless run",
  );
}

console.log("E. Pure copy, nothing stored");
{
  const src = code("src/game/restaurant/rivalChefs.ts");
  assert(
    !/credits|appendLedgerEntry|economyLedger|Math\.random|Date\.now|new Date|performance\.now|window\.|localStorage|fetch\(|SaveData/.test(
      src,
    ),
    "E1: no wallet, ledger, clock, random, storage or save in the rule file",
  );
  assert(
    !/chefRecord|rivalChefs/.test(code("src/game/SaveManager.ts")),
    "E2: no save field for it",
  );
}

console.log("F. Wiring");
{
  const hero = code("src/components/kc/CityRanking.tsx");
  assert(
    /rivalChefOf\(c\.next\.id\)/.test(hero) &&
      /RANKING_NEWS_FROM_LEVEL/.test(hero) &&
      /data-testid="rival-chef-line"/.test(hero),
    "F1: Progress shows the next rival's chef from the ranking news",
  );
  const kit = code("src/components/kc/Kitchen.tsx");
  assert(
    /data-testid="kitchen-rival-chef"/.test(kit) &&
      /\[@media\(min-height:700px\)\]:block/.test(kit) &&
      /hidden/.test(
        kit.slice(kit.indexOf("kitchen-rival-chef") - 200, kit.indexOf("kitchen-rival-chef") + 300),
      ),
    "F2: the Kitchen card shows it only on a tall window (hidden below 700 px of height)",
  );
  const app = code("src/App.tsx");
  assert(
    /rival: chefSays\(rivalChef, "beaten"\)/.test(app) && /rivalChefOf\(lastPassed\.id\)/.test(app),
    "F3: the celebration gets the last passed rival's reply",
  );
  assert(/sendAnalyticsEvent\("rival_passed"/.test(app), "F4: the pass is measured (rival_passed)");
}

console.log(failures === 0 ? "\nRIVAL CHEFS QA: ALL PASS" : `\nRIVAL CHEFS QA: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
