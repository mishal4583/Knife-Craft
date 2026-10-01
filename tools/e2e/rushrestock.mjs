// Rush Restock (Business → blocked order) against the built game.
// A returning player whose only menu dish (Garden Salad) is missing carrot:
//   1. the Operations "Current Order Blocked" card shows ⚡ Rush Restock with its price,
//      no ad button (the local mock platform can't show rewarded ads) and Go to Market;
//   2. paying cash stocks the carrot, charges exactly Market ($0.80) + 25%, writes one
//      inventory-purchase ledger entry and unblocks the order (Service: "Everything's in stock");
//   3. with a stubbed rewarded ad, 🎬 Watch Ad restocks free (no money, no ledger entry);
//      a declined ad restocks nothing.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  text,
  save,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");

// Every Business dish except the Garden Salad goes off the menu, so each order is a salad.
const OFF_MENU = [
  "biz-caprese-salad",
  "biz-caprese-skewers",
  "biz-insalata-di-pomodoro",
  "biz-tomato-lettuce-salad",
  "biz-fennel-artichoke-salad",
  "biz-kachumber-salad",
  "biz-thai-cucumber-salad",
  "biz-korean-pear-radish-salad",
  "biz-salmon-avocado-salad",
  "biz-avocado-corn-salad",
  "biz-garlic-bread",
  "biz-tomato-bruschetta",
  "biz-tomato-basil-crostini",
  "biz-mushroom-bruschetta",
  "biz-sauteed-garlic-mushrooms",
  "biz-asparagus-persillade",
  "biz-spinach-curry",
  "biz-cauliflower-curry",
  "biz-potato-curry",
  "biz-pea-tomato-curry",
  "biz-pumpkin-coconut-curry",
  "biz-eggplant-masala",
  "biz-tomato-chicken-curry",
  "biz-tofu-broccoli-stirfry",
  "biz-chicken-broccoli",
  "biz-green-bean-tofu-stirfry",
  "biz-black-pepper-chicken",
  "biz-garlic-chicken",
  "biz-salmon-sashimi",
  "biz-salmon-asparagus",
  "biz-salmon-persillade",
  "biz-thai-basil-chicken",
  "biz-thai-basil-salmon",
  "biz-greek-lemon-chicken",
  "biz-zucchini-fennel-salad",
  "biz-celery-apple-salad",
  "biz-cucumber-pomegranate-salad",
  "biz-beet-orange-salad",
  "biz-peach-cheddar-board",
  "biz-cabbage-cauliflower-stirfry",
  "biz-ribeye-herb-butter",
  "biz-carne-asada-corn",
  "biz-turnips-persillade",
  "biz-sweet-potato-hash",
  "biz-mango-pineapple-cup",
  "biz-kiwi-watermelon-plate",
  "biz-strawberry-grape-cup",
];
const DAY = 7; // no supplier event: carrot is $0.80 in the Market
const blockedSave = (credits) =>
  seedSave({
    version: 2,
    credits,
    // Its reached milestones (First dish served, First Business day — it is on Day 7) were already
    // paid — so loading adds nothing.
    economyLedger: [
      {
        id: "seed-first-business-day",
        timestamp: 0,
        category: "milestone-reward",
        amount: 30000,
        description: "first-business-day",
      },
      {
        id: "seed-first-dish",
        timestamp: 0,
        category: "milestone-reward",
        amount: 10000,
        description: "first-dish",
      },
    ],
    business: {
      calendar: { businessDay: DAY },
      inventory: {
        tomato: { ingredientId: "tomato", quantity: 3, unitCost: 100, purchaseDay: DAY },
        cucumber: { ingredientId: "cucumber", quantity: 3, unitCost: 100, purchaseDay: DAY },
      },
      menuActivation: { inactiveDishIds: OFF_MENU },
    },
  });

const { browser, page, logs } = await launch();

/** Business → Service → Open the Counter: a salad customer arrives, blocked on carrot. */
async function openBlockedOrder() {
  await clickButton(page, /Business$/);
  await sleep(600);
  await clickButton(page, /Open Restaurant →|Go to Service →/);
  await sleep(600);
  await clickButton(page, /Open the Counter/);
  await sleep(800);
}
async function operationsTab() {
  await clickButton(page, /Business$/);
  await sleep(500);
  await clickButton(page, /Operations/);
  await sleep(600);
}
const inventoryCount = (s) => s.economyLedger.filter((e) => e.category === "inventory-purchase");

// ---------- 1 + 2: cash ----------
await boot(page, blockedSave(50000));
await openBlockedOrder();
let t = await flat(page);
check(
  "1a Service shows the missing carrot",
  /Missing:.*Carrot/i.test(t),
  t.match(/Missing:[^.]*/)?.[0],
);
check("1b Service offers Rush Restock with its price", /Rush Restock · \$1\.00/.test(t));
check("1c no ad button on the local mock platform (rewarded ads unsupported)", !/Watch Ad/.test(t));
check("1d Go to Market stays available", /Go to Market/.test(t));
check("1e the fee is explained", /Market price \$0\.80 \+ 25% rush fee/.test(t));
await shot(page, "rush-1-service-blocked");

