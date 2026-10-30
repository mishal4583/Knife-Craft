/**
 * SERVICE_LOOP_QA — Phase 1, the level system hidden behind one service loop (developer 2026-10-30,
 * docs/planning/PHASE1-PLAN-2026-10-30.md):
 *   N. the next service (restaurant/nextService.ts): the first unlocked level not completed, for a fresh,
 *      a mid-campaign, a replayed-out-of-order and a finished save; null when everything is done;
 *   W. the services-to-go wording: never negative, "after the next service" for one, "in N services";
 *   K. the Kitchen: the restaurant build's one button is "Open for service" → the next service; no Replay
 *      on the Kitchen (replays are the Order Board's); after the last service it opens the restaurant;
 *   S. after a story card nothing rolls on by itself (decision P3: back to the Kitchen, one tap);
 *   L. no level number on the service path (Pre-Service Check, its back link, Closing Time, Daily
 *      Maintenance, the restock panel and its notes, the Market's need label);
 *   M. the module touches no wallet, ledger, save or random.
 *
 * Run: npx tsx scripts/service-loop-qa.mts
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
import { DEFAULT_SAVE } from "../src/game/SaveManager.ts";
import { getLevels, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import {
  lockBadge,
  nextServiceLevel,
  opensInText,
  servicesLeft,
} from "../src/game/restaurant/nextService.ts";

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const src = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// ── N. the next service ──────────────────────────────────────────────────
const levels = getLevels();
const ids = levels.map((l) => l.id);
const progress = (done: string[], highest: string): LevelProgress => ({
  ...DEFAULT_SAVE.levelProgress,
  completedLevelIds: done,
  highestUnlockedLevelId: highest,
  currentLevelId: highest,
});
check(
  "N1 a fresh save: the first level",
  nextServiceLevel(DEFAULT_SAVE.levelProgress)?.id === ids[0],
);
check(
  "N2 mid-campaign: the first level not completed",
  nextServiceLevel(progress(ids.slice(0, 11), ids[11]!))?.id === ids[11],
);
check(
  "N3 a gap (a level left unfinished) comes first",
  nextServiceLevel(progress([...ids.slice(0, 4), ...ids.slice(5, 9)], ids[9]!))?.id === ids[4],
);
check("N4 everything completed: null", nextServiceLevel(progress(ids, ids.at(-1)!)) === null);

// ── W. wording ───────────────────────────────────────────────────────────
check("W1 never negative", servicesLeft(5, 9) === 0 && servicesLeft(5, 5) === 0);
check("W2 counts the first services to play", servicesLeft(20, 17) === 3);
check(
  "W3 phrases",
  opensInText(5, 5) === "now" &&
    opensInText(6, 5) === "after the next service" &&
    opensInText(9, 5) === "in 4 services",
  [opensInText(5, 5), opensInText(6, 5), opensInText(9, 5)],
);
check("W4 badges", lockBadge(6, 5) === "🔒 next service" && lockBadge(9, 5) === "🔒 4 services");

// ── K. the Kitchen ───────────────────────────────────────────────────────
const kitchen = src("src/components/kc/Kitchen.tsx");
const home = kitchen.slice(
  kitchen.indexOf("export function Kitchen("),
  kitchen.indexOf("export function OrderBoard("),
);
check("K1 the button reads Open for service", home.includes('"Open for service"'));
check(
  "K2 it opens the next service",
  /nextServiceLevel\(levelProgress\)/.test(home) && /onSelectLevel\(openService\.id\)/.test(home),
);
const buttonAt = home.indexOf("if (!openService)");
const restaurantButton = buttonAt < 0 ? "" : home.slice(buttonAt, home.indexOf(") : (", buttonAt));
check(
  "K3 the restaurant build's button has no Replay",
  restaurantButton.length > 0 && !/Replay/.test(restaurantButton),
);
check(
  "K4 after the last service it opens the restaurant",
  /go\("business"\)/.test(restaurantButton),
);
const board = kitchen.slice(kitchen.indexOf("export function OrderBoard("));
check(
  "K5 replays stay on the Order Board",
  /"Replay"/.test(board) && /onSelectLevel\(level\.id\)/.test(board),
);

// ── S. no roll-on after a story card ─────────────────────────────────────
const app = src("src/App.tsx");
check(
  "S1 roll-on only after a first completion with no story card",
  /rollOnRef\.current = done\.first && !done\.story && next/.test(app),
);

// ── L. no level number on the service path ───────────────────────────────
const LEVEL_COPY = /\b(Level|Lv\.?) ?(\$\{|\{)/;
const codeOnly = (p: string) =>
  src(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
for (const p of [
  "src/components/kc/restaurant/PreServiceCheck.tsx",
  "src/components/kc/restaurant/ServiceCheckLayer.tsx",
  "src/components/kc/restaurant/ClosingTime.tsx",
  "src/components/kc/DailyMaintenance.tsx",
  "src/components/kc/inventory/RestaurantAttentionPanel.tsx",
  "src/game/restaurant/restaurantAttention.ts",
  "src/game/restaurant/marketNeeds.ts",
])
  check(
    `L1 no "Level N" copy: ${path.basename(p)}`,
    !LEVEL_COPY.test(codeOnly(p)),
    codeOnly(p).match(LEVEL_COPY)?.[0],
  );

// ── M. purity ────────────────────────────────────────────────────────────
const mod = src("src/game/restaurant/nextService.ts").replace(/\/\*[\s\S]*?\*\//g, "");
check(
  "M1 the module touches no wallet, ledger, save or random",
  !/Math\.random|debitWallet|appendLedgerEntry|SaveManager|credits/.test(mod),
);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
