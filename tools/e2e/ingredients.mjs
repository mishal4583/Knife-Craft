// Ingredients in the built game — Market buys, Business monitors:
//   0. Business → Inventory has no purchase controls (empty state: "Go to Market →");
//   1. Market → Ingredients lists all 57 ingredients (nothing hidden, no "No dish"); Business →
//      Inventory's "Go to Market →" opens it;
//   2. prices are per ingredient (potato $0.60, tomato $1.00, asparagus $2.60, salmon $6.50);
//   3. every card shows what the purchase does to the wallet: "$1,332 → $1,327" for 5 lb,
//      "You'll have $1,307 remaining" from 25 lb, and "Not enough money — need $X more." when short;
//   4. buying moves the wallet by exactly the card's total (one ledger entry), and Business →
//      Inventory shows the stock straight away; a "Most needed" chip deep-links to its card;
//   4f. a full fridge: "Not enough fridge space. You have N units of fridge space left.";
//   5. the Butter dish (Ribeye with Herb Butter) cooks end to end: order → cut → Knife Report →
//      served, paid, and its butter taken from stock; Most used then lists butter.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  save,
  text,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const DAY = 7; // no supplier event on day 7
const businessSave = (credits) =>
  seedSave({ version: 2, credits, business: { calendar: { businessDay: DAY } } });

const { browser, page, logs } = await launch();

/** Card texts by ingredient name. */
const cards = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("article.product-card")].map((a) => [
        a.querySelector("p")?.textContent?.trim(),
        a.textContent.replace(/\s+/g, " "),
      ]),
    ),
  );
async function openInventory() {
  await clickButton(page, /Business$/);
  await sleep(600);
  await clickButton(page, /Inventory$/);
  await sleep(600);
}
async function openIngredients() {
  await clickButton(page, /Market$/);
  await sleep(600);
  await clickButton(page, /Ingredients$/);
  await sleep(600);
}
const buyButtons = () =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("button")].filter((b) =>
        /^Buy \d|Increase quantity/.test(b.textContent.trim() + (b.getAttribute("aria-label") ?? "")),
      ).length,
  );
const flat = async () => (await text(page)).replace(/\s+/g, " ");
/** Clicks a card's + button `n` times. */
async function plus(name, n) {
  for (let i = 0; i < n; i++) {
    await page.evaluate((name) => {
      document.querySelector(`[aria-label="Increase quantity for ${name}"]`)?.click();
    }, name);
    await sleep(60);
  }
}

// ---------- 0 + 1: Business monitors, Market buys ----------
await boot(page, businessSave(133_200)); // $1,332.00
await openInventory();
let t = await flat();
check(
  "0a Business → Inventory: no buy controls, empty-fridge text and Go to Market",
  (await buyButtons()) === 0 &&
    /Track your stock, freshness and restaurant supply needs\./.test(t) &&
    /Your fridge is empty\. Buy ingredients from the Market/.test(t) &&
    /Go to Market →/.test(t) &&
    /Inventory analytics/i.test(t) &&
    /Purchasing/i.test(t) &&
    /Most used/i.test(t),
  t.slice(0, 300),
);
await shot(page, "ingredients-0-inventory-empty");
await clickButton(page, /^Go to Market →$/);
await sleep(700);
t = await flat();
check(
  "0b Go to Market → opens the Market on Fresh Ingredients",
  /Fresh Ingredients/.test(t) && (await page.evaluate(() => document.querySelectorAll("article.product-card").length)) === 57,
);
let c = await cards();
const names = Object.keys(c);
check(
  "1a all 57 ingredients are listed in Market → Ingredients, none hidden",
  names.length === 57 &&
    names.includes("Butter") &&
    names.includes("Ribeye Steak") &&
    !Object.values(c).some((t) => /No dish/.test(t)) &&
    !(await page.evaluate(() => /Show \d+ more ingredients/.test(document.body.innerText))),
  names.length,
);
check(
  "1b cards say how many menu dishes use them (Butter: 1 menu dish)",
  /1 menu dish\b/.test(c["Butter"]) && /menu dish/.test(c["Watermelon"]),
  { butter: c["Butter"]?.slice(0, 80) },
);
check(
  "2a prices are per ingredient",
  /\$0\.60\/lb/.test(c["Potato"]) &&
    /\$1\.00\/lb/.test(c["Tomato"]) &&
    /\$2\.60\/lb/.test(c["Asparagus"]) &&
    /\$6\.50\/lb/.test(c["Salmon Fillet"]),
  { potato: c["Potato"]?.slice(0, 40), salmon: c["Salmon Fillet"]?.slice(0, 40) },
);
check(
  "3a a 5 lb card shows the balance change: $1,332 → $1,327",
  /Buy 5 lb · \$5\.00/.test(c["Tomato"]) && /\$1,332 → \$1,327/.test(c["Tomato"]),
  c["Tomato"],
);
await plus("Tomato", 4); // 5 → 10 → 15 → 20 → 25
c = await cards();
check(
  "3b from 25 lb the card says what remains: You'll have $1,307 remaining",
  /Buy 25 lb · \$25\.00/.test(c["Tomato"]) && /You'll have \$1,307 remaining/.test(c["Tomato"]),
  c["Tomato"],
);
await shot(page, "ingredients-1-cards");

