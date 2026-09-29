// Business → Ingredients in the built game:
//   1. all 57 ingredients are listed — every one is used by a Business dish (Butter included, on
//      the Ribeye with Herb Butter); nothing is hidden or marked "No dish";
//   2. prices are per ingredient (potato $0.60, tomato $1.00, asparagus $2.60, salmon $6.50);
//   3. every card shows what the purchase does to the wallet: "$1,332 → $1,327" for 5 lb,
//      "You'll have $1,307 remaining" from 25 lb, and "Not enough money — need $X more." when short;
//   4. buying moves the wallet by exactly the card's total (one ledger entry);
//   5. the Butter dish (Ribeye with Herb Butter) cooks end to end: order → cut → Knife Report →
//      served, paid, and its butter taken from stock.
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
async function openIngredients() {
  await clickButton(page, /Business$/);
  await sleep(600);
  await clickButton(page, /Ingredients$/);
  await sleep(600);
}
/** Clicks a card's + button `n` times. */
async function plus(name, n) {
  for (let i = 0; i < n; i++) {
    await page.evaluate((name) => {
      document.querySelector(`[aria-label="Increase quantity for ${name}"]`)?.click();
    }, name);
    await sleep(60);
  }
}

// ---------- 1 + 2 + 3 ----------
await boot(page, businessSave(133_200)); // $1,332.00
await openIngredients();
let c = await cards();
const names = Object.keys(c);
check(
  "1a all 57 ingredients are listed (every one is on a Business menu), none hidden",
  names.length === 57 &&
    names.includes("Butter") &&
    names.includes("Ribeye Steak") &&
    !Object.values(c).some((t) => /No dish/.test(t)) &&
    !(await page.evaluate(() => /Show \d+ more ingredients/.test(document.body.innerText))),
  names.length,
);
check(
  "1b menu dishes use them: with the full menu on, Butter and Watermelon carry the Menu badge",
  /MENU|Menu/.test(c["Butter"]) && /MENU|Menu/.test(c["Watermelon"]),
  { butter: c["Butter"]?.slice(0, 60) },
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

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("ingredients-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nINGREDIENTS E2E: ALL PASS" : `\nINGREDIENTS E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
