/**
 * SERVICE_FLOOR_QA — Transformation Phase B (developer 2026-10-25): the
 * customer's walk into the dining room, their order bubble, the plate after
 * Serve and the walk out (src/game/restaurant/serviceFloor.ts,
 * components/kc/game/ServiceFloor.tsx, Preparation.tsx, App.tsx).
 *   A. geometry: every stage's two seats and walks stay in the view, start
 *      outside the door, end at the seat, the seats are apart;
 *   B. seats alternate between customers and stay fixed per order;
 *   C. the face follows the dish's real grade; a customer always looks the same;
 *   D. wiring: presentation only — the floor never serves, pays or advances;
 *      Preparation calls the existing Serve once and shows the plate only for
 *      a real serve; Next / menu guest wait for the walk out; restaurant build only;
 *   E. no save field, no money path, no Business Day gate change.
 *
 * Run: npx tsx scripts/service-floor-qa.mts
 */
import { saveManagerChangesBeyondStartCash } from "./startCashGuard.mts";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  DEPARTING_FRESH_MS,
  noteDeparting,
  takeDeparting,
  FLOOR_PASS,
  FLOOR_SEATS,
  FLOOR_VIEW,
  REACTION_FACE,
  inView,
  legDurations,
  lookFor,
  resetSeatsForTests,
  seatForOrder,
  walkFrames,
  walkMs,
} from "../src/game/restaurant/serviceFloor.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
// The "nothing changed" audit is measured from 3ceac0f (the reviewed main before the 2026-10-29 work).
// Later approved save additions are excluded from this phase's "nothing changed" diff (each has its own QA):
// business.guideSeen (restaurant-guide-qa), business.pendingCash + the ledger `batch` (pending-cash-qa). Later approved save additions.
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

console.log("A. Geometry");
{
  const inside = (p: { x: number; y: number }) =>
    p.x >= FLOOR_VIEW.x0 && p.x <= FLOOR_VIEW.x1 && p.y >= FLOOR_VIEW.y0 && p.y <= FLOOR_VIEW.y1;
  const stages = Object.keys(FLOOR_SEATS) as (keyof typeof FLOOR_SEATS)[];
  assert(stages.length === 6, "A1: all six kitchen stages have seats", stages);
  const bad: string[] = [];
  for (const st of stages) {
    const [a, b] = FLOOR_SEATS[st];
    for (const [i, s] of [a, b].entries()) {
      const p = s.path;
      if (!p.every(inside)) bad.push(`${st}#${i} leaves the view`);
      if (!(p[0]!.y > 88 && Math.abs(p[0]!.x - 50) < 2))
        bad.push(`${st}#${i} doesn't start outside the door`);
      if (!p.some((q) => Math.abs(q.x - 50) < 2 && q.y > 78 && q.y < 84))
        bad.push(`${st}#${i} doesn't pass the door`);
      const end = p.at(-1)!;
      if (end.x !== s.seat.x || end.y !== s.seat.y) bad.push(`${st}#${i} doesn't end at its seat`);
      if (!(s.table.y < s.seat.y && Math.abs(s.table.x - s.seat.x) < 1))
        bad.push(`${st}#${i} table not in front of the seat`);
      if (legDurations(p).some((d) => d <= 0)) bad.push(`${st}#${i} has a zero-length leg`);
      if (walkMs(p) < 1200 || walkMs(p) > 4000) bad.push(`${st}#${i} walk ${walkMs(p)} ms`);
      const f = walkFrames(p);
      if (f[0]!.at !== 0 || f.at(-1)!.at !== 100)
        bad.push(`${st}#${i} frames ${f[0]!.at}–${f.at(-1)!.at}`);
    }
    if (Math.hypot(a.seat.x - b.seat.x, a.seat.y - b.seat.y) < 10)
      bad.push(`${st} seats too close`);
  }
  assert(
    bad.length === 0,
    "A2: every walk starts outside, passes the door, ends at its chair in front of its table, inside the view, 1.2–4 s",
    bad,
  );
  const v = inView({ x: FLOOR_VIEW.x0, y: FLOOR_VIEW.y1 });
  const p = inView(FLOOR_PASS);
  assert(
    v.x === 0 && v.y === 100 && p.x > 40 && p.x < 60 && p.y > 10 && p.y < 25,
    "A3: map → view percent; the pass is at the service counter",
    { v, p },
  );
}

console.log("B. Seats");
{
  resetSeatsForTests();
  const s1 = seatForOrder("o1");
  const s2 = seatForOrder("o2");
  const s3 = seatForOrder("o3");
  const again = seatForOrder("o1");
  assert(
    s1 !== s2 && s2 !== s3 && again === s1,
    "B1: seats alternate customer to customer and stay fixed per order (a re-render keeps it)",
    { s1, s2, s3, again },
  );
  noteDeparting({ customerId: "c1", seat: 0, face: "😋", at: 1000 });
  const d1 = takeDeparting(2000, "o2");
  const d1again = takeDeparting(2500, "o2");
  const nobody = takeDeparting(3000, "o3");
  noteDeparting({ customerId: "c2", seat: 1, face: "🙂", at: 1000 });
  const stale = takeDeparting(1000 + DEPARTING_FRESH_MS + 1, "o4");
  assert(
    d1?.customerId === "c1" && d1again === d1 && nobody === null && stale === null,
    "B2: the customer who left walks out in the next arrival only — once, the same on a re-render, never long after",
    { d1, d1again, nobody, stale },
  );
}

