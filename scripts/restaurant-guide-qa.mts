/**
 * RESTAURANT GUIDE QA (developer 2026-10-29): the game tells the player what to
 * do next and why — the 2nd floor, a machine, a Floor Server, staff, the
 * kitchen and fridge upgrades, achievements, the city ranking.
 *
 *   A. Nothing before it makes sense; the first steps arrive in order
 *   B. A step is done when its rule stops applying (never nags after)
 *   C. Put off ("Later"): not offered again until 10 levels later; intros once
 *   D. Save: guideSeen survives the real SaveManager load; old saves are fine
 *   E. Wiring: the Kitchen card, one step per level, no money, no randomness
 *
 * Run: npx tsx scripts/restaurant-guide-qa.mts
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

const { DEFAULT_SAVE, SaveManager } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const { REMIND_EVERY_LEVELS, guideStepDue, guideStepFor, guideStepsApplying, markGuideSeen } =
  await import("../src/game/restaurant/restaurantGuide.ts");
const { STATIONS } = await import("../src/game/restaurant/secondFloor.ts");

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) =>
  fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), p), "utf8");

const saveAt = (n: number, patch: Partial<SaveData> = {}): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 0,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    // The current campaign numbering (the real loader remaps saves without it).
    campaignVersion: 3,
  },
  ...patch,
});
const ids = (s: SaveData) => guideStepsApplying(s).map((x) => x.id);

console.log("A. Pacing");
{
  assert(
    guideStepFor(saveAt(1)) === null && guideStepFor(saveAt(3)) === null,
    "A1: nothing in the first levels (Grandma's tips cover them)",
  );
  const l5 = saveAt(5);
  assert(
    ids(l5).includes("floor-machine") &&
      guideStepsApplying(l5).find((x) => x.id === "floor-machine")?.to === "second-floor",
    "A2: from Level 5 the 2nd floor is introduced, with a button to it",
    ids(l5),
  );
  assert(
    ids(saveAt(7)).includes("achievements-intro"),
    "A3: achievements are introduced from Level 6",
  );
  assert(
    ids(saveAt(9)).some((i) => i.startsWith("rank:")),
    'A4: from Level 8 the city ranking motivates ("your restaurant is #N")',
  );
  const rank = guideStepsApplying(saveAt(12)).find((x) => x.id.startsWith("rank:"))!;
  assert(
    /#\d+ of \d+/.test(rank.title) && /reputation/.test(rank.why) && rank.to === "rack",
    "A5: the ranking step names the rank and the next rival, and opens Progress",
    rank,
  );
  const tier = guideStepsApplying(saveAt(30, { credits: 3_000_000 })).find((x) =>
    x.id.startsWith("kitchen:"),
  );
  assert(
    !!tier && tier.to === "business-kitchen-upgrades" && /\$/.test(tier.why),
    "A6: once a kitchen tier can be built, the guide says so with its price",
    tier,
  );
  assert(
    !ids(saveAt(30)).some((i) => i.startsWith("kitchen:")),
    "A6b: a player with an empty wallet is not sent to buy the kitchen (it appears once a third is saved)",
  );
  const first = guideStepFor(saveAt(5));
  assert(
    first?.id === "floor-machine",
    "A7: the first step is the one that matters most right now (the 2nd floor)",
    first?.id,
  );
}

console.log("A2. Early purchase goals (developer 2026-10-30: things to do through Level 30)");
{
  const rich = saveAt(8, { credits: 5_000_000 });
  const poor = saveAt(8, { credits: 500 });
  const idsRich = ids(rich);
  assert(
    idsRich.some((i) => i.startsWith("knife:")) &&
      idsRich.some((i) => i.startsWith("board:")) &&
      idsRich.includes("blacksmith"),
    "G1: with the money in hand the guide offers a better knife, a better board and the Blacksmith",
    idsRich,
  );
  assert(
    !ids(poor).some((i) => i.startsWith("knife:") || i.startsWith("board:") || i === "blacksmith"),
    "G2: it never offers what the player cannot afford",
  );
  assert(
    !ids(saveAt(2, { credits: 5_000_000 })).some((i) => i.startsWith("knife:")),
    "G3: nothing before Level 3",
  );
}

console.log("B. Done means gone");
{
  const station = STATIONS[0]!;
  const withMachine = saveAt(6, {
    business: {
      ...DEFAULT_SAVE.business,
      secondFloor: { stations: { [station.id]: { level: 1, lastCollectAt: 0 } } },
    },
  });
  const a = ids(withMachine);
  assert(
    !a.includes("floor-machine") && a.includes("floor-server"),
    'B1: with a machine the step becomes "hire a Floor Server"',
    a,
  );
  const staffed = {
    ...withMachine,
    business: {
      ...withMachine.business,
      secondFloor: { ...withMachine.business.secondFloor!, servers: 1 },
    },
  };
  const b = ids(staffed);
  assert(
    !b.includes("floor-machine") && !b.includes("floor-server"),
    "B2: with a machine and a server the 2nd-floor steps are finished",
    b,
  );
  const hired = saveAt(10, {
    business: { ...DEFAULT_SAVE.business, staff: { hiredRoles: ["line-cook"] as never } },
  });
  assert(
    !ids(hired).includes("staff-first"),
    'B3: with staff hired, "hire your first helper" is gone',
  );
  assert(
    ids(saveAt(10)).includes("staff-first"),
    "B4: with no staff at Level 10, the guide asks for a first helper",
  );
}

console.log("C. Later, reminders, one-off intros");
{
  const s = saveAt(5);
  const step = guideStepFor(s)!;
  const later = markGuideSeen(s, step);
  assert(
    later.business.guideSeen?.includes(`${step.id}@5`) && guideStepFor(later)?.id !== step.id,
    "C1: after Later the same step is not offered again at once",
    later.business.guideSeen,
  );
  assert(
    guideStepDue(step, later.business.guideSeen ?? [], 5 + REMIND_EVERY_LEVELS - 1) === false &&
      guideStepDue(step, later.business.guideSeen ?? [], 5 + REMIND_EVERY_LEVELS) === true,
    "C2: a put-off step returns after 10 levels (while it still applies)",
  );
  const intro = guideStepsApplying(saveAt(7)).find((x) => x.id === "achievements-intro")!;
  const seenIntro = [`achievements-intro@7`];
  assert(
    guideStepDue(intro, seenIntro, 7 + 100) === false,
    "C3: a one-off intro is never offered a second time",
  );
  const many = Array.from({ length: 5 }, (_, i) =>
    markGuideSeen(saveAt(5 + i), { ...step, id: `x${i}` }),
  );
  void many;
  let s2 = saveAt(9);
  for (let i = 0; i < 80; i++) s2 = markGuideSeen(s2, { ...step, id: `t${i}` });
  assert((s2.business.guideSeen?.length ?? 0) <= 60, "C4: the seen list stays bounded");
  assert(
    s.credits === later.credits && s.economyLedger.length === later.economyLedger.length,
    "C5: no money moves, no ledger entry",
  );
}

console.log("D. Save");
{
  const step = guideStepFor(saveAt(5))!;
  const withSeen = markGuideSeen(saveAt(5), step);
  store["knifecraft.save.v1"] = JSON.stringify(withSeen);
  (SaveManager as unknown as { cache: unknown }).cache = null;
  const loaded = await SaveManager.load();
  assert(
    JSON.stringify(loaded.business.guideSeen) === JSON.stringify(withSeen.business.guideSeen),
    "D1: guideSeen survives the real SaveManager load",
    loaded.business.guideSeen,
  );
  const { guideSeen: _drop, ...rest } = withSeen.business;
  store["knifecraft.save.v1"] = JSON.stringify({ ...withSeen, business: rest });
  (SaveManager as unknown as { cache: unknown }).cache = null;
  const old = await SaveManager.load();
  assert(
    old.business.guideSeen === undefined && guideStepFor(old) !== null,
    "D2: an old save with no guideSeen loads and still gets its first step",
  );
}

console.log("E. Wiring");
{
  const app = read("src/App.tsx");
  const mod = read("src/game/restaurant/restaurantGuide.ts");
  assert(
    /guideStepFor\(save\)/.test(app) &&
      /<GuideCard/.test(app) &&
      /markGuideSeen\(saveRef\.current, guideStep\)/.test(app) &&
      /guideLevelRef\.current !== guideAtLevel/.test(app) &&
      /homeCalm[\s\S]{0,200}screen === "kitchen"/.test(app),
    "E1: App shows the card on the calm Kitchen, once per level, and saves it as seen",
  );
  assert(
    !/Math\.random|Date\.now|credits\s*[-+]?=|appendLedgerEntry/.test(mod),
    "E2: the guide is deterministic and never touches money or the ledger",
  );
}

console.log(
  failures ? `\nRESTAURANT GUIDE QA: ${failures} FAILURE(S)` : "\nRESTAURANT GUIDE QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
