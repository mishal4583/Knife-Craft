/**
 * PROGRESSION PREVIEW QA — kitchen progression after Kitchen Investments
 * were folded into the six kitchen backgrounds.
 *
 * Design (current): the six existing kitchen backgrounds ARE the kitchen
 * progression. The eight separate Kitchen Investment purchases (and their
 * chapter upkeep) are retired — not sold in the Shop, never charged,
 * never previewed. The retired catalog/manager modules stay on disk only
 * for the Economy V2 design/QA scripts that document the old system.
 *
 * Checks:
 *  A. Shop: no investment category, cards, buy action or prop.
 *  B. No investment purchase or upkeep can reach the wallet/ledger.
 *  C. Order Board "Next" timeline: kitchen backgrounds yes, investments
 *     never; only real catalog items at their own levels; no duplicates.
 *  D. Kitchen backgrounds: all six intact, levels unchanged, art present.
 *  E. Saves: no new field; an old save holding ownedKitchenInvestmentIds
 *     loads with coins/knives/Blacksmith/kitchen/level progress intact.
 *  F. Campaign/Business isolation.
 *  G. Economy V2 freeze.
 *  K. Kitchen upgrades are permanent: the kitchen follows the highest
 *     stage reached and can never be switched back.
 *  H. Order Board rows: a kitchen background unlocking right behind a
 *     level's own reward is shown as a second hint (Lv 40/70/90 only).
 *
 * Run: npx tsx scripts/progression-preview-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { dollars } from "../src/game/money.ts";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { getKitchenUpgradeState, migrateKitchenDevelopment, purchaseKitchenUpgrade, syncKitchenUpgradeOwnership } from "../src/game/kitchen/KitchenUpgradeManager.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { CAFE_MILESTONES } from "../src/game/cafe/cafeDefinitions.ts";
import { getNextKitchenStagePreview, getNextRewardPreview, getRewardTimeline, levelNumber } from "../src/game/levels/levelMastery.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";
import { CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf8");
/** Source with comments removed, so a retirement note never counts as live code. */
const code = (rel: string) =>
  read(rel)
    // only block comments that open a line — a "/*" inside a string (e.g. an import.meta.glob path) is code
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
function srcFiles(dir: string): string[] {
  return fs.readdirSync(path.resolve(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return srcFiles(rel);
    return /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
}
/** The eight retired Kitchen Investments — must never reappear anywhere the player can see. */
const INVESTMENT_NAMES = ["Prep Station Upgrade", "Storage Rack", "Service Counter", "Herb Garden", "Display Case", "Chef's Table", "Wine Cellar", "Grand Renovation"];

// ===== A: Shop =====
{
  const shop = code("src/components/kc/Shop.tsx");
  assert(!/"equipment"/.test(shop), "A: the Shop has no Equipment/investment category");
  assert(!/KitchenInvestment|kitchenInvestment|KITCHEN_INVESTMENT/.test(shop), "A2: the Shop no longer imports or renders Kitchen Investments");
  assert(!/buyKitchenInvestment/.test(shop) && !/buyKitchenInvestment/.test(code("src/ScreensRouter.tsx")) && !/buyKitchenInvestment/.test(code("src/App.tsx")), "A3: no buyKitchenInvestment action exists in App, router or Shop");
  const cats = [...read("src/components/kc/Shop.tsx").matchAll(/\{ id: "([a-z]+)", label: "([^"]+)"/g)].map((m) => m[1]);
  // Developer request: staff lives only in Business (Business → Staff → Kitchen helpers), so the
  // Market's "staff" category was removed on purpose; every other category is unchanged.
  assert(JSON.stringify(cats) === JSON.stringify(["knives", "boards", "suppliers", "ingredients", "blacksmith"]) && !cats.includes("staff"), `A4: remaining categories intact (Staff moved to Business): ${cats.join(", ")}`);
  assert(!/Benefit|Appears in your kitchen|Installed/.test(shop), "A5: no leftover investment wording (Benefit / Appears in your kitchen / Installed)");
}

// ===== B: no investment UPKEEP anywhere; kitchen development is bought at exactly one site =====
// Economy V2.5 (approved): kitchen tiers are paid Restaurant Development, recorded as
// "kitchen-investment-purchase" — only by App.tsx's buildKitchenUpgrade. Recurring upkeep stays banned.
{
  const ledgerDefs = new Set(["src/game/economy/EconomyLedger.ts", "src/game/economy/ledgerTypes.ts"]);
  const upkeep = srcFiles("src")
    .filter((f) => !ledgerDefs.has(f) && !f.startsWith("src/game/kitchen/"))
    .filter((f) => /"investment-upkeep"|chargeChapterUpkeep|buyKitchenInvestment/.test(code(f)));
  assert(upkeep.length === 0, `B: nothing in src writes investment upkeep (found: ${upkeep.join(", ") || "none"})`);
  // A WRITE is an appendLedgerEntry(…, "kitchen-investment-purchase", …) call; reading the category (Progress, migration) isn't one.
  const writes = (f: string) => code(f).match(/appendLedgerEntry\([^;]*?"kitchen-investment-purchase"/g) ?? [];
  const purchaseWriters = srcFiles("src")
    .filter((f) => !ledgerDefs.has(f))
    .filter((f) => writes(f).length > 0);
  const appSites = writes("src/App.tsx").length;
  assert(JSON.stringify(purchaseWriters) === JSON.stringify(["src/App.tsx"]) && appSites === 1, `B1: kitchen development is recorded at exactly one site, App.tsx (found: ${purchaseWriters.join(", ")}, ${appSites} site(s))`);
  const importers = srcFiles("src")
    .filter((f) => !f.startsWith("src/game/kitchen/kitchenInvestment") && !f.startsWith("src/game/kitchen/KitchenInvestment"))
    .filter((f) => /kitchen\/(KitchenInvestmentManager|kitchenInvestmentDefinitions|kitchenInvestmentTypes)/.test(code(f)));
  assert(importers.length === 0, `B2: no game module imports the retired investment modules (found: ${importers.join(", ") || "none"})`);
  const app = code("src/App.tsx");
  assert(!/upkeep/i.test(app), "B3: App.tsx has no chapter-upkeep path left");
  assert(/"completion-reward", rewardCoins/.test(app) && /setLevelRewardNotice\(\{ rewardCoins \}\)/.test(app), "B4: the completion reward + its banner are unchanged apart from dropping the upkeep line");
  const ledger = read("src/game/economy/EconomyLedger.ts");
  assert(/"investment-upkeep"/.test(ledger) && /"kitchen-investment-purchase"/.test(ledger), "B5: legacy ledger categories are still labelled, so old saves' history still displays");
}

// ===== C: Next-reward timeline =====
{
  const timeline = getRewardTimeline();
  const names = timeline.map((r) => r.name);
  assert(INVESTMENT_NAMES.every((n) => !names.includes(n)), "C: no retired investment name is on the timeline");
  const shown = new Set<string>();
  for (let lv = 0; lv <= 250; lv++) {
    const r = getNextRewardPreview(lv);
    if (r) shown.add(r.name);
  }
  assert(INVESTMENT_NAMES.every((n) => !shown.has(n)), "C2: no level's Order Board hint ever names a retired investment");
  const p40 = getNextRewardPreview(40);
  const p90 = getNextRewardPreview(90);
  assert(p40?.name === "Established Kitchen" && p40.atLevel === 41 && p40.icon === "🏠", `C3: after Lv 40 the hint is the "Established Kitchen" background (Lv 41)`);
  assert(p90?.name === "Grand Kitchen" && p90.atLevel === 91 && p90.icon === "🏠", `C4: after Lv 90 the hint is the "Grand Kitchen" background (Lv 91)`);
  for (const u of KITCHEN_UPGRADE_CATALOG.filter((u) => u.unlockLevel > 1)) {
    const cafeClash = CAFE_MILESTONES.some((m) => m.title === u.name && m.levelRequired < u.unlockLevel);
    const entry = timeline.find((r) => r.name === u.name);
    assert(
      cafeClash ? entry?.icon === "🏆" : entry?.atLevel === u.unlockLevel && entry.icon === "🏠",
      cafeClash
        ? `C5: "${u.name}" (Lv ${u.unlockLevel}) shares its name with an earlier café rank — shown once, not twice`
        : `C5: timeline has the "${u.name}" background at Lv ${u.unlockLevel}`,
    );
  }
  const keys = timeline.map((r) => `${r.atLevel}|${r.name}`);
  assert(new Set(names).size === names.length && new Set(keys).size === keys.length, "C6: no duplicate entries");
  const sources = [
    ...KNIFE_CATALOG.map((k) => `${k.unlockLevel}|${k.name}`),
    ...BOARD_CATALOG.map((b) => `${b.unlockLevel}|${b.name}`),
    ...CAFE_MILESTONES.map((m) => `${m.levelRequired}|${m.title}`),
    ...KITCHEN_UPGRADE_CATALOG.map((u) => `${u.unlockLevel}|${u.name}`),
    // Late game: each cuisine chapter's opening level (from the level data) and the Level 250 finale.
    ...getLevels()
      .filter((l, i, all) => i === 0 || all[i - 1]!.chapter !== l.chapter)
      .map((l) => `${levelNumber(l.id)}|Chapter ${l.chapter} · ${CHAPTER_TITLES[l.chapter]}`),
    `${getLevels().length}|Campaign Finale`,
  ];
  assert(keys.every((k) => sources.includes(k)), "C7: every entry is a real knife/board/café rank/kitchen background/cuisine chapter/campaign finale at its own level (nothing invented)");
  assert(timeline.every((r, i) => i === 0 || timeline[i - 1]!.atLevel <= r.atLevel), "C8: timeline is level-ordered");
  const last = timeline[timeline.length - 1]!;
  assert(last.name === "Campaign Finale" && last.atLevel === 250 && getNextRewardPreview(250) === null, `C9: the last real goal is "${last.name}" at Lv ${last.atLevel}; after the campaign nothing is invented`);
  const dead: number[] = [];
  for (let lv = 1; lv < 250; lv++) if (!getNextRewardPreview(lv)) dead.push(lv);
  assert(dead.length === 0, `C10: every level 1-249 shows a real next goal on the Order Board (no dead stretch after Lv 120)${dead.length ? " — none at " + dead.slice(0, 10).join(",") : ""}`);
  assert(timeline.filter((r) => r.atLevel > 120).every((r) => r.icon === "📖" || r.icon === "🏁"), "C11: after Lv 120 the goals are only real cuisine chapters and the finale — no invented rewards");
}

// ===== D: the six kitchen backgrounds =====
{
  assert(
    KITCHEN_UPGRADE_CATALOG.map((u) => `${u.name}@${u.unlockLevel}:${u.asset}`).join(", ") ===
      "Humble Kitchen@1:skin-01, Growing Kitchen@21:skin-02, Established Kitchen@41:skin-03, Neighborhood Café@51:skin-04, Flourishing Café@71:skin-05, Grand Kitchen@91:skin-06",
    "D: all six kitchen backgrounds intact — names, levels and art unchanged",
  );
  const bg = read("src/components/kc/KitchenBackground.tsx");
  for (const u of KITCHEN_UPGRADE_CATALOG) {
    assert(fs.existsSync(path.resolve(ROOT, `src/assets/kitchen/${u.asset}.webp`)) && bg.includes(`"${u.asset}":`), `D2: ${u.name}'s art (${u.asset}.webp) exists and is mapped`);
  }
  assert(/kitchenUpgradeOrDefault\(save\.equippedKitchenUpgradeId\)/.test(read("src/components/kc/Kitchen.tsx")), "D3: the Kitchen still renders the equipped background from the save");
}

// ===== E: saves =====
{
  assert(
    JSON.stringify(Object.keys(DEFAULT_SAVE)) ===
      JSON.stringify(["version", "credits", "equippedKnifeId", "equippedBoardId", "ownedKnifeIds", "ownedBoardIds", "ownedKitchenUpgradeIds", "equippedKitchenUpgradeId", "economy", "ownedKitchenInvestmentIds", "knifeSharpness", "knifeUpgrades", "ownedStaffIds", "selectedSupplierId", "economyLedger", "recipeProgress", "settings", "levelProgress", "story", "dailyOrder", "endless", "business"]),
    "E: SaveData fields unchanged (no new field; the legacy field is kept so old saves load)",
  );
  // A real pre-change save: owns investments, has paid upkeep, has progress everywhere.
  const legacy: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    credits: 12_345,
    ownedKnifeIds: ["chef", "santoku"],
    equippedKnifeId: "santoku",
    knifeUpgrades: { santoku: { sharpness: 3, speed: 2, handling: 1 } },
    ownedKitchenUpgradeIds: ["humble-kitchen", "growing-kitchen", "established-kitchen"],
    equippedKitchenUpgradeId: "established-kitchen",
    ownedKitchenInvestmentIds: ["prep-station-upgrade", "storage-rack"],
    ownedStaffIds: ["prep-assistant"],
    levelProgress: { ...DEFAULT_SAVE.levelProgress, highestUnlockedLevelId: "level-45", currentLevelId: "level-45" },
    economyLedger: [
      { id: "l1", timestamp: 1, category: "kitchen-investment-purchase", amount: -2000, description: "prep-station-upgrade" },
      { id: "l2", timestamp: 2, category: "investment-upkeep", amount: -40, description: "chapter-2" },
    ],
  };
  localStorage.setItem("knifecraft.save.v1", JSON.stringify(legacy));
  const loaded = await SaveManager.load();
  assert(
    loaded.credits === 12_345 &&
      JSON.stringify(loaded.ownedKnifeIds) === JSON.stringify(legacy.ownedKnifeIds) &&
      loaded.equippedKnifeId === "santoku" &&
      JSON.stringify(loaded.knifeUpgrades) === JSON.stringify(legacy.knifeUpgrades) &&
      JSON.stringify(loaded.ownedKitchenUpgradeIds) === JSON.stringify(legacy.ownedKitchenUpgradeIds) &&
      loaded.equippedKitchenUpgradeId === "established-kitchen" &&
      JSON.stringify(loaded.ownedStaffIds) === JSON.stringify(legacy.ownedStaffIds) &&
      loaded.levelProgress.highestUnlockedLevelId === "level-45",
    "E2: an old save with owned investments loads through the real SaveManager — coins, knives, Blacksmith, kitchen, staff and level progress intact",
  );
  assert(
    JSON.stringify(loaded.ownedKitchenInvestmentIds) === JSON.stringify(legacy.ownedKitchenInvestmentIds) &&
      loaded.economyLedger.length === 2,
    "E3: the legacy investment ids and past ledger history are kept as-is (not reset, not refunded, not re-charged)",
  );
}

// ===== F: isolation =====
{
  const mastery = code("src/game/levels/levelMastery.ts");
  assert(!/business/i.test(mastery), "F: the reward timeline never reads Business Mode");
  const businessFiles = srcFiles("src/game/business").concat(srcFiles("src/components/kc/business"));
  assert(businessFiles.every((f) => !/kitchenInvestment|KitchenInvestment|levelMastery/.test(code(f))), "F2: Business Mode doesn't depend on kitchen investments or the Campaign reward timeline");
}

// ===== H: Order Board rows — kitchen backgrounds surfaced behind a level's own reward =====
{
  const board = read("src/components/kc/Kitchen.tsx");
  assert(/const nextReward = ownReward \?\? getNextRewardPreview\(levelNumber\(level\.id\)\);/.test(board), "H0: each row's main hint is still chosen exactly as before (own reward, else next on the timeline)");
  assert(/const stageAfter = ownReward\s*\?\s*getNextKitchenStagePreview\(levelNumber\(level\.id\)\)\s*:\s*null;/.test(board), "H0b: the only addition is a second hint on own-reward rows, from getNextKitchenStagePreview");
  // Rebuild every row's hints the way Kitchen.tsx renders them.
  const rows = getLevels().map((l) => {
    const n = levelNumber(l.id);
    const main = l.unlockReward ? `Unlocks: ${l.unlockReward.name}${l.unlockReward.type === "knife" || l.unlockReward.type === "board" ? " in the Market" : ""}` : (() => { const r = getNextRewardPreview(n); return r ? `Next: ${r.name} · Lv ${r.atLevel}` : null; })();
    const stage = l.unlockReward ? getNextKitchenStagePreview(n) : null;
    return { n, main, extra: stage ? `Next: ${stage.name} · Lv ${stage.atLevel}` : null };
  });
  const extras = rows.filter((r) => r.extra).map((r) => `${r.n}→${r.extra}`);
  console.log("     second hints:", JSON.stringify(extras));
  const at = (n: number) => rows.find((r) => r.n === n)!;
  // A knife/board is only unlocked for purchase, never handed over, so the row says "Unlocks … in the Market".
  assert(at(40).main === "Unlocks: Cleaver in the Market" && at(40).extra === "Next: Established Kitchen · Lv 41", `H1: Lv 40 shows "${at(40).main}" + "${at(40).extra}"`);
  assert(at(70).extra === "Next: Flourishing Café · Lv 71", `H2: Lv 70 shows "${at(70).main}" + "${at(70).extra}"`);
  assert(at(90).extra === "Next: Grand Kitchen · Lv 91", `H3: Lv 90 shows "${at(90).main}" + "${at(90).extra}"`);
  assert(JSON.stringify(extras) === JSON.stringify(["40→Next: Established Kitchen · Lv 41", "70→Next: Flourishing Café · Lv 71", "90→Next: Grand Kitchen · Lv 91"]), "H4: exactly those three rows gain a second hint — every other row is unchanged");
  const shownBgs = new Set(rows.flatMap((r) => [r.main, r.extra]).filter((h): h is string => !!h && /· Lv (21|41|51|71|91)$/.test(h) && KITCHEN_UPGRADE_CATALOG.some((u) => h.includes(u.name))));
  assert([...shownBgs].every((h) => !/Growing Kitchen|Neighborhood Café/.test(h)), "H5: Growing Kitchen / Neighborhood Café stay shown once, as their café rank — no name-clash duplicate");
  for (let lv = 0; lv <= 250; lv++) {
    const st = getNextKitchenStagePreview(lv);
    if (st && !KITCHEN_UPGRADE_CATALOG.some((u) => u.name === st.name && u.unlockLevel === st.atLevel)) assert(false, `H6: Lv ${lv} stage preview "${st.name}" is not a real background`);
  }
  assert(getNextKitchenStagePreview(9) === null && getNextKitchenStagePreview(49) === null, "H6: a café rank sharing a background's name (Growing Kitchen Lv 10, Neighborhood Café Lv 50) is never treated as a background");
  assert(rows.every((r) => !r.extra || r.extra !== r.main), "H7: no row shows the same reward twice");
  const all = rows.flatMap((r) => [r.main, r.extra]).filter(Boolean).join("\n");
  assert(INVESTMENT_NAMES.every((name) => !new RegExp(`(Reward|Next): ${name.replace(/'/g, "'")}( ·|$)`, "m").test(all)), "H8: no retired Kitchen Investment appears on any row");
}

// ===== K: kitchen upgrades are permanent — the kitchen only ever moves forward =====
{
  const at = (lv: number, extra: Partial<SaveData> = {}): SaveData => ({
    ...structuredClone(DEFAULT_SAVE),
    levelProgress: { ...DEFAULT_SAVE.levelProgress, highestUnlockedLevelId: `level-${lv}`, currentLevelId: `level-${lv}` },
    ...extra,
  });
  const fresh = at(1);
  assert(syncKitchenUpgradeOwnership(fresh) === fresh && fresh.equippedKitchenUpgradeId === "humble-kitchen", "K: a new player starts in Humble Kitchen (sync changes nothing)");
  // Economy V2.5: reaching Lv 21 only makes Growing Kitchen AVAILABLE; building it moves the kitchen.
  const reached = syncKitchenUpgradeOwnership(at(21));
  assert(reached.equippedKitchenUpgradeId === "humble-kitchen" && getKitchenUpgradeState("growing-kitchen", reached) === "available", `K2: reaching Lv 21 makes Growing Kitchen available to build — the level alone grants nothing (got ${reached.equippedKitchenUpgradeId})`);
  const built = purchaseKitchenUpgrade({ ...reached, credits: dollars(20_000) }, "growing-kitchen");
  assert(built.ok && built.save.equippedKitchenUpgradeId === "growing-kitchen" && built.save.credits === 0, "K2b: building it for exactly $20,000 moves the kitchen to Growing Kitchen and leaves $0");
  const picked = at(45, { ownedKitchenUpgradeIds: ["humble-kitchen", "growing-kitchen", "established-kitchen"], equippedKitchenUpgradeId: "humble-kitchen" });
  const moved = syncKitchenUpgradeOwnership(picked);
  assert(moved.equippedKitchenUpgradeId === "established-kitchen", "K3: an old save that had switched back to Humble Kitchen at Lv 45 is moved forward to Established Kitchen");
  assert(syncKitchenUpgradeOwnership(moved) === moved, "K4: sync is idempotent (no change on a second pass)");
  // A save from before V2.5 (version 2) keeps every tier its level had already earned for free.
  const grand = migrateKitchenDevelopment({ ...at(91), version: 2 });
  assert(grand.equippedKitchenUpgradeId === "grand-kitchen" && grand.ownedKitchenUpgradeIds.length === 6 && grand.version === 3, "K5: a pre-V2.5 save at Lv 91 migrates to Grand Kitchen with all six stages (version 3)");
  assert(syncKitchenUpgradeOwnership(at(91)).equippedKitchenUpgradeId === "humble-kitchen", "K5b: a V2.5 save at Lv 91 that built nothing is still in Humble Kitchen");
  const regressed = syncKitchenUpgradeOwnership({ ...grand, levelProgress: { ...grand.levelProgress, highestUnlockedLevelId: "level-30" } });
  assert(regressed.equippedKitchenUpgradeId === "grand-kitchen" && regressed.ownedKitchenUpgradeIds.length === 6, "K6: never moves back — a lower level number (e.g. edited save) keeps Grand Kitchen");
  assert(
    getKitchenUpgradeState("established-kitchen", moved) === "current" &&
      getKitchenUpgradeState("humble-kitchen", moved) === "past" &&
      getKitchenUpgradeState("growing-kitchen", moved) === "past" &&
      getKitchenUpgradeState("grand-kitchen", moved) === "locked",
    "K7: stages read current / past / locked",
  );
  const managerExports = Object.keys(await import("../src/game/kitchen/KitchenUpgradeManager.ts"));
  assert(!managerExports.includes("equipKitchenUpgrade") && !managerExports.includes("canEquipKitchenUpgrade"), "K8: there is no way to switch back to an earlier kitchen (equip functions removed)");
  const screen = code("src/components/kc/KitchenUpgrades.tsx");
  assert(!/Use This Kitchen/.test(screen) && !/>Owned</.test(screen) && !/>Equipped</.test(screen) && !/setEquipped/.test(screen), "K9: the Kitchen Upgrades screen has no 'Use This Kitchen' button and no Owned/Equipped badges");
  assert(/Current Kitchen/.test(screen) && /Already upgraded past this/.test(screen) && /Upgraded ✓/.test(screen), "K10: it shows Current Kitchen, and past stages as upgraded-past");
  const app = code("src/App.tsx");
  assert(/let synced = syncKitchenUpgradeOwnership\(loaded\);/.test(app) && /const synced = syncKitchenUpgradeOwnership\(next\);/.test(app) && !/equipKitchenUpgrade|setEquippedKitchenUpgrade/.test(app), "K11: sync runs on load and on every save; no equip action remains in App");
}

// ===== G: Economy V2 freeze =====
{
  const v2 = spawnSync("npx", ["tsx", JSON.stringify(path.resolve(import.meta.dirname, "economy-v2-campaign-simulation.mts"))], { encoding: "utf8", shell: true });
  const honest = v2.stdout.slice(v2.stdout.indexOf("SIMULATION HONEST"), v2.stdout.indexOf("Total net campaign result") + 60);
  const has = (label: string, value: string) => new RegExp(`${label}:\\s*${value}(?![\\d,])`).test(honest);
  assert(
    v2.status === 0 && has("Gross recipe revenue", "\\$165,140\\.00") && has("Level-completion rewards", "\\$77,581\\.00") && has("Total COGS", "\\$37,620\\.00") && has("Total quality bonuses", "\\$3,315\\.00") && has("Total net campaign result", "\\$208,416\\.00"),
    "G: Economy V2 freeze exact — $165,140.00 / $77,581.00 / $37,620.00 / $3,315.00 / $208,416.00 (V2.5 completion rewards)",
  );
}

console.log(failures === 0 ? "\nPROGRESSION PREVIEW QA: ALL PASS" : `\nPROGRESSION PREVIEW QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
