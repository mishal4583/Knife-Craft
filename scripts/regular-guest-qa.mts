/**
 * REGULAR GUEST + TOP-N CARD QA (developer 2026-11-25, first-20-levels engagement plan rows 13 and 19).
 *
 *  R  the regular guest (restaurant/regularGuest.ts): Sofia is the first guest of every FIRST play from Level 13; nothing else about the order moves
 *  T  the "Top N" lines of the rank card (restaurant/celebrations.ts): Top 40, 25, 10, 5 and #1, each naming the next
 *
 * Run: npx tsx scripts/regular-guest-qa.mts
 */
import { readFileSync } from "node:fs";
import {
  REGULAR_FROM_LEVEL,
  REGULAR_GREETINGS,
  REGULAR_ID,
  regularCustomer,
  regularGreeting,
  regularIntroNote,
  regularVisit,
  withRegularGuest,
} from "../src/game/restaurant/regularGuest.ts";
import { TOP_LINES, celebrationFor, topMilestone } from "../src/game/restaurant/celebrations.ts";
import { createTicketedServiceSession } from "../src/game/service/ServiceManager.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { CUSTOMERS } from "../src/game/customers/customerDefinitions.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}

console.log("R. The regular guest");
{
  assert(REGULAR_FROM_LEVEL === 13, "R1: she first comes on Level 13");
  assert(
    regularVisit(12) === 0 &&
      regularVisit(13) === 1 &&
      regularVisit(14) === 2 &&
      regularVisit(91) === 79,
    "R2: the visit number is the level number (0 before Level 13, 1 on Level 13)",
    [regularVisit(12), regularVisit(13), regularVisit(14), regularVisit(91)],
  );
  assert(regularCustomer(12) === null && regularCustomer(1) === null, "R3: nobody before Level 13");
  const c13 = regularCustomer(13)!;
  const c14 = regularCustomer(14)!;
  assert(
    c13.id === REGULAR_ID &&
      c13.name === "Sofia" &&
      CUSTOMERS.some((c) => c.id === REGULAR_ID) &&
      c13.regularVisit === 1 &&
      c14.regularVisit === 2,
    "R4: the regular is Sofia (the roster's own painted guest) and carries her visit number",
    { id: c13.id, name: c13.name },
  );
  assert(
    c13.greeting === regularGreeting(1) &&
      c14.greeting === regularGreeting(2) &&
      c13.greeting !== c14.greeting,
    "R5: she greets differently on her first visit and the next",
  );
  const bad = REGULAR_GREETINGS.filter(
    (g) =>
      g.length > 90 ||
      /\d|\$|%/.test(g) ||
      (g.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1 ||
      /\b(she|he|her|his)\b/i.test(g),
  );
  assert(
    bad.length === 0 && REGULAR_GREETINGS.length >= 4,
    "R6: every greeting is short, has no number, money or pronoun, and at most one emoji",
    bad,
  );
  const seq = Array.from({ length: 30 }, (_, i) => regularGreeting(i + 1));
  assert(
    seq[0] !== seq[6] &&
      seq[1] === seq[1 + (REGULAR_GREETINGS.length - 1)] &&
      seq.every((g) => g.length > 0),
    "R7: after the first visit the greetings cycle in order",
  );

  // a real ticketed session, the way App builds one
  const tickets = CAMPAIGN_RECIPES.slice(0, 3);
  const seeded = (seed: number) => {
    let s = seed;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  };
  const base = createTicketedServiceSession("level-14", tickets, 0, seeded(5), 1, false)!;
  const swapped = withRegularGuest(base, 14);
  assert(
    swapped.current!.customer.id === REGULAR_ID &&
      swapped.current!.order.customerId === REGULAR_ID &&
      swapped.current!.customer.regularVisit === 2,
    "R8: on a first play of Level 14 her order is the first guest's",
  );
  const sameButGuest = (a: typeof base, b: typeof base) =>
    JSON.stringify({
      ...a,
      current: { ...a.current, customer: 0, order: { ...a.current!.order, customerId: 0 } },
      next: a.next && { ...a.next, customer: 0, order: { ...a.next.order, customerId: 0 } },
    }) ===
    JSON.stringify({
      ...b,
      current: { ...b.current, customer: 0, order: { ...b.current!.order, customerId: 0 } },
      next: b.next && { ...b.next, customer: 0, order: { ...b.next.order, customerId: 0 } },
    });
  assert(
    sameButGuest(base, swapped) &&
      swapped.current!.recipe.id === base.current!.recipe.id &&
      swapped.current!.order.basePayment === base.current!.order.basePayment &&
      JSON.stringify(swapped.tickets?.map((r) => r.id)) ===
        JSON.stringify(base.tickets?.map((r) => r.id)),
    "R9: only the guest changes: the dish, its pay, the tickets and the rest of the session are exactly the ticket's",
  );
  // the order after hers is never her too
  let twice = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const s = withRegularGuest(
      createTicketedServiceSession("level-20", tickets, 0, seeded(seed), 1, false)!,
      20,
    );
    if (s.next && s.next.customer.id === REGULAR_ID) twice++;
    if (s.next && s.next.order.customerId !== s.next.customer.id) twice++;
  }
  assert(
    twice === 0,
    "R10: over 400 sessions she is never two guests in a row, and every order's customer id matches its guest",
    twice,
  );
  // the no-ops
  assert(
    withRegularGuest(base, 12) === base,
    "R11: before Level 13 the session is returned as it is",
  );
  const replay = createTicketedServiceSession("level-14", tickets, 0, seeded(5), 1, true)!;
  assert(withRegularGuest(replay, 14) === replay, "R12: a replay keeps its random guests");
  const retry = createTicketedServiceSession("level-14", tickets, 1, seeded(5), 1, false)!;
  assert(
    withRegularGuest(retry, 14) === retry,
    "R13: a retry that already served a plate keeps the guest who ordered it",
  );
  const empty = { ...base, current: null };
  assert(withRegularGuest(empty, 14) === empty, "R14: no current order, nothing to change");
  assert(
    regularIntroNote(13) !== null &&
      /Sofia/.test(regularIntroNote(13)!) &&
      regularIntroNote(12) === null &&
      regularIntroNote(14) === null,
    "R15: the level-complete line that introduces her appears on Level 13 only",
    regularIntroNote(13),
  );
  // pure presentation: the rule file touches no money, state, clock or random
  const src = readFileSync(
    new URL("../src/game/restaurant/regularGuest.ts", import.meta.url),
    "utf8",
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(
    !/Math\.random|Date\.now|new Date|credits|economyLedger|wallet|localStorage|SaveManager/.test(
      code,
    ),
    "R16: the rule is pure: no money, ledger, wallet, clock, random or save",
  );
}

console.log("T. The Top-N lines");
{
  assert(
    JSON.stringify(TOP_LINES) === JSON.stringify([40, 25, 10, 5, 1]),
    "T1: the lines are Top 40, 25, 10, 5 and #1",
  );
  const m = (a: number, b: number) => topMilestone(a, b);
  assert(
    JSON.stringify(m(41, 40)) === JSON.stringify({ top: 40, next: 25 }) &&
      JSON.stringify(m(26, 25)) === JSON.stringify({ top: 25, next: 10 }) &&
      JSON.stringify(m(11, 10)) === JSON.stringify({ top: 10, next: 5 }) &&
      JSON.stringify(m(6, 5)) === JSON.stringify({ top: 5, next: 1 }) &&
      JSON.stringify(m(2, 1)) === JSON.stringify({ top: 1, next: null }),
    "T2: each line names the next one, and #1 has none",
  );
  assert(
    m(40, 39) === null && m(30, 26) === null && m(25, 24) === null,
    "T3: no card for a climb that stays on one side of a line (40 -> 39, 30 -> 26, and already at 25 -> 24)",
  );
  assert(
    JSON.stringify(m(41, 24)) === JSON.stringify({ top: 25, next: 10 }),
    "T4: a climb across two lines names the better one (41 -> 24 is the Top 25)",
  );
  const card = (from: number, to: number) =>
    celebrationFor({
      rank: { from, to, passed: "x" },
      popularity: null,
      spotlessStreak: 0,
    })!;
  const c40 = card(41, 40);
  assert(
    c40.kind === "rank" &&
      c40.title === "You're in the Top 40!" &&
      c40.lines.includes("🎯 Next: Top 25"),
    "T5: the rank card for 41 -> 40 says Top 40 and what is next",
    c40,
  );
  const plain = card(40, 39);
  assert(
    plain.title === "You climbed to #39!" && !plain.lines.some((l) => /Next: Top/.test(l)),
    "T6: an ordinary climb keeps the old card",
    plain,
  );
  const one = card(2, 1);
  assert(
    one.title === "You're #1 in the city!" && !one.lines.some((l) => /Next: Top/.test(l)),
    "T7: reaching #1 says so and has no next line",
    one,
  );
}

console.log(failures ? `\nREGULAR GUEST QA: ${failures} FAILED` : "\nREGULAR GUEST QA: ALL PASS");
process.exit(failures ? 1 : 0);
