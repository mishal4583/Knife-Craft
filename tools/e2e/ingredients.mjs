// Business → Ingredients in the built game:
//   1. only ingredients a Business dish uses are listed (37); "Show 20 more ingredients" reveals the
//      rest, each marked "No dish";
//   2. prices are per ingredient (potato $0.60, tomato $1.00, asparagus $2.60, salmon $6.50);
//   3. every card shows what the purchase does to the wallet: "$1,332 → $1,327" for 5 lb,
//      "You'll have $1,307 remaining" from 25 lb, and "Not enough money — need $X more." when short;
//   4. buying moves the wallet by exactly the card's total (one ledger entry).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot, save } from "./harness.mjs";

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
  "1a only the 37 ingredients a Business dish uses are listed",
  names.length === 37 && !names.includes("Ribeye Steak") && !names.includes("Watermelon"),
  names.length,
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

// ---------- 1b: the hidden ones ----------
await clickButton(page, /^Show 20 more ingredients/);
await sleep(500);
c = await cards();
check(
  "1b 'Show 20 more ingredients' reveals the rest, each marked 'No dish'",
  Object.keys(c).length === 57 && /No dish/.test(c["Ribeye Steak"]) && !/No dish/.test(c["Tomato"]),
  Object.keys(c).length,
);
await shot(page, "ingredients-2-all");

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

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("ingredients-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nINGREDIENTS E2E: ALL PASS" : `\nINGREDIENTS E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
