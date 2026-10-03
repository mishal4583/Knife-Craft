// Screenshots of the three fridge models (visual check against the design references).
import { launch, boot, seedSave, sleep, clickButton, shot } from "./harness.mjs";
const DAY = 7;
const e = (id, q, d = DAY, c = 100) => [
  id,
  { ingredientId: id, quantity: q, unitCost: c, purchaseDay: d },
];
const STOCK = Object.fromEntries([
  e("cheddar", 2),
  e("mozzarella", 1),
  e("tofu", 1),
  e("tomato", 3),
  e("carrot", 2),
  e("cucumber", 1),
  e("onion", 2),
  e("potato", 2),
  e("pepper", 3),
  e("mushroom", 3),
  e("chicken", 2, DAY - 2),
  e("salmon", 2),
  e("steak", 1),
  e("bread", 2),
  e("apple", 4),
  e("lemon", 3),
  e("lettuce", 2),
  e("basil", 1, DAY - 1),
  e("spinach", 2),
  e("butter", 2),
  e("garlic", 4),
  e("ginger", 2),
  e("chilli", 3),
]);
const { browser, page } = await launch();
const [w, h] = (process.env.SIZE ?? "375x642").split("x").map(Number);
await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, hasTouch: true });
for (const id of ["basic", "commercial", "professional"]) {
  await boot(
    page,
    seedSave({
      version: 2,
      credits: 100_000,
      business: {
        calendar: { businessDay: DAY },
        inventory: STOCK,
        refrigerator: { refrigeratorId: `${id}-refrigerator` },
      },
    }),
  );
  await clickButton(page, /Inventory$/);
  await sleep(900);
  await page.evaluate(() =>
    document.querySelector('[data-testid="physical-fridge"]').scrollIntoView({ block: "start" }),
  );
  await sleep(500);
  await shot(page, `fridgeshot-${id}-${w}x${h}-a`);
  await page.evaluate(() =>
    document.querySelector('[data-testid="fridge-unit"]').scrollIntoView({ block: "start" }),
  );
  await sleep(300);
  await shot(page, `fridgeshot-${id}-${w}x${h}-b`);
  await page.evaluate(() =>
    document.querySelector('[data-testid="fridge-attention"]').scrollIntoView({ block: "end" }),
  );
  await sleep(300);
  await shot(page, `fridgeshot-${id}-${w}x${h}-c`);
}
await browser.close();