// ---------- 4: buy ----------
const before = await readSave(page);
await page.evaluate(() => {
  const card = [...document.querySelectorAll("article.product-card")].find(
    (a) => a.querySelector("p")?.textContent?.trim() === "Tomato",
  );
  [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()))?.click();
});
await sleep(600);
const after = await readSave(page);
const added = after.economyLedger.slice(before.economyLedger.length);
check(
  "4a buying moves the wallet by exactly the card total (one −$25.00 ledger entry)",
  before.credits - after.credits === 2_500 &&
    added.length === 1 &&
    added[0].category === "inventory-purchase" &&
    added[0].amount === -2_500,
  { before: before.credits, after: after.credits, added },
);
await openInventory();
t = await flat();
check(
  "4b Business → Inventory shows it at once: Tomato 25 lb · $25.00, fridge 25 / 40, purchasing $25.00",
  /Tomato 25 lb · \$25\.00/.test(t) && /25 \/ 40/.test(t) && /This Business Day \$25\.00 1 purchase/i.test(t),
  t.slice(0, 600),
);
await shot(page, "ingredients-4-inventory");
// Most needed → deep link to that ingredient's Market card.
const chip = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="most-needed"] button');
  b?.click();
  return b?.getAttribute("data-ingredient");
});
await sleep(800);
const focused = await page.evaluate(() => {
  const a = document.querySelector("article.product-card.ring-2");
  const r = a?.getBoundingClientRect();
  return a ? { id: a.getAttribute("data-ingredient"), visible: r.top >= 0 && r.bottom <= innerHeight } : null;
});
check(
  "4c a Most needed chip opens the Market on that ingredient's card, in view",
  !!chip && focused?.id === chip && focused.visible,
  { chip, focused },
);

// ---------- 3c: not enough money ----------
await boot(page, businessSave(300)); // $3.00
await openIngredients();
c = await cards();
check(
  "3c short of money the card says so before the tap: Not enough money — need $2.00 more.",
  /Not enough money — need \$2\.00 more\./.test(c["Tomato"]),
  c["Tomato"],
);
const poor = await readSave(page);
await page.evaluate(() => {
  const card = [...document.querySelectorAll("article.product-card")].find(
    (a) => a.querySelector("p")?.textContent?.trim() === "Tomato",
  );
  [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()))?.click();
});
await sleep(500);
check(
  "3d pressing Buy anyway changes nothing",
  JSON.stringify(await readSave(page)) === JSON.stringify(poor),
);
await shot(page, "ingredients-3-short");

// ---------- 4f: fridge full ----------
await boot(
  page,
  seedSave({
    version: 2,
    credits: 50_000,
    business: {
      calendar: { businessDay: DAY },
      inventory: { onion: { ingredientId: "onion", quantity: 38, unitCost: 100, purchaseDay: DAY } },
    },
  }),
);
await openIngredients();
c = await cards();
check(
  "4f fridge full: the card says so and how much space is left",
  /Not enough fridge space\. You have 2 units of fridge space left\./.test(c["Tomato"]),
  c["Tomato"],
);
const full = await readSave(page);
await page.evaluate(() => {
  const card = [...document.querySelectorAll("article.product-card")].find(
    (a) => a.querySelector("p")?.textContent?.trim() === "Tomato",
  );
  [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()))?.click();
});
await sleep(500);
check("4g pressing Buy anyway changes nothing", JSON.stringify(await readSave(page)) === JSON.stringify(full));

// ---------- 5: the Butter dish, cooked for real ----------
// Every Business dish id (businessDishCatalog.ts); all but the butter dish go off the menu.
const ALL_DISH_IDS = [
  "biz-garden-salad",
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
const stock = Object.fromEntries(
  ["steak", "butter", "parsley", "garlic"].map((id) => [
    id,
    { ingredientId: id, quantity: 5, unitCost: 100, purchaseDay: DAY },
  ]),
);
await boot(
  page,
  seedSave({
    version: 2,
    credits: 50_000,
    business: {
      calendar: { businessDay: DAY },
      inventory: stock,
      menuActivation: {
        inactiveDishIds: ALL_DISH_IDS.filter((id) => id !== "biz-ribeye-herb-butter"),
      },
    },
  }),
);
await clickButton(page, /Business$/);
await sleep(600);
await clickButton(page, /Open Restaurant →|Go to Service →/);
await sleep(600);
await clickButton(page, /Open the Counter/);
await sleep(800);
check(
  "5a a customer orders Ribeye with Herb Butter",
  /Ribeye with Herb Butter/.test(await text(page)),
);
await clickButton(page, /Start Preparing/);
await sleep(1500);
const cooked = await playToReport(page, { maxMs: 120000 });
check(
  "5b it is cut to the Knife Report (steak, butter, parsley, garlic)",
  cooked.ok,
  cooked.log.slice(-3),
);
await clickButton(page, /^Continue$/);
await sleep(900);
const beforeServe = await readSave(page);
await clickButton(page, /^Serve to /);
await sleep(900);
const served = await readSave(page);
const paid = served.economyLedger.slice(beforeServe.economyLedger.length);
check(
  "5c served: one business-revenue entry for the dish, butter taken from stock",
  paid.length === 1 &&
    paid[0].category === "business-revenue" &&
    paid[0].description === "biz-ribeye-herb-butter" &&
    paid[0].amount > 0 &&
    (served.business.inventory.butter?.quantity ?? 0) < 5,
  { paid, butter: served.business.inventory.butter?.quantity },
);

await clickButton(page, /^Back to Service$/);
await sleep(600);
await openInventory();
t = await flat();
check("5d Most used lists butter from the served order", /Most used.{0,200}Butter/i.test(t), t.match(/Most used.{0,200}/i)?.[0] ?? t.slice(0, 200));

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("ingredients-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nINGREDIENTS E2E: ALL PASS" : `\nINGREDIENTS E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
