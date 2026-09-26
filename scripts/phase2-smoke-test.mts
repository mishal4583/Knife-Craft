/**
 * PHASE 2 SMOKE TEST — pure-logic assertions for the restaurant-service
 * loop (brief §43), run the same way as scripts/phase1-smoke-test.mts:
 *   node --experimental-strip-types scripts/phase2-smoke-test.mts
 * (bundled with esbuild first, since plain Node ESM can't resolve this
 * project's extensionless TS imports).
 */
import {
  createServiceSession,
  recordAllComponents,
  serveCurrentOrder,
  advanceServiceSession,
  sharesComponentWithNext,
  poolUnlockedByLevel,
} from "../src/game/service/ServiceManager.ts";
import { TEST_RECIPE_POOL } from "../src/game/service/testRecipePool.ts";
// USD: an order pays its recipe's whole-dollar basePayment as wallet cents (money.ts dollars()).
import { dollars } from "../src/game/money.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// 1. Pool gating — never offers a locked recipe (chicken needs level 101).
const earlyPool = poolUnlockedByLevel(TEST_RECIPE_POOL, 10);
assert(
  earlyPool.every((r) => r.unlockLevel <= 10) &&
    !earlyPool.some((r) => r.id === "service-chicken-two-ways"),
  "poolUnlockedByLevel(10) excludes the chicken recipe (unlockLevel 101)",
);
const fullPool = poolUnlockedByLevel(TEST_RECIPE_POOL, 120);
assert(
  fullPool.length === TEST_RECIPE_POOL.length,
  "poolUnlockedByLevel(120) includes the full test pool",
);

// 2. Session creation — current is ACTIVE, next is PENDING, both real.
let session = createServiceSession("service-test", fullPool, Math.random);
assert(
  session.current !== null && session.current.order.status === "ACTIVE",
  "new session's current order is ACTIVE",
);
assert(
  session.next !== null && session.next.order.status === "PENDING",
  "new session's next order is still PENDING (§8)",
);
assert(session.recent === null, "new session has no recent order yet");

// 3. recordAllComponents drives ACTIVE -> PREPARING -> READY for a real recipe.
const cucumberSession = createServiceSession("t", [TEST_RECIPE_POOL[0]!], Math.random); // single-component recipe
assert(cucumberSession.current!.order.status === "ACTIVE", "single-component order starts ACTIVE");
const afterComponents = recordAllComponents(cucumberSession);
assert(
  afterComponents.current!.order.status === "READY",
  "recording its one component takes a single-component order straight to READY",
);

// 4. Serve is refused before READY; succeeds exactly once at READY; payment happens exactly once.
const notReadySession = createServiceSession("t", [TEST_RECIPE_POOL[0]!], Math.random);
assert(
  serveCurrentOrder(notReadySession) === null,
  "serveCurrentOrder refuses an order that is not READY",
);
const readyResult = serveCurrentOrder(afterComponents)!;
assert(readyResult !== null, "serveCurrentOrder succeeds once the order is READY");
assert(
  readyResult.coinsAwarded === dollars(TEST_RECIPE_POOL[0]!.basePayment),
  "serve pays exactly the recipe's basePayment (in dollars)",
);
assert(
  readyResult.session.current!.order.status === "COMPLETED",
  "served order reaches COMPLETED (SERVED->PAID->COMPLETED bundled)",
);
assert(
  serveCurrentOrder(readyResult.session) === null,
  "serving an already-COMPLETED order is refused (no double payment)",
);

