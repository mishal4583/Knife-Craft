/**
 * COACHING_QA — beginner coaching (src/game/coaching.ts, the ghost
 * demonstration in scenes/coachGhost.ts + PreparationScene, the how-to card
 * in Preparation.tsx).
 *
 * Run: npx tsx scripts/coaching-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { TECHNIQUES, type TechniqueId } from "../src/game/definitions.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { levelNumber } from "../src/game/levels/levelMastery.ts";
import {
  COACH_TEXT,
  TEACH_ALL_THROUGH_LEVEL,
  taughtTechniques,
  COACH_FIRST_DELAY_MS,
  COACH_STUCK_IDLE_MS,
  BEGINNER_HINT_THROUGH_LEVEL,
  showsBeginnerHint,
} from "../src/game/coaching.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else console.log(`ok   ${label}`);
}

const ALL = Object.keys(TECHNIQUES) as TechniqueId[];

// A: every technique has a how-to card.
assert(
  ALL.every((t) => COACH_TEXT[t] && COACH_TEXT[t].title && COACH_TEXT[t].how && COACH_TEXT[t].why),
  `A: every technique (${ALL.length}) has a how-to card: title, how, why`,
);

// B: Levels 1–5 teach everything they ask for.
assert(
  LEVELS.filter((l) => levelNumber(l.id) <= TEACH_ALL_THROUGH_LEVEL).every(
    (l) => taughtTechniques(l.id, ALL).length === ALL.length,
  ),
  "B: every step of Levels 1–5 is taught",
);

// C: every technique is taught in the level that introduces it — and the first is the level that introduces it.
const taughtAt = new Map<TechniqueId, number[]>();
for (const l of LEVELS) {
  const n = levelNumber(l.id);
  if (n <= TEACH_ALL_THROUGH_LEVEL) continue;
  for (const t of taughtTechniques(l.id, ALL)) taughtAt.set(t, [...(taughtAt.get(t) ?? []), n]);
}
const firstUse = (t: TechniqueId) =>
  Math.min(
    ...LEVELS.filter((l) => l.preparationSteps.some((s) => s.technique === t)).map((l) =>
      levelNumber(l.id),
    ),
  );
const late = ALL.filter((t) => firstUse(t) > TEACH_ALL_THROUGH_LEVEL);
assert(
  late.every((t) => (taughtAt.get(t) ?? []).includes(firstUse(t))),
  `C: a technique first used after Level 5 is taught in the level that introduces it (${late
    .map((t) => `${t}@${firstUse(t)}`)
    .join(", ")})`,
);
assert(
  [...taughtAt.values()].every((levels) => levels.length === 1) &&
    [...taughtAt.values()].flat().length === late.length,
  `C2: after Level 5 each new technique is taught once, in the level that introduces it — and nothing else (${[...taughtAt.values()].flat().join(", ")})`,
);

// D: a level teaches only what its session asks for; later levels teach nothing new.
assert(
  JSON.stringify(taughtTechniques("level-1", ["slice"])) === '["slice"]' &&
    taughtTechniques("level-150", ALL).length === 0,
  "D: the session's own techniques only; Level 150 teaches nothing",
);

// E: only when it helps — timing and the stuck rule.
assert(
  COACH_FIRST_DELAY_MS < 1500 && COACH_STUCK_IDLE_MS <= 6000,
  `E: a taught step demonstrates after ${COACH_FIRST_DELAY_MS} ms, then only if the player is stuck (no progress, ${COACH_STUCK_IDLE_MS} ms idle)`,
);
{
  const scene = read("src/game/scenes/PreparationScene.ts");
  const fn = scene.slice(
    scene.indexOf("private updateCoach"),
    scene.indexOf("private coachTargetNow"),
  );
  assert(
    /this\.coachTeach\.has\(this\.technique\.id\) &&/.test(fn) &&
      /!this\.coachStepProgressed\(\) && now - this\.coachInputT >= COACH_STUCK_IDLE_MS/.test(fn) &&
      !/COACH_IDLE_MS/.test(scene),
    "E2: an untaught step never demonstrates; a taught one returns only while no progress has been made",
  );
}

// F: wiring — the scene only draws; the demonstration never changes cut/peel/score state.
const scene = read("src/game/scenes/PreparationScene.ts");
const coachBody = scene.slice(
  scene.indexOf("private coachBlocked"),
  scene.indexOf("/** Ported from knifecraft.html drawKnifeBody"),
);
assert(
  /drawCoachGhost/.test(scene) &&
    /EVT\.COACH/.test(scene) &&
    coachBody.length > 0 &&
    !/this\.(cuts|peeled|usedGuide\[[^\]]*\]\[[^\]]*\])\s*=|commitCut|markPeelSegmentCovered|ensureGuidesFor/.test(
      coachBody,
    ),
  "F: the coach code only reads cut/peel state (no commits, no guide consumption)",
);
const prep = read("src/components/kc/game/Preparation.tsx");
assert(
  /data-testid="coach-card"/.test(prep) &&
    /pointer-events-none/.test(
      prep.slice(prep.indexOf("coach-card") - 200, prep.indexOf("coach-card")),
    ),
  "F2: the how-to card never blocks a tap (pointer-events-none)",
);
const app = read("src/App.tsx");
assert(
  /\(isCampaignService \|\| isBatchGroup \|\| sessionMode === "campaign"\) &&\s*save &&\s*!save\.levelProgress\.completedLevelIds\.includes\(activeLevel\.id\)/.test(
    app,
  ) &&
    (app.match(/\{\.\.\.\(coachLevelId \? \{ coachLevelId \} : \{\}\)\}/g) ?? []).length === 2 &&
    /const campaignId = coachLevelId;/.test(prep),
  "F3: coaching only in a campaign level played for the first time — never a replay, Today's Special, Endless, Restaurant Service or Business",
);
assert(
  showsBeginnerHint("level-1") &&
    showsBeginnerHint(`level-${BEGINNER_HINT_THROUGH_LEVEL}`) &&
    !showsBeginnerHint(`level-${BEGINNER_HINT_THROUGH_LEVEL + 1}`) &&
    !showsBeginnerHint(undefined) &&
    /showHint && phase === "prep" && showsBeginnerHint\(coachLevelId\)/.test(prep),
  `F4: the plain one-line gesture hint shows only in Levels 1–${BEGINNER_HINT_THROUGH_LEVEL} on a first play`,
);

console.log(failures === 0 ? "\nCOACHING QA: ALL PASS" : `\nCOACHING QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
