/**
 * PENDING CASH QA (developer 2026-10-29): money enters the wallet only when the
 * player sweeps it up — and is never lost, doubled or flooded into the ledger.
 *
 *   P. Pieces: each swept piece moves exactly its cents; the wallet equals the ledger
 *   L. Ledger: one settlement entry and one tip entry per order, however many pieces
 *   R. Reload: the cash on the table survives a save and load; settling pays it once
 *   S. Safety: never negative, never more than owed; cash piles up (one pile per pay kind), nothing is collected for the player
 *   W. Wiring in App.tsx
 *
 * Run: npx tsx scripts/pending-cash-qa.mts
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
const {
  collectPendingCashPiece,
  pendingCashOf,
  pendingPiles,
  pendingCashTotal,
  settlePendingCash,
  withPendingCash,
} = await import("../src/game/economy/pendingCash.ts");
const { cashPieces } = await import("../src/game/cashBurst.ts");
const { MAX_LEDGER_ENTRIES } = await import("../src/game/economy/EconomyLedger.ts");

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
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
const base = (credits = 500): SaveData => ({ ...DEFAULT_SAVE, credits, economyLedger: [] });
const serve = (s: SaveData, pay = 18_700, tip = 2_800): SaveData =>
  withPendingCash(s, {
    amount: pay,
    tip,
    category: "campaign-settlement",
    description: "recipe-x",
    tipDescription: "level-9:recipe-x",
  });
const sweepAll = (s: SaveData, pay = 18_700, tip = 2_800): SaveData =>
  cashPieces(pay, tip).reduce((acc, p) => collectPendingCashPiece(acc, p.cents, p.tip), s);

console.log("P. Pieces");
{
  const owed = serve(base());
  assert(
    owed.credits === 500 && owed.economyLedger.length === 0 && pendingCashTotal(owed) === 21_500,
    "P1: serving books nothing — the wallet and ledger are untouched, the cash is owed",
  );
  const pieces = cashPieces(18_700, 2_800);
  let s = owed;
  let moved = 0;
  for (const p of pieces) {
    const before = s;
    s = collectPendingCashPiece(s, p.cents, p.tip);
    moved += p.cents;
    if (s.credits - before.credits !== p.cents || pendingCashTotal(s) !== 21_500 - moved) {
      assert(false, "P2: each piece moves exactly its cents from the table to the wallet", { p });
      break;
    }
  }
  assert(
    s.credits === 500 + 21_500 && pendingCashOf(s) === null && s.credits === 500 + ledgerSum(s),
    "P2: every piece moves exactly its cents; at the end the table is empty and wallet = opening + ledger",
    { credits: s.credits, ledger: ledgerSum(s) },
  );
}

console.log("L. Ledger");
{
  const s = sweepAll(serve(base()));
  const pay = s.economyLedger.filter((e) => e.category === "campaign-settlement");
  const tip = s.economyLedger.filter((e) => e.category === "customer-tip");
  assert(
    cashPieces(18_700, 2_800).length > 4 &&
      s.economyLedger.length === 2 &&
      pay.length === 1 &&
      pay[0]!.amount === 18_700 &&
      tip.length === 1 &&
      tip[0]!.amount === 2_800 &&
      tip[0]!.description === "level-9:recipe-x",
    "L1: an order of many bills writes ONE settlement entry and ONE tip entry, with their full amounts",
    s.economyLedger.map((e) => [e.category, e.amount]),
  );
  assert(
    s.economy.lifetime["campaign-settlement"] === 18_700 &&
      s.economy.lifetime["customer-tip"] === 2_800,
    "L2: the never-trimmed lifetime totals get exactly the swept amounts (no double count by piece)",
    s.economy.lifetime,
  );
  let busy = base();
  for (let i = 0; i < 40; i++) busy = sweepAll(serve(busy, 12_000, 1_000), 12_000, 1_000);
  assert(
    busy.economyLedger.length === 80 &&
      busy.economyLedger.length < MAX_LEDGER_ENTRIES &&
      busy.credits === 500 + ledgerSum(busy),
    "L3: 40 orders leave 80 entries (the ledger window holds 100 orders, not 20), and the wallet still equals the ledger",
    busy.economyLedger.length,
  );
}

console.log("R. Reload");
{
  const owed = serve(base());
  const reloaded = JSON.parse(JSON.stringify(owed)) as SaveData;
  assert(
    pendingCashTotal(reloaded) === 21_500,
    "R1: the cash on the table survives a save and reload",
  );
  const settled = settlePendingCash(reloaded);
  assert(
    settled.credits === 500 + 21_500 &&
      pendingCashOf(settled) === null &&
      settled.credits === 500 + ledgerSum(settled),
    "R2: settling after a reload pays the order once, wallet = opening + ledger",
  );
  assert(
    settlePendingCash(settled) === settled,
    "R3: settling again changes nothing (no double pay)",
  );
  // Half swept, then the game closes.
  const pieces = cashPieces(18_700, 2_800);
  let half = serve(base());
  for (const p of pieces.slice(0, Math.floor(pieces.length / 2)))
    half = collectPendingCashPiece(half, p.cents, p.tip);
  const back = settlePendingCash(JSON.parse(JSON.stringify(half)) as SaveData);
  assert(
    back.credits === 500 + 21_500 &&
      back.economyLedger.length === 2 &&
      back.credits === 500 + ledgerSum(back),
    "R4: half swept, then closed: on the next load the rest is settled — exactly once, still two entries",
    { credits: back.credits, entries: back.economyLedger.length },
  );
  store["knifecraft.save.v1"] = JSON.stringify(owed);
  (SaveManager as unknown as { cache: unknown }).cache = null;
  const loaded = await SaveManager.load();
  assert(
    pendingCashTotal(loaded) === 21_500,
    "R5: the real SaveManager load keeps the cash on the table",
  );
}

console.log("S. Safety");
{
  const owed = serve(base(), 1_000, 0);
  const over = collectPendingCashPiece(owed, 99_999, false);
  assert(
    over.credits === 500 + 1_000 && pendingCashOf(over) === null,
    "S1: a piece larger than what is owed pays only what is owed",
  );
  const none = base();
  assert(
    collectPendingCashPiece(none, 500, false) === none,
    "S2: with nothing owed a sweep changes nothing (same save)",
  );
  const wrongKind = collectPendingCashPiece(owed, 500, true);
  assert(wrongKind === owed, "S3: a tip piece with no tip owed pays nothing");
  // Rule changed (developer 2026-10-31, "let it pile up like other idle games until the user
  // collects it"): a new order no longer collects the one before it. Same pay kind = one pile.
  const two = serve(owed, 700, 0);
  assert(
    two.credits === 500 &&
      two.economyLedger.length === 0 &&
      pendingCashTotal(two) === 1_700 &&
      pendingCashOf(two)!.batch === pendingCashOf(owed)!.batch &&
      pendingCashOf(two)!.more === undefined,
    "S4: a new order leaves the cash before it on the table — it piles up, nothing is collected, one pile per pay kind",
  );
  const guests = withPendingCash(two, {
    amount: 450,
    category: "business-revenue",
    description: "menu-dish",
  });
  const piles = pendingPiles(guests);
  assert(
    pendingCashTotal(guests) === 2_150 &&
      piles.length === 2 &&
      piles[0]!.batch !== piles[1]!.batch &&
      guests.credits === 500,
    "S4b: another pay kind (menu guests) is its own pile with its own batch; still nothing collected",
    piles,
  );
  const all = settlePendingCash(JSON.parse(JSON.stringify(guests)) as SaveData);
  const byKind = (k: string) =>
    all.economyLedger.filter((e) => e.category === k).reduce((t, e) => t + e.amount, 0);
  assert(
    all.credits === 500 + 2_150 &&
      pendingCashOf(all) === null &&
      all.credits === 500 + ledgerSum(all) &&
      byKind("campaign-settlement") === 1_700 &&
      byKind("business-revenue") === 450,
    "S4c: one tap collects every pile (after a reload too): wallet = opening + ledger, one entry per pay kind",
    { credits: all.credits, ledger: all.economyLedger.map((e) => [e.category, e.amount]) },
  );
  // A swipe takes the first pile, then the next one moves up.
  const swiped = collectPendingCashPiece(guests, 1_700, false);
  assert(
    pendingPiles(swiped).length === 1 &&
      pendingCashOf(swiped)!.category === "business-revenue" &&
      pendingCashTotal(swiped) === 450 &&
      swiped.credits === 500 + 1_700,
    "S4d: a swipe takes the first pile; the next pile moves up",
  );
  assert(
    pendingCashOf(serve(base(), 0, 0)) === null,
    "S5: an order that pays nothing leaves nothing on the table",
  );
  const odd = {
    ...owed,
    business: {
      ...owed.business,
      pendingCash: {
        batch: "x",
        category: "campaign-settlement",
        description: "d",
        payCents: -5,
        tipCents: Number.NaN,
      },
    },
  } as unknown as SaveData;
  assert(
    pendingCashOf(odd) === null && settlePendingCash(odd).credits === odd.credits,
    "S6: an odd saved record is ignored — never negative money",
  );
}

console.log("Q. Saves (developer 2026-10-30: a swept order is not ten writes)");
{
  let writes = 0;
  const stored: string[] = [];
  const ls = globalThis.localStorage as unknown as { setItem: (k: string, v: string) => void };
  const original = ls.setItem;
  ls.setItem = (k: string, v: string) => {
    writes++;
    stored.push(v);
    original(k, v);
  };
  let s2 = serve(base());
  const pieces = cashPieces(18_700, 2_800);
  const saves: Promise<void>[] = [];
  for (const p of pieces) {
    s2 = collectPendingCashPiece(s2, p.cents, p.tip);
    saves.push(SaveManager.save(s2));
  }
  await Promise.all(saves);
  const last = JSON.parse(stored[stored.length - 1]!) as SaveData;
  assert(
    pieces.length >= 8 && writes <= 3,
    `Q1: ${pieces.length} swept pieces make at most 3 writes, not ${pieces.length} (got ${writes})`,
  );
  assert(
    last.credits === s2.credits && pendingCashOf(last) === null && last.economyLedger.length === 2,
    "Q2: the LAST write holds the final state — an older state never lands after a newer one",
    { credits: last.credits },
  );
  ls.setItem = original;
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const mod = read("src/game/economy/pendingCash.ts");
  assert(
    (app.match(/withPendingCash\(/g) ?? []).length >= 3 &&
      /withPendingCash\(nextSave/.test(read("src/game/business/BusinessServiceManager.ts")) &&
      !/queueServiceCash|pendingServiceCashRef/.test(app) &&
      /collectPendingCashPiece\(current, cents, isTip\)/.test(app),
    "W1: every serve path (campaign, batch, menu guest in App; Business inside serveBusinessOrder) leaves its cash through withPendingCash, in the save that marks the order served",
  );
  // Rule changed (developer 2026-10-30, "dont make it mandatory, let the players collect when they
  // require, but it must be collected before night closing"): the cash waits on the table, saved with
  // the order, instead of being settled when the player leaves or the game loads.
  assert(
    !/pendingCashTotal\(current\) > 0\) persist\(settlePendingCash\(current\)\)/.test(app) &&
      !/syncKitchenUpgradeOwnership\(loaded\);[\s\S]{0,300}settlePendingCash\(synced\)/.test(app),
    "W2: leaving the service or loading the game leaves the cash on the table (nothing is settled behind the player's back)",
  );
  assert(
    /function collectTableCash\(\)[\s\S]{0,200}settlePendingCash\(current\)/.test(app) &&
      /onCollectTableCash=\{collectTableCash\}/.test(app) &&
      /disabled=\{left > 0 \|\| tableCash > 0\}/.test(
        read("src/components/kc/restaurant/ClosingTime.tsx"),
      ),
    "W3: the player collects it from the Kitchen when they want, and Close for the night waits until it is in the till",
  );
  assert(!/Math\.random/.test(mod), "W4: no randomness");
}

console.log(failures ? `\nPENDING CASH QA: ${failures} FAILURE(S)` : "\nPENDING CASH QA: ALL PASS");
process.exit(failures ? 1 : 0);
