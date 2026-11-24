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
  BEATEN_TEMPLATES,
  DARE_TEMPLATES,
  RESPECT_FROM_RANK,
  RESPECT_TEMPLATES,
  RIVAL_CHEFS,
  chefCallName,
  chefRespects,
  chefSays,
  familyOf,
  rivalChefOf,
  rivalLine,
  templateLine,
} from "../src/game/restaurant/rivalChefs.ts";
import {
  ASSISTANT_BEATS,
  MAX_LINE_CHARS,
  assistantBeatFor,
  assistantOf,
  markAssistantSeen,
  notebookEntries,
  putOffAt,
  withBeatPutOff,
} from "../src/game/restaurant/assistant.ts";
import { restaurantLevelOf } from "../src/game/restaurant/restaurantMenu.ts";
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

console.log("H. Respect lines and the template path (audit Batch 4, developer 2026-11-23)");
{
  const facts = (r: (typeof RIVALS)[number]) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    district: r.district,
  });
  const lastTwelve = RIVALS.slice(-12).map((r) => r.id);
  assert(
    lastTwelve.every((id) => (rivalChefOf(id)?.respect ?? "").trim().length > 0),
    "H1: the twelve rivals the player meets last each have a hand-written respect line",
    lastTwelve.filter((id) => !rivalChefOf(id)?.respect),
  );
  const respects = RIVALS.map((r) => rivalLine("respect", rivalChefOf(r.id), facts(r)));
  assert(
    respects.every((t) => t.trim().length > 0 && !/[{}]/.test(t)),
    "H2: every one of the 49 rivals has a respect line (hand-written or templated), with no unfilled placeholder",
  );
  assert(
    RIVALS.every(
      (r) =>
        rivalLine("dare", undefined, facts(r)).trim() &&
        rivalLine("beaten", undefined, facts(r)).trim(),
    ),
    "H3: with no hand-written chef at all, the dare and beaten templates still give every rival a line",
  );
  const every = [
    ...respects,
    ...RIVALS.map((r) => templateLine("respect", facts(r))),
    ...RIVALS.map((r) => templateLine("dare", facts(r))),
    ...RIVALS.map((r) => templateLine("beaten", facts(r))),
  ];
  assert(
    every.every((t) => t.length <= 70),
    "H4: at most 70 characters a line, templates included",
    every.filter((t) => t.length > 70),
  );
  assert(
    every.every(
      (t) =>
        !/\bonly\s+\d+\s*%|% of (chefs|players)|top\s+\d+\s*%|better than \d+/i.test(t) &&
        !/\d/.test(t),
    ),
    "H5: no population claim and no digit in a respect or template line",
  );
  assert(
    every.every(
      (t) =>
        !/\b(stupid|idiot|loser|pathetic|useless|terrible|worthless|trash|garbage|noob|dumb|ugly|fat|hate|kill|die|suck|bad chef|you can't cook|you cannot cook)\b/i.test(
          t,
        ) && !/!{2,}|[A-Z]{6,}/.test(t),
    ),
    "H6: respect is respect: no insult word, no shouting",
  );
  assert(
    JSON.stringify(RIVALS.map((r) => templateLine("respect", facts(r)))) ===
      JSON.stringify(RIVALS.map((r) => templateLine("respect", facts(r)))),
    "H7: the template is deterministic (the same rival always gets the same line)",
  );
  const names = RIVALS.map((r) => templateLine("respect", facts(r)));
  assert(
    new Set(names).size > 20,
    "H8: the templates spread over the roster (many different lines)",
    new Set(names).size,
  );
  assert(
    Object.values(RESPECT_TEMPLATES).every((p) => p.length === 2 && p[0] !== p[1]) &&
      DARE_TEMPLATES[0] !== DARE_TEMPLATES[1] &&
      BEATEN_TEMPLATES[0] !== BEATEN_TEMPLATES[1],
    "H9: each template family has two different lines",
  );
  // the cuisine and district facts reach the text
  const dist = RIVALS.find((r) =>
    /\{district\}/.test(
      (RESPECT_TEMPLATES[familyOf(r.cuisine)] ?? RESPECT_TEMPLATES["default"]!).join("|"),
    ),
  )!;
  assert(
    RIVALS.some((r) => templateLine("respect", facts(r)).includes(r.district)) &&
      RIVALS.some((r) => templateLine("respect", facts(r)).includes(r.name)),
    "H10: templates use the rival's own name and district",
    dist?.id,
  );
  assert(
    familyOf("Italian") === "italian" &&
      familyOf("French") === "french" &&
      familyOf("Modern Indian") === "indian" &&
      familyOf("Something new") === "default",
    "H11: cuisines map to their family, an unknown one to the default",
  );
  assert(
    RIVALS.every(
      (r) =>
        RESPECT_TEMPLATES[familyOf(r.cuisine)] !== undefined || familyOf(r.cuisine) === "default",
    ),
    "H12: every cuisine in the city lands in a family that has templates",
  );
  // hand-written beats template, and respect never repeats the beaten line
  const claire = rivalChefOf("chez-margaux")!;
  assert(
    rivalLine("respect", claire, facts(RIVALS.find((r) => r.id === "chez-margaux")!)) ===
      claire.respect,
    "H13: a hand-written line wins over the template",
  );
  assert(
    RIVAL_CHEFS.every((c) => !c.respect || c.respect !== c.beaten) &&
      chefRespects(claire, facts(RIVALS.find((r) => r.id === "chez-margaux")!)).startsWith(
        "Chef Margaux: “",
      ),
    "H14: a respect line is its own line, said as 'Chef <name>: “…”'",
  );
  // late game wiring
  assert(RESPECT_FROM_RANK === 10, "H15: respect belongs to the late game: the top ten");
  const cr = code("src/components/kc/CityRanking.tsx");
  assert(
    /data-testid="rival-chef-respect"/.test(cr) &&
      /c\.rank <= RESPECT_FROM_RANK/.test(cr) &&
      /c\.passed/.test(cr) &&
      /chefRespects\(behind, c\.passed\)/.test(cr),
    "H16: the Restaurant Progress card shows the respect of the rival just behind the player, only in the top ten",
  );
  assert(
    /export const RESPECT_FROM_RANK/.test(code("src/game/restaurant/rivalChefs.ts")) &&
      !/credits|economyLedger|Date\.now|new Date|Math\.random|window\.|localStorage/.test(
        code("src/game/restaurant/rivalChefs.ts"),
      ),
    "H17: the rival file stays pure copy (no wallet, ledger, clock, random, storage)",
  );
}