await operationsTab();
t = await flat(page);
check(
  "1f Operations 'Current Order Blocked' card carries the same Rush Restock button",
  /Current Order Blocked/.test(t) && /Rush Restock · \$1\.00/.test(t),
);
await shot(page, "rush-2-operations-blocked");

const before = await readSave(page);
await clickButton(page, /Rush Restock · /);
await sleep(700);
const after = await readSave(page);
t = await flat(page);
check("2a cash: $1.00 charged (carrot $0.80 + 25%)", before.credits - after.credits === 100, {
  before: before.credits,
  after: after.credits,
});
check(
  "2b carrot stocked (1 unit at the rush price)",
  after.business.inventory.carrot?.quantity === 1 &&
    after.business.inventory.carrot?.unitCost === 100,
  after.business.inventory.carrot,
);
const newEntries = inventoryCount(after).slice(inventoryCount(before).length);
check(
  "2c exactly one inventory-purchase ledger entry, −$1.00 for carrot",
  newEntries.length === 1 &&
    newEntries[0].amount === -100 &&
    newEntries[0].description === "carrot",
  newEntries,
);
check("2d the blocked-order card is gone", !/Current Order Blocked/.test(t));
await clickButton(page, /Go to Service →/);
await sleep(600);
t = await flat(page);
check(
  "2e Service: the order can now be prepared",
  /Everything's in stock/.test(t) && /Start Preparing/.test(t),
);
await shot(page, "rush-3-service-unblocked");

// Not enough cash: the button is disabled and says why.
await boot(page, blockedSave(99));
await openBlockedOrder();
t = await flat(page);
check(
  "2f with $0.99, Rush Restock ($1.00) explains the shortfall",
  /Rush Restock costs \$1\.00 — you have \$0\.99/.test(t),
);
const poorBefore = await readSave(page);
await clickButton(page, /Rush Restock · /);
await sleep(400);
check(
  "2g … and pressing it changes nothing",
  JSON.stringify(await readSave(page)) === JSON.stringify(poorBefore),
);

// ---------- 3: rewarded ad (stubbed platform) ----------
// The Bridge's advertisement object keeps the first function assigned to it,
// so the fake ad is installed once and its outcome switched via a variable.
async function stubRewarded(outcome) {
  await page.evaluate((outcome) => {
    window.__rushAdOutcome = outcome;
    const adv = window.bridge.advertisement;
    if (adv.__rushStubbed) return;
    adv.__rushStubbed = true;
    let handler = null;
    Object.defineProperty(adv, "isRewardedSupported", { get: () => true, configurable: true });
    adv.on = (_event, cb) => (handler = cb);
    adv.off = () => (handler = null);
    adv.showRewarded = () => {
      const seq =
        window.__rushAdOutcome === "rewarded"
          ? ["opened", "rewarded", "closed"]
          : ["opened", "closed"];
      seq.forEach((s, i) => setTimeout(() => handler && handler(s), 80 * (i + 1)));
    };
  }, outcome);
}
await boot(page, blockedSave(50000));
await stubRewarded("closed");
await openBlockedOrder();
t = await flat(page);
check(
  "3a with rewarded ads supported, 🎬 Watch Ad · Restock Free appears",
  /Watch Ad · Restock Free/.test(t),
);
const adBefore = await readSave(page);
await clickButton(page, /Watch Ad/);
await sleep(900);
t = await flat(page);
check(
  "3b a declined ad restocks nothing and says so",
  JSON.stringify(await readSave(page)) === JSON.stringify(adBefore) && /didn't finish/.test(t),
);
await stubRewarded("rewarded");
await clickButton(page, /Watch Ad/);
await sleep(900);
const adAfter = await readSave(page);
t = await flat(page);
check(
  "3c a finished ad restocks the carrot free",
  adAfter.business.inventory.carrot?.quantity === 1 &&
    adAfter.business.inventory.carrot?.unitCost === 0 &&
    adAfter.credits === adBefore.credits,
);
check(
  "3d no ledger entry for the free restock",
  adAfter.economyLedger.length === adBefore.economyLedger.length,
);
check("3e the order unblocks", /Everything's in stock/.test(t));
await shot(page, "rush-4-after-ad");

// ---------- Go to Market → the Market's Ingredients tab (buying lives there) ----------
await boot(page, blockedSave(50000));
await openBlockedOrder();
await clickButton(page, /^Go to Market →$/);
await sleep(700);
check(
  "9a Go to Market → opens Market → Fresh Ingredients with all 57 cards",
  /Fresh Ingredients/.test(await flat(page)) &&
    (await page.evaluate(() => document.querySelectorAll("article.product-card").length)) === 57,
);

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("rushrestock-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nRUSH RESTOCK E2E: ALL PASS" : `\nRUSH RESTOCK E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