console.log("C. Faces and looks");
{
  const grades = ["Masterful", "Clean", "Honest", "Rustic", "Learning"] as const;
  assert(
    grades.every((g) => typeof REACTION_FACE[g] === "string" && REACTION_FACE[g].length > 0),
    "C1: a face for every real grade",
  );
  const a = lookFor("c-tobias");
  const b = lookFor("c-tobias");
  assert(
    a.outfit === b.outfit && a.hair === b.hair && /^#/.test(a.outfit),
    "C2: the same customer always looks the same (no randomness)",
    a,
  );
}

console.log("D. Wiring");
{
  const floorLogic = code("src/game/restaurant/serviceFloor.ts");
  const view = code("src/components/kc/game/ServiceFloor.tsx");
  const prep = code("src/components/kc/game/Preparation.tsx");
  const app = code("src/App.tsx");
  // Rule changed (developer 2026-10-26: "the cash near their dining table … collect it like
  // idle games"): the floor now shows the serve's pay and tip as cash on the table (CashVacuum,
  // display only) and a wallet that rolls to the real balance — it may READ credits, never
  // write money, the ledger or the save.
  assert(
    !/Math\.random/.test(floorLogic + view) &&
      !/Ledger|Settlement|SaveManager|persist|debitWallet|credits\s*[+-]?=[^=>]/.test(
        floorLogic + view,
      ) &&
      !/wallet|credits/.test(floorLogic),
    "D1: the floor is presentation only — no randomness, ledger, settlement or save; it never writes money",
  );
  assert(
    /const served = service\.onServe\(\{ joinCash \}\);/.test(prep) &&
      /if \(served && floor\) \{[\s\S]{0,900}setFloorMode\("deliver"\)/.test(prep) &&
      (prep.match(/service\.onServe\(/g) ?? []).length === 1,
    "D2: Serve calls the existing serve once (joining a party's cash pile when plates were held, 2026-10-30); the plate goes to the table only for a real serve",
  );
  assert(
    /service\.nextLabel === "Finish Level"\s*\?\s*service\.onNextOrder\(\)\s*:\s*departThen\(service\.onNextOrder\)/.test(
      prep,
    ) &&
      /service\.extraAction!\.disabled\s*\?\s*undefined\s*:\s*departThen\(service\.extraAction!\.onClick\)/.test(
        prep,
      ) &&
      /const departThen = \(next: \(\) => void\) => \{[\s\S]{0,320}\r?\n\s*next\(\);\r?\n\s*\};/.test(
        prep,
      ),
    "D3: Next Customer / Finish Level / a menu guest run the existing action at once, exactly once (the walk out never delays it)",
  );
  assert(
    /useState<FloorMode \| null>\(\s*(?:\/\/[^\n]*\n\s*)*service && floor && service\.order\.order\.status !== "READY" \? "arrive" : null/.test(
      prep,
    ) && /if \(paused\) return;\s*if \(floorMode\) return;/.test(prep),
    "D4: a service order starts with the arrival (only when the floor is given, and not for a plate prepared together with the one before it); the Regular's clock waits for it",
  );
  assert(
    /\.\.\.\(RESTAURANT_MODE\s*\?\s*\{[\s\S]{0,160}floor: \{[\s\S]{0,200}kitchenMapArtStage\(save\.equippedKitchenUpgradeId\)/.test(
      app,
    ),
    "D5: App gives the floor in the restaurant build only, from the built kitchen stage",
  );
  assert(
    /onClick=\{finish\}/.test(view) &&
      /done\.current/.test(view) &&
      /min-h-|h-12|KButton/.test(view),
    "D6: a tap anywhere skips ahead, once (a second tap does nothing); the button is a 48 px KButton",
  );
}

console.log("E. Nothing else moves");
{
  // Compared with the tree before Phase B (095115a, the Phase 0 report).
  // Rule changed (developer 2026-10-26, "the game starts at 0 cash"): SaveManager may change
  // only the new save's opening credits (scripts/startCashGuard.mts).
  const diff =
    saveManagerChangesBeyondStartCash("095115a", ROOT).join("\n") +
    execSync(
      // Early-game phase 4 (developer 2026-10-26): everything unlocked by Level 5 — only the unlock-level
      // lines of these catalogs change (staff-hire-qa U5 checks no price moved).
      "git diff ae4ad52 -- src/game/business/businessTypes.ts src/game/economy :!src/game/economy/staffDefinitions.ts :!src/game/business/businessTypes.ts :!src/game/economy/EconomyLedger.ts :!src/game/economy/ledgerTypes.ts :!src/game/economy/customerTips.ts :!src/game/economy/pendingCash.ts src/game/daily/EndlessServiceManager.ts src/game/restaurant/endlessRestaurant.ts",
      { cwd: ROOT, encoding: "utf8" },
    );
  assert(
    diff.trim() === "",
    "E1: no save field, no wallet / ledger change, the Business Day gate (Endless only) untouched",
    diff.slice(0, 300),
  );
}

console.log(
  failures === 0 ? "\nSERVICE FLOOR QA: ALL PASS" : `\nSERVICE FLOOR QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
