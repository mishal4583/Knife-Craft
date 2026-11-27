/**
 * FESTIVAL SAVE, UNLOCK, ART AND WIRING QA (developer 2026-11-27; the one new save field `business.festivals` approved: "do whatever necessary").
 *
 *  A  the save: absent or damaged reads as nothing; a finished round counts once, keeps the best; old saves need nothing; no money, no ledger
 *  B  the unlocks: Levels 10-90; after the campaign the 25-order schedule, each gap counted only after the festival before was first played
 *  C  the screen's boxes: every tap target 48 px at the smallest window, inside the stage, none on another, for every pace, upright and wide
 *  D  the art: every picture the festival names exists, small; the 270 MB source folder is kept out of git
 *  E  wiring: the screen, the preview link, the level lock, the result, the after-campaign count, the Mini-games card, pause; Dessert Run untouched
 *
 * Run: npx tsx scripts/festival-save-qa.mts
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { FESTIVAL_EVENTS, festivalEvent } from "../src/game/festival/events.ts";
import {
  festivalsOf,
  lifetimeOrdersOf,
  recordFestivalRound,
  withFestivalBaseline,
} from "../src/game/festival/state.ts";
import { festivalStatus, waitingFestival } from "../src/game/festival/schedule.ts";
import { burgerKitchen } from "../src/game/festival/burger.ts";
import { PACES } from "../src/game/festival/tiers.ts";
import {
  PORTRAIT,
  SMALLEST_SCALE,
  portraitHeight,
  portraitLayout,
  tapTargets,
  wideLayout,
  type FestivalLayout,
} from "../src/components/kc/festival/festivalLayout.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const read = (p: string) => readFileSync(p, "utf8");

const levels = getLevels();
/** A save that has reached level `n` (n beyond the last = the whole campaign done). */
const at = (n: number): SaveData => {
  const done = levels.slice(0, Math.min(n - 1, levels.length)).map((l) => l.id);
  const current = levels[Math.min(n - 1, levels.length - 1)]!.id;
  return {
    ...structuredClone(DEFAULT_SAVE),
    credits: 12_345,
    levelProgress: {
      ...DEFAULT_SAVE.levelProgress,
      currentLevelId: current,
      highestUnlockedLevelId: current,
      completedLevelIds: done,
    },
  };
};
const finished = at(levels.length + 1);
const orders = (save: SaveData, n: number): SaveData => ({
  ...save,
  business: {
    ...save.business,
    finance: {
      ...save.business.finance,
      lifetime: { ...save.business.finance.lifetime, orderCount: n },
    },
  },
});
const status = (save: SaveData, id: string) => festivalStatus(save, festivalEvent(id)!);

