/**
 * PREP_COOK_AUTO_QA — the hired Prep Cook cuts for the player (developer 2026-10-30:
 * "after certain levels, if needed by the players, let them hire a Prep Cook to cut the
 * vegetables and ingredients and automate the restaurant fully").
 *   R. the rule (restaurant/prepCookAuto.ts): hired + from the unlock level + not a teaching run;
 *   G. the plate: always the plain Honest score, never better than a hand-cut Clean/Masterful one
 *      in pay or tip, and never worse than the neutral Honest settlement;
 *   S. the save: `settings.autoService` is optional (old saves read as off) and survives a load;
 *   H. the Prep Cook is paid by the hour only (no fee, his shift wage at every closing; developer
 *      2026-10-30), hiring opens at Level 5, and the guide offers it from the
 *      unlock level until hired;
 *   A. the wiring: App passes the Prep Cook only for a campaign service order and never on a
 *      teaching first play; Auto only repeats Serve / Collect cash / Next Customer, each latched once,
 *      and never buys anything.
 *
 * Run: npx tsx scripts/prep-cook-auto-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager } from "../src/game/SaveManager.ts";
import {
  AUTO_COLLECT_MS,
  AUTO_NEXT_MS,
  AUTO_SERVE_MS,
  PREP_COOK_CUTS_FROM,
  PREP_COOK_GRADE,
  PREP_COOK_SCORE,
  prepCookCanCut,
} from "../src/game/restaurant/prepCookAuto.ts";
import {
  STAFF_HIRE_FROM,
  closingWage,
  staffHireFee,
} from "../src/game/restaurant/staffRequirements.ts";
import { BUSINESS_STAFF_CATALOG, dailyPayroll } from "../src/game/business/businessStaff.ts";
import { TIPS, tipAmount } from "../src/game/economy/customerTips.ts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { guideStepsApplying } from "../src/game/restaurant/restaurantGuide.ts";
import type { SaveData } from "../src/game/SaveManager.ts";

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const src = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// ── R. the rule ──────────────────────────────────────────────────────────
const hired = ["prep-cook"] as const;
check("R1 not hired: never", !prepCookCanCut({ hiredRoles: [], level: 60, teaching: false }));
check(
  "R2 another role is not a Prep Cook",
  !prepCookCanCut({ hiredRoles: ["line-cook", "server"], level: 60, teaching: false }),
);
check(
  "R3 hired but before the unlock level: the board is the player's",
  !prepCookCanCut({ hiredRoles: hired, level: PREP_COOK_CUTS_FROM - 1, teaching: false }),
);
check(
  "R4 hired, at the unlock level: cuts",
  prepCookCanCut({ hiredRoles: hired, level: PREP_COOK_CUTS_FROM, teaching: false }),
);
check(
  "R5 a first play that teaches a technique is always by hand",
  !prepCookCanCut({ hiredRoles: hired, level: 60, teaching: true }),
);
check(
  "R6 the unlock level is after the hire opens (Level 5) and inside the campaign",
  PREP_COOK_CUTS_FROM > STAFF_HIRE_FROM && PREP_COOK_CUTS_FROM < 148,
  { from: PREP_COOK_CUTS_FROM, hire: STAFF_HIRE_FROM },
);

// ── G. the plate ─────────────────────────────────────────────────────────
check("G1 the grade is Honest", PREP_COOK_GRADE === "Honest");
check("G2 the score is in the Honest band (70–84)", PREP_COOK_SCORE >= 70 && PREP_COOK_SCORE < 85, {
  score: PREP_COOK_SCORE,
});
const recipe = CAMPAIGN_RECIPES.find((r) => r.components.length > 0)!;
const pay = (score: number) =>
  computeSettlement(recipe, 3, score, undefined, undefined, undefined, [], undefined).netResult;
check(
  "G3 a Prep Cook plate pays no more than a hand-cut Clean or Masterful one",
  pay(PREP_COOK_SCORE) <= pay(85) && pay(85) <= pay(96),
  { cook: pay(PREP_COOK_SCORE), clean: pay(85), masterful: pay(96) },
);
check("G4 and no less than a Rustic one", pay(PREP_COOK_SCORE) >= pay(55), {
  cook: pay(PREP_COOK_SCORE),
  rustic: pay(55),
});
check(
  "G5 the Honest tip share is below Clean and Masterful",
  TIPS.PCT_BY_GRADE.Honest < TIPS.PCT_BY_GRADE.Clean &&
    TIPS.PCT_BY_GRADE.Clean < TIPS.PCT_BY_GRADE.Masterful &&
    tipAmount(10000, TIPS.PCT_BY_GRADE.Honest) < tipAmount(10000, TIPS.PCT_BY_GRADE.Clean),
);

// ── S. the save ──────────────────────────────────────────────────────────
check("S1 a new game has Auto off", DEFAULT_SAVE.settings.autoService === undefined);
const loaded = await SaveManager.load();
check("S2 a loaded old save reads Auto as off", loaded.settings.autoService !== true);
const on = { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings, autoService: true } };
await SaveManager.save(on);
const again = await SaveManager.load();
check("S3 Auto on survives a save and load", again.settings.autoService === true, again.settings);
await SaveManager.reset();

// ── H. hiring ────────────────────────────────────────────────────────────
const fee = staffHireFee("prep-cook");
// Rule changed (developer 2026-10-30): the Prep Cook is paid by the hour only — no hiring fee, his full shift wage at every closing.
check(
  "H1 the Prep Cook has no hiring fee; closing pays his full shift wage from his first day",
  fee === 0 &&
    closingWage("prep-cook", PREP_COOK_CUTS_FROM) === dailyPayroll(["prep-cook"]) &&
    closingWage("prep-cook", 6) === dailyPayroll(["prep-cook"]) &&
    closingWage("prep-cook", 40) === dailyPayroll(["prep-cook"]),
  { fee },
);
check(
  "H2 the role says what it does",
  /cuts orders for you/i.test(BUSINESS_STAFF_CATALOG["prep-cook"].description),
  BUSINESS_STAFF_CATALOG["prep-cook"].description,
);
const guideAt = (n: number, roles: string[]): string[] => {
  const save: SaveData = {
    ...DEFAULT_SAVE,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 3,
    },
    business: { ...DEFAULT_SAVE.business, staff: { hiredRoles: roles as never[] } },
  };
  return guideStepsApplying(save).map((x) => x.id);
};
check(
  "H3 before the unlock level the guide does not offer it",
  !guideAt(PREP_COOK_CUTS_FROM - 1, []).includes("prep-cook-cuts"),
);
check(
  "H4 from the unlock level the guide offers it, until hired",
  guideAt(PREP_COOK_CUTS_FROM, []).includes("prep-cook-cuts") &&
    !guideAt(PREP_COOK_CUTS_FROM + 5, ["prep-cook"]).includes("prep-cook-cuts"),
  guideAt(PREP_COOK_CUTS_FROM, []),
);

// ── A. the wiring ────────────────────────────────────────────────────────
const app = src("src/App.tsx");
check(
  "A1 App offers the Prep Cook only for a restaurant campaign service order",
  /const prepCookOn =\s*RESTAURANT_MODE &&\s*isCampaignService &&/.test(app),
);
check(
  "A2 App hands over no teaching first play (taughtTechniques) and checks the level",
  /prepCookCanCut\(\{[\s\S]*?level: levelNumber\(activeLevel\.id\)[\s\S]*?taughtTechniques\(/.test(
    app,
  ),
);
check(
  "A3 the setting is flipped in one place and saved with the save",
  /function toggleAutoService\(\)[\s\S]*?autoService: save\.settings\.autoService !== true/.test(
    app,
  ),
);
const card = src("src/components/kc/game/ServiceOrderComplete.tsx");
// Rule changed (Phase 2 step 5, plan approved by the developer 2026-10-31): Auto works through the
// door queue, so it also presses the player's Menu guest button (a waiting guest it can serve).
check(
  "A4 Auto presses only the player's own taps (Serve, Collect cash, the Menu guest button, Next Customer)",
  /handleServe, AUTO_SERVE_MS|window\.setTimeout\(handleServe, AUTO_SERVE_MS\)/.test(card) &&
    /collect \? onCollectCash! : \(guest \?\? nextOnce\)/.test(card) &&
    /const guest = extraAction && !extraAction\.disabled \? extraAction\.onClick : null;/.test(
      card,
    ),
);
check(
  "A5 cash that has to be swiped by hand is never skipped",
  /if \(!collect && remaining > 0\) return;/.test(card),
);
check(
  "A6 a held party plate (card hidden) is not auto-advanced twice",
  /if \(!auto \|\| hidden \|\| served\) return;/.test(card) &&
    /if \(!auto \|\| hidden \|\| !served\) return;/.test(card),
);
const auto = src("src/game/restaurant/prepCookAuto.ts");
check(
  "A7 the rule module touches no wallet, ledger, random or purchase",
  !/Math\.random|debitWallet|appendLedgerEntry|purchase/i.test(
    auto.replace(/\/\*[\s\S]*?\*\//g, ""),
  ),
);
check(
  "A8 the beats are positive and ordered for the eye",
  AUTO_SERVE_MS > 0 && AUTO_NEXT_MS > 0 && AUTO_COLLECT_MS > AUTO_SERVE_MS,
);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
