/**
 * CAMPAIGN PAID ORDERS QA — developer decision #5: completed orders are
 * saved, so leaving a multi-order level and retrying never pays them twice.
 *
 *  A. Rules (levels/paidOrders.ts): what a level still owes, per order
 *     (service levels) and per customer (batch groups); none on a completed
 *     level; recording and clearing.
 *  B. LevelManager.completeLevel drops the level's entry and leaves a save
 *     without one exactly as before.
 *  C. Sessions (real ServiceManager): a retried service level starts with
 *     its paid orders counted; a retried batch group starts with its paid
 *     customers served; the level finishes after the rest only.
 *  D. The exploit, replayed with the real rules: serve 1 of 2 → leave →
 *     retry → serve 2 pays exactly 2 orders, never 3; honest play pays the
 *     same orders as before.
 *  E. Saves: the entry survives the real SaveManager save/load; an old save
 *     without it loads unchanged.
 *  F. Wiring in App.tsx.
 *
 * Browser: tools/e2e/paidorders.mjs (a real Level 30 retry).
 *
 * Run: npx tsx scripts/campaign-paid-orders-qa.mts
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
import { getLevel, completeLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import {
  mayPayOrder,
  ordersRequired,
  paidOrdersFor,
  withPaidOrder,
  withoutPaidOrders,
} from "../src/game/levels/paidOrders.ts";
import {
  createServiceSession,
  createBatchGroupSession,
  withOrdersAlreadyServed,
  withBatchOrdersAlreadyServed,
  currentBatchOrder,
  isBatchGroupComplete,
} from "../src/game/service/ServiceManager.ts";
import { getCampaignRecipe, type RecipeDefinition } from "../src/game/recipes/campaignRecipes.ts";
import { SaveManager, DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const service = getLevel("level-30")!; // requiredOrders 2
const batch = getLevel("level-70")!; // 3-customer batch group
const progressAt = (n: number): LevelProgress => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});

console.log("A. Rules");
{
  const p0 = progressAt(30);
  assert(
    ordersRequired(service) === 2 && ordersRequired(batch) === 3,
    "A1: orders required: 2 and 3",
  );
  assert(paidOrdersFor(p0, service.id).length === 0, "A2: nothing recorded on a fresh save");
  const p1 = withPaidOrder(p0, service.id, "r1");
  const p2 = withPaidOrder(p1, service.id, "r2");
  assert(
    mayPayOrder(p0, service, "x") &&
      mayPayOrder(p1, service, "x") &&
      !mayPayOrder(p2, service, "x"),
    "A3: a service level pays only while it still owes an order (2 of 2 paid → no more)",
  );
  assert(
    p0.paidOrders === undefined && p1.paidOrders?.[service.id]?.join() === "r1",
    "A4: recording is pure and kept per level",
  );
  const done = { ...p0, completedLevelIds: [...p0.completedLevelIds, service.id] };
  assert(!mayPayOrder(done, service, "x"), "A5: a completed level never pays through this rule");
  const recipes = batch.batchGroupRecipeIds!;
  const b1 = withPaidOrder(progressAt(70), batch.id, recipes[0]!);
  assert(
    !mayPayOrder(b1, batch, recipes[0]!) && mayPayOrder(b1, batch, recipes[1]!),
    "A6: a batch group pays each customer once",
  );
  assert(
    withoutPaidOrders(p2, service.id).paidOrders?.[service.id] === undefined &&
      withoutPaidOrders(p0, service.id) === p0,
    "A7: clearing drops the entry and leaves a save without one untouched",
  );
}

console.log("B. completeLevel");
{
  const p = withPaidOrder(withPaidOrder(progressAt(30), service.id, "a"), "level-31", "b");
  const r = completeLevel(service.id, p);
  assert(
    r.isFirstCompletion &&
      r.progress.paidOrders?.[service.id] === undefined &&
      r.progress.paidOrders?.["level-31"]?.join() === "b",
    "B1: completing the level drops its own entry only",
  );
  const plain = completeLevel(service.id, progressAt(30));
  assert(!("paidOrders" in plain.progress), "B2: a save without the field gets no new key");
}

console.log("C. Sessions");
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
{
  const pool = service
    .recipePoolIds!.map((id) => getCampaignRecipe(id))
    .filter((r): r is RecipeDefinition => !!r);
  const s = createServiceSession(service.id, pool, rand, service.chapter, false);
  const retry = withOrdersAlreadyServed(s, 1);
  assert(
    s.completedCount === 0 && retry.completedCount === 1 && retry.current === s.current,
    "C1: a retried service level starts with its 1 paid order counted, a new order to serve",
  );
  assert(
    retry.completedCount + 1 >= ordersRequired(service),
    "C2: serving that one order finishes the level (App's campaignWillFinishNext)",
  );
}
{
  const recipes = batch
    .batchGroupRecipeIds!.map((id) => getCampaignRecipe(id))
    .filter((r): r is RecipeDefinition => !!r);
  const g = createBatchGroupSession(batch.id, recipes, rand, batch.chapter, false);
  const retry = withBatchOrdersAlreadyServed(g, [recipes[0]!.id]);
  assert(
    retry.orders[0]!.order.status === "COMPLETED" &&
      retry.orders.slice(1).every((o) => o.order.status !== "COMPLETED") &&
      currentBatchOrder(retry)?.recipe.id === recipes[1]!.id,
    "C3: a retried batch group starts with the paid customer served, the next one current",
  );
  assert(
    isBatchGroupComplete(
      withBatchOrdersAlreadyServed(
        g,
        recipes.map((r) => r.id),
      ),
    ) && !isBatchGroupComplete(retry),
    "C4: the group completes only when every customer is served",
  );
}

console.log("D. The exploit");
{
  // Serve 1 of 2 → leave → retry (session rebuilt from the save) → serve.
  let p = progressAt(30);
  let paid = 0;
  const serve = (recipeId: string) => {
    if (!mayPayOrder(p, service, recipeId)) return;
    paid++;
    p = withPaidOrder(p, service.id, recipeId);
  };
  serve("first");
  // leave: the session is gone; only the save remains
  const retryCount = paidOrdersFor(p, service.id).length;
  serve("second-try-order");
  const finished = retryCount + 1 >= ordersRequired(service);
  serve("extra"); // a third serve the level no longer owes
  assert(paid === 2 && finished, "D1: leave after 1 of 2 and retry → 2 orders paid in all, not 3");
  // Honest play: two serves, one sitting.
  let q = progressAt(30);
  let honest = 0;
  for (const r of ["a", "b"]) {
    if (mayPayOrder(q, service, r)) {
      honest++;
      q = withPaidOrder(q, service.id, r);
    }
  }
  assert(honest === 2, "D2: honest play still pays both orders");
}

console.log("E. Saves");
{
  const s: SaveData = {
    ...DEFAULT_SAVE,
    levelProgress: withPaidOrder(progressAt(30), service.id, "chicken-curry"),
  };
  await SaveManager.save(s);
  const back = await SaveManager.load();
  assert(
    paidOrdersFor(back.levelProgress, service.id).join() === "chicken-curry",
    "E1: the paid order survives the real SaveManager save/load",
  );
  memoryStore.clear();
  await SaveManager.save({ ...DEFAULT_SAVE, levelProgress: progressAt(30) });
  const old = await SaveManager.load();
  assert(
    !("paidOrders" in old.levelProgress) &&
      paidOrdersFor(old.levelProgress, service.id).length === 0,
    "E2: an older save without the field loads unchanged (nothing paid recorded)",
  );
}

console.log("F. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    /withOrdersAlreadyServed\(session, paidOrdersFor\(levelProgress, level\.id\)\.length\)/.test(
      app,
    ) &&
      /withBatchOrdersAlreadyServed\(fresh, paidOrdersFor\(save\.levelProgress, level\.id\)\)/.test(
        app,
      ),
    "F1: both session builders carry the paid orders into a retry",
  );
  assert(
    (app.match(/!mayPayOrder\(save\.levelProgress, level, (recipe|viewed\.recipe)\.id\)/g) ?? [])
      .length === 2 &&
      (app.match(/levelProgress: withPaidOrder\(\s*save\.levelProgress,/g) ?? []).length === 2,
    "F2: both serve paths pay only an owed order and record it in the same save",
  );
  assert(
    (app.match(/completeCampaignLevel\(level\);/g) ?? []).length === 3 &&
      (app.match(/if \(levelAlreadyPaidInFull\(level\)\) return;/g) ?? []).length === 2,
    "F3: one completion path; a level paid in full on an earlier try completes on its next start",
  );
}

console.log(
  failures
    ? `\nCAMPAIGN PAID ORDERS QA: ${failures} FAILURE(S)`
    : "\nCAMPAIGN PAID ORDERS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
