/**
 * MINI-GAMES SHELF QA (developer 2026-11-17: "every mini-game inside the home kitchen screen, each available to play according to
 * its level"). business/miniGames.ts + components/kc/MiniGamesSheet.tsx, opened from the Kitchen's 🎮 button.
 *
 *  A  The list: all eight mini-games, one tile each, a real screen each, in the order they open, every unlock level read from the
 *     game's own constant (not copied)
 *  B  By level: locked below its level, open from it; the opening order is 3 / 4 / 7 / 10 / 10 / 15 / 18 / 18 (checked against the constants)
 *  C  The shelf never farms: a game that works on stock is "ready" only while something waits, the Car Park only while today's lot is open,
 *     a save with nothing waiting has no ready real-stock game; the free-play games are ready from their level
 *  D  Pure: the shelf moves no money, no stock, no ledger, no random and no clock
 *  E  Wiring: the Kitchen has the button, the router sends every game home when started from the Kitchen, the two free-play games take the
 *     player's level and refuse a lower one
 *
 * Run: npx tsx scripts/mini-games-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE } from "../src/game/SaveManager.ts";
import { MG_ART, NINE_SLICE } from "../src/components/kc/minigamesArt.ts";
import { CAR_PARK_FIRST_LEVEL } from "../src/game/business/carPark.ts";
import { CRATE_FIRST_LEVEL } from "../src/game/business/crateDispatch.ts";
import { DESSERT_RUN_FIRST_LEVEL } from "../src/game/business/dessertRun.ts";
import { INSPECTION_FIRST_LEVEL } from "../src/game/business/deliveryInspection.ts";
import { FRIDGE_SORT_FIRST_LEVEL } from "../src/game/business/fridgeSort.ts";
import { SAUCE_FIRST_LEVEL } from "../src/game/business/sauceStation.ts";
import { STOCKROOM_FIRST_LEVEL } from "../src/game/business/stockroomSort.ts";
import {
  MINI_GAMES,
  MINI_GAMES_BY_LEVEL,
  freePlayFirstLevel,
  isMiniGameScreen,
  miniGameViews,
} from "../src/game/business/miniGames.ts";

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
const byId = (level: number, id: string) =>
  miniGameViews(DEFAULT_SAVE, level).find((v) => v.entry.id === id)!;

console.log("A. The list");
{
  assert(MINI_GAMES.length === 8, "A1: eight mini-games on the shelf", MINI_GAMES.length);
  assert(
    new Set(MINI_GAMES.map((g) => g.id)).size === 8 &&
      new Set(MINI_GAMES.map((g) => g.screen)).size === 8,
    "A2: each has its own id and its own screen",
  );
  const data = read("src/components/kc/data.ts");
  assert(
    MINI_GAMES.every((g) => data.includes(`"${g.screen}"`)),
    "A3: every tile opens a real ScreenId",
  );
  assert(
    MINI_GAMES.every(
      (g) => g.name.length > 0 && g.name.length <= 20 && g.glyph.length > 0 && g.firstLevel >= 1,
    ),
    "A4: a short name, a logo and a level on every tile",
  );
  const levels = MINI_GAMES_BY_LEVEL.map((g) => g.firstLevel);
  assert(
    levels.every((l, i) => i === 0 || levels[i - 1]! <= l),
    "A5: the shelf lists the games in the order they open",
    levels,
  );
  const ctx = MINI_GAMES.map((g) => `${g.id}:${g.firstLevel}`).join(" ");
  assert(
    MINI_GAMES.find((g) => g.id === "inspection")!.firstLevel === INSPECTION_FIRST_LEVEL &&
      MINI_GAMES.find((g) => g.id === "fridge-sort")!.firstLevel === FRIDGE_SORT_FIRST_LEVEL &&
      MINI_GAMES.find((g) => g.id === "sauce")!.firstLevel === SAUCE_FIRST_LEVEL &&
      MINI_GAMES.find((g) => g.id === "stockroom")!.firstLevel === STOCKROOM_FIRST_LEVEL &&
      MINI_GAMES.find((g) => g.id === "car-park")!.firstLevel === CAR_PARK_FIRST_LEVEL &&
      MINI_GAMES.find((g) => g.id === "dessert-run")!.firstLevel === DESSERT_RUN_FIRST_LEVEL &&
      MINI_GAMES.find((g) => g.id === "kitchen-dispatch")!.firstLevel === CRATE_FIRST_LEVEL,
    "A6: every unlock level is the game's own constant",
    ctx,
  );
}

console.log("B. By level");
{
  for (const g of MINI_GAMES) {
    // Fridge Check opens on the freshness stage (its own rule); the others on their constant.
    const below = byId(g.firstLevel - 1, g.id).state;
    const at = byId(g.firstLevel, g.id).state;
    assert(
      below === "locked" && at !== "locked",
      `B1: ${g.name} is locked at Level ${g.firstLevel - 1} and open at Level ${g.firstLevel}`,
      { below, at },
    );
  }
  assert(
    miniGameViews(DEFAULT_SAVE, 1).every((v) => v.state === "locked"),
    "B2: a new game has the whole shelf locked (nothing is given early)",
  );
  assert(
    miniGameViews(DEFAULT_SAVE, 100).every((v) => v.state !== "locked"),
    "B3: at Level 100 every game is open",
  );
  const locked = miniGameViews(DEFAULT_SAVE, 1)[0]!;
  assert(locked.text === null, "B4: a locked tile has no play line (the sheet shows its level)");
}

console.log("C. The shelf never farms a reward");
{
  const v100 = miniGameViews(DEFAULT_SAVE, 100);
  const stateOf = (id: string) => v100.find((v) => v.entry.id === id)!;
  assert(
    stateOf("inspection").state === "resting" &&
      stateOf("fridge-sort").state === "resting" &&
      stateOf("stockroom").state === "resting",
    "C1: with nothing delivered, Check / Fridge Sort / Stock the shelves rest (no rounds to farm)",
    [stateOf("inspection").state, stateOf("fridge-sort").state, stateOf("stockroom").state],
  );
  assert(
    stateOf("car-park").state === "ready",
    "C2: the Car Park is ready while today's lot is open",
  );
  const done = {
    ...DEFAULT_SAVE,
    business: {
      ...DEFAULT_SAVE.business,
      carPark: {
        ...(DEFAULT_SAVE.business.carPark ?? {}),
        doneDay: DEFAULT_SAVE.business.calendar.businessDay,
      },
    },
  };
  const afterDone = miniGameViews(done, 100).find((v) => v.entry.id === "car-park")!;
  assert(
    afterDone.state === "resting" && afterDone.text === "Cleared · back tomorrow",
    "C3: the Car Park rests once today's lot is cleared (its Hype stays once a business day)",
    afterDone,
  );
  const free = ["fridge-check", "dessert-run", "kitchen-dispatch"].map((id) =>
    miniGameViews(DEFAULT_SAVE, 100).find((v) => v.entry.id === id)!,
  );
  assert(
    free.every((v) => v.state === "ready" && v.text === "Free play"),
    "C4: Fridge Check, Dessert Run and Kitchen Dispatch are free play from their level",
  );
  const lineLen = miniGameViews(DEFAULT_SAVE, 100).every((v) => (v.text ?? "").length <= 26);
  assert(lineLen, "C5: every line is a few words (26 characters at most)");
}

console.log("D. Pure");
{
  const before = JSON.stringify(DEFAULT_SAVE);
  for (let l = 1; l <= 120; l++) miniGameViews(DEFAULT_SAVE, l);
  assert(
    JSON.stringify(DEFAULT_SAVE) === before,
    "D1: reading the shelf changes nothing in the save",
  );
  const src = read("src/game/business/miniGames.ts");
  assert(
    !/Math\.random|Date\.now|new Date|addLedger|credits|economyLedger/.test(src),
    "D2: no random, no clock, no money, no ledger in the shelf",
  );
  assert(
    JSON.stringify(miniGameViews(DEFAULT_SAVE, 30)) ===
      JSON.stringify(miniGameViews(DEFAULT_SAVE, 30)),
    "D3: deterministic",
  );
}

console.log("E. Wiring");
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    kitchen.includes('data-testid="minigames-shortcut"') && kitchen.includes("<MiniGamesSheet"),
    "E1: the Kitchen has the Mini-games button and opens the sheet",
  );
  const sheet = read("src/components/kc/MiniGamesSheet.tsx");
  assert(
    sheet.includes("minigame-${entry.id}") &&
      sheet.includes("min-h-[132px]") &&
      sheet.includes("h-12 w-12"),
    "E2: a test id per tile, tiles over 48 px (the painted card is min-h 132, was 112 before the art of 2026-11-18), a 48 px close button",
  );
  const router = read("src/ScreensRouter.tsx");
  const exits = (router.match(/leaveTo\(/g) ?? []).length;
  assert(
    exits >= 9,
    "E3: every mini-game leaves through leaveTo (home when started from the Kitchen)",
    exits,
  );
  assert(
    router.includes("dessertRunPreviewLevel(restaurantLevelOf(save.levelProgress))") &&
      router.includes("kitchenDispatchPreviewLevel(restaurantLevelOf(save.levelProgress))"),
    "E4: Dessert Run and Kitchen Dispatch take the player's level (the preview link still wins)",
  );
  const app = read("src/App.tsx");
  assert(
    app.includes("freePlayFirstLevel(s)"),
    "E5: go() refuses a free-play game below its level",
  );
  assert(
    freePlayFirstLevel("dessert-run") === 18 &&
      freePlayFirstLevel("kitchen-dispatch") === 18 &&
      freePlayFirstLevel("car-park") === null,
    "E6: only the two free-play games are held by go()",
  );
  assert(
    isMiniGameScreen("car-park") && !isMiniGameScreen("inventory"),
    "E7: the screens on the shelf are recognised, others are not",
  );
}

console.log("F. The painted art (developer 2026-11-18)");
{
  const dir = path.resolve(import.meta.dirname, "..", "public", "business", "minigames");
  /** Width and height of a WebP (lossy VP8, lossless VP8L or extended VP8X). */
  const webpSize = (file: string): { w: number; h: number } | null => {
    const b = fs.readFileSync(file);
    if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    return null;
  };
  const missing = MG_ART.filter((n) => !fs.existsSync(path.join(dir, `${n}.webp`)));
  assert(
    missing.length === 0 && MG_ART.length === 22,
    "F1: all 22 pictures exist (scripts/make-minigame-assets.py builds them from the Codex folder)",
    missing,
  );
  const total = MG_ART.reduce(
    (t, n) =>
      t +
      (fs.existsSync(path.join(dir, `${n}.webp`))
        ? fs.statSync(path.join(dir, `${n}.webp`)).size
        : 0),
    0,
  );
  assert(
    total > 0 && total <= 300 * 1024,
    `F2: together they weigh ${Math.round(total / 1024)} KB (limit 300 KB; lazy: fetched a moment after the Kitchen opens, never in its first load)`,
    total,
  );
  const bad: unknown[] = [];
  for (const [name, n] of Object.entries(NINE_SLICE)) {
    const sz = webpSize(path.join(dir, `${name}.webp`));
    if (!sz || sz.w !== n.w || sz.h !== n.h) bad.push({ name, got: sz, want: [n.w, n.h] });
  }
  assert(
    bad.length === 0,
    "F3: every stretchable frame's file is the size minigamesArt.ts slices it for (a wrong size would tear its corners)",
    bad,
  );
  const icons = MINI_GAMES.map((g) => g.id);
  assert(
    icons.every(
      (id) =>
        MG_ART.includes(`icon-${id}` as never) &&
        (webpSize(path.join(dir, `icon-${id}.webp`))?.w ?? 0) === 288,
    ),
    "F4: every mini-game on the shelf has its painted icon (288 px) under its own id",
  );
  const sheet = read("src/components/kc/MiniGamesSheet.tsx");
  assert(
    /has\("sheet-panel"\)/.test(sheet) &&
      /has\(`icon-\$\{entry\.id\}`\)/.test(sheet) &&
      /have the plain look|falls back to the earlier plain look/.test(sheet) &&
      sheet.includes("🎮 Mini-games") &&
      sheet.includes("entry.glyph"),
    "F5: every painted piece falls back to the earlier plain look (the glyph tile, the emoji title, the gradient card) until its file is there",
  );
  assert(
    /minigame-\$\{entry\.id\}/.test(sheet) &&
      /mg-icon-|mg-star-|mg-glow-|mg-status-/.test(sheet) &&
      !/minigame-(icon|star|glow|status)-/.test(sheet),
    "F6: the extra test ids start with mg- so they never collide with a tile's minigame-<id>",
  );
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /warmMiniGameArt/.test(kitchen) &&
      /useMiniGameArt\(\["shortcut-icon"\]\)/.test(kitchen) &&
      /🎮/.test(kitchen),
    "F7: the Kitchen fetches the sheet's pictures a moment after it opens and shows the painted controller on its button (the emoji until it arrives)",
  );
  // "waiting": a star only where something really waits
  const all = miniGameViews(DEFAULT_SAVE, 1);
  assert(
    all.every((v) => v.waiting === false),
    "F8: nothing is 'waiting' on a fresh save at Level 1 (no star on a locked game)",
  );
}

console.log(failures ? `\n${failures} FAILED` : "\nMINI-GAMES SHELF: ALL PASS");
process.exit(failures ? 1 : 0);