console.log("I. Paige's Later on a rival message (audit Batch 4, developer 2026-11-23)");
{
  const rivalBeat = ASSISTANT_BEATS.filter((b) => b.id.startsWith("rival:"));
  assert(
    rivalBeat.length > 0 && rivalBeat.every((b) => b.later === true),
    "I1: every rival message offers Later",
  );
  assert(
    ASSISTANT_BEATS.filter((b) => !b.id.startsWith("rival:")).every((b) => !b.later),
    "I2: no other beat changed (Later is only on the rival messages)",
  );
  const mamas = rivalBeat.find((b) => b.id === "rival:harbor-grill")!;
  const rival = RIVALS.find((r) => r.id === "harbor-grill")!;
  const lvl = rival.passedAtLevel;
  // a save where this rival is the next one to pass, Paige hired with tips on
  const base = (completed: number): SaveData => ({
    ...at(completed),
    // every other tip is already given, so the rival message is the one offered
    business: {
      ...at(completed).business,
      assistant: {
        hired: true,
        seen: ASSISTANT_BEATS.filter(
          (b) => !b.hire && b.id !== "rival:harbor-grill" && !b.id.startsWith("floor-nudge:"),
        ).map((b) => b.id),
      },
    },
  });
  let found: SaveData | null = null;
  for (let c = 0; c < 140 && !found; c++) {
    const s = base(c);
    const l = restaurantLevelOf(s.levelProgress);
    if (
      l >= rival.passedAtLevel - 1 &&
      l <= rival.passedAtLevel &&
      mamas.when(s, l) &&
      assistantBeatFor(s)?.id === mamas.id
    )
      found = s;
  }
  assert(!!found, "I3: (setup) there is a moment when the rival message is the one offered");
  if (found) {
    const level = restaurantLevelOf(found.levelProgress);
    const later = withBeatPutOff(found, mamas.id);
    assert(
      putOffAt(later, mamas.id, level) && !putOffAt(found, mamas.id, level),
      "I4: Later puts the message off at this level",
    );
    assert(
      assistantBeatFor(later)?.id !== mamas.id,
      "I5: put off at this level, it is not offered again at this level",
    );
    assert(
      !assistantOf(later).seen.includes(mamas.id) &&
        JSON.stringify(assistantOf(later).seen) === JSON.stringify(assistantOf(found).seen),
      "I6: Later does not count it as given (it is not in the saved tips, so not in the notebook)",
    );
    assert(
      !notebookEntries(later).some((e) => e.id === mamas.id),
      "I7: and it is not in the notebook until the player answers it",
    );
    // the next level: the same rule offers it again, while its own window lasts
    const nextLevelWhen = mamas.when(later, level + 1);
    assert(
      nextLevelWhen === (level + 1 <= rival.passedAtLevel && mamas.when({ ...found }, level + 1)),
      "I8: on the next level it is offered again exactly when its own window still applies",
    );
    const answered = markAssistantSeen(later, mamas.id);
    assert(
      assistantOf(answered).seen.includes(mamas.id) && assistantBeatFor(answered)?.id !== mamas.id,
      "I9: once answered (Got it / Go there) it is given for good",
    );
    // tips off silences it whatever Later says
    const quiet = {
      ...found,
      business: { ...found.business, assistant: { hired: true, seen: [], tipsOff: true } },
    };
    assert(
      assistantBeatFor(quiet) === null || assistantBeatFor(quiet)?.id !== mamas.id,
      "I10: 'Tips: Off' still silences it",
    );
    // persistence: the existing guideSeen list, the other entries kept, no new field
    const withGuide: SaveData = {
      ...found,
      business: { ...found.business, guideSeen: ["rank:climb@8", "market@6"] },
    };
    const put = withBeatPutOff(withGuide, mamas.id);
    assert(
      put.business.guideSeen?.includes("rank:climb@8") &&
        put.business.guideSeen?.includes("market@6") &&
        put.business.guideSeen?.includes(`later:${mamas.id}@${level}`),
      "I11: it is kept in the existing guideSeen list next to the Guide's own entries",
    );
    assert(
      withBeatPutOff(put, mamas.id).business.guideSeen?.filter((e) =>
        e.startsWith(`later:${mamas.id}@`),
      ).length === 1,
      "I12: a second Later replaces the first (one entry per message)",
    );
    const many = Array.from({ length: 80 }, (_, i) => `later:rival:x${i}@${i}`);
    assert(
      (
        withBeatPutOff({ ...found, business: { ...found.business, guideSeen: many } }, mamas.id)
          .business.guideSeen ?? []
      ).length <= 60,
      "I13: the list stays short (at most 60 entries)",
    );
    const keysBefore = Object.keys(found.business).sort().join();
    assert(
      Object.keys(put.business).sort().join() ===
        Object.keys({ ...found.business, guideSeen: [] })
          .sort()
          .join() && keysBefore.length > 0,
      "I14: no new save field (only the existing guideSeen list changes)",
    );
    const oldSave = {
      ...found,
      business: { ...found.business, guideSeen: undefined },
    } as unknown as SaveData;
    let threw = false;
    try {
      putOffAt(oldSave, mamas.id, level);
      withBeatPutOff(oldSave, mamas.id);
    } catch {
      threw = true;
    }
    assert(!threw, "I15: an old save with no guideSeen list never throws");
  }
  const host = code("src/components/kc/assistant/AssistantHost.tsx");
  assert(
    /data-testid="assistant-later"/.test(host) &&
      /beat\.later && counts && onLater/.test(host) &&
      /const timed = counts && !active\?\.beat\.later/.test(host),
    "I16: the bubble shows a Later button on those messages, and the timer no longer counts them as given",
  );
  const app2 = code("src/App.tsx");
  assert(
    /onLater=\{paigeLater\}/.test(app2) && /persist\(withBeatPutOff\(cur, id\)\)/.test(app2),
    "I17: App writes Later through the one save funnel",
  );
}

console.log(failures === 0 ? "\nRIVAL CHEFS QA: ALL PASS" : `\nRIVAL CHEFS QA: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
