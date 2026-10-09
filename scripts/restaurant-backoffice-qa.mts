/**
 * RESTAURANT BACK OFFICE QA — Unified Restaurant phase 7: one Staff, one
 * Suppliers and one Equipment screen over the data sets that already exist
 * (docs/RESTAURANT_INTEGRATION_AUDIT.md §17 conflict 4), restaurant build.
 *
 *  S. Suppliers: the ingredient supplier (SaveData.selectedSupplierId) is
 *     chosen on Restaurant → Suppliers next to the contracts; each card shows
 *     the Market's own price with that supplier; choosing is free (no money,
 *     no ledger) and changes what the Market charges; the Market shows the
 *     current supplier and links to the Suppliers tab instead of a tab of
 *     its own.
 *  E. Equipment: restaurant development (the kitchen tiers) is shown next to
 *     the fridge — current tier, built x/5, the next tier with its price and
 *     level — read-only, built on the Kitchen Upgrade screen.
 *  T. Staff was already one screen: waged roles, kitchen helpers and the
 *     specialist chefs on Restaurant → Staff; none in the Market.
 *  W. Wiring and the release build: everything above only under
 *     RESTAURANT_MODE; the release Market keeps its Campaign Supplier tab;
 *     the view module never reads the switch.
 *
 * Run: npx tsx scripts/restaurant-backoffice-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  SUPPLIER_EXAMPLE_INGREDIENT,
  restaurantDevelopment,
  supplierChoices,
  supplierPriceNote,
} from "../src/game/restaurant/restaurantBackOffice.ts";
import { restaurantQuote } from "../src/game/restaurant/restaurantEconomy.ts";
import { selectSupplier } from "../src/game/economy/SupplierManager.ts";
import { purchaseQuote } from "../src/game/business/BusinessInventoryManager.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "");

function saveAt(n: number): SaveData {
  return {
    ...structuredClone(DEFAULT_SAVE),
    credits: 500_000,
    levelProgress: {
      ...structuredClone(DEFAULT_SAVE.levelProgress),
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  };
}

console.log("S. One Suppliers screen");
{
  const base = saveAt(30);
  const choices = supplierChoices(base);
  const local = restaurantQuote(base, SUPPLIER_EXAMPLE_INGREDIENT, 1).unitCost;
  assert(
    choices.length === 3 &&
      choices.filter((c) => c.current).length === 1 &&
      choices.find((c) => c.current)!.id === "local-market" &&
      choices.find((c) => c.id === "local-market")!.exampleUnitCost === local,
    `S1: three suppliers, Local Market current on a new save; tomato ${local}¢ a unit`,
  );
  const picked = selectSupplier(base, "wholesale-supplier");
  const after = picked.ok ? picked.save : base;
  const wholesale = choices.find((c) => c.id === "wholesale-supplier")!;
  assert(
    picked.ok &&
      after.credits === base.credits &&
      after.economyLedger.length === base.economyLedger.length &&
      supplierChoices(after).find((c) => c.current)!.id === "wholesale-supplier" &&
      restaurantQuote(after, SUPPLIER_EXAMPLE_INGREDIENT, 1).unitCost ===
        wholesale.exampleUnitCost &&
      wholesale.exampleUnitCost === Math.round(local * 0.9),
    `S2: choosing Wholesale is free (no money, no ledger) and the Market then charges what its card showed (${wholesale.exampleUnitCost}¢)`,
  );
  assert(
    supplierPriceNote(base) === "" &&
      supplierPriceNote(after) === " · −10% on ingredients" &&
      supplierPriceNote({ ...base, selectedSupplierId: "premium-supplier" }) ===
        " · +10% on ingredients",
    "S3: the Market's supplier line names the price effect",
  );
  assert(
    purchaseQuote(after, SUPPLIER_EXAMPLE_INGREDIENT, 1).unitCost ===
      purchaseQuote(base, SUPPLIER_EXAMPLE_INGREDIENT, 1).unitCost,
    "S4: the classic (release) Market quote ignores the supplier, as before",
  );
}

console.log("E. Equipment: restaurant development");
{
  const fresh = restaurantDevelopment(saveAt(5));
  const growing = KITCHEN_UPGRADE_CATALOG[1]!;
  assert(
    fresh.currentName === KITCHEN_UPGRADE_CATALOG[0]!.name &&
      fresh.built === 0 &&
      fresh.total === KITCHEN_UPGRADE_CATALOG.length - 1 &&
      fresh.next?.name === growing.name &&
      fresh.next.price === growing.price &&
      fresh.next.unlockLevel === growing.unlockLevel &&
      fresh.next.state === "locked",
    `E1: a new restaurant: ${fresh.currentName}, 0/${fresh.total} built, next ${growing.name} at Level ${growing.unlockLevel}`,
  );
  assert(
    restaurantDevelopment(saveAt(growing.unlockLevel)).next?.state === "available",
    "E2: at its level the next tier is ready to build",
  );
  const all = KITCHEN_UPGRADE_CATALOG.map((u) => u.id);
  const done = restaurantDevelopment({
    ...saveAt(250),
    ownedKitchenUpgradeIds: all,
    equippedKitchenUpgradeId: all[all.length - 1]!,
  });
  assert(
    done.next === null &&
      done.built === done.total &&
      done.currentName === KITCHEN_UPGRADE_CATALOG[all.length - 1]!.name,
    `E3: every tier built: fully developed (${done.currentName})`,
  );
  const card = code("src/components/kc/restaurant/RestaurantDevelopmentCard.tsx");
  assert(
    /go\("kitchen-upgrades"\)/.test(card) &&
      !/purchaseKitchenUpgrade|buildKitchenUpgrade/.test(card),
    "E4: the card is read-only and links to the Kitchen Upgrade screen",
  );
}

console.log("T. Staff is one screen");
{
  const staff = code("src/components/kc/business/BusinessStaff.tsx");
  // Raw: Shop.tsx has an import.meta.glob("…/**/*…") path a comment stripper would misread.
  const shop = read("src/components/kc/Shop.tsx");
  assert(
    /KitchenHelpers/.test(staff) && /SpecialistChefs/.test(staff) && !/id: "staff"/.test(shop),
    "T1: waged team, kitchen helpers and specialist chefs on Restaurant → Staff; no Staff tab in the Market",
  );
}