console.log("A. The save");
{
  const fresh = at(12);
  assert(
    !("festivals" in DEFAULT_SAVE.business),
    "A1: a new and an old save have no festivals field (nothing to migrate)",
  );
  assert(
    JSON.stringify(festivalsOf(fresh)) === JSON.stringify({ v: 1, record: {} }),
    "A2: absent reads as none played",
  );
  const junk = {
    ...fresh,
    business: {
      ...fresh.business,
      festivals: {
        record: { burger: { plays: -3, wins: "x", best: NaN, stars: 9 }, bad: 4 },
        campaignDoneAtOrder: -1,
      } as never,
    },
  };
  assert(
    JSON.stringify(festivalsOf(junk)) ===
      JSON.stringify({ v: 1, record: { burger: { plays: 0, wins: 0, best: 0, stars: 3 } } }),
    "A3: damaged values are clamped, never thrown on",
    festivalsOf(junk),
  );
  const before = JSON.stringify(fresh);
  const once = recordFestivalRound(orders(fresh, 7), "burger", { score: 900, stars: 2, won: true });
  const twice = recordFestivalRound(orders(once, 30), "burger", {
    score: 500,
    stars: 0,
    won: false,
  });
  assert(JSON.stringify(fresh) === before, "A4: recording never changes the save it was given");
  assert(
    JSON.stringify(festivalsOf(twice).record.burger) ===
      JSON.stringify({ plays: 2, wins: 1, best: 900, stars: 2, playedAtOrder: 7 }),
    "A5: rounds are counted; the best score and stars stay; the first play's order count is kept",
    festivalsOf(twice).record.burger,
  );
  assert(
    twice.credits === fresh.credits &&
      JSON.stringify(twice.economyLedger) === JSON.stringify(fresh.economyLedger) &&
      JSON.stringify(twice.business.inventory) === JSON.stringify(fresh.business.inventory),
    "A6: no money, no ledger entry, no stock: replaying can never pay or cost anything",
  );
  const top = Object.keys(twice).sort().join();
  assert(top === Object.keys(fresh).sort().join(), "A7: no new top-level save field");
  const back = JSON.parse(JSON.stringify(twice)) as SaveData;
  assert(
    JSON.stringify(festivalsOf(back)) === JSON.stringify(festivalsOf(twice)),
    "A8: it survives being written and read",
  );
  assert(
    /\.\.\.partial\.business,/.test(read("src/game/SaveManager.ts")),
    "A9: SaveManager keeps every business field it reads (so festivals stay)",
  );
  const based = withFestivalBaseline(orders(fresh, 40), 40);
  assert(
    festivalsOf(based).campaignDoneAtOrder === 40 &&
      festivalsOf(withFestivalBaseline(based, 55)).campaignDoneAtOrder === 40,
    "A10: the after-campaign count starts once and never moves",
  );
  assert(
    lifetimeOrdersOf(orders(fresh, 12)) === 12,
    "A11: the count is the restaurant's own lifetime orders",
  );
}

console.log("B. The unlocks");
{
  assert(
    status(at(9), "burger").state === "level" && status(at(10), "burger").state === "open",
    "B1: the Burger Festival opens at Level 10",
  );
  assert(
    status(at(19), "pizza").state === "level" && status(at(20), "pizza").state === "open",
    "B2: Pizza at Level 20",
  );
  assert(
    FESTIVAL_EVENTS.slice(0, 9).every((e) => festivalStatus(at(91), e).state === "open"),
    "B3: an old save already past a level finds those festivals open",
  );
  assert(
    status(at(91), "seafood").state === "campaign",
    "B4: Seafood waits for the whole campaign (all 91 levels)",
  );
  let save = orders(finished, 100);
  const left = (s: SaveData, id: string) => {
    const st = status(s, id);
    return st.state === "orders" ? st.left : st.state;
  };
  assert(
    left(save, "seafood") === 4,
    "B5: with the campaign done, Seafood is 4 orders away, however many were served before",
    status(save, "seafood"),
  );
  save = withFestivalBaseline(orders(save, 101), 100);
  assert(left(save, "seafood") === 3, "B6: the first Endless order starts the count");
  save = orders(save, 104);
  assert(status(save, "seafood").state === "open", "B7: after 4, open");
  assert(
    status(save, "bakery").state === "previous",
    "B8: Bakery waits until Seafood has been played, so two never arrive together",
  );
  save = orders(save, 120);
  assert(status(save, "bakery").state === "previous", "B9: even many orders later");
  let served = 120;
  const schedule: number[] = [];
  save = recordFestivalRound(save, "seafood", { score: 1, stars: 0, won: false });
  for (const [id, gap] of [
    ["bakery", 4],
    ["indian", 4],
    ["mexican", 4],
    ["gourmet", 4],
    ["championship", 5],
  ] as const) {
    assert(
      left(save, id) === gap,
      `B10: after the one before is played (a loss counts), ${id} is ${gap} orders away`,
    );
    served += gap;
    save = orders(save, served);
    assert(status(save, id).state === "open", `B11: ${id} opens`);
    schedule.push(gap);
    save = recordFestivalRound(save, id, { score: 1, stars: 0, won: false });
  }
  assert(
    4 + schedule.reduce((a, b) => a + b) === 25,
    "B12: played as soon as they open, the six come over exactly 25 orders",
  );
  assert(
    status(orders(save, served), "seafood").state === "open",
    "B13: a played festival stays open to replay",
  );
  assert(
    waitingFestival(at(12))?.id === "burger" &&
      waitingFestival(recordFestivalRound(at(12), "burger", { score: 1, stars: 0, won: false })) ===
        undefined &&
      waitingFestival(at(9)) === undefined,
    "B14: the Kitchen points at an open festival never played (only one that can be played)",
  );
}

