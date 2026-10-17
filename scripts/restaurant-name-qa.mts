/**
 * RESTAURANT NAME QA (developer 2026-10-17: "ask the user to give the
 * restaurant name before the first level … and make it changeable at the
 * settings"). restaurant/restaurantName.ts and its wiring.
 *
 *  N  The name: cleaned (single spaces, trimmed, at most 24 characters); an
 *     empty name keeps the default; asked only while `settings.restaurantName`
 *     is absent; naming changes only settings (no money, ledger or progress).
 *  S  Saves: the name survives SaveManager save → load; an old save without it
 *     loads with the default and is asked once; no new top-level save field.
 *  W  Wiring: App shows the naming card after the intro and holds Level 1 under
 *     it (restaurant build only); Settings and the map's nameboard change the
 *     same saved name (the map no longer keeps it in plain localStorage);
 *     Progress and the City Ranking show it.
 *
 * Run: npx tsx scripts/restaurant-name-qa.mts
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

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import {
  DEFAULT_RESTAURANT_NAME,
  RESTAURANT_NAME_MAX,
  cleanRestaurantName,
  needsRestaurantName,
  restaurantNameOf,
  withRestaurantName,
} from "../src/game/restaurant/restaurantName.ts";
import { restaurantProgress } from "../src/game/progression/restaurantProgress.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const fresh = (): SaveData => structuredClone(DEFAULT_SAVE);

console.log("N. The name");
{
  assert(
    cleanRestaurantName("  Nonna's   Table  ") === "Nonna's Table" &&
      cleanRestaurantName("x".repeat(40)).length === RESTAURANT_NAME_MAX &&
      RESTAURANT_NAME_MAX === 24 &&
      cleanRestaurantName("   ") === "",
    "N1: names are trimmed, single-spaced and at most 24 characters",
  );
  const s = fresh();
  const named = withRestaurantName(s, "  The Copper Pan ");
  const blank = withRestaurantName(s, "   ");
  assert(
    needsRestaurantName(s) &&
      restaurantNameOf(s) === DEFAULT_RESTAURANT_NAME &&
      !needsRestaurantName(named) &&
      restaurantNameOf(named) === "The Copper Pan" &&
      blank.settings.restaurantName === DEFAULT_RESTAURANT_NAME &&
      !needsRestaurantName(blank) &&
      withRestaurantName(named, "The Copper Pan") === named,
    "N2: asked until named; the name is stored cleaned; an empty name keeps the default (and stops the asking); the same name changes nothing",
  );
  const strip = (x: SaveData) => JSON.stringify({ ...x, settings: null });
  assert(
    strip(named) === strip(s) &&
      named.credits === s.credits &&
      named.economyLedger.length === s.economyLedger.length &&
      JSON.stringify({ ...named.settings, restaurantName: undefined }) ===
        JSON.stringify({ ...s.settings, restaurantName: undefined }),
    "N3: naming changes only settings.restaurantName — no money, ledger, progress or other setting",
  );
}

console.log("S. Saves");
{
  await SaveManager.save(withRestaurantName(fresh(), "Golden Ladle"));
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  const back = await SaveManager.load();
  memoryStore.clear();
  const old = { ...fresh(), settings: { sound: false, music: true, reducedMotion: true } };
  memoryStore.set("knifecraft.save.v1", JSON.stringify(old));
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  const oldBack = await SaveManager.load();
  assert(
    restaurantNameOf(back) === "Golden Ladle" &&
      !needsRestaurantName(back) &&
      needsRestaurantName(oldBack) &&
      restaurantNameOf(oldBack) === DEFAULT_RESTAURANT_NAME &&
      oldBack.settings.sound === false &&
      oldBack.settings.reducedMotion === true,
    "S1: the name survives save → load; an old save keeps its settings, shows the default and is asked once",
  );
  assert(
    !("restaurantName" in DEFAULT_SAVE) &&
      /restaurantName\?: string;/.test(read("src/game/SaveManager.ts")),
    "S2: no new top-level save field (an optional settings key, like measure)",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const router = read("src/ScreensRouter.tsx");
  const map = read("src/components/kc/restaurantMap/RestaurantMapView.tsx");
  const journal = read("src/components/kc/Journal.tsx");
  const ranking = read("src/components/kc/CityRanking.tsx");
  assert(
    /RESTAURANT_MODE && save\.story\.introDone && !showIntro && needsRestaurantName\(save\)/.test(
      app,
    ) &&
      /\{showIntro \|\| askRestaurantName \? \(/.test(app) &&
      /<RestaurantNameCard initial=\{legacyRestaurantName\} onSave=\{setRestaurantName\} \/>/.test(
        app,
      ) &&
      /persist\(next\)/.test(app.slice(app.indexOf("function setRestaurantName"))),
    "W1: after the intro the naming card shows (restaurant build) and Level 1 waits under it; the name is saved through persist",
  );
  assert(
    /restaurantName: restaurantNameOf\(save\), onSetRestaurantName: setRestaurantName/.test(
      router,
    ) &&
      /data-testid="restaurant-name-setting"/.test(journal) &&
      /restaurantName=\{restaurantNameOf\(save\)\}/.test(router) &&
      /onRestaurantNameChange=\{setRestaurantName\}/.test(router) &&
      !/localStorage\.(get|set)Item/.test(map),
    "W2: Settings and the map's nameboard change the one saved name (no plain localStorage)",
  );
  const s = withRestaurantName(fresh(), "Corner Bistro");
  assert(
    restaurantProgress(s).restaurantName === "Corner Bistro" &&
      (ranking.match(/restaurantNameOf\(save\)/g) ?? []).length === 2,
    "W3: Progress and the City Ranking show the player's name",
  );
}

console.log(
  failures ? `\nRESTAURANT NAME QA: ${failures} FAILURE(S)` : "\nRESTAURANT NAME QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
