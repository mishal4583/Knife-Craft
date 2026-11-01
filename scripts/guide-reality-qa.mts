/**
 * GUIDE REALITY QA (developer 2026-11-01: "it shows you can afford the Santoku even before unlocking it, check for
 * these kinds of mistakes deeply and make sure they never affect the game logic in future").
 *
 * A recommendation is a promise: "you can afford X", "hire a Y", "open the Market". Every promise the guide
 * (restaurant/restaurantGuide.ts) can make must be TRUE by the game's own rules at that moment, judged by the SAME
 * predicates the Market, the Staff page and the Kitchen strip use (never by a second price check of its own).
 * This suite sweeps every level from 1 to 80 at five wallet sizes and, for every step the guide offers, asks the
 * game itself whether the thing is really there.
 *
 *   G. Knives and boards: a step names only an item the Market sells right now and the wallet covers, and the
 *      cheapest such item; a locked item is never recommended, at any level or wallet.
 *   S. Staff: the role can be hired at that level, is not hired yet, and is not on the starting team.
 *   K. Kitchen and fridge: the tier can be built now; the bigger fridge exists.
 *   B. Blacksmith, Second Floor, cleaning, suppliers: each step's own opening level has been reached.
 *   T. The tab locks: a section that is locked shows no attention count, and the Market states agree with the
 *      guide for every knife and board at every level (locked ⇒ never recommended).
 *   W. The wording: "You can afford" appears only on a step whose item is affordable.
 *
 * Run: npx tsx scripts/guide-reality-qa.mts
 */
const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => void Object.keys(store).forEach((k) => delete store[k]),
  key: () => null,
  length: 0,
} as Storage;

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const { guideStepsApplying } = await import("../src/game/restaurant/restaurantGuide.ts");
const { KNIFE_CATALOG } = await import("../src/game/knives/knifeDefinitions.ts");
const { BOARD_CATALOG } = await import("../src/game/boards/boardDefinitions.ts");
const { getKnifePurchaseState, isKnifeLevelUnlocked } =
  await import("../src/game/knives/KnifeManager.ts");
const { canBuy: canBuyBoard, isLevelUnlocked: boardUnlocked } =
  await import("../src/game/boards/BoardManager.ts");
const { staffHireFrom } = await import("../src/game/restaurant/staffRequirements.ts");
const { STARTING_TEAM_ROLES } = await import("../src/game/config/startingTeam.ts");
const { nextKitchenUpgrade } = await import("../src/game/kitchen/nextKitchenUpgrade.ts");
const { isSecondFloorOpen } = await import("../src/game/restaurant/secondFloor.ts");
const { isCleanlinessLive } = await import("../src/game/restaurant/cleanliness.ts");
const { PREP_COOK_CUTS_FROM } = await import("../src/game/restaurant/prepCookAuto.ts");
const { isSystemLive } = await import("../src/game/restaurant/restaurantProgression.ts");
const { TAB_OPENS_AT } = await import("../src/game/restaurant/firstLevels.ts");
const { attentionBadgesFor } = await import("../src/game/restaurant/attentionBadges.ts");

let failures = 0;
let checks = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  checks++;
  if (!cond) {
    failures++;
    console.log(`  FAIL ${msg}`);
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}

const saveAt = (n: number, credits: number): SaveData => ({
  ...DEFAULT_SAVE,
  credits,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 3,
  },
});
const WALLETS = [0, 5_000, 50_000, 5_000_000, 100_000_000_000];
const LEVELS = Array.from({ length: 80 }, (_, i) => i + 1);

