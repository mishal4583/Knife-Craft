/**
 * FRIDGE NEED QA (developer 2026-11-13: "before the game is about to get stuck, when the player has the money, ask him to buy the new fridge and
 * make it mandatory; if he doesn't have the full money, watch a video to get a discount"). restaurant/fridgeUpgradeNeed.ts.
 *
 *  A  The rule: nothing with room to spare or at the top fridge; "full" when today's food does not fit; "soon" when a coming service's
 *     purchases would not fit the shelf as it will be; food already on the shelf counts.
 *  B  Who must buy: required only when the wallet covers it ("soon": and today's food too); the ad's discount only when the wallet is short
 *     by no more than 25 %, once a day; a wallet far away is never blocked and keeps the supplier's cover.
 *  C  The purchase: one "refrigerator-purchase" entry; with the ad one "rewarded-ad" entry of the discount first, in the same save; all or
 *     nothing; idempotent by reward id; the cash identity holds; the inventory is untouched.
 *  D  The campaign: a simulated player is asked BEFORE the level where a player who never buys is stopped, buys once and finishes; nobody is
 *     blocked; the completionist is unchanged.
 *  W  Wiring: the check blocks START on `required`, App grants the discount only on `rewarded` with the spot's own placement, on the latest
 *     save; the placement is in the Bridge config; the rule file is pure.
 *
 * Run: npx tsx scripts/fridge-need-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import { coverFor } from "../src/game/restaurant/serviceCover.ts";
import {
  FRIDGE_AD_DAILY_CAP,
  FRIDGE_AD_DISCOUNT_SHARE,
  FRIDGE_AD_ID_PREFIX,
  buyNeededFridge,
  fridgeAdDiscount,
  fridgeAdsToday,
  newFridgeDiscountRewardId,
  nextFridgeUp,
} from "../src/game/restaurant/fridgeUpgradeNeed.ts";
import { AD_PLACEMENT } from "../src/game/PlayablesSDK.ts";
import { freshRestaurantSave, run } from "./restaurantCampaignSim.mts";

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
const NOW = new Date();
const progressAt = (n: number) => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const saveAt = (n: number, credits: number): SaveData => ({
  ...DEFAULT_SAVE,
  credits,
  levelProgress: progressAt(n),
  business: { ...DEFAULT_SAVE.business, inventory: {} },
});
/** Fresh food this service does not use (bought today, so nothing is expired). */
const stuffed = (n: number, credits: number, units: [string, number][]): SaveData => {
  const s = saveAt(n, credits);
  let inventory = s.business.inventory;
  for (const [id, q] of units)
    inventory = addStock(inventory, id as never, q, 100, s.business.calendar.businessDay);
  return { ...s, business: { ...s.business, inventory } };
};
const planOf = (s: SaveData, n: number) => servicePlanFor(s, getLevel(`level-${n}`)!, NOW)!;
const commercial = REFRIGERATOR_CATALOG.find((f) => f.capacity === 100)!;
const professional = REFRIGERATOR_CATALOG.find((f) => f.capacity === 240)!;
const PRICE = commercial.price;
const DISCOUNT = fridgeAdDiscount(PRICE);
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

