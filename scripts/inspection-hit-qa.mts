/**
 * INSPECTION HIT QA (developer 2026-11-21: "I clicked on the sweet potato behind and it picked the wrong item. Optimize the touch and its accuracy").
 * The tap of Delivery Inspection is judged on the ingredients' own solid pixels (`components/kc/inventory/inspectionHit.ts`), topmost first, with a fingertip of slack.
 *  A. A tap on an item behind, where the item in front has no solid pixel (inside its round box), picks the one behind (the old box test picked the one in front).
 *  B. A tap on the front item's own pixel picks it; exactly the same point with the item in front removed picks the one behind.
 *  C. The slack: a tap just off a solid edge still picks it (within the finger's width), a tap farther than that picks nothing.
 *  D. A tilted item is hit where it is DRAWN (the mask turns with the tilt).
 *  E. The game uses it (taps and drags both) and skips pieces already found; Done is unchanged.
 * Run: npx tsx scripts/inspection-hit-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  SLACK_PX,
  pickItem,
  setMaskForTest,
  type Pickable,
} from "../src/components/kc/inventory/inspectionHit.ts";
import type { CrateItem } from "../src/game/business/deliveryInspection.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail).slice(0, 300));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const W = 1000; // the crate's width in px: 1 crate unit = 10 px
const item = (
  id: number,
  ingredient: string,
  x: number,
  y: number,
  size: number,
  tilt = 0,
): CrateItem => ({ id, ingredient, x, y, size, tilt, layer: 1 }) as unknown as CrateItem;
const pk = (it: CrateItem, z: number): Pickable => ({ item: it, z });

// two test "ingredients": a full disc (a zucchini's body is round enough here) and a thin diagonal-free bar that fills only the bottom half of its box
setMaskForTest("zucchini", (x, y) => Math.hypot(x - 0.5, y - 0.5) <= 0.2); // small solid disc in the middle of a big box
setMaskForTest("sweetpotato", () => true); // solid all over
setMaskForTest("rightbar", (x) => x > 0.5); // solid only on the right half

console.log("A. A tap goes to the item whose own pixel is under the finger");
{
  const front = item(1, "zucchini", 50, 40, 30); // box 300 px wide, solid disc of 120 px
  const behind = item(2, "sweetpotato", 50, 40, 30);
  const list = [pk(front, 200), pk(behind, 100)];
  // 120 px right of the centre: inside the front item's round box (150 px) but far outside its solid disc
  const off = pickItem(list, W, 500 + 120, 400);
  assert(
    off?.id === 2,
    "A1: on the front item's empty corner, the item behind gets the tap",
    off?.id,
  );
  const on = pickItem(list, W, 500, 400);
  assert(on?.id === 1, "A2: on the front item's own pixel, the front item gets it", on?.id);
}
console.log("B. The same point, with and without the item in front");
{
  const front = item(1, "zucchini", 50, 40, 30);
  const behind = item(2, "sweetpotato", 50, 40, 30);
  assert(
    pickItem([pk(front, 2), pk(behind, 1)], W, 500, 400)?.id === 1,
    "B1: both there: the front one",
  );
  assert(
    pickItem([pk(behind, 1)], W, 500, 400)?.id === 2,
    "B2: the front one gone: the one behind",
  );
  assert(
    pickItem([pk(front, 1), pk(behind, 2)], W, 500, 400)?.id === 2,
    "B3: the order is the paint order (z), not the list order",
  );
}
console.log("C. A fingertip of slack");
{
  const only = item(3, "zucchini", 50, 40, 30); // solid disc radius 60 px about (500, 400)
  const near = pickItem([pk(only, 1)], W, 500 + 60 + 8, 400);
  const far = pickItem([pk(only, 1)], W, 500 + 60 + SLACK_PX + 8, 400);
  assert(
    near?.id === 3,
    `C1: 8 px off the edge (inside the ${SLACK_PX} px slack) still picks it`,
    near?.id,
  );
  assert(far === null, "C2: farther than the slack picks nothing", far?.id);
  assert(pickItem([], W, 500, 400) === null, "C3: an empty crate picks nothing");
}
console.log("D. A tilted item is hit where it is drawn");
{
  // solid on the right half of its box; tilted 90 degrees clockwise the solid half is the BOTTOM half
  const t = item(4, "rightbar", 50, 40, 30, 90);
  const bottom = pickItem([pk(t, 1)], W, 500, 400 + 100);
  const top = pickItem([pk(t, 1)], W, 500, 400 - 100);
  assert(bottom?.id === 4, "D1: the solid half, turned to the bottom, is hit there", bottom?.id);
  assert(top === null, "D2: the empty half, turned to the top, is not", top?.id);
}
console.log("E. The game uses it");
{
  const g = fs.readFileSync(
    path.join(ROOT, "src/components/kc/inventory/DeliveryInspectionGame.tsx"),
    "utf8",
  );
  assert(
    /pickItem\(/.test(g) &&
      /const it = pick\(e\.clientX, e\.clientY\)/.test(g) &&
      /flag\(d\.id\)/.test(g),
    "E1: a press picks the item by its pixels, and the release flags that item (not the box that was pressed)",
  );
  assert(
    /!gone\.has\(x\.id\) && !found\.has\(x\.id\)/.test(g),
    "E2: a piece already found or gone is skipped, so a tap goes through to what lay behind it",
  );
  assert(
    /loadMask\(it\.ingredient\)/.test(g),
    "E3: the pictures' pixels are read when the game opens",
  );
}
console.log(
  failures === 0 ? "\nINSPECTION HIT QA: ALL PASS" : `\nINSPECTION HIT QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