{
  const staff = read("src/components/kc/business/BusinessStaff.tsx");
  assert(
    /const restaurantTeams = RESTAURANT_MODE;/.test(staff) &&
      /id="kitchen-team"/.test(staff) &&
      /id="restaurant-team"/.test(staff) &&
      staff.indexOf('id="kitchen-team"') < staff.indexOf("<KitchenHelpers") &&
      staff.indexOf("<KitchenHelpers") < staff.indexOf('id="restaurant-team"') &&
      /restaurantTeams \? \(\s*<SpecialistChefs[\s\S]*?\) : \(\s*<KitchenHelpers/.test(staff),
    "T2: restaurant build — one Staff screen in two teams: Kitchen Team (one-time helpers) then Restaurant Team (waged roles + specialist chefs); the release keeps its layout",
  );
}

console.log("W. Wiring and the release build");
{
  // Raw: Shop.tsx has an import.meta.glob("…/**/*…") path a comment stripper would misread.
  const shop = read("src/components/kc/Shop.tsx");
  const suppliers = code("src/components/kc/business/BusinessSuppliers.tsx");
  const fridge = code("src/components/kc/business/BusinessRefrigerator.tsx");
  const market = code("src/components/kc/MarketIngredients.tsx");
  const router = code("src/ScreensRouter.tsx");
  const dash = code("src/components/kc/business/BusinessDashboard.tsx");
  assert(
    /RESTAURANT_MODE\s*\?\s*categories\.filter\(\(c\) => c\.id !== "suppliers"\)\s*:\s*categories/.test(
      shop,
    ) &&
      /\{ id: "suppliers", label: "Campaign Supplier"/.test(shop) &&
      // First levels (2026-10-09): before Level 10 only knives and boards show.
      /const visibleCategories = browseOnly\s*\?\s*shopCategories\.filter[\s\S]{0,120}: shopCategories;/.test(
        shop,
      ) &&
      /visibleCategories\.map/.test(shop),
    "W1: the Market hides its supplier tab only in the restaurant build (the release keeps Campaign Supplier)",
  );
  assert(
    /RESTAURANT_MODE && selectSupplier \?/.test(suppliers) &&
      /selectSupplier=\{selectSupplier\}/.test(dash) &&
      (router.match(/selectSupplier=\{selectSupplier\}/g) ?? []).length === 2,
    "W2: Restaurant → Suppliers gets App's own selectSupplier and shows the ingredient supplier only in the restaurant build",
  );
  assert(
    /RESTAURANT_MODE \? <RestaurantDevelopmentCard/.test(fridge),
    "W3: Equipment shows restaurant development only in the restaurant build",
  );
  assert(
    /RESTAURANT_MODE \? \{ onChangeSupplier: \(\) => go\("business-suppliers"\) \} : \{\}/.test(
      shop,
    ) && /data-testid="market-supplier"/.test(market),
    "W4: the Market's Ingredients names the supplier and links to Restaurant → Suppliers (restaurant build)",
  );
  assert(
    /title=\{RESTAURANT_MODE \? "Restaurant" : "Business"\}/.test(dash),
    "W6: the back office is titled Restaurant in the restaurant build (Business in the release)",
  );
  const mod = code("src/game/restaurant/restaurantBackOffice.ts");
  assert(!/RESTAURANT_MODE|Math\.random/.test(mod), "W5: the view module never reads the switch");
}

console.log(
  failures
    ? `RESTAURANT BACK OFFICE QA: ${failures} FAILURE(S)`
    : "RESTAURANT BACK OFFICE QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
