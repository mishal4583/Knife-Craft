/**
 * SERVICE_FLOW_QA — Phase 2, customers on a clock (restaurant/serviceFlow.ts,
 * docs/planning/PHASE2-PLAN-2026-10-30.md):
 *   P. the pace: one at a time before Level 5, then 35 s / 28 s / 22 s, shorter with a bigger team (≥ 15 s);
 *   S. the schedule: deterministic; orders first and in order, then guests, then walk-ins; counts as given;
 *      a level's own order never walks out;
 *   Q. the queue: first come first served; at most 4 waiting; patience drains only while waiting
 *      (not seated, not under Auto); a walk-out is a state only; the clock step is clamped; paused = no move;
 *      one at a time admits nobody while someone is in; Next Customer calls the next arrival in;
 *   M. the module: no wallet, ledger, save, React or Math.random.
 *
 * Run: npx tsx scripts/service-flow-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  MAX_STEP_MS,
  MIN_GAP_MS,
  QUEUE_MAX,
  arrivalSchedule,
  callNext,
  gapFor,
  guestLeft,
  nextToSeat,
  oneAtATime,
  paceAt,
  queueDone,
  seatGuest,
  startQueue,
  stepQueue,
  waitingOf,
  type QueueState,
} from "../src/game/restaurant/serviceFlow.ts";

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const run = (q: QueueState, ms: number, opts = {}) => {
  let s = q;
  for (let t = 0; t < ms; t += MAX_STEP_MS) s = stepQueue(s, MAX_STEP_MS, opts);
  return s;
};

// ── P. pace ──────────────────────────────────────────────────────────────
check("P1 Levels 1–4 one at a time", [1, 4].every(oneAtATime) && !oneAtATime(5));
check(
  "P2 35 s from L5, 28 s from L20, 22 s from L40",
  paceAt(5).gapMs === 35_000 && paceAt(20).gapMs === 28_000 && paceAt(40).gapMs === 22_000,
);
check(
  "P3 patience 150 / 120 / 100 s",
  paceAt(5).patienceMs === 150_000 &&
    paceAt(20).patienceMs === 120_000 &&
    paceAt(60).patienceMs === 100_000,
);
check(
  "P4 a bigger team shortens the gap, never below 15 s",
  gapFor(10, 2) === 35_000 && gapFor(10, 4) === 17_500 && gapFor(40, 8) === MIN_GAP_MS,
);

// ── S. schedule ──────────────────────────────────────────────────────────
const input = {
  levelId: "level-12",
  levelNumber: 12,
  orders: 2,
  guests: 2,
  walkIns: 1,
  capacity: 2,
};
const s1 = arrivalSchedule(input);
check("S1 deterministic", JSON.stringify(s1) === JSON.stringify(arrivalSchedule(input)));
check(
  "S2 orders first, then guests, then the walk-in; counts as given",
  s1.map((a) => a.kind).join() === "order,order,guest,guest,walk-in" &&
    s1.map((a) => a.index).join() === "0,1,0,1,0",
);
check(
  "S3 one every gap from 0",
  s1.map((a) => a.atMs).join() === [0, 1, 2, 3, 4].map((i) => i * 35_000).join(),
);
check(
  "S4 a level's own order never walks out; guests have the level's patience",
  s1.filter((a) => a.kind === "order").every((a) => a.patienceMs === Infinity) &&
    s1.filter((a) => a.kind !== "order").every((a) => a.patienceMs === 150_000),
);
check(
  "S5 Levels 1–4: everyone due at 0 (taken one at a time)",
  arrivalSchedule({ ...input, levelNumber: 3 }).every((a) => a.atMs === 0),
);

// ── Q. queue ─────────────────────────────────────────────────────────────
let q = startQueue(s1, 12);
check("Q1 the first customer is at the door at once", nextToSeat(q)?.kind === "order");
q = run(q, 35_000 * 4);
check(
  "Q2 first come, first served",
  waitingOf(q)
    .map((g) => g.arrival.id)
    .join() === "level-12:0,level-12:1,level-12:2,level-12:3",
);
check(
  "Q3 at most 4 waiting; the 5th waits outside",
  waitingOf(q).length === QUEUE_MAX && q.outside.length === 1,
);
q = run(q, 150_000);
check(
  "Q4 guests walk out after their patience; orders never do",
  q.guests
    .filter((g) => g.state === "WALKED_OUT")
    .map((g) => g.arrival.kind)
    .join() === "guest,guest" &&
    q.guests.filter((g) => g.arrival.kind === "order").every((g) => g.state === "WAITING"),
  q.guests.map((g) => [g.arrival.id, g.state]),
);
let p = run(startQueue(s1, 12), 35_000 * 3);
p = seatGuest(p, "level-12:2");
p = run(p, 200_000);
check(
  "Q5 a seated guest's patience is paused",
  p.guests.find((g) => g.arrival.id === "level-12:2")?.state === "SEATED",
);
const auto = run(run(startQueue(s1, 12), 35_000 * 3), 200_000, { patiencePaused: true });
check("Q6 under Auto nobody walks out", !auto.guests.some((g) => g.state === "WALKED_OUT"));
const big = stepQueue(startQueue(s1, 12), 60_000);
check("Q7 one step is clamped", big.clockMs === MAX_STEP_MS);
const paused = startQueue(s1, 12);
check("Q8 paused (dt 0) moves nothing", stepQueue(paused, 0) === paused);
let one = startQueue(arrivalSchedule({ ...input, levelNumber: 3 }), 3);
check("Q9 one at a time: only one in", one.guests.length === 1);
one = seatGuest(one, "level-12:0");
one = run(one, 400_000);
check(
  "Q10 one at a time: nobody else comes in, nobody walks out, while someone is in",
  one.guests.length === 1 && one.guests[0]!.state === "SEATED",
);
one = guestLeft(one, "level-12:0");
check("Q11 …and the next comes in when they leave", nextToSeat(one)?.id === "level-12:1");
let c = startQueue(s1, 12);
c = guestLeft(seatGuest(c, "level-12:0"), "level-12:0");
check(
  "Q12 nobody at the door: Next Customer calls the next arrival in now",
  nextToSeat(callNext(c))?.id === "level-12:1",
);
let d = startQueue(arrivalSchedule({ ...input, orders: 1, guests: 0, walkIns: 0 }), 12);
d = guestLeft(seatGuest(d, "level-12:0"), "level-12:0");
check("Q13 done when nobody is waiting, seated or to come", queueDone(d) && !queueDone(c));

// ── M. module ────────────────────────────────────────────────────────────
const mod = fs
  .readFileSync(path.join(process.cwd(), "src/game/restaurant/serviceFlow.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
check(
  "M1 no wallet, ledger, save, React or Math.random",
  !/Math\.random|debitWallet|appendLedgerEntry|SaveManager|credits|from "react"/.test(mod),
);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
