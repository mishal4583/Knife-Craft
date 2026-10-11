/**
 * DELIVERIES QA (a real restaurant's day, plan F3 — developer 2026-10-11).
 * restaurant/deliveries.ts.
 *
 *  K  Cadence: fresh on every even restaurant day, weekly on each week's
 *     first day (Monday); nothing before L21 or with the order switched off.
 *  O  The order: fresh = the next 2 days' perishables, weekly = a week's
 *     slow goods + cleaning supplies; from USABLE stock (expired stock
 *     doesn't count) and never more than fits in the fridge.
 *  D  Delivery: each line an ordinary Market purchase — one ledger entry,
 *     the Market's price; opening cash + ledger = closing cash; a line the
 *     wallet can't pay is skipped and listed (never < 0, no debt).
 *  I  Once only: running the night again (reload, second tap) never orders
 *     or delivers the same id twice.
 *  V  An odd / old state is clamped.
 *  W  Wiring: App closes the night with it; the sim uses it; no Math.random.
 *
 * Run: npx tsx scripts/restaurant-deliveries-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import type { IngredientId } from "../src/game/definitions.ts";
import {
  DELIVERIES_FROM,
  afterNight,
  deliveriesOf,
  isDeliveryDay,
  isFreshIngredient,
  orderFor,
  setStandingOrder,
  tonightsOrder,
} from "../src/game/restaurant/deliveries.ts";
import { marketPlanFor } from "../src/game/restaurant/marketPlan.ts";

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
const saveAt = (n: number, day: number, credits = 5_000_000): SaveData => ({
  ...DEFAULT_SAVE,
  credits,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
  business: {
    ...DEFAULT_SAVE.business,
    inventory: {},
    restaurantDay: {
      day,
      opened: false,
      servicesDone: 0,
      servicesPlanned: 0,
      closingDue: false,
      openingCredits: null,
      openingLevel: null,
    },
  },
});
const on = (s: SaveData) => setStandingOrder(setStandingOrder(s, "fresh", true), "weekly", true);
const signed = (s: SaveData) => s.economyLedger.reduce((n, e) => n + e.amount, 0);

console.log("K. Cadence");
{
  assert(
    isDeliveryDay("fresh", 12) &&
      !isDeliveryDay("fresh", 13) &&
      isDeliveryDay("weekly", 15) &&
      !isDeliveryDay("weekly", 16),
    "K1: fresh every even day; weekly on the week's first day (Day 1, 8, 15 …)",
  );
  const off = afterNight(saveAt(40, 12), 40);
  const early = afterNight(on(saveAt(DELIVERIES_FROM - 1, 12)), DELIVERIES_FROM - 1);
  const odd = afterNight(on(saveAt(40, 13)), 40);
  assert(
    off.received.length === 0 && early.received.length === 0 && odd.received.length === 0,
    "K2: nothing with the order off, before L21, or on a day that isn't a delivery day",
  );
}

console.log("O. The order");
{
  const s = on(saveAt(40, 12));
  const fresh = orderFor(s, "fresh", 40);
  const weekly = orderFor(s, "weekly", 40);
  const plan2 = marketPlanFor(s, 2).rows.filter((r) => isFreshIngredient(r.ingredientId));
  assert(
    fresh.length > 0 &&
      fresh.every((l) => l.kind === "ingredient" && isFreshIngredient(l.id as IngredientId)) &&
      fresh.length === plan2.length &&
      weekly.some((l) => l.kind === "supply") &&
      weekly.every((l) => l.kind === "supply" || !isFreshIngredient(l.id as IngredientId)),
    "O1: fresh = the next 2 days' perishables (the Market plan's own lines); weekly = slow goods + cleaning supplies",
    { fresh: fresh.length, plan2: plan2.length, weekly: weekly.map((l) => l.id) },
  );
  // Stock that has expired by now doesn't count as usable: the order still brings it.
  const first = fresh[0]!;
  const stale: SaveData = {
    ...s,
    business: {
      ...s.business,
      calendar: { businessDay: 30 },
      inventory: {
        [first.id]: { ingredientId: first.id, quantity: 5, unitCost: 100, purchaseDay: 1 },
      },
    },
  };
  const fresh2 = orderFor(stale, "fresh", 40);
  assert(
    fresh2.some((l) => l.id === first.id),
    "O2: expired stock isn't usable — the order still brings the ingredient",
  );
}

console.log("D. Delivery");
{
  const s = on(saveAt(40, 22));
  const r = afterNight(s, 40);
  const rec = r.received;
  const lines = rec.flatMap((x) => x.lines);
  const entries = r.save.economyLedger.slice(s.economyLedger.length);
  assert(
    rec.map((x) => x.kind).join() === "fresh,weekly" &&
      lines.length > 0 &&
      entries.length === lines.length &&
      entries.every(
        (e) => e.category === "inventory-purchase" || e.category === "supply-packaging-purchase",
      ) &&
      s.credits + signed(r.save) - signed(s) === r.save.credits &&
      rec.reduce((n, x) => n + x.cost, 0) === s.credits - r.save.credits &&
      Object.keys(r.save.business.inventory).length > 0,
    "D1: Day 22 (even and a Monday): fresh and weekly arrive; one ledger entry per line; cash + ledger = closing cash",
    { kinds: rec.map((x) => x.kind), lines: lines.length, entries: entries.length },
  );
  const poor = afterNight(on(saveAt(40, 12, 50)), 40);
  assert(
    poor.save.credits >= 0 &&
      poor.received[0]!.skipped.length > 0 &&
      poor.save.economyLedger.length === poor.received[0]!.lines.length,
    "D2: a line the wallet can't pay is skipped and listed — never below 0, no debt",
    { credits: poor.save.credits, skipped: poor.received[0]?.skipped.length },
  );
}

console.log("I. Once only");
{
  const s = on(saveAt(40, 12));
  const once = afterNight(s, 40);
  const twice = afterNight(once.save, 40);
  assert(
    once.received.length === 1 &&
      twice.received.length === 0 &&
      twice.save.credits === once.save.credits &&
      twice.save.economyLedger.length === once.save.economyLedger.length &&
      deliveriesOf(twice.save).delivered.includes("12-fresh") &&
      deliveriesOf(twice.save).pending.length === 0 &&
      tonightsOrder(once.save, 40).every((o) => o.kind !== "fresh" || !isDeliveryDay("fresh", 13)),
    "I1: running the night again (a reload, a second tap) delivers nothing more",
  );
}

console.log("V. Odd saves");
{
  const odd = {
    ...saveAt(40, 12),
    business: {
      ...saveAt(40, 12).business,
      deliveries: {
        fresh: "yes",
        pending: [
          { id: 3 },
          {
            id: "x",
            kind: "fresh",
            arriveDay: -2,
            lines: [{ kind: "ingredient", id: "tomato", qty: -1 }],
          },
        ],
        delivered: [1, "a"],
      },
    },
  } as unknown as SaveData;
  const d = deliveriesOf(odd);
  assert(
    d.fresh === false &&
      d.pending.length === 1 &&
      d.pending[0]!.arriveDay === 0 &&
      d.pending[0]!.lines.length === 0 &&
      d.delivered.join() === "a",
    "V1: an odd state is clamped",
    d,
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const sim = read("scripts/restaurantCampaignSim.mts");
  assert(
    /afterNight\(/.test(app) &&
      /afterNight\(/.test(sim) &&
      !/Math\.random/.test(read("src/game/restaurant/deliveries.ts")),
    "W1: App closes the night with the deliveries; the sim too; no randomness",
  );
}

console.log(failures ? `\nDELIVERIES QA: ${failures} FAILURE(S)` : "\nDELIVERIES QA: ALL PASS");
process.exit(failures ? 1 : 0);
