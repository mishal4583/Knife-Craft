/**
 * MILESTONE CHEST QA (developer 2026-11-10): the Hype chests at the first completion of Levels 5, 10, 15 and 20 (restaurant/milestoneChests.ts).
 *   A the chests: which levels, what they give, the card
 *   B they give Hype only: credits, stock and the ledger never move
 *   C wiring: first completion only, restaurant build only, the card shows (with a ranking climb's lines too)
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { CHESTS, chestAt, chestCelebration } from "../src/game/restaurant/milestoneChests.ts";
import { addHype, secondFloorOf, HYPE_MAX } from "../src/game/restaurant/secondFloor.ts";

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

console.log("A. The chests");
{
  assert(CHESTS.map((c) => c.level).join() === "5,10,15,20", "A1: Levels 5, 10, 15 and 20", CHESTS);
  assert(
    CHESTS.every((c) => Number.isInteger(c.hype) && c.hype >= 10 && c.hype <= 50),
    "A2: each gives 10-50 Hype (the meter is 100)",
  );
  assert(
    CHESTS.every((c, i) => i === 0 || c.hype >= CHESTS[i - 1]!.hype),
    "A3: the gifts never shrink as the game goes on",
  );
  assert(
    chestAt(4) === null && chestAt(21) === null && chestAt(10)?.level === 10,
    "A4: other levels have none",
  );
  const card = chestCelebration(CHESTS[0]!, ["🏆 #9 → #8 in the city"]);
  assert(
    card.kind === "chest" &&
      card.lines[0] === "⚡ +15 Hype" &&
      card.lines.length === 2 &&
      card.title.length > 0 &&
      card.paige.length <= 80,
    "A5: the card says the Hype and keeps a ranking climb's line",
    card,
  );
}

console.log("B. Hype only");
{
  const save: SaveData = { ...structuredClone(DEFAULT_SAVE), credits: 12_345 };
  const ledger = save.economyLedger.length;
  const inv = JSON.stringify(save.business.inventory);
  let cur = save;
  for (const c of CHESTS) cur = addHype(cur, c.hype);
  assert(CHESTS.reduce((n, c) => n + c.hype, 0) === 110, "B1: the four chests add up to 110 Hype");
  assert(secondFloorOf(cur).hype === HYPE_MAX, "B1b: the meter stops at its maximum of 100");
  assert(
    cur.credits === 12_345 &&
      cur.economyLedger.length === ledger &&
      JSON.stringify(cur.business.inventory) === inv,
    "B2: credits, stock and the ledger are untouched",
  );
}

console.log("C. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    /RESTAURANT_MODE && isFirstCompletion \? chestAt\(levelNumber\(level\.id\)\) : null/.test(app),
    "C1: only a first completion, only in the restaurant build",
  );
  assert(
    /if \(chest\) nextSave = addHype\(nextSave, chest\.hype\)/.test(app),
    "C2: the Hype goes into the level's own save",
  );
  assert(
    /chestCelebration\(chest, c \? c\.lines : \[\]\)/.test(app),
    "C3: the card shows, with a ranking climb's lines too",
  );
  const src = read("src/game/restaurant/milestoneChests.ts");
  assert(
    !/credits|economyLedger|Math\.random|inventory/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "C4: the rules file has no money, stock or random",
  );
}

console.log(
  failures === 0
    ? "\nMILESTONE CHEST QA: ALL PASS"
    : `\nMILESTONE CHEST QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