console.log("C. The boxes on the screen");
{
  const bad: string[] = [];
  const heights = [960, portraitHeight(390, 844), portraitHeight(320, 568), 1200];
  for (const pace of PACES) {
    const kitchen = burgerKitchen(pace);
    const counts = {
      atOnce: pace.atOnce,
      grill: pace.grillSlots,
      plates: pace.plates,
      trays: kitchen.trays.length,
    };
    const layouts: { name: string; layout: FestivalLayout; scale: number }[] = [
      ...heights.map((h) => ({
        name: `upright ${h}`,
        layout: portraitLayout(counts, h),
        scale: SMALLEST_SCALE.portrait,
      })),
      { name: "wide", layout: wideLayout(counts), scale: SMALLEST_SCALE.wide },
    ];
    for (const { name, layout, scale } of layouts) {
      const targets = tapTargets(layout);
      if (
        layout.trays.length !== counts.trays ||
        layout.grill.length !== counts.grill ||
        layout.plates.length !== counts.plates ||
        layout.seats.length !== counts.atOnce
      )
        bad.push(`t${pace.tier} ${name}: counts`);
      for (const [x, y, w, h] of targets) {
        if (w * scale < 48 || h * scale < 48)
          bad.push(
            `t${pace.tier} ${name}: small ${Math.round(w * scale)}x${Math.round(h * scale)}`,
          );
        if (x < 0 || y < 0 || x + w > layout.w || y + h > layout.h)
          bad.push(`t${pace.tier} ${name}: outside ${x},${y}`);
      }
      for (let i = 0; i < targets.length; i++)
        for (let j = i + 1; j < targets.length; j++) {
          const [ax, ay, aw, ah] = targets[i]!;
          const [bx, by, bw, bh] = targets[j]!;
          if (
            Math.min(ax + aw, bx + bw) - Math.max(ax, bx) > 0.5 &&
            Math.min(ay + ah, by + bh) - Math.max(ay, by) > 0.5
          )
            bad.push(`t${pace.tier} ${name}: overlap ${i}/${j}`);
        }
      for (const { bubble } of layout.seats)
        if (bubble[0] < 0 || bubble[0] + bubble[2] > layout.w || bubble[1] < 0)
          bad.push(`t${pace.tier} ${name}: bubble outside`);
    }
  }
  assert(
    bad.length === 0,
    "C1: every pace, upright and wide: tap targets 48 px at the smallest window, inside the stage, none overlapping",
    bad.slice(0, 8),
  );
  assert(
    portraitHeight(390, 844) === 1169 &&
      portraitHeight(320, 568) === 960 &&
      portraitHeight(768, 1024) === PORTRAIT.h &&
      portraitHeight(360, 900) === PORTRAIT.maxH,
    "C2: a tall phone's stage grows to fill it; a squarer window keeps 540 x 960",
  );
}

