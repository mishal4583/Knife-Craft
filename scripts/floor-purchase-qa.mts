/**
 * FLOOR PURCHASE TEXT QA (developer 2026-11-11): the Second Floor says in plain words what each purchase is and what it adds
 * (restaurant/floorPurchaseText.ts). A the words; B the result line after a buy carries the real numbers; C the screen uses them.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { nextFloorGoal, floorGoals } from "../src/game/restaurant/floorGoal.ts";
import {
  PURCHASE_HELP,
  PURCHASE_INFO,
  boughtText,
  gainText,
  goalTitle,
} from "../src/game/restaurant/floorPurchaseText.ts";
import {
  MAX_POLISH,
  buyPolish,
  buyTable,
  floorPerHour,
  secondFloorOf,
} from "../src/game/restaurant/secondFloor.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const fmt = (n: number) => `$${(n / 100).toFixed(2)}`;
const NOW = 1_800_000_000_000;

function floorSave(): SaveData {
  const s = structuredClone(DEFAULT_SAVE) as SaveData;
  s.credits = 5_000_000;
  s.business = {
    ...s.business,
    secondFloor: {
      stations: { coffee: { level: 1, lastCollectAt: NOW, tables: 2, polish: 6 } },
      servers: 1,
      cleaners: 0,
      branch: 0,
    },
  } as SaveData["business"];
  return s;
}

console.log("A. The words");
{
  const kinds = ["machine", "table", "polish", "tier"] as const;
  assert(
    kinds.every((k) => PURCHASE_INFO[k].icon && PURCHASE_INFO[k].does.length > 20),
    "A1: every kind has an icon and a sentence saying what it does",
  );
  assert(
    /6%/.test(PURCHASE_INFO.polish.does) &&
      new RegExp(`${MAX_POLISH} steps`).test(PURCHASE_INFO.polish.does),
    "A2: Polish says +6% a step and how many steps there are",
  );
  assert(PURCHASE_HELP.length === 4, "A3: the ⓘ explains all four purchases", PURCHASE_HELP);
  const s = floorSave();
  const goals = floorGoals(s, 14);
  const polish = goals.find((g) => g.kind === "polish")!;
  const table = goals.find((g) => g.kind === "table")!;
  const tier = goals.find((g) => g.kind === "tier")!;
  const owned = secondFloorOf(s).stations.coffee;
  assert(
    goalTitle(polish, owned) === "Coffee: polish step 7 of 10" &&
      goalTitle(table, owned) === "Coffee: add table #3" &&
      goalTitle(tier, owned) === "Coffee: upgrade to Tier 2",
    "A4: goal titles say the thing and the step ('polish step 7 of 10', not 'polish 7')",
    [goalTitle(polish, owned), goalTitle(table, owned), goalTitle(tier, owned)],
  );
  assert(
    gainText(1234, fmt) === "+$12.34 an hour" && /Floor Server/.test(gainText(0, fmt)),
    "A5: the gain reads '+$X an hour'; a machine nobody runs says it needs a Floor Server",
  );
  const g = nextFloorGoal(s, 14, s.credits)!;
  assert(!!g && g.gain > 0, "A6: the next goal always has a gain to show", g);
}

console.log("B. After a buy");
{
  const s = floorSave();
  const t = buyTable(s, "coffee", NOW);
  const p = buyPolish(s, "coffee", NOW);
  assert(t.ok && p.ok, "B0: the purchases work");
  if (t.ok && p.ok) {
    const tt = boughtText("table", "coffee", s, t.save, fmt);
    const pt = boughtText("polish", "coffee", s, p.save, fmt);
    assert(
      /table #3 added/.test(tt) &&
        tt.includes(fmt(floorPerHour(t.save) - floorPerHour(s))) &&
        tt.includes(fmt(floorPerHour(t.save))),
      "B1: a table says which one, what it added an hour and what the floor earns now",
      tt,
    );
    assert(
      /polished \(7\/10\)/.test(pt) && pt.includes(fmt(floorPerHour(p.save) - floorPerHour(s))),
      "B2: a polish step says 7/10 and what it added an hour",
      pt,
    );
    assert(
      /hire a Floor Server/.test(boughtText("machine", "coffee", s, s, fmt)),
      "B3: a machine that earns nothing yet says what to do",
    );
  }
}

console.log("C. The screen");
{
  const v = read("src/components/kc/restaurantMap/SecondFloorView.tsx");
  assert(
    /goalTitle\(goal, floor\.stations\[goal\.id\]\)/.test(v) &&
      /data-testid="floor-goal-help"/.test(v) &&
      /data-testid="purchase-help"/.test(v),
    "C1: the goal strip and the station panel use the plain titles and carry the ⓘ explanations",
  );
  assert(
    /Earns 6% more/.test(v) && /Upgrade to Tier/.test(v) && /Add table #/.test(v),
    "C2: the three purchase buttons say what they buy and what it adds",
  );
  assert(
    !/✓ Station bought · working now|✨ Polished · earns more|🪑 New table · more guests/.test(v),
    "C3: the vague 'Polished · earns more' notes are gone",
  );
  assert(
    !/credits|ledger|Math\.random/.test(
      read("src/game/restaurant/floorPurchaseText.ts").replace(/\/\*[\s\S]*?\*\//g, ""),
    ),
    "C4: the text module moves no money and has no randomness",
  );
}

console.log(
  failures === 0 ? "\nFLOOR PURCHASE QA: ALL PASS" : `\nFLOOR PURCHASE QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
