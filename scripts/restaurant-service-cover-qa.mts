/**
 * SERVICE COVER QA (developer 2026-10-10: "don't use Grandma lending anywhere
 * and anymore — use watch ad; don't miss any monetization opportunity"; with
 * no ad, a small loan). restaurant/serviceCover.ts + supplierCredit.ts.
 *
 *  A  When it applies: only from Level 10, only for a short part the wallet
 *     can't pay; before Level 10 Grandma's pantry is the only way (tutorial
 *     levels, nothing can be bought yet).
 *  D  The ad's reward: exactly the missing goods at cost 0 — no money, no
 *     ledger, no penalty; the check is ready.
 *  C  Supplier credit: the Market's units/packs at the Market price, owed;
 *     no money moves now; ready.
 *  R  Repayment: min(owed, earned, wallet); one "supplier-credit-repayment"
 *     entry; never below $0; repaid across levels; old saves owe nothing.
 *  I  Invariants over 200 seeded covers/repayments: whole cents, credits ≥ 0,
 *     opening cash + ledger = closing cash, owed = taken − repaid.
 *  W  Wiring: App grants the ad only on `rewarded`, reads the save after the
 *     ad, uses the spot's own placement; repayment at a first completion; the
 *     check shows the ad only when the platform can, credit when it can't or
 *     the ad failed; no Grandma's spares / Emergency Service anywhere; the
 *     new modules never read RESTAURANT_MODE or Math.random.
 *
 * Run: npx tsx scripts/restaurant-service-cover-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";
import { rollServiceTickets } from "../src/game/restaurant/serviceTickets.ts";
import { pantryForMissing, serviceStockCheck } from "../src/game/restaurant/campaignStock.ts";
import { serviceSuppliesCheck } from "../src/game/restaurant/serviceSupplies.ts";
import { coverFor, coverWithAd, coverWithCredit } from "../src/game/restaurant/serviceCover.ts";
import {
  repayFromEarnings,
  supplierCreditOf,
  takeOnCredit,
} from "../src/game/restaurant/supplierCredit.ts";
import { lifetimeTotal } from "../src/game/economy/economyState.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";

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
const planAt = (s: SaveData, n: number) => {
  const tickets = rollServiceTickets(getLevel(`level-${n}`)!);
  return {
    levelNumber: n,
    check: serviceStockCheck(s, n, tickets, { ownOrders: true }),
    supplies: serviceSuppliesCheck(s, n, n >= 31 ? tickets.map(() => "dine-in" as const) : []),
    tickets,
  };
};

console.log("A. When it applies");
{
  const l5 = saveAt(5, 0);
  const p5 = planAt(l5, 5);
  const l30 = saveAt(30, 0);
  const p30 = planAt(l30, 30);
  const rich = saveAt(30, 500_000);
  assert(
    coverFor(p5, "stock") === null &&
      p5.check.applies &&
      !p5.check.ready &&
      pantryForMissing(l5, p5.check, false) !== null,
    "A1: before Level 10 no ad or credit — Grandma's pantry (the tutorial levels; nothing can be bought yet)",
  );
  assert(
    coverFor(p30, "stock") !== null &&
      pantryForMissing(l30, p30.check, true) === null &&
      coverFor(planAt(rich, 30), "stock") === null,
    "A2: from Level 10 only when the wallet can't pay (a player who can pay buys it); never the pantry",
  );
  const l31 = saveAt(31, 0);
  const p31 = planAt(l31, 31);
  assert(
    coverFor(p31, "supplies") !== null &&
      coverFor(planAt(saveAt(31, 500_000), 31), "supplies") === null,
    "A3: supplies too — only when what blocks can't be paid for",
  );
}

console.log("D. The ad's reward");
{
  const s = saveAt(31, 0);
  const p = planAt(s, 31);
  const st = coverWithAd(s, p, "stock")!;
  const both = coverWithAd(st, planAt(st, 31), "supplies")!;
  const after = planAt(both, 31);
  assert(
    !!st &&
      !!both &&
      both.credits === 0 &&
      both.economyLedger.length === s.economyLedger.length &&
      supplierCreditOf(both).owed === 0 &&
      after.check.applies &&
      after.check.ready &&
      after.supplies.applies &&
      after.supplies.ready &&
      p.check.applies &&
      p.check.missingRows.every(
        (r) => (st.business.inventory[r.ingredientId]?.quantity ?? 0) === r.missing,
      ),
    "D1: exactly the missing ingredients and supplies at cost 0 — no money, no ledger, nothing owed → ready",
  );
}

console.log("C. Supplier credit");
{
  const s = saveAt(31, 0);
  const p = planAt(s, 31);
  const offer = coverFor(p, "stock")!;
  const st = coverWithCredit(s, p, "stock")!;
  const sup = coverFor(planAt(st, 31), "supplies")!;
  const both = coverWithCredit(st, planAt(st, 31), "supplies")!;
  const after = planAt(both, 31);
  assert(
    !!both &&
      p.check.applies &&
      offer.creditCost === p.check.missingCost &&
      supplierCreditOf(st).owed === offer.creditCost &&
      supplierCreditOf(both).owed === offer.creditCost + sup.creditCost &&
      both.credits === 0 &&
      both.economyLedger.length === s.economyLedger.length &&
      after.check.applies &&
      after.check.ready &&
      after.supplies.applies &&
      after.supplies.ready,
    `C1: the Market's goods at the Market price, owed ($${((offer.creditCost + sup.creditCost) / 100).toFixed(2)}); no money moves now → ready`,
  );
  assert(
    Object.values(both.business.inventory).every((e) => (e?.unitCost ?? 0) > 0) &&
      (both.business.supplies.stock["dinner-plates"]?.costBasis ?? 0) > 0,
    "C2: goods on credit carry their real cost (food cost and the P&L stay true)",
  );
}

console.log("R. Repayment");
{
  const owing = takeOnCredit(saveAt(40, 0), 5_000);
  const r1 = repayFromEarnings({ ...owing, credits: 3_000 }, 3_000, "level-40");
  const r2 = repayFromEarnings(r1.save, 0);
  const r3 = repayFromEarnings({ ...r1.save, credits: r1.save.credits + 9_000 }, 9_000);
  assert(
    r1.repaid === 3_000 &&
      r1.save.credits === 0 &&
      r1.owed === 2_000 &&
      r1.save.economyLedger.at(-1)?.category === "supplier-credit-repayment" &&
      r1.save.economyLedger.at(-1)?.amount === -3_000 &&
      r2.repaid === 0 &&
      r2.save === r1.save &&
      r3.repaid === 2_000 &&
      r3.owed === 0 &&
      supplierCreditOf(r3.save).repaid === 5_000,
    "R1: min(owed, earned, wallet); one entry per repayment, none at 0; repaid across levels until nothing's owed",
  );
  const old = { ...DEFAULT_SAVE } as SaveData;
  assert(
    old.business.supplierCredit === undefined &&
      supplierCreditOf(old).owed === 0 &&
      repayFromEarnings(old, 10_000).save === old,
    "R2: an old save owes nothing and repays nothing",
  );
}

console.log("I. Invariants (200 seeded rounds)");
{
  const rand = makeSeededRand(20261010);
  let s = saveAt(31, 0);
  const startCash = s.credits;
  const ledgerSum = (x: SaveData) => lifetimeTotal(x.economy, "supplier-credit-repayment");
  let ok = true;
  let taken = 0;
  for (let i = 0; i < 200; i++) {
    if (rand() < 0.5) {
      // A broke player: what was earned has been spent elsewhere.
      s = { ...s, credits: 0 };
      const p = planAt(s, 31);
      const next = coverWithCredit(s, p, rand() < 0.5 ? "stock" : "supplies");
      if (next) {
        taken += supplierCreditOf(next).owed - supplierCreditOf(s).owed;
        s = next;
      }
      // Use the stock up again so the next round is short.
      s = {
        ...s,
        business: { ...s.business, inventory: {}, supplies: DEFAULT_SAVE.business.supplies },
      };
    } else {
      const earned = Math.floor(rand() * 4_000);
      s = repayFromEarnings({ ...s, credits: s.credits + earned }, earned).save;
    }
    const c = supplierCreditOf(s);
    if (
      !Number.isInteger(s.credits) ||
      s.credits < 0 ||
      c.owed !== c.taken - c.repaid ||
      c.repaid !== -ledgerSum(s)
    ) {
      ok = false;
    }
  }
  assert(
    ok && taken > 0 && supplierCreditOf(s).repaid > 0 && startCash >= 0,
    "I1: whole cents, credits never < 0, owed = taken − repaid, every repayment in the ledger",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const fn = app.slice(
    app.indexOf("async function coverServiceWithAd"),
    app.indexOf("function coverServiceWithCredit"),
  );
  const iAd = fn.indexOf("await requestRewardedAd(");
  const iGate = fn.indexOf('ad.status !== "rewarded"');
  const iRead = fn.indexOf("const latest = saveRef.current");
  const iGrant = fn.indexOf("coverWithAd(latest, plan, part)");
  assert(
    iAd > 0 &&
      iGate > iAd &&
      iRead > iGate &&
      iGrant > iRead &&
      /part === "stock" \? AD_PLACEMENT\.serviceStock : AD_PLACEMENT\.serviceSupplies/.test(fn) &&
      /coverAdBusyRef\.current/.test(fn),
    "W1: the ad is granted only after `rewarded`, from the save read AFTER the ad, with the spot's own placement; one at a time",
  );
  assert(
    /repayFromEarnings\(nextSave, rewardCoins \+ \(orderCoins \?\? 0\), level\.id\)/.test(app) &&
      /RESTAURANT_MODE && isFirstCompletion\) \{\s*const r = repayFromEarnings/.test(app),
    "W2: supplier credit is repaid from a first completion's earnings (orders + reward)",
  );
  const ui = read("src/components/kc/restaurant/CoverActions.tsx");
  assert(
    /\{adAvailable \? \(/.test(ui) && /const showCredit = !adAvailable \|\| adFailed;/.test(ui),
    "W3: the check shows the ad only when the platform can; supplier credit when it can't or the ad failed",
  );
  const all = [
    "src/App.tsx",
    "src/components/kc/restaurant/PreServiceCheck.tsx",
    "src/components/kc/restaurant/ServiceCheckLayer.tsx",
    "src/game/restaurant/serviceSupplies.ts",
  ]
    .map(read)
    .join("\n");
  assert(
    !/grandmasSpares|markEmergencyService|isEmergencyService|Borrow Grandma's spares|Emergency Service:/.test(
      all,
    ) && !/Use Grandma's pantry \(free, this service only\)/.test(all),
    "W4: no Grandma's spares, Emergency Service or 'pantry this service only' anywhere",
  );
  assert(
    ["serviceCover", "supplierCredit"].every(
      (m) =>
        !/RESTAURANT_MODE|Math\.random/.test(
          read(`src/game/restaurant/${m}.ts`).replace(/\/\*[\s\S]*?\*\//g, ""),
        ),
    ),
    "W5: the new modules never read RESTAURANT_MODE or Math.random",
  );
}

console.log(failures ? `SERVICE COVER QA: ${failures} FAILURE(S)` : "SERVICE COVER QA: ALL PASS");
process.exit(failures ? 1 : 0);