console.log("D. The art");
{
  const art = read("src/components/kc/festival/festivalArt.ts");
  const names = new Set<string>([...art.matchAll(/"((?:burger|ui)\/[a-z-]+)"/g)].map((m) => m[1]!));
  for (const f of readdirSync("src/components/kc/festival"))
    for (const m of read(`src/components/kc/festival/${f}`).matchAll(
      /festivalUrl\("([a-z/-]+)"\)/g,
    ))
      names.add(m[1]!);
  for (const who of ["elderly-woman", "office-man", "student-woman", "tourist-man"])
    for (const mood of ["happy", "neutral", "impatient", "excited"])
      names.add(`people/${who}-${mood}`);
  const missing = [...names].filter((n) => !existsSync(`public/festival/${n}.webp`));
  assert(
    names.size >= 30 && missing.length === 0,
    "D1: every picture the festival names exists",
    missing,
  );
  let total = 0;
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = `${dir}/${f}`;
      if (statSync(p).isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk("public/festival");
  assert(
    total > 0 && total < 1200 * 1024,
    `D2: together they weigh ${Math.round(total / 1024)} KB (limit 1200 KB; fetched only when the festival opens)`,
  );
  assert(
    /^Festival competition assets\/$/m.test(read(".gitignore")),
    "D3: the 270 MB art folder is kept out of git",
  );
  assert(
    /^ASSETS|ASSETS: dict/m.test(read("scripts/make-festival-assets.py")),
    "D4: the pictures are cut by scripts/make-festival-assets.py",
  );
}

console.log("E. Wiring");
{
  const router = read("src/ScreensRouter.tsx");
  const app = read("src/App.tsx");
  assert(
    read("src/components/kc/data.ts").includes('| "festival"') &&
      /screen === "festival" \? \(/.test(router) &&
      /<FestivalScreen/.test(router) &&
      /import\("@\/components\/kc\/restaurantScreens"\)/.test(router),
    "E1: its own screen, in the lazy restaurant chunk",
  );
  assert(
    /query\.get\("festival"\)/.test(router) &&
      /festivalPreviewAsked/.test(app) &&
      /!previewing && shouldRunIntro/.test(app),
    "E2: the preview link ?festival=1 (&pace=1-15) opens a round, without the intro",
  );
  assert(
    /s === "festival" &&\s*RESTAURANT_MODE[\s\S]{0,200}< FESTIVAL_FIRST_LEVEL/.test(app) &&
      /Festival Competition opens \$\{unlockText/.test(app),
    "E3: it cannot be opened below Level 10, and the lock says services",
  );
  const result = app.slice(
    app.indexOf("function festivalResult("),
    app.indexOf("function carParkAction("),
  );
  assert(
    /persist\(recordFestivalRound\(current, result\.eventId, result\)\)/.test(result) &&
      !/appendLedgerEntry|credits/.test(result),
    "E4: a finished round is recorded, and nothing is paid",
  );
  assert(
    /withFestivalBaseline\(served, lifetimeOrdersOf\(save\)\)/.test(app),
    "E5: the first Endless Restaurant order starts the after-campaign count",
  );
  const sheet = read("src/components/kc/MiniGamesSheet.tsx");
  assert(
    /data-testid="mg-festival"/.test(sheet) &&
      /go\("festival"\)/.test(sheet) &&
      /RESTAURANT_MODE \? \(/.test(sheet),
    "E6: the Mini-games sheet has the Festival card (restaurant game only)",
  );
  const game = read("src/components/kc/festival/FestivalGame.tsx");
  assert(
    /PauseManager\.subscribe\(setHeld\)/.test(game) &&
      /paused \|\| held \|\| phase !== "play"/.test(game) &&
      /Math\.min\(100, now - last\)/.test(game),
    "E7: the round waits for the platform's and ads' pause, and a hidden tab never makes food jump",
  );
  assert(
    !/visibilitychange|document\.hidden|sessionStorage|localStorage/.test(
      game + read("src/components/kc/festival/FestivalScreen.tsx"),
    ),
    "E8: no Page Visibility API or browser storage",
  );
  const select = read("src/components/kc/festival/FestivalSelect.tsx");
  assert(
    /useUnlockText\(\)/.test(select) &&
      /unlock\.when\(status\.level\)/.test(select) &&
      !/Level \$\{/.test(select),
    "E9: a locked festival says what opens it in the game's own words, never a level number",
  );
  let changed = "";
  try {
    changed = execSync(
      'git diff --name-only HEAD -- "src/game/business/dessert*" "src/components/kc/inventory/dessert*" "src/components/kc/inventory/DessertRunGame.tsx"',
      { encoding: "utf8" },
    ).trim();
  } catch {
    changed = "git unavailable";
  }
  assert(changed === "", "E10: Dessert Run is untouched", changed);
}

console.log(failures ? `\nFESTIVAL SAVE QA: ${failures} FAILED` : "\nFESTIVAL SAVE QA: ALL PASS");
process.exit(failures ? 1 : 0);
