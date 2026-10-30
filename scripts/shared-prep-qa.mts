/**
 * SHARED PREP + OPTIONAL CASH QA (developer 2026-10-30):
 *  S  Customers who ordered the same dish are cut plate after plate, cooked once and served
 *     together: the next plate arrives READY with the same score (ServiceManager is unchanged).
 *  C  Collecting the cash left on the table is optional, but it must be in the till before the
 *     night closes.
 *
 * Run: npx tsx scripts/shared-prep-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  advanceServiceSession,
  createTicketedServiceSession,
  recordAllComponents,
  serveCurrentOrder,
} from "../src/game/service/ServiceManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail));
  }
}

console.log("S. Same dish, prepared together");
{
  const r = getCampaignRecipe("camp-bruschetta-trio")!;
  let s = createTicketedServiceSession("level-17", [r, r], 0, () => 0, 3, false)!;
  s = recordAllComponents(s, 90);
  const served = serveCurrentOrder(s, () => 0, 100)!;
  s = advanceServiceSession(served.session, [], () => 0);
  assert(
    s.current?.order.status === "ACTIVE",
    "S1: after the first plate is served the next order is a fresh ACTIVE one",
  );
  s = recordAllComponents(s, 90);
  assert(
    s.current?.order.status === "READY" && s.current.order.preparationScore === 90,
    "S2: the same preparation makes the next plate READY with the same score — no second cutting",
  );
  const again = serveCurrentOrder(s, () => 0, 100);
  assert(
    !!again && again.coinsAwarded === 100,
    "S3: the second plate is served and paid once through the same serve",
  );
  assert(
    serveCurrentOrder(again!.session, () => 0, 100) === null,
    "S4: a served plate can never be served or paid again",
  );

  const prep = read("src/components/kc/game/Preparation.tsx");
  assert(
    /Array\.from\(\{ length: portions \}/.test(prep) &&
      /FOR PLATE|\$\{k \+ 1\}/.test(prep) &&
      /const \[portions\] = useState/.test(prep) &&
      /onComplete\(result\.score, portions\)/.test(prep),
    "S5: Preparation repeats the dish's steps once per plate (decided once per order) and reports the plates when the cut ends",
  );
  const app = read("src/App.tsx");
  assert(
    /recordAllComponents\(advanced, sharedPrep\.score\)/.test(app) &&
      /sharedPrep\.levelId === advanced\.levelId/.test(app) &&
      /setSharedPrep\(null\);/.test(app),
    "S6: only the next plate of the SAME level and dish arrives ready; the memory is cleared with every new level session",
  );
  assert(
    /n < 3 &&[\s\S]{0,80}at \+ 1 \+ n < required[\s\S]{0,80}tickets\[at \+ 1 \+ n\]\?\.id === id/.test(
      app,
    ),
    "S7: only the level's own required orders with the same recipe, up to a party of 4, are prepared together (never menu guests)",
  );
}

console.log("C. Optional cash, collected before closing");
{
  const soc = read("src/components/kc/game/ServiceOrderComplete.tsx");
  assert(
    !/disabled=\{remaining > 0\}/.test(soc) && !/\|\| remaining > 0\}/.test(soc),
    "C1: Next, the extra action and Back never wait for the cash on the table",
  );
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  assert(
    /data-testid="cash-later"/.test(floor) && /Collect later/.test(floor),
    "C2: the table's cash screen offers 'Collect later'",
  );
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /data-testid="kitchen-table-cash"/.test(kitchen) && /on the table · Collect/.test(kitchen),
    "C3: the Kitchen shows the cash left on the table with a Collect button",
  );
  const closing = read("src/components/kc/restaurant/ClosingTime.tsx");
  assert(
    /disabled=\{left > 0 \|\| tableCash > 0\}/.test(closing) &&
      /Collect the table cash first/.test(closing),
    "C4: 'Close for the night' waits until the table's cash is in the till",
  );
  assert(
    /later\(\(\) => setState\("leaving"\), DELIVER_MS \+ REACT_MS\)/.test(floor) &&
      /if \(partyLeaves\) \{[\s\S]{0,200}finishRef\.current\(\)[\s\S]{0,200}LEAVE_MS/.test(floor) &&
      !/setState\("cash"\)/.test(
        floor.slice(floor.indexOf("useEffect"), floor.indexOf("const tapAnywhere")),
      ),
    "C5: after the plate and the reaction the customer walks out and the served card opens by itself — the cash screen only opens when the player asks (cashOnly)",
  );
  const prep = read("src/components/kc/game/Preparation.tsx");
  assert(
    /setCashViewOnly\(true\)/.test(prep) &&
      /\{\.\.\.\(cashViewOnly \? \{ cashOnly: true \} : \{\}\)\}/.test(prep),
    "C6: 'Collect cash at the table' opens the cash view on purpose (cashOnly), swipe the piles in or 'Collect later'",
  );
}

console.log(failures ? `\nSHARED PREP QA: ${failures} FAILURE(S)` : "\nSHARED PREP QA: ALL PASS");
process.exit(failures ? 1 : 0);