console.log("A. The rule");
{
  const empty = planOf(saveAt(46, 1_000_000), 46);
  assert(
    empty.fridgeNeed === null,
    "A1: an empty Basic fridge at Level 46 asks for nothing, however rich the player",
  );
  // 20 + 16 of 40 units taken by food Level 46 does not use: today's food does not fit.
  const full = planOf(
    stuffed(46, PRICE + 100_000, [
      ["watermelon", 20],
      ["pumpkin", 16],
    ]),
    46,
  );
  const c = full.check;
  assert(
    c.applies &&
      c.storageNeeded > c.storageFree &&
      full.fridgeNeed?.reason === "full" &&
      full.fridgeNeed.fridge.id === commercial.id &&
      full.fridgeNeed.needUnits === c.storageNeeded &&
      full.fridgeNeed.roomLeft === c.storageFree,
    "A2: today's food does not fit: 'full', the next fridge up (Commercial), with the check's own numbers",
    full.fridgeNeed,
  );
  // Room for today, not for what comes: find a filling where today fits and the need says "soon".
  let soon: ReturnType<typeof planOf> | null = null;
  let fill = 0;
  for (let q = 1; q <= 38 && !soon; q++) {
    const p = planOf(stuffed(44, PRICE * 3, [["watermelon", q]]), 44);
    if (p.fridgeNeed?.reason === "soon") {
      soon = p;
      fill = q;
    }
  }
  const sc = soon?.check;
  assert(
    !!soon &&
      !!sc &&
      sc.applies &&
      sc.storageNeeded <= sc.storageFree &&
      soon.fridgeNeed!.atLevel > 44 &&
      soon.fridgeNeed!.atLevel <= 46 &&
      soon.fridgeNeed!.needUnits > soon.fridgeNeed!.roomLeft,
    "A3: today's food fits but a service within two levels would not: 'soon', naming that level and its numbers",
    { fill, need: soon?.fridgeNeed },
  );
  const lighter = planOf(stuffed(44, PRICE * 3, [["watermelon", Math.max(0, fill - 6)]]), 44);
  assert(
    lighter.fridgeNeed === null,
    "A4: six units fewer on the shelf and nothing is asked (the rule waits until it is really close)",
    lighter.fridgeNeed,
  );
  const top: SaveData = {
    ...stuffed(46, 1_000_000, [["watermelon", 230]]),
  };
  const topSave = {
    ...top,
    business: { ...top.business, refrigerator: { refrigeratorId: professional.id } },
  };
  assert(
    nextFridgeUp(topSave) === null && planOf(topSave, 46).fridgeNeed === null,
    "A5: at the top fridge nothing is asked (no bigger one exists; the supplier's cover stays the way out)",
  );
  assert(
    planOf(saveAt(2, 1_000_000), 2).fridgeNeed === null,
    "A6: before services use stock (Level 2) nothing is asked",
  );
}

console.log("B. Who must buy");
{
  const units: [string, number][] = [
    ["watermelon", 20],
    ["pumpkin", 16],
  ];
  const at = (credits: number) => planOf(stuffed(46, credits, units), 46);
  const rich = at(PRICE);
  const near = at(PRICE - DISCOUNT);
  const far = at(PRICE - DISCOUNT - 1);
  assert(
    DISCOUNT === PRICE * FRIDGE_AD_DISCOUNT_SHARE && DISCOUNT === 50_000 && DISCOUNT % 100 === 0,
    "B1: the ad takes 25 % off, whole dollars ($500 off the $2,000 Commercial)",
  );
  assert(
    rich.fridgeNeed!.required &&
      rich.fridgeNeed!.canPay &&
      rich.fridgeNeed!.adDiscount === 0 &&
      servicePlanNeedsSheet(rich),
    "B2: the wallet covers the price: required (the sheet shows, START waits), no ad is offered",
  );
  assert(
    !near.fridgeNeed!.required &&
      !near.fridgeNeed!.canPay &&
      near.fridgeNeed!.adDiscount === DISCOUNT &&
      near.fridgeNeed!.shortBy === DISCOUNT &&
      servicePlanNeedsSheet(near),
    "B3: short by exactly the discount: not required, the ad's discount is offered and the sheet shows it",
  );
  assert(
    !far.fridgeNeed!.required &&
      far.fridgeNeed!.adDiscount === 0 &&
      far.fridgeStuck &&
      coverFor(far, "stock") !== null,
    "B4: one cent further away: no ad, nothing required, and the supplier's cover is still offered (no soft-lock)",
  );
  // "soon": today's food comes first.
  let q = 1;
  while (q <= 38 && planOf(stuffed(44, PRICE * 3, [["watermelon", q]]), 44).fridgeNeed === null)
    q++;
  const soonAt = (credits: number) => planOf(stuffed(44, credits, [["watermelon", q]]), 44);
  const cost = (() => {
    const c = soonAt(PRICE * 3).check;
    return c.applies ? c.missingCost : 0;
  })();
  assert(
    cost > 0 &&
      soonAt(PRICE + cost).fridgeNeed!.required &&
      !soonAt(PRICE + cost - 1).fridgeNeed!.required &&
      soonAt(PRICE + cost - 1).fridgeNeed!.canPay,
    "B5: 'soon' is required only when the wallet covers the fridge AND today's food; one cent less and it is only offered",
    { cost },
  );
  // Today's ad is used: no second offer.
  const base = stuffed(46, PRICE - DISCOUNT, units);
  const used: SaveData = {
    ...base,
    economyLedger: [
      ...base.economyLedger,
      {
        id: "x",
        timestamp: NOW.getTime(),
        category: "rewarded-ad",
        amount: DISCOUNT,
        description: `${FRIDGE_AD_ID_PREFIX}earlier`,
      } as never,
    ],
  };
  assert(
    FRIDGE_AD_DAILY_CAP === 1 &&
      fridgeAdsToday(used, NOW) === 1 &&
      planOf(used, 46).fridgeNeed!.adDiscount === 0,
    "B6: one discount ad a day, read from the ledger (no new save field)",
  );
}

