/**
 * PARTY SERVED TOGETHER QA (developer 2026-10-30: "serve everyone together, eat together, leave the
 * cash and leave the restaurant together").
 *
 *  H  A member whose party-mates are still to be cooked is HELD (paid, plate kept back); the party
 *     never goes stale while a plate is held; the last order delivers every plate at once
 *  C  A party's cash is one pile: held members' cash joins the table's cash, one ledger entry
 *  F  The floor sends every plate out together and the whole party walks out together
 *
 * Run: npx tsx scripts/party-served-together-qa.mts
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

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");
const {
  PARTY_FRESH_MS,
  finishPartyDelivery,
  heldPlatesOf,
  markPartyHeld,
  partyCompleteWith,
  resetParties,
  seatInParty,
} = await import("../src/game/restaurant/serviceFloor.ts");
const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
const { pendingCashOf, settlePendingCash, withPendingCash } =
  await import("../src/game/economy/pendingCash.ts");

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail));
  }
}

// A party of 2: find an order id the hash seats as a pair (parties are sized by a hash of the id).
function pairId(): string {
  for (let i = 0; i < 400; i++) {
    resetParties();
    const id = `order-1700000000000-${i}`;
    const seat = seatInParty(
      id,
      "c1",
      { emoji: "🍝", name: "Pasta" },
      [{ emoji: "🍲", name: "Soup" }],
      1000,
    );
    if (seat.party.size === 2) return id;
  }
  throw new Error("no pair id");
}

console.log("H. Held plates");
{
  const id1 = pairId();
  resetParties();
  const s1 = seatInParty(
    id1,
    "c1",
    { emoji: "🍝", name: "Pasta" },
    [{ emoji: "🍲", name: "Soup" }],
    1000,
  );
  assert(s1.party.size === 2 && s1.slot === 0, "H1: the first order sits in a party of 2");
  markPartyHeld(id1, "🍝", "😍", 2000);
  assert(
    heldPlatesOf(id1) === 0,
    "H2: a member's own held plate is not counted as 'waiting for me'",
  );
  // The second order, much later than the party's freshness window: it still joins (a plate is held).
  const later = 1000 + PARTY_FRESH_MS * 5;
  const s2 = seatInParty("order-1700000000000-b", "c2", { emoji: "🍲", name: "Soup" }, [], later);
  assert(
    s2.party === s1.party && s2.slot === 1 && !s2.arriving,
    "H3: the next order joins the same party even after a long cook (plates are held)",
  );
  assert(
    heldPlatesOf("order-1700000000000-b") === 1,
    "H4: the last member sees one plate waiting for the table",
  );
  assert(
    partyCompleteWith(s2),
    "H5: the party is complete with the last member served — all leave together",
  );
  finishPartyDelivery("order-1700000000000-b", "🍲", "🙂", later + 10);
  assert(
    s2.party.served.every((x) => !!x) && s2.party.held.every((x) => !x) && s2.party.left,
    "H6: after the delivery every plate is served, nothing is held and the party is marked gone",
  );
  const s3 = seatInParty(
    "order-1700000000000-c",
    "c3",
    { emoji: "🥗", name: "Salad" },
    [],
    later + 20,
  );
  assert(
    s3.party !== s1.party && s3.arriving && s3.leaving === null,
    "H7: the next customers find the room empty — a gone party never 'leaves' twice",
  );
  // A stale party without held plates still expires.
  resetParties();
  const a = seatInParty(
    "order-x-1",
    "c1",
    { emoji: "🍝", name: "Pasta" },
    [{ emoji: "🍲", name: "Soup" }],
    1000,
  );
  const b = seatInParty(
    "order-x-2",
    "c2",
    { emoji: "🍲", name: "Soup" },
    [],
    1000 + PARTY_FRESH_MS + 1,
  );
  assert(a.party !== b.party, "H8: a party with nothing held still goes stale as before");
}

console.log("C. One pile of cash");
{
  const base = { ...DEFAULT_SAVE, credits: 1000 };
  const cash = (amount: number, tip: number, merge?: boolean) => ({
    amount,
    tip,
    category: "campaign-settlement" as const,
    description: "r",
    ...(merge ? { merge } : {}),
  });
  const a = withPendingCash(base, cash(10_000, 1_000));
  const b = withPendingCash(a, cash(5_000, 500, true));
  assert(
    pendingCashOf(b)?.payCents === 15_000 &&
      pendingCashOf(b)?.tipCents === 1_500 &&
      b.credits === 1000,
    "C1: a party-mate's cash joins the pile; the wallet is untouched until it is collected",
  );
  const settled = settlePendingCash(b);
  const entries = settled.economyLedger.filter(
    (e) => e.category === "campaign-settlement" || e.category === "customer-tip",
  );
  assert(
    settled.credits === 1000 + 16_500 && entries.length === 2,
    "C2: collecting the party's pile pays it once: one settlement entry + one tip entry",
    entries.length,
  );
  const c = withPendingCash(a, cash(5_000, 0));
  assert(
    c.credits === 1000 + 11_000 && pendingCashOf(c)?.payCents === 5_000,
    "C3: without 'merge' an older pile is taken in first (a different table)",
  );
}

console.log("F. The floor");
{
  const fl = read("src/components/kc/game/ServiceFloor.tsx");
  assert(
    /const deliverers = spots\.map\(\(_, i\) => i === slot \|\| !!party\.held\[i\]\)/.test(fl) &&
      /sfplate\$\{uid\}_\$\{i\}/.test(fl),
    "F1: every held plate and this member's plate are delivered together, one per place",
  );
  assert(
    /const partyLeaves = mode === "deliver" && !cashOnly && partyCompleteWith\(partySeat\)/.test(
      fl,
    ) &&
      /sfexit\$\{uid\}_\$\{i\}/.test(fl) &&
      /state === "leaving" && partyLeaves/.test(fl),
    "F2: when the party is complete they all walk out together (staggered at the door)",
  );
  const prep = read("src/components/kc/game/Preparation.tsx");
  assert(
    /partySeat\.slot < partySeat\.party\.size - 1 &&\s*\(service\.ticketsAfter \?\? 0\) > 0/.test(
      prep,
    ) &&
      /service\.onServe\(\{ joinCash \}\)/.test(prep) &&
      /markPartyHeld\(/.test(prep) &&
      /finishPartyDelivery\(/.test(prep),
    "F3: Preparation holds a plate only while the party has a place left AND an order to fill it, joins the cash, and finishes the delivery when the floor is done",
  );
  const app = read("src/App.tsx");
  assert(
    /\.\.\.\(opts\?\.joinCash \? \{ merge: true \} : \{\}\)/.test(app) &&
      (app.match(/resetParties\(\)/g) ?? []).length >= 3,
    "F4: App merges the party's cash and clears the parties when a service starts, ends or is left",
  );
}

console.log(
  failures
    ? `\nPARTY SERVED TOGETHER QA: ${failures} FAILURE(S)`
    : "\nPARTY SERVED TOGETHER QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