// 5. advanceServiceSession: current(COMPLETED)->recent, next->current(ACTIVE), fresh next generated.
const beforeAdvance = readyResult.session;
const previousNextRecipeId = beforeAdvance.next!.recipe.id;
const advanced = advanceServiceSession(beforeAdvance, fullPool, Math.random);
assert(
  advanced.recent !== null && advanced.recent.order.status === "COMPLETED",
  "advanceServiceSession moves the completed order to recent",
);
assert(
  advanced.current !== null && advanced.current.recipe.id === previousNextRecipeId,
  "the old NEXT recipe becomes the new CURRENT",
);
assert(
  advanced.current!.order.status === "ACTIVE",
  "the newly-promoted current order is activated (PENDING->ACTIVE)",
);
assert(advanced.next !== null, "a brand-new NEXT order is generated");
assert(
  advanceServiceSession(advanced, fullPool, Math.random).current === advanced.current,
  "advanceServiceSession is a no-op once current is ACTIVE again (not yet re-served)",
);
assert(
  advanceServiceSession(session, fullPool, Math.random).current === session.current,
  "advanceServiceSession no-ops on a freshly-created (unserved) session",
);

// 6. Shared/batching detection — the two tomato-dice recipes are detected as shareable when adjacent.
const tomatoSalad = TEST_RECIPE_POOL.find((r) => r.id === "service-tomato-onion-salad")!;
const gardenBowl = TEST_RECIPE_POOL.find((r) => r.id === "service-garden-tomato-bowl")!;
let batchSession = createServiceSession("t", [tomatoSalad], Math.random);
batchSession = { ...batchSession, next: { ...batchSession.next!, recipe: gardenBowl } };
const shared = sharesComponentWithNext(batchSession);
assert(
  shared !== null && shared.ingredientId === "tomato" && shared.technique === "dice",
  "sharesComponentWithNext detects the shared tomato-dice component",
);
const garlicMushroomBowl = TEST_RECIPE_POOL.find((r) => r.id === "service-garlic-mushroom-bowl")!;
let noOverlapSession = createServiceSession("t", [tomatoSalad], Math.random);
noOverlapSession = {
  ...noOverlapSession,
  next: { ...noOverlapSession.next!, recipe: garlicMushroomBowl },
};
assert(
  sharesComponentWithNext(noOverlapSession) === null,
  "sharesComponentWithNext returns null when current/next share no ingredient+technique",
);
assert(
  sharesComponentWithNext({ ...noOverlapSession, next: null }) === null,
  "sharesComponentWithNext returns null when there is no next order",
);

// 7. Shared-output recipe ("Family Bruschetta for Two") — one prepared output satisfies both plates.
const familyRecipe = TEST_RECIPE_POOL.find((r) => r.id === "service-family-bruschetta")!;
let familySession = createServiceSession("t", [familyRecipe], Math.random);
familySession = recordAllComponents(familySession);
assert(
  familySession.current!.order.status === "READY",
  "the shared-output recipe becomes READY after recording its (shared) components once",
);
assert(
  familySession.current!.session.outputs.length === 2 &&
    familySession.current!.session.outputs.every((o) => o.assignedTo.length === 2),
  "each of the 2 components produced exactly 1 output, each assigned to both plates (not duplicated per plate)",
);

// 8. Branching recipe ("Chicken Two Ways") — two independent cuts, two destinations, both required.
const chickenRecipe = TEST_RECIPE_POOL.find((r) => r.id === "service-chicken-two-ways")!;
let chickenSession = createServiceSession("t", [chickenRecipe], Math.random);
assert(
  chickenSession.current!.recipe.components.length === 2,
  "the branching recipe has 2 independent components",
);
chickenSession = recordAllComponents(chickenSession);
assert(
  chickenSession.current!.order.status === "READY",
  "the branching recipe becomes READY once both independent cuts are recorded",
);
assert(
  chickenSession.current!.session.outputs.length === 2,
  "the branching recipe produced 2 separate outputs (not 1 shared one)",
);

// 9. Customer progression across a two-order sequence (§27).
let queue = createServiceSession("t", earlyPool, () => 0.999); // bias customer picks toward the roster's last entry for variety
const firstCustomerId = queue.current!.customer.id;
queue = recordAllComponents(queue);
const serve1 = serveCurrentOrder(queue)!;
queue = advanceServiceSession(serve1.session, earlyPool, Math.random);
assert(
  queue.recent!.customer.id === firstCustomerId,
  "after serving, the first customer is preserved in RECENT",
);
assert(queue.current !== null, "a second customer is now CURRENT");

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