console.log("C. The purchase");
{
  const units: [string, number][] = [
    ["watermelon", 20],
    ["pumpkin", 16],
  ];
  const rich = stuffed(46, PRICE + 12_345, units);
  const need = planOf(rich, 46).fridgeNeed;
  const bought = buyNeededFridge(rich, need, null);
  assert(
    bought.ok &&
      bought.save.credits === 12_345 &&
      bought.save.business.refrigerator.refrigeratorId === commercial.id &&
      bought.save.economyLedger.length === rich.economyLedger.length + 1 &&
      bought.save.economyLedger.at(-1)!.category === "refrigerator-purchase" &&
      bought.save.economyLedger.at(-1)!.amount === -PRICE &&
      bought.save.business.inventory === rich.business.inventory &&
      rich.credits + (ledgerSum(bought.save) - ledgerSum(rich)) === bought.save.credits,
    "C1: a plain purchase: the full price, ONE 'refrigerator-purchase' entry, the food untouched, cash = opening + ledger",
  );
  assert(
    bought.ok &&
      planOf(bought.save, 46).fridgeNeed === null &&
      !planOf(bought.save, 46).fridgeStuck,
    "C2: with the Commercial fridge the same shelf asks for nothing more",
  );
  const near = stuffed(46, PRICE - DISCOUNT + 700, units);
  const nearNeed = planOf(near, 46).fridgeNeed;
  const id = newFridgeDiscountRewardId();
  const withAd = buyNeededFridge(near, nearNeed, id);
  const entries = withAd.ok ? withAd.save.economyLedger.slice(near.economyLedger.length) : [];
  assert(
    withAd.ok &&
      withAd.discount === DISCOUNT &&
      withAd.save.credits === 700 &&
      entries.length === 2 &&
      entries[0]!.category === "rewarded-ad" &&
      entries[0]!.amount === DISCOUNT &&
      entries[0]!.description === id &&
      entries[1]!.category === "refrigerator-purchase" &&
      entries[1]!.amount === -PRICE &&
      near.credits + (ledgerSum(withAd.save) - ledgerSum(near)) === withAd.save.credits &&
      withAd.save.business.refrigerator.refrigeratorId === commercial.id,
    "C3: with the ad: the discount is ONE 'rewarded-ad' entry, the fridge ONE purchase entry at its full price, the wallet pays price − 25 %",
    entries,
  );
  assert(
    !buyNeededFridge(near, nearNeed, null).ok &&
      buyNeededFridge(near, nearNeed, null).ok === false &&
      !buyNeededFridge(near, null, id).ok &&
      !buyNeededFridge(rich, need, newFridgeDiscountRewardId()).ok &&
      !buyNeededFridge(near, nearNeed, "some-other-id").ok,
    "C4: nothing changes without the ad when the wallet is short, without a need, with an ad that was not on offer, or with a foreign id",
  );
  assert(
    withAd.ok && !buyNeededFridge(withAd.save, nearNeed, id).ok,
    "C5: the same reward id never pays twice",
  );
  assert(
    id.startsWith(FRIDGE_AD_ID_PREFIX) &&
      withAd.ok &&
      fridgeAdsToday(withAd.save, new Date()) === 1,
    "C6: the paid discount counts as today's ad",
  );
}

