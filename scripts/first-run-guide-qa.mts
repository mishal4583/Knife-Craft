/**
 * FIRST RUN GUIDE QA (developer 2026-11-01: "ensure there are proper hand instructions to buy the ingredients, hire
 * them, and then go back to cutting", then "ask the player to hire them first, then buy the ingredients"; restaurant/firstRunGuide.ts):
 *   R. One hand at a time, in order: hire the Server and the Cashier → buy the food → back to the Kitchen → Open for
 *      service → start the service; a finished step never returns; a hire the player cannot pay for is skipped (the hand
 *      never points at a button that cannot be tapped); nothing after the first service; nothing before the intro is done.
 *   W. The wiring: the Market's Buy and Hire buttons, the bottom bar's tabs, the Kitchen's button and the sheet's button.
 *
 * Run: npx tsx scripts/first-run-guide-qa.mts
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

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const G = await import("../src/game/restaurant/firstRunGuide.ts");
const { marketPlanFor } = await import("../src/game/restaurant/marketPlan.ts");

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const fresh = (): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  story: { ...DEFAULT_SAVE.story, introDone: true },
});
/** The food bought: every line of today's plan is in the fridge. */
const withFood = (s: SaveData): SaveData => {
  const inv = { ...s.business.inventory };
  for (const row of marketPlanFor(s, 1).rows)
    inv[row.ingredientId] = {
      ingredientId: row.ingredientId,
      quantity: 50,
      unitCost: 0,
      purchaseDay: s.business.calendar.businessDay,
    } as (typeof inv)[typeof row.ingredientId];
  return { ...s, business: { ...s.business, inventory: inv } };
};
const hired = (s: SaveData, roles: string[]): SaveData =>
  ({
    ...s,
    business: { ...s.business, staff: { ...s.business.staff, hiredRoles: roles } },
  }) as unknown as SaveData;
const step = (s: SaveData, where: Parameters<typeof G.firstRunHand>[1]) =>
  G.firstRunHand(s, where)?.step ?? null;

{
  const s0 = fresh();
  check(
    "R1 a new game: the team is hired FIRST, so the Market's hand is on Hire, and anywhere else it points at the Market",
    step(s0, "market") === "hire" &&
      step(s0, "kitchen") === "to-market" &&
      step(s0, "other") === "to-market" &&
      marketPlanFor(s0, 1).rows.length > 0,
  );
  const s1 = hired(s0, ["server"]);
  check(
    "R2 one of the two hired: still the Hire step for the other",
    step(s1, "market") === "hire",
  );
  const s2 = hired(s0, ["server", "cashier"]);
  check(
    "R3 both hired, the food still to buy: the hand moves to Buy (on the Market) — or to the Market tab from elsewhere",
    step(s2, "market") === "buy" && step(s2, "kitchen") === "to-market",
    step(s2, "market"),
  );
  const s3 = withFood(s2);
  check(
    "R4 team hired and food bought: back to the Kitchen (the tab) — and once there, Open for service; on the sheet, start the service",
    marketPlanFor(s3, 1).rows.length === 0 &&
      step(s3, "market") === "to-kitchen" &&
      step(s3, "other") === "to-kitchen" &&
      step(s3, "kitchen") === "open" &&
      step(s3, "sheet") === "start",
    { market: step(s3, "market"), kitchen: step(s3, "kitchen"), sheet: step(s3, "sheet") },
  );
  const broke = { ...s0, credits: 0 };
  check(
    "R5 a hire the player cannot pay for is skipped: the hand goes on to Buy instead of pointing at a dead button",
    step(broke, "market") === "buy" && step(withFood(broke), "kitchen") === "open",
  );
  const done = { ...s3, levelProgress: { ...s3.levelProgress, completedLevelIds: ["level-1"] } };
  const early = { ...fresh(), story: { ...DEFAULT_SAVE.story, introDone: false } };
  check(
    "R6 no hand after the first service, and none before the intro is done",
    G.firstRunHand(done, "kitchen") === null &&
      G.firstRunHand(done, "market") === null &&
      G.firstRunHand(early, "market") === null &&
      !G.isFirstRun(done),
  );
  const order: string[] = [];
  order.push(step(s0, "market")!, step(s2, "market")!);
  order.push(step(s3, "market")!, step(s3, "kitchen")!, step(s3, "sheet")!);
  check(
    "R7 the whole walk is hire → buy → to-kitchen → open → start, each with its own numbered caption in that order",
    order.join() === "hire,buy,to-kitchen,open,start" &&
      (
        [
          [s0, "market", "1️⃣"],
          [s2, "market", "2️⃣"],
          [s3, "market", "3️⃣"],
          [s3, "kitchen", "4️⃣"],
          [s3, "sheet", "5️⃣"],
        ] as const
      ).every(([sv, w, n]) => G.firstRunHand(sv, w)?.caption.startsWith(n)),
    order,
  );
}

{
  const plan = read("src/components/kc/MarketPlanPanel.tsx");
  const team = read("src/components/kc/restaurant/TeamHireCard.tsx");
  const nav = read("src/components/kc/Kitchen.tsx");
  const router = read("src/ScreensRouter.tsx");
  const sheet = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  check(
    "W1 the Market: the hand is on the first Buy button only while the food is to buy, and on the first affordable Hire button only at the hire step",
    /handStep === "buy" && row === rows\[0\]/.test(plan) &&
      /firstRunHand\(save, "market"\)\?\.step === "hire"/.test(team) &&
      /handRole === o\.role/.test(team),
  );
  check(
    "W2 the bottom bar: a hand and a numbered caption on the Market tab, then the Kitchen tab (not while Grandma's own pointer is up)",
    /NavHandContext/.test(nav) &&
      /data-testid="first-run-caption"/.test(nav) &&
      /const handed = pointer \? null : firstHand/.test(nav) &&
      /tab: "shop"/.test(router) &&
      /tab: "kitchen"/.test(router) &&
      /firstHand && !navGuide/.test(router),
  );
  check(
    "W3 the Kitchen's Open for service button and the Pre-Service Check's start button each get the hand at their step",
    /data-hand-for="open-service"/.test(nav) &&
      /firstRunHand\(save, "kitchen"\)\?\.step === "open"/.test(nav) &&
      /data-hand-for="start-service"/.test(sheet) &&
      /firstRunHand\(save, "sheet"\)\?\.step === "start"/.test(layer),
  );
  const mod = read("src/game/restaurant/firstRunGuide.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  check(
    "W4 presentation only: the guide module buys, hires and saves nothing and uses no random",
    !/debitWallet|appendLedgerEntry|Math\.random|SaveManager\.|persist/.test(mod),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
