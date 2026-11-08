/**
 * ASSET MAPPING QA (developer 2026-11-06: "the cashier doesn't use the generated avatar... find out if there are any more issues like it,
 * assets not properly used and not mapping to their direct source"). Guards the rule "a thing that has painted art shows that art, from ONE
 * place, and a button that is about one thing opens THAT thing":
 *   A  every id has its picture: ingredients, supplies, stockroom goods, spoiled twins; every staff role, specialist chef and floor role has a portrait
 *   B  ONE role -> portrait map (staffPortraits.ts): no private copies in the screens
 *   C  the missing-staff attention row names WHO to hire (role or specialist id)
 *   D  every screen that lists attention rows opens them through ONE helper that sends staff to THEIR card
 *   E  the screens that show a hireable person use the portrait component, not an emoji
 *   F  a guide step that sends the player to hire someone names the role, and App opens that card
 *   G  the ingredient-naming alerts carry the ingredients for the screen to draw
 *   H  the cleaners (developer 2026-11-07, "add the cleaner's assets"): the second Floor Cleaner and the Cleaner for today are the two
 *      male portraits, one mapping, every screen reads it; Paige's staff portrait exists
 * Prints a line per check and exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { INGREDIENTS } from "../src/game/definitions.ts";
import { SUPPLY_CATALOG } from "../src/game/business/businessSupplies.ts";
import { BUSINESS_STAFF_CATALOG } from "../src/game/business/businessStaff.ts";
import { SPECIALIST_CHEFS } from "../src/game/restaurant/staffRequirements.ts";
import {
  DAY_CLEANER_PORTRAIT,
  floorStaffPortraitFile,
  staffPortraitFile,
} from "../src/components/kc/business/staffPortraits.ts";
import { FLOOR_STAFF } from "../src/game/restaurant/secondFloor.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const has = (f: string) => fs.existsSync(path.join(ROOT, f));
const files = (d: string) =>
  has(d) ? fs.readdirSync(path.join(ROOT, d)).map((f) => f.replace(/\.webp$/, "")) : [];

console.log("A. Every id has its picture");
{
  const ing = files("public/business/ingredients");
  const miss = Object.keys(INGREDIENTS).filter((i) => !ing.includes(i));
  assert(miss.length === 0, "A1: every ingredient has a picture", miss);
  const spoiled = files("public/business/ingredients-spoiled");
  const miss2 = Object.keys(INGREDIENTS).filter((i) => i !== "chicken" && !spoiled.includes(i));
  assert(miss2.length === 0, "A2: every ingredient (but the chicken) has a spoiled twin", miss2);
  const sup = files("public/business/supplies");
  const goods = files("public/business/stockroom/goods");
  assert(
    SUPPLY_CATALOG.every((s) => sup.includes(s.id)) &&
      SUPPLY_CATALOG.every((s) => goods.includes(s.id)),
    "A3: every supply has its picture and its Stockroom good",
  );
  const portraits = files("public/business/staff-portraits");
  const roles = Object.keys(BUSINESS_STAFF_CATALOG);
  const noPortrait = roles.filter(
    (r) => !staffPortraitFile(r) || !portraits.includes(staffPortraitFile(r)!),
  );
  assert(noPortrait.length === 0, "A4: every staff role has a portrait file", noPortrait);
  const chefs = SPECIALIST_CHEFS.map((c) => c.id);
  const noChef = chefs.filter(
    (c) => !staffPortraitFile(c) || !portraits.includes(staffPortraitFile(c)!),
  );
  assert(
    chefs.length >= 4 && noChef.length === 0,
    "A5: every specialist chef has a portrait file",
    {
      chefs,
      noChef,
    },
  );
  assert(
    portraits.includes("floor-server") &&
      portraits.includes("floor-cleaner") &&
      Object.keys(FLOOR_STAFF).length === 2,
    "A6: the two Second Floor roles have their portraits",
  );
}

console.log("B. One role -> portrait map");
{
  const staff = read("src/components/kc/business/BusinessStaff.tsx");
  assert(!/ROLE_PORTRAIT|ROLE_ICON/.test(staff), "B1: the Staff screen keeps no private role map");
  assert(
    /staffPortraitFile\(def\.role\)/.test(staff),
    "B2: the Staff roster reads staffPortraits.ts",
  );
  assert(
    staffPortraitFile("cleaner") === "floor-cleaner" && staffPortraitFile("cashier") === "cashier",
    "B3: cleaner = the broom-and-dustpan portrait, cashier = the cashier",
  );
}

console.log("C. The staff attention row says WHO");
{
  const src = read("src/game/restaurant/restaurantAttention.ts");
  assert(
    /to: "staff";\s*id: string;\s*specialist: boolean/.test(src) &&
      /to: "staff", id: r\.id/.test(src),
    "C1: the row's action carries the role or chef id",
  );
}

console.log("D. One helper opens every attention row");
{
  const helper = read("src/components/kc/attentionActions.ts");
  assert(
    /openStaffFor\(go, \[t\.id\]\)/.test(helper),
    "D1: a missing person opens THEIR Staff card",
  );
  const panel = read("src/components/kc/inventory/RestaurantAttentionPanel.tsx");
  const daily = read("src/components/kc/DailyMaintenance.tsx");
  assert(
    /openAttentionRow\(row, go\)/.test(panel) && !/go\("business-staff"\)/.test(panel),
    "D2: the Inventory panel uses it (no plain go to Staff)",
  );
  assert(
    /openAttentionRow\(row, go\)/.test(daily) && /openStaffFor\(go, \[person\.id\]\)/.test(daily),
    "D3: Daily Maintenance uses it, and its Hire buttons open the person's card",
  );
}

console.log("E. People are shown as people");
{
  const need = (f: string, re: RegExp, msg: string) => assert(re.test(read(f)), msg);
  need(
    "src/components/kc/inventory/RestaurantAttentionPanel.tsx",
    /StaffPortrait/,
    "E1: the attention tile shows the portrait",
  );
  need(
    "src/components/kc/restaurant/TeamHireCard.tsx",
    /StaffPortrait[\s\S]*staffPortraitFile\(o\.role\)/,
    "E2: the Market's Hire your team card shows the portraits",
  );
  need(
    "src/components/kc/restaurant/PreServiceCheck.tsx",
    /staffPortraitFile\(r\.id\)/,
    "E3: the Pre-Service Check's staff rows show portraits",
  );
  need(
    "src/components/kc/restaurant/GuideCard.tsx",
    /staffPortraitFile\(step\.focus\)/,
    "E4: a hire step on the guide card shows the person",
  );
  need(
    "src/components/kc/DailyMaintenance.tsx",
    /staffPortraitFile\(person\.id\)/,
    "E5: Daily Maintenance's required team shows portraits",
  );
  // Moved with the full-screen sink (developer 2026-11-09): the strip and the list sheet draw the supply pictures (wash/SinkQueue.tsx).
  need(
    "src/components/kc/restaurant/wash/SinkQueue.tsx",
    /<SupplyIcon\s+id=\{view\.id as never\}|<SupplyIcon id=\{v\.id as never\}/,
    "E6: the wash-up strip draws the supply pictures",
  );
}

console.log("F. Guide steps that send the player to hire someone");
{
  const guide = read("src/game/restaurant/restaurantGuide.ts");
  assert(
    /focus\?: string/.test(guide) &&
      /focus: "prep-cook"/.test(guide) &&
      /focus: rule\.role/.test(guide),
    "F1: the Prep Cook and role steps name who",
  );
  assert(
    /openStaffFor\(go, \[guideStep\.focus\]\)/.test(read("src/App.tsx")),
    "F2: App opens that card from the guide",
  );
  assert(
    /supply: \[\.\.\.missing\]\[0\]!/.test(guide) &&
      /openMarketSupplies\([\s\S]*guideStep\.supply/.test(read("src/App.tsx")),
    "F3: the out-of-cleaning-supplies step opens the Market on the first missing supply",
  );
}

console.log("G. Alerts that name ingredients");
{
  const alerts = read("src/game/business/businessAlerts.ts");
  assert(
    (alerts.match(/glanceParts:/g) ?? []).length >= 3,
    "G1: spoil tonight, near expiry and order blocked all carry their ingredients",
  );
  assert(
    /glanceParts \?/.test(read("src/components/kc/business/BusinessDashboard.tsx")),
    "G2: the Overview draws their pictures",
  );
}

console.log("H. The cleaners and Paige");
{
  const portraits = files("public/business/staff-portraits");
  assert(
    portraits.includes("floor-cleaner-male") &&
      portraits.includes("cleaner-today") &&
      portraits.includes("assistant"),
    "H1: the male Floor Cleaner, the Cleaner for today and Paige have their portrait files",
    portraits,
  );
  assert(
    floorStaffPortraitFile("cleaner", 0) === "floor-cleaner" &&
      floorStaffPortraitFile("cleaner", 1) === "floor-cleaner-male" &&
      floorStaffPortraitFile("server", 0) === "floor-server" &&
      floorStaffPortraitFile("server", 1) === "floor-server" &&
      DAY_CLEANER_PORTRAIT === "cleaner-today",
    "H2: first Floor Cleaner = the woman (broom), second = the man (broom and dustpan), the Floor Server has one portrait, the day Cleaner is the man with the mop",
  );
  assert(
    FLOOR_STAFF.cleaner.max <= 2,
    "H3: the Second Floor hires at most 2 Floor Cleaners, so the two portraits cover every hire (a bigger team needs another portrait)",
    FLOOR_STAFF.cleaner.max,
  );
  const face = read("src/components/kc/common/FloorStaffFace.tsx");
  assert(
    /floorStaffPortraitFile\(role, index\)/.test(face) && !/floor-\$\{role\}\.webp/.test(face),
    "H4: the Floor Staff face reads the one mapping (no private file name)",
  );
  assert(
    /index=\{Math\.min\(have, def\.max - 1\)\}/.test(
      read("src/components/kc/MarketSecondFloor.tsx"),
    ),
    "H5: the Market's Floor team card shows the NEXT person to hire (the second Floor Cleaner is the man)",
  );
  const view = read("src/components/kc/restaurantMap/SecondFloorView.tsx");
  assert(
    /role === "cleaner"\s*\?\s*Math\.min\(def\.max, Math\.max\(1, have\)\)/.test(view) &&
      /index=\{i\}/.test(view),
    "H6: the Second Floor screen shows one face per hired Floor Cleaner",
  );
  const clean = read("src/components/kc/business/BusinessCleanliness.tsx");
  assert(
    /today \? DAY_CLEANER_PORTRAIT : "floor-cleaner"/.test(clean) &&
      /<CleanerFace className="h-7 w-7" today \/>/.test(clean) &&
      /<CleanerFace className="h-7 w-7" today=\{!!today\} \/>/.test(clean),
    "H7: 'A Cleaner for today' (the offer and the one on duty) is the man with the mop; the team's Cleaner stays the woman",
  );
}

if (failures) {
  console.log(`\n${failures} FAILED`);
  process.exit(1);
}
console.log("\nALL PASS");