console.log("D. The campaign (simulated players)");
{
  const never = run(
    "never buys a fridge",
    freshRestaurantSave(),
    1,
    {
      profile: "diligent",
      noFridgeUpgrade: true,
    } as never,
    false,
  );
  const stoppedAt = Number(/^L(\d+)/.exec(never.stats.blocked[0] ?? "")?.[1] ?? 0);
  const firstAsk = Number(/^L(\d+)/.exec(never.stats.fridgeNeedAt[0] ?? "")?.[1] ?? 0);
  assert(
    stoppedAt > 0 && firstAsk > 0 && firstAsk < stoppedAt && stoppedAt - firstAsk <= 3,
    `D1: the check asks for the fridge BEFORE the kitchen is stuck (asked at Level ${firstAsk}, a player who never buys is stopped at Level ${stoppedAt})`,
    { asks: never.stats.fridgeNeedAt, blocked: never.stats.blocked[0] },
  );
  const diligent = run(
    "diligent",
    freshRestaurantSave(),
    1,
    { profile: "diligent" } as never,
    false,
  );
  assert(
    diligent.stats.levels === 91 &&
      diligent.stats.blocked.length === 0 &&
      diligent.stats.invariant.length === 0 &&
      diligent.stats.fridgeNeedAt.length >= 1 &&
      diligent.stats.fridgeNeedAt.every((x) => x.endsWith("!")) &&
      diligent.s.business.refrigerator.refrigeratorId !== "basic-refrigerator",
    `D2: a player who buys when asked finishes all 91 levels, never blocked, every ask affordable (${diligent.stats.fridgeNeedAt.join(" ")})`,
    { asks: diligent.stats.fridgeNeedAt, blocked: diligent.stats.blocked },
  );
  const comp = run(
    "completionist",
    freshRestaurantSave(),
    1,
    { profile: "completionist" } as never,
    false,
  );
  assert(
    comp.stats.levels === 91 && comp.stats.blocked.length === 0 && comp.s.credits >= 15_000_000,
    `D3: the completionist still finishes above $150k ($${Math.round(comp.s.credits / 100)})`,
  );
}

console.log("W. Wiring");
{
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const rule = code(read("src/game/restaurant/fridgeUpgradeNeed.ts"));
  const app = read("src/App.tsx");
  const sheet = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const card = read("src/components/kc/restaurant/FridgeNeedCard.tsx");
  const config = JSON.parse(read("public/playgama-bridge-config.json"));
  assert(
    !/Math\.random|RESTAURANT_MODE|window\.|localStorage|setTimeout/.test(rule),
    "W1: the rule file is pure (no Math.random, RESTAURANT_MODE, window, storage or timers)",
  );
  assert(
    sheet.includes("!fridgeNeed?.required") &&
      sheet.includes("<FridgeNeedCard") &&
      sheet.includes("Buy the fridge to start"),
    "W2: the check shows the card and START waits for a required fridge",
  );
  const fn = app.slice(
    app.indexOf("async function buyNeededFridgeWithAd"),
    app.indexOf("or supplier credit: the goods now"),
  );
  assert(
    fn.includes("AD_PLACEMENT.fridgeDiscount") &&
      fn.includes('ad.status !== "rewarded"') &&
      fn.indexOf('ad.status !== "rewarded"') <
        fn.indexOf("buyNeededFridge(latest, need, rewardId)") &&
      fn.indexOf("await requestRewardedAd") < fn.lastIndexOf("saveRef.current") &&
      AD_PLACEMENT.fridgeDiscount === "fridge_discount" &&
      config.advertisement.rewarded.placements.some(
        (p: { id: string }) => p.id === "fridge_discount",
      ),
    "W3: App pays the discount only on `rewarded`, on the save read AFTER the ad, with the spot's own placement (listed in the Bridge config)",
  );
  assert(
    card.includes("25% off") &&
      card.includes("formatUsd(adPrice)") &&
      card.includes('data-testid="psc-fridge-buy"') &&
      card.includes("min-h-12"),
    "W4: the card says what the ad gives before it (25% off and the price), with 48 px buttons",
  );
}

console.log(failures ? `FRIDGE NEED QA: ${failures} FAILURE(S)` : "FRIDGE NEED QA: ALL PASS");
process.exit(failures ? 1 : 0);