let steps = 0;
for (const n of LEVELS) {
  for (const credits of WALLETS) {
    const s = saveAt(n, credits);
    for (const step of guideStepsApplying(s)) {
      steps++;
      const where = { level: n, credits, step: step.id };
      const [kind, id] = step.id.split(":") as [string, string | undefined];
      if (kind === "knife") {
        assert(
          id !== undefined && getKnifePurchaseState(s, id) === "affordable",
          "G1 a knife step is a knife the Market sells now and the wallet covers",
          where,
        );
        assert(
          id !== undefined && isKnifeLevelUnlocked(s, id),
          "G2 a knife step never names a locked knife",
          where,
        );
        const cheapest = [...KNIFE_CATALOG]
          .filter((k) => k.price > 0 && getKnifePurchaseState(s, k.id) === "affordable")
          .sort((a, b) => a.price - b.price)[0];
        assert(cheapest?.id === id, "G3 it is the cheapest knife the player can buy now", {
          ...where,
          cheapest: cheapest?.id,
        });
      } else if (kind === "board") {
        assert(
          id !== undefined && canBuyBoard(id, s),
          "G4 a board step is a board the Market sells now and the wallet covers",
          where,
        );
        assert(
          id !== undefined && boardUnlocked(id, s),
          "G5 a board step never names a locked board",
          where,
        );
      } else if (kind === "staff") {
        const role = id as string;
        assert(
          staffHireFrom(role) <= n,
          "S1 a staff step names a role that can be hired at this level",
          { ...where, from: staffHireFrom(role) },
        );
        assert(
          !s.business.staff.hiredRoles.includes(role as never),
          "S2 and one that is not hired yet",
          where,
        );
        assert(
          !(STARTING_TEAM_ROLES as readonly string[]).includes(role),
          "S3 and not the starting team (they are hired in the first shop)",
          where,
        );
      } else if (kind === "kitchen") {
        const next = nextKitchenUpgrade(s);
        assert(
          next?.id === id && next.state === "available",
          "K1 a kitchen step is the next tier, level reached and buildable",
          { ...where, state: next?.state },
        );
      } else if (step.id === "prep-cook-cuts") {
        assert(
          n >= PREP_COOK_CUTS_FROM && n >= staffHireFrom("prep-cook"),
          "B1 the Prep Cook step waits for the level he starts at",
          where,
        );
      } else if (step.id === "floor-machine" || step.id === "floor-server") {
        assert(isSecondFloorOpen(n), "B2 a 2nd-floor step only once the 2nd floor is open", where);
      } else if (step.id === "cleaning-supplies" || step.id === "cleaner") {
        assert(isCleanlinessLive(n), "B3 a cleaning step only once cleaning is live", where);
      } else if (step.id === "supplier") {
        assert(
          isSystemLive("fridge-freshness", n),
          "B4 the supplier step only once suppliers are live",
          where,
        );
      }
      if (/^You can afford/.test(step.title)) {
        const ok =
          (kind === "knife" && id !== undefined && getKnifePurchaseState(s, id) === "affordable") ||
          (kind === "board" && id !== undefined && canBuyBoard(id, s));
        assert(ok, 'W1 "You can afford …" is said only about something the player can buy', where);
      }
    }
  }
}
console.log(
  `  ${steps} guide steps checked across ${LEVELS.length} levels × ${WALLETS.length} wallets`,
);
assert(steps > 100, "the sweep reached real guide steps (not an empty loop)", { steps });

// T. For every knife and board at every level: a locked item is never the one recommended.
for (const n of LEVELS) {
  const s = saveAt(n, 100_000_000_000);
  const ids = guideStepsApplying(s).map((x) => x.id);
  for (const k of KNIFE_CATALOG) {
    if (getKnifePurchaseState(s, k.id) === "locked")
      assert(!ids.includes(`knife:${k.id}`), "T1 a locked knife is never recommended", {
        level: n,
        knife: k.id,
      });
  }
  for (const b of BOARD_CATALOG) {
    if (!boardUnlocked(b.id, s))
      assert(!ids.includes(`board:${b.id}`), "T2 a locked board is never recommended", {
        level: n,
        board: b.id,
      });
  }
  assert(
    s.levelProgress.highestUnlockedLevelId === `level-${n}`,
    "T3 the sweep's saves really are at the level they claim",
    { n },
  );
}

// The exact report: at Level 2 with the Santoku still locked, no step may offer it.
{
  const santoku = KNIFE_CATALOG.find((k) => /santoku/i.test(k.name));
  if (santoku) {
    for (const n of LEVELS) {
      const s = saveAt(n, 100_000_000_000);
      if (!isKnifeLevelUnlocked(s, santoku.id))
        assert(
          !guideStepsApplying(s).some((x) => x.id === `knife:${santoku.id}`),
          "R1 the reported bug: the locked Santoku is never offered as affordable",
          { level: n },
        );
    }
    assert(
      LEVELS.some((n) => !isKnifeLevelUnlocked(saveAt(n, 0), santoku.id)) &&
        LEVELS.some((n) => isKnifeLevelUnlocked(saveAt(n, 0), santoku.id)),
      "R2 the sweep covers both sides of the Santoku's unlock",
    );
  } else assert(false, "R0 the catalog has a Santoku");
}

// T4. A locked section shows no attention count (the red "!" on a lock).
for (const n of [1, 2, 3, 4, 5, 6]) {
  const s = saveAt(n, 100);
  const nav = attentionBadgesFor(s).nav as Record<string, number | undefined>;
  for (const tab of Object.keys(TAB_OPENS_AT) as (keyof typeof TAB_OPENS_AT)[]) {
    if (n < TAB_OPENS_AT[tab] && tab !== "business")
      assert(!nav[tab], `T4 a locked ${tab} tab shows no attention count`, { level: n });
  }
}

console.log(
  failures
    ? `\nGUIDE REALITY QA: ${failures} FAILURE(S) of ${checks}`
    : `\nGUIDE REALITY QA: ALL PASS (${checks} checks)`,
);
process.exit(failures ? 1 : 0);
