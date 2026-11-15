/**
 * MINI-GAME PRAISE QA (developer 2026-11-14: "more appreciation from Paige when players go back to the kitchen home page after a mini-game
 * with 3 stars"). restaurant/miniGamePraise.ts; shown by App `notePraise` and her bubble (AssistantHost).
 *
 *  A  The rule: only three stars earn praise; every game has several lines; lines are short, name no level, and the pose is a happy one.
 *  B  It is pure and deterministic: the same input is the same words; the line rotates with how many she has given; a streak of 2 / 3+
 *     picks the streak lines; the beat is a celebration (success tone) with a `praise:` id that is not a tip.
 *  W  Wiring: App praises only real rounds of the five mini-games, only when she is hired and tips are on, holds it for a home screen,
 *     never writes it to the saved tips (the notebook), and the rule file moves no money and touches no clock or random.
 *
 * Run: npx tsx scripts/mini-game-praise-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { MAX_LINE_CHARS, PAIGE_POSES } from "../src/game/restaurant/assistant.ts";
import {
  PRAISE_LINES,
  PRAISE_STREAK,
  PRAISE_STREAK_LINES,
  PRAISE_STARS,
  isPraiseId,
  praiseBeat,
  praiseLine,
  type PraiseGame,
} from "../src/game/restaurant/miniGamePraise.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const GAMES = Object.keys(PRAISE_LINES) as PraiseGame[];

console.log("A. The rule");
{
  assert(
    GAMES.join() === "fridge-sort,stockroom,inspection,sauce,fridge-check,car-park",
    "A1: the six mini-games have praise (the Car Park joined on 2026-11-15)",
    GAMES,
  );
  assert(
    GAMES.every((g) => praiseLine({ game: g, stars: 2, streak: 1, given: 0 }) === null) &&
      GAMES.every((g) => praiseBeat({ game: g, stars: 0, streak: 0, given: 0 }) === null),
    "A2: under three stars there is no praise",
  );
  assert(
    GAMES.every((g) => praiseLine({ game: g, stars: PRAISE_STARS, streak: 1, given: 0 }) !== null),
    "A3: three stars earn praise in every game",
  );
  assert(
    GAMES.every((g) => PRAISE_LINES[g].length >= 4) && PRAISE_STREAK_LINES.length === 2,
    "A4: each game has at least four lines (so she does not repeat herself at once), and there are two streak lines",
  );
  const all = [...GAMES.flatMap((g) => PRAISE_LINES[g]), ...PRAISE_STREAK_LINES];
  assert(
    all.every((l) => l.length > 0 && l.length <= MAX_LINE_CHARS),
    "A5: every line is one short bubble (at most MAX_LINE_CHARS)",
    all.filter((l) => l.length > MAX_LINE_CHARS),
  );
  assert(
    all.every((l) => !/\blevel\s*\d|\bL\d+\b/i.test(l)) && new Set(all).size === all.length,
    "A6: no line names a level (ui-copy-qa U1) and no line is repeated",
  );
}

console.log("B. Deterministic, and what the bubble gets");
{
  const a = praiseLine({ game: "sauce", stars: 3, streak: 1, given: 5 });
  const b = praiseLine({ game: "sauce", stars: 3, streak: 1, given: 5 });
  assert(JSON.stringify(a) === JSON.stringify(b), "B1: the same input gives the same words");
  const seen = new Set(
    [0, 1, 2, 3].map((n) => praiseLine({ game: "stockroom", stars: 3, streak: 1, given: n })!.text),
  );
  assert(seen.size === 4, "B2: four praises in a row in one game are four different lines", [
    ...seen,
  ]);
  const wrap = praiseLine({ game: "stockroom", stars: 3, streak: 1, given: 4 })!.text;
  assert(
    wrap === PRAISE_LINES.stockroom[0],
    "B3: after the last line she starts again from the first",
  );
  const two = praiseLine({ game: "inspection", stars: 3, streak: 2, given: 0 })!.text;
  const three = praiseLine({ game: "inspection", stars: 3, streak: PRAISE_STREAK, given: 0 })!.text;
  const six = praiseLine({ game: "inspection", stars: 3, streak: 6, given: 0 })!.text;
  assert(
    two === PRAISE_STREAK_LINES[0] &&
      three === PRAISE_STREAK_LINES[1] &&
      six === PRAISE_STREAK_LINES[1],
    "B4: a second perfect round in a row is 'another three stars', three or more is 'on fire'",
    { two, three, six },
  );
  const poses = [0, 1, 2, 3].map(
    (n) => praiseLine({ game: "sauce", stars: 3, streak: 1, given: n })!.pose,
  );
  assert(
    poses.every((p) => PAIGE_POSES.includes(p) && (p === "cheer" || p === "clap")) &&
      new Set(poses).size === 2,
    "B5: she cheers or claps, one after the other",
    poses,
  );
  const beat = praiseBeat({ game: "fridge-check", stars: 3, streak: 1, given: 7 })!;
  assert(
    beat.id === "praise:fridge-check:7" &&
      isPraiseId(beat.id) &&
      !isPraiseId("meet") &&
      beat.tone === "success" &&
      beat.lines.length === 1 &&
      beat.priority >= 100 &&
      !beat.hire &&
      !beat.go &&
      !beat.target,
    "B6: the beat is one celebration bubble (success tone), nothing to press but OK, and its id marks it as praise, not a tip",
    beat,
  );
}

console.log("W. Wiring");
{
  const rule = read("src/game/restaurant/miniGamePraise.ts");
  const app = read("src/App.tsx");
  assert(
    !/Math\.random|Date\.now|performance\.now|new Date|credits|economyLedger|SaveData/.test(
      rule.replace(/\/\*[\s\S]*?\*\//g, ""),
    ),
    "W1: the rule file is pure: no clock, no random, no money, no save",
  );
  const n = (app.match(/notePraise\(/g) ?? []).length;
  assert(
    n === 7 &&
      ["fridge-sort", "inspection", "sauce", "stockroom", "fridge-check", "car-park"].every((g) =>
        app.includes(`notePraise("${g}"`),
      ),
    "W2: App praises each of the six mini-games when a round finishes (the function plus six calls)",
    { n },
  );
  assert(
    /!assistantHired\(cur\) \|\| assistantOf\(cur\)\.tipsOff/.test(app) &&
      /if \(stars < PRAISE_STARS\) \{\s*run\.streak = 0;/.test(app),
    "W3: only a hired Paige with tips on says it; a round under three stars ends the run",
  );
  assert(
    /if \(isPraiseId\(id\)\) \{\s*setPaigePraise\(null\);[\s\S]*?return;/.test(app) &&
      /screen === "kitchen" \? paigePraise : null\) \?\? assistantBeatFor\(save\)/.test(app),
    "W4: the praise goes first at the next calm home screen, is cleared when shown, and is never marked seen in the save (the notebook)",
  );
  assert(
    /result\.checkEffects\)\s*notePraise\("fridge-check"/.test(app),
    "W5: the Fridge Check praises only a finished real round (the check effects exist)",
  );
}

console.log(
  failures ? `\nMINI-GAME PRAISE QA: ${failures} FAILURE(S)` : "\nMINI-GAME PRAISE QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
