// THE FESTIVAL FAST FOOD COMPETITION in a real browser, restaurant build (developer 2026-11-27: game/festival + components/kc/festival).
// Run with tsx, because it plays rounds with the game's own simulated player:  npx tsx tools/e2e/festival.mjs
//   F1 the Kitchen's Mini-games sheet: the Festival card is locked below Level 10 ("opens in N services", no level number), ready from it
//   F2 the select screen: 15 cards; Event 1 playable; the others locked behind the one before and say so; no level number anywhere (every festival is
//       built since 2026-11-28; each is checked by festival-menus.mjs)
//   F3 the intro card names the rival and the goals; the round waits until Start
//   F4 a whole first round WITH REAL TAPS (the simulated player reading the screen): coached for the first customers, every customer served, a win,
//      the stars; the save records it (business.festivals) and the money and ledger do not move
//   F10 the stages (RULE CHANGE, developer 2026-11-28: three, each against another rival): a win names the next rival and what the stage adds, and
//      "Next rival" opens it; the arrows go back to an earlier stage and never past the open one; the festival list shows the stages won
//   F13 the third stage's win unlocks the next festival, 10 services later
//   F5 pause: the clock and the food wait; Resume; the platform's pause stops it too
//   F6 doing nothing: the rival wins; a constructive tip; Try again starts a fresh round
//   F7 phone sizes and phones on their side, the first event and the pace of Event 15 (4 customers, 12 trays): every tap target at least 48 px,
//      nothing outside the window, no tap target on another, no sideways scroll
//   F9 the developer's art (2026-11-27), a round with the whole menu: no broken picture; on upright windows the painted counter covers the stage
//      with its edge on the counter line; the coach's hand points inside its target; the first event's two unused grill rings show a lock and the
//      stage that opens them
//   F11 the stall reaches the window's edges: the counter on an upright tablet and on a very wide window (RULE CHANGE 2026-11-28: the checked cloth
//       is gone, the developer's picture of the sorted stall has none)
//   F12 (developer 2026-11-28) customers walk in from the stall's sides and walk off again; landscape power-ups beside Pause; the plate stand
//   F14 (developer 2026-11-28, a picture: "sorted and organised") on its side: the tray of pans and the Sauce Station; stage 3 has every place
//       open; stage 1 shows the rest locked with its stage, in the places they will take, and a tap on a locked one does nothing
//   F15 (developer 2026-11-28) the plates lie inside the board's flat surface, the whole board in view; a real tap on each plate's picture
//       selects that plate, and so does a tap on a lower plate's burger where it rises past its tap box
//   F8 no console errors
// Screenshots: out/festival-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  boot,
  launch,
  seedSave,
  sleep,
  shot,
  SAVE_KEY,
} from "./harness.mjs";
import { nextAction } from "../../src/game/festival/bot.ts";
import { burgerRound } from "../../src/game/festival/burger.ts";
import { festivalEvent, paceOfStage } from "../../src/game/festival/events.ts";
import { paceFor } from "../../src/game/festival/tiers.ts";
import { portraitLayout } from "../../src/components/kc/festival/festivalLayout.ts";
import { cookerOf } from "../../src/game/festival/kitchen.ts";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];

const saveAt = (n, extra = {}) =>
  seedSave({
    credits: 50_000,
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: PAIGE_QUIET,
      sectionsSeen: ["shop", "inventory", "rack", "business"],
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    ...extra,
  });

const { browser, page, logs } = await launch();
const GAME = '[data-testid="festival-game"]';
const q = (id) => `[data-testid="${id}"]`;
const has = async (id) => !!(await page.$(q(id)));
const data = (name) => page.$eval(GAME, (e, n) => e.dataset[n], name);
const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim());

async function open(query, level, w = 390, h = 844, save = saveAt(level)) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${base}${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.bridge?.storage, { timeout: 20000 });
  await page.evaluate(
    async (s, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(s)]);
    },
    save,
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await sleep(500);
}
const stored = () =>
  page.evaluate(async (key) => {
    const [raw] = await window.bridge.storage.get([key]);
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }, SAVE_KEY);

/** A real mouse tap in the middle of an element. */
async function tapOn(sel) {
  const el = await page.$(sel);
  if (!el) return false;
  const box = await el.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

/** The round's state, rebuilt from what the screen shows, for the simulated player. */
async function screenState(round) {
  const seen = await page.evaluate(() => {
    const game = document.querySelector('[data-testid="festival-game"]');
    const spots = {};
    for (const id of ["drink", "fryer", "grill"])
      spots[id] = [...document.querySelectorAll(`[data-testid^="fest-${id}-"]`)].map((b) => ({
        item: b.dataset.item,
        phase: b.dataset.phase,
        dish: b.dataset.dish,
      }));
    return {
      phase: game.dataset.phase,
      served: Number(game.dataset.served),
      spots,
      plates: [...document.querySelectorAll('[data-testid^="fest-plate-"]')].map((b) => ({
        parts: b.dataset.parts ? b.dataset.parts.split("+") : [],
        selected: b.hasAttribute("data-selected"),
      })),
      customers: [...document.querySelectorAll('[data-testid="fest-bubble"]')].map((b) => ({
        id: Number(b.dataset.id),
        seat: Number(b.dataset.seat),
        order: b.dataset.order.split(","),
      })),
    };
  });
  const cookers = Object.fromEntries(
    Object.entries(seen.spots).map(([id, list]) => {
      const def = cookerOf(round.kitchen, id);
      return [
        id,
        list.map((s) => {
          if (!s.item) return null;
          const cook = def.cookMs[s.item];
          const t =
            s.phase === "cooking"
              ? 0
              : s.phase === "ready"
                ? cook
                : s.phase === "over"
                  ? cook + def.readyMs
                  : cook + def.readyMs + def.overMs;
          return {
            item: s.item,
            t,
            ...(s.dish
              ? { dish: s.dish.split("+").map((item) => ({ item, quality: "good" })) }
              : {}),
          };
        }),
      ];
    }),
  );
  const customers = seen.customers.map((c) => ({
    id: c.id,
    seat: c.seat,
    patience: 1,
    max: 1,
    wants: c.order.map((w) => {
      const done = w.startsWith("done:");
      const what = w.replace("done:", "");
      return {
        done,
        // (a dish always has its base and at least one more part)
        item: what.includes("+")
          ? { kind: "dish", parts: what.split("+") }
          : { kind: "side", item: what },
      };
    }),
  }));
  return {
    phase: seen.phase,
    served: seen.served,
    state: {
      done: seen.phase !== "play",
      cookers,
      customers,
      plates: seen.plates.map((p) => p.parts.map((item) => ({ item, quality: "good" }))),
      selected: Math.max(
        0,
        seen.plates.findIndex((p) => p.selected),
      ),
    },
  };
}
const selectorFor = (a) =>
  a.kind === "tray"
    ? q(`fest-tray-${a.item}`)
    : a.kind === "cooker"
      ? q(`fest-${a.cooker}-${a.slot}`)
      : a.kind === "plate"
        ? q(`fest-plate-${a.plate}`)
        : q("fest-bin");

/** Plays with real taps until the round ends (or `until` says stop). */
async function playRound(round, { limitMs = 150_000, onTap } = {}) {
  const from = Date.now();
  let taps = 0;
  while (Date.now() - from < limitMs) {
    const now = await screenState(round);
    if (now.phase !== "play") break;
    const action = nextAction(round, now.state);
    if (action) {
      if (onTap) await onTap(action, now);
      await tapOn(selectorFor(action));
      taps++;
      await sleep(140);
    } else await sleep(120);
  }
  return taps;
}

/** Opens the Kitchen's Mini-games sheet, answering any guide card over it with "Later" first. */
async function openSheet() {
  await page.waitForSelector(q("minigames-shortcut"), { timeout: 15000 });
  for (let i = 0; i < 6; i++) {
    const clear = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="guide-card"]');
      if (!card) return true;
      [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Later"))?.click();
      return false;
    });
    if (clear) break;
    await sleep(600);
  }
  await sleep(700);
  await page.click(q("minigames-shortcut"));
  await page.waitForSelector(q("mg-festival"), { timeout: 8000 });
  await sleep(500);
}

// F1: the Mini-games sheet's card
await open("", 7);
const noStar = !(await has("minigames-shortcut-star"));
await openSheet();
const f1Locked = {
  state: await page.$eval(q("mg-festival"), (e) => e.dataset.state),
  line: await text(q("mg-festival-status")),
};
await open("", 12);
await sleep(900);
const star = await has("minigames-shortcut-star");
await openSheet();
const f1Open = {
  state: await page.$eval(q("mg-festival"), (e) => e.dataset.state),
  line: await text(q("mg-festival-status")),
};
await shot(page, "festival-sheet");
check(
  "F1 the Mini-games sheet: locked below Level 10 in services (no level number), ready from it with the Burger Festival waiting",
  noStar &&
    star &&
    f1Locked.state === "locked" &&
    /opens in \d+ services?/.test(f1Locked.line) &&
    !/level/i.test(f1Locked.line) &&
    f1Open.state === "ready" &&
    /Burger Festival is waiting/.test(f1Open.line),
  { f1Locked, f1Open },
);

// F2: the select screen, opened from the card
await page.click(q("mg-festival"));
await page.waitForSelector(q("festival-select"), { timeout: 15000 });
await sleep(600);
const f2 = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('[data-testid^="festival-card-"]')];
  return {
    cards: cards.length,
    states: cards.map((c) => c.dataset.state).join(","),
    words: document.querySelector('[data-testid="festival-select"]').textContent,
    sideways: document.documentElement.scrollWidth > innerWidth,
    small: [...document.querySelectorAll('[data-testid="festival-select"] button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width < 47.5 || r.height < 47.5;
    }).length,
  };
});
await shot(page, "festival-select");
// RULE CHANGE (developer 2026-11-28): the others are locked behind the festival before (no level or after-campaign schedule)
check(
  "F2 the select screen: 15 festivals, Event 1 playable at Level 12, the others locked behind the one before; no level number; 48 px buttons",
  f2.cards === 15 &&
    f2.states.startsWith("play,locked,locked") &&
    !/\bLevel \d/i.test(f2.words) &&
    /Win the Burger Festival/.test(f2.words) &&
    /Win the Pizza Festival/.test(f2.words) &&
    !f2.sideways &&
    f2.small === 0,
  { states: f2.states, sideways: f2.sideways, small: f2.small },
);

// F3: the intro card
await page.click(q("festival-play-burger"));
await page.waitForSelector(q("fest-intro"), { timeout: 15000 });
await sleep(900);
const intro = await text(q("fest-intro"));
const t0 = await page.$$eval('[data-testid="fest-bubble"]', (b) => b.length);
await shot(page, "festival-intro");
check(
  "F3 the intro names the rival and the three star goals; no customer comes before Start",
  /Chef Dolly/.test(intro) &&
    /Sunny Side Diner/.test(intro) &&
    /Beat \d+ points/.test(intro) &&
    t0 === 0,
  { intro: intro.slice(0, 160), customers: t0 },
);

// F4: a whole round with real taps
await open("?festival=1", 12);
await page.waitForSelector(q("fest-start"), { timeout: 15000 });
const before = await stored();
await page.click(q("fest-start"));
await page.waitForSelector(q("fest-bubble"), { timeout: 8000 });
await sleep(300);
const coachFirst = (await has("fest-coach-text")) ? await text(q("fest-coach-text")) : "";
await shot(page, "festival-coach");
const round1 = burgerRound(paceFor(1), 1); // (the kitchen and the pace are the same for every seed)
let shotMid = false;
const taps = await playRound(round1, {
  onTap: async (_a, now) => {
    if (!shotMid && now.served >= 3) {
      shotMid = true;
      await shot(page, "festival-play");
    }
  },
});
await page.waitForSelector(q("fest-result"), { timeout: 15000 }).catch(() => {});
await sleep(900);
await shot(page, "festival-result");
const won = await page.$eval(q("fest-result"), (e) => e.dataset.won).catch(() => null);
const stars = await page
  .$eval(q("fest-result-stars"), (e) => Number(e.dataset.stars))
  .catch(() => -1);
const servedLine = await text(q("fest-result")).catch(() => "");
await sleep(600);
const after = await stored();
const record = after.business.festivals?.record?.burger;
check(
  "F4 a whole first round with real taps: coached at first, all 5 served, a win with stars, recorded in the save; money and ledger unchanged",
  /Tap the bun/.test(coachFirst) &&
    won === "true" &&
    stars >= 1 &&
    /Served5\/5|Served 5\/5/.test(servedLine) &&
    record?.plays === 1 &&
    record?.wins === 1 &&
    record?.stars === stars &&
    record?.best > 0 &&
    after.credits === before.credits &&
    JSON.stringify(after.economyLedger) === JSON.stringify(before.economyLedger),
  { coachFirst, taps, won, stars, record, credits: [before.credits, after.credits] },
);

// F10: the stage just won opens the next
const unlocked = (await has("fest-unlocked")) ? await text(q("fest-unlocked")) : "";
await page.click(q("fest-next"));
await page.waitForSelector(q("fest-intro"), { timeout: 8000 });
await sleep(600);
const stageNow = () => text(q("fest-stage-number"));
const two = {
  number: await stageNow(),
  news: (await has("fest-new")) ? await text(q("fest-new")) : "",
  upDisabled: await page.$eval(q("fest-stage-up"), (e) => e.disabled),
  tomato: await has("fest-tray-tomato"),
  rival: await data("rivalId"),
  intro: await text(q("fest-intro")),
};
await shot(page, "festival-stage2");
await page.click(q("fest-stage-down"));
await sleep(600);
const back = {
  number: await stageNow(),
  downDisabled: await page.$eval(q("fest-stage-down"), (e) => e.disabled),
  tomato: await has("fest-tray-tomato"),
  coach: await has("fest-coach-text"),
  rival: await data("rivalId"),
};
await page.click(q("fest-stage-up"));
await sleep(600);
const again = await stageNow();
await page.click(`${q("fest-intro")} .fest-secondary`);
await page.waitForSelector(q("festival-select"), { timeout: 8000 });
const listLine = await text(q("festival-record-burger"));
const listCard = await text(q("festival-card-burger"));
check(
  "F10 stages: the win names Stage 2's rival and food and opens it against that rival; the arrows reach Stage 1 again and stop at the open one; the list shows 1/3 and the next rival",
  record?.cleared === 1 &&
    /Stage 2: Chef Nils · 8 customers · .*Tomato/.test(unlocked) &&
    /Stage 2 of 3/.test(two.number) &&
    /New: .*Tomato/.test(two.news) &&
    /8 customers/.test(two.intro) &&
    /Chef Nils · Harbor Grill/.test(two.intro) &&
    two.rival === "harbor-grill" &&
    two.upDisabled &&
    two.tomato &&
    /Stage 1 of 3/.test(back.number) &&
    back.rival === "sunny-side" &&
    back.downDisabled &&
    !back.tomato &&
    !back.coach &&
    /Stage 2 of 3/.test(again) &&
    /stages 1\/3/.test(listLine) &&
    /Chef Nils/.test(listCard),
  { cleared: record?.cleared, unlocked, two, back, again, listLine, listCard },
);

// F13: a whole third stage with real taps, from a save that has won the first two
const twoWon = saveAt(12);
twoWon.business = {
  ...twoWon.business,
  festivals: { v: 1, record: { burger: { plays: 2, wins: 2, best: 500, stars: 2, cleared: 2 } } },
};
await open("", 12, 390, 844, twoWon);
await openSheet();
await page.click(q("mg-festival"));
await page.waitForSelector(q("festival-play-burger"), { timeout: 15000 });
await page.click(q("festival-play-burger"));
await page.waitForSelector(q("fest-start"), { timeout: 15000 });
await sleep(700);
const third = { number: await stageNow(), rival: await data("rivalId") };
await shot(page, "festival-stage3");
await page.click(q("fest-start"));
await page.waitForSelector(q("fest-bubble"), { timeout: 8000 });
await playRound({ ...burgerRound(paceOfStage(festivalEvent("burger"), 3), 1) });
await page.waitForSelector(q("fest-result"), { timeout: 90_000 }).catch(() => {});
await sleep(1200);
const thirdWon = await page.$eval(q("fest-result"), (e) => e.dataset.won).catch(() => null);
const opens = (await has("fest-next-festival")) ? await text(q("fest-next-festival")) : "";
await shot(page, "festival-won-all");
const thirdSave = (await stored()).business.festivals.record.burger;
const noNext = !(await has("fest-next"));
await page.click(q("fest-to-list"));
await page.waitForSelector(q("festival-select"), { timeout: 8000 });
const pizza = await text(q("festival-card-pizza"));
await shot(page, "festival-select-unlocked");
check(
  "F13 the third stage (its own rival) wins the festival: Pizza is unlocked and opens in 10 services",
  /Stage 3 of 3/.test(third.number) &&
    third.rival === "the-rustic-table" &&
    thirdWon === "true" &&
    noNext &&
    /Pizza Festival unlocked! Play it in 10 more services\./.test(opens) &&
    thirdSave.cleared === 3 &&
    thirdSave.wonAt === 11 &&
    /Opens in 10 services/.test(pizza),
  { third, thirdWon, opens, thirdSave, pizza },
);

// F5: pause, and the platform's pause
await open("?festival=1", 12);
await page.waitForSelector(q("fest-start"), { timeout: 15000 });
await page.click(q("fest-start"));
await page.waitForSelector(q("fest-bubble"), { timeout: 8000 });
await tapOn(q("fest-tray-bun"));
await tapOn(q("fest-tray-patty"));
await sleep(500);
const frozenLook = () =>
  page.evaluate(() => ({
    meter: document.querySelector('[data-testid="fest-grill-0"] .fest-meter > span')?.style
      .transform,
    // (patience is five hearts since the developer's art)
    patience: document.querySelector('[data-testid="fest-hearts"]')?.dataset.left,
    rival: document.querySelector('[data-testid="festival-game"]').dataset.rival,
  }));
await page.click(q("fest-pause"));
await sleep(300);
const p1 = await frozenLook();
await sleep(2500);
const p2 = await frozenLook();
await page.click(q("fest-resume"));
await sleep(1200);
const p3 = await frozenLook();
await page.evaluate(() => window.bridge.platform.emit?.("pause_state_changed", true));
const emitted = await page.evaluate(() => {
  const b = window.bridge;
  const name = b.EVENT_NAME?.PAUSE_STATE_CHANGED;
  if (typeof b.platform.emit === "function") {
    b.platform.emit(name, true);
    return true;
  }
  return false;
});
await sleep(500);
const platformPaused = await has("fest-paused");
check(
  "F5 pause: the food, the customers and the rival wait; Resume goes on" +
    (emitted
      ? "; the platform's pause shows it too"
      : " (the mock Bridge cannot send a platform pause: PauseManager's wiring is checked by festival-save-qa)"),
  p1.meter === p2.meter &&
    p1.patience === p2.patience &&
    p1.rival === p2.rival &&
    p3.patience !== p2.patience &&
    (!emitted || platformPaused),
  { p1, p2, p3, emitted, platformPaused },
);

// F6: doing nothing loses; the tip; Try again
await open("?festival=1", 12);
await page.waitForSelector(q("fest-start"), { timeout: 15000 });
await page.click(q("fest-start"));
await page.waitForSelector(q("fest-result"), { timeout: 120_000 }).catch(() => {});
await sleep(900);
await shot(page, "festival-lost");
const lostWon = await page.$eval(q("fest-result"), (e) => e.dataset.won).catch(() => null);
const tip = (await has("fest-tip")) ? await text(q("fest-tip")) : "";
await page.click(q("fest-again"));
await page.waitForSelector(q("fest-intro"), { timeout: 8000 }).catch(() => {});
check(
  "F6 doing nothing: the rival wins, a tip says what to do next time, Try again starts a fresh round",
  lostWon === "false" &&
    tip.length > 10 &&
    (await has("fest-intro")) &&
    (await data("score")) === "0",
  { lostWon, tip },
);

// F7: every size, the first event and Event 15's pace
const layoutCheck = () =>
  page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-testid="fest-stage"] button')]
      .map((b) => ({ id: b.dataset.testid, r: b.getBoundingClientRect() }))
      .filter((b) => b.r.width > 0);
    const overlaps = [];
    for (let i = 0; i < buttons.length; i++)
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i].r;
        const c = buttons[j].r;
        const x = Math.min(a.right, c.right) - Math.max(a.left, c.left);
        const y = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (x > 1 && y > 1) overlaps.push(`${buttons[i].id}/${buttons[j].id}`);
      }
    // (a bubble still popping in is measured once it has finished; so is a customer still walking in, developer 2026-11-28)
    document
      .getAnimations()
      .forEach(
        (a) =>
          ["fest-pop", "fest-walk-in", "fest-walk-out"].includes(a.animationName) && a.finish(),
      );
    const bubbles = [...document.querySelectorAll('[data-testid="fest-bubble"]')].map((b) =>
      b.getBoundingClientRect(),
    );
    // how much of each customer's picture (from its top, where the face is) their own bubble covers
    const faces = [...document.querySelectorAll('[data-testid="fest-stage"] .fest-person')].map(
      (p) => {
        const r = p.getBoundingClientRect();
        const over = bubbles
          .filter((b) => b.left < r.right && b.right > r.left)
          .map((b) => Math.max(0, b.bottom - r.top) / r.height);
        return Math.round(Math.max(0, ...over) * 100);
      },
    );
    const clipped = [...document.querySelectorAll('[data-testid="fest-stage"] .fest-tray-name')]
      .filter((n) => n.scrollWidth > n.clientWidth + 1)
      .map((n) => n.textContent);
    const wantsOut = [...document.querySelectorAll('[data-testid="fest-bubble"]')].filter((b) => {
      const box = b.getBoundingClientRect();
      return [...b.querySelectorAll(".fest-want, .fest-chip")].some((w) => {
        const r = w.getBoundingClientRect();
        return (
          r.left < box.left - 1 ||
          r.right > box.right + 1 ||
          r.top < box.top - 1 ||
          r.bottom > box.bottom + 1
        );
      });
    }).length;
    return {
      faceCovered: Math.max(0, ...faces),
      wantsOut,
      clipped,
      buttons: buttons.length,
      small: buttons.filter((b) => b.r.width < 47.5 || b.r.height < 47.5).map((b) => b.id),
      outside: buttons
        .filter(
          (b) =>
            b.r.left < -1 ||
            b.r.top < -1 ||
            b.r.right > innerWidth + 1 ||
            b.r.bottom > innerHeight + 1,
        )
        .map((b) => b.id),
      overlaps,
      bubbles: bubbles.length,
      bubbleOutside: bubbles.filter((r) => r.left < -1 || r.right > innerWidth + 1 || r.top < -1)
        .length,
      sideways: document.documentElement.scrollWidth > innerWidth,
    };
  });
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
  [768, 1024],
  [740, 360],
  [844, 390],
  [1280, 720],
]) {
  for (const pace of [1, 15]) {
    await open(`?festival=1&pace=${pace}`, 12, w, h);
    await page.waitForSelector(q("fest-start"), { timeout: 15000 });
    const introFits = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="fest-start"]').getBoundingClientRect();
      return r.height >= 47.5 && r.right <= innerWidth + 1;
    });
    await page.click(q("fest-start"));
    const round = burgerRound(paceFor(pace), 5);
    // some real taps, so food and plates are on the screen, then a wait until the counter is full
    await playRound(round, { limitMs: 4000 });
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="fest-bubble"]').length >= n,
      { timeout: 20000 },
      paceFor(pace).atOnce,
    );
    await tapOn(q("fest-tray-bun"));
    await tapOn(q("fest-tray-patty"));
    await tapOn(q("fest-tray-fries"));
    await sleep(500);
    const m = await layoutCheck();
    await shot(page, `festival-${w}x${h}-pace${pace}`);
    check(
      `F7 ${w} x ${h}, pace ${pace}: 48 px tap targets, all inside the window, none on another, the bubbles inside, no sideways scroll`,
      introFits &&
        m.small.length === 0 &&
        m.outside.length === 0 &&
        m.overlaps.length === 0 &&
        m.bubbles === paceFor(pace).atOnce &&
        m.bubbleOutside === 0 &&
        m.wantsOut === 0 &&
        m.clipped.length === 0 &&
        m.faceCovered <= 25 &&
        !m.sideways,
      m,
    );
  }
}

// F9: the art
const brokenArt = () =>
  page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('[data-testid="festival-game"] img')];
    await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
    const layers = [...document.querySelectorAll('[data-testid="festival-game"] svg image')].map(
      (i) => i.getAttribute("href"),
    );
    const bad = [];
    for (const src of new Set(layers)) {
      const probe = new Image();
      probe.src = src;
      await probe.decode().catch(() => bad.push(src));
    }
    return {
      images: imgs.length,
      layers: new Set(layers).size,
      broken: [...imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")), ...bad],
    };
  });
for (const [w, h] of [
  [390, 844],
  [360, 640],
  [1280, 720],
]) {
  await open("?festival=1&pace=15", 12, w, h);
  await page.waitForSelector(q("fest-start"), { timeout: 15000 });
  await page.click(q("fest-start"));
  await playRound(burgerRound(paceFor(15), 5), { limitMs: 8000 });
  await sleep(400);
  const art = await brokenArt();
  const seen = await page.evaluate(() => {
    const scene = document.querySelector('[data-testid="fest-scene"]');
    if (!scene) return null;
    const s = scene.getBoundingClientRect();
    const r = document.querySelector('[data-testid="fest-stage"]').getBoundingClientRect();
    const k = r.width / 540;
    return {
      covers:
        s.left <= r.left + 1 &&
        s.right >= r.right - 1 &&
        s.top <= r.top + 1 &&
        s.bottom >= r.bottom - 1,
      edge: Math.round((s.top + 0.445 * s.height - r.top) / k),
      height: Math.round(r.height / k),
    };
  });
  // RULE CHANGE (developer 2026-11-27, the concept stall): a tall phone now shares its extra height with the workstation, so the counter line is
  // read from the layout itself instead of the old "370 + all the extra height"
  const counter = seen && {
    ...seen,
    layout: portraitLayout({ atOnce: 4, grill: 4, plates: 4, trays: 12, drinks: 3 }, seen.height)
      .counter,
  };
  await shot(page, `festival-art-${w}x${h}`);
  check(
    `F9 ${w} x ${h}, the whole menu: no broken picture${w < h ? "; the painted counter covers the stage, its edge on the counter line" : ""}`,
    art.broken.length === 0 &&
      art.images > 30 &&
      (w > h ? counter === null : counter.covers && Math.abs(counter.edge - counter.layout) <= 2),
    { ...art, counter },
  );
}
await open("?festival=1", 12);
await page.waitForSelector(q("fest-start"), { timeout: 15000 });
await page.click(q("fest-start"));
await page.waitForSelector(".fest-hand", { timeout: 8000 });
await sleep(700);
const hand = await page.evaluate(() => {
  const h = document.querySelector(".fest-hand").getBoundingClientRect();
  const target = document
    .querySelector('[data-testid="fest-coach"]')
    .parentElement.getBoundingClientRect();
  // the fingertip is near the picture's top left
  const x = h.left + h.width * 0.2;
  const y = h.top + h.height * 0.15;
  return {
    tipInside:
      x >= target.left && x <= target.right && y >= target.top - 4 && y <= target.bottom + 4,
  };
});
const locks = await page.$$eval('[data-testid="fest-ring-locked"]', (l) =>
  l.map((e) => e.textContent.trim()),
);
await shot(page, "festival-coach-art");
check(
  "F9 the coach's hand points inside its target; the first event's two unused grill rings show a lock and the stage that opens them",
  // RULE CHANGE (developer 2026-11-28: three stages): the locked rings open at Stages 2 and 3 (were 3 and 7)
  hand.tipInside && locks.join() === "Stage 2,Stage 3",
  { hand, locks },
);

// F11: the stall reaches the window's edges
for (const [w, h, part] of [
  [768, 1024, "fest-wood"],
  [912, 432, "fest-wood"],
  [1920, 720, "fest-wood"],
]) {
  await open("?festival=1", 12, w, h);
  await page.waitForSelector(q("fest-start"), { timeout: 15000 });
  await sleep(400);
  const box = await page
    .$eval(q(part), (e) => {
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), window: innerWidth };
    })
    .catch(() => null);
  check(
    `F11 ${w} x ${h}: the counter runs from one window edge to the other`,
    !!box && box.left <= 1 && box.right >= box.window - 1,
    box,
  );
}

// F12 (developer 2026-11-28): customers walk in from the stall's sides and walk off again; the power-ups sit beside Pause
for (const [w, h] of [
  [1392, 640],
  [740, 360],
  [390, 844],
]) {
  await open("?festival=1", 12, w, h);
  await page.waitForSelector(q("fest-start"), { timeout: 15000 });
  await page.click(q("fest-start"));
  await page.waitForSelector(".fest-person.fest-arrive", { timeout: 15000 });
  // hold every walk at its first and its last frame, and measure
  const walkIn = await page.evaluate(() => {
    const walks = document.getAnimations().filter((a) => a.animationName === "fest-walk-in");
    const people = () =>
      [...document.querySelectorAll(".fest-person.fest-arrive")].map((e) => {
        const r = e.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          walk: parseFloat(e.style.getPropertyValue("--walk")),
        };
      });
    walks.forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
    const from = people();
    walks.forEach((a) => a.finish());
    const to = people();
    return { walks: walks.length, from, to, window: innerWidth };
  });
  const fromSides =
    walkIn.walks > 0 &&
    walkIn.from.length === walkIn.to.length &&
    walkIn.from.every((p, i) => {
      const end = walkIn.to[i];
      const outside = p.walk < 0 ? p.right <= 1 : p.left >= walkIn.window - 1;
      // level with where they end up (they come sideways, not up from behind the counter), starting on their nearer side
      const nearer = (end.left + end.right) / 2 <= walkIn.window / 2 + 2 ? p.walk < 0 : p.walk > 0;
      return (
        outside &&
        nearer &&
        Math.abs(p.top - end.top) < 1 &&
        end.left >= 0 &&
        end.right <= walkIn.window
      );
    });
  check(
    `F12 ${w} x ${h}: a customer starts past the window's nearer edge and walks in to the seat`,
    fromSides,
    {
      walks: walkIn.walks,
      from: walkIn.from.map((p) => [Math.round(p.left), Math.round(p.right)]),
      to: walkIn.to.map((p) => [Math.round(p.left), Math.round(p.right)]),
    },
  );
  if (w > h) {
    const bar = await page.evaluate(() => {
      const r = (id) => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
      const pause = r("fest-pause");
      const powers = ["patience", "instant", "freeze"].map((id) =>
        document.querySelector(`[data-testid="fest-power-${id}"]`),
      );
      const boxes = (
        powers.every(Boolean)
          ? powers
          : [...document.querySelectorAll('[data-testid^="fest-power-"]')]
      ).map((e) => e.getBoundingClientRect());
      const last = boxes[boxes.length - 1];
      const counts = [...document.querySelectorAll(".fest-power-count")].map(
        (e) => e.getBoundingClientRect().top,
      );
      return {
        n: boxes.length,
        gap: Math.round(pause.left - last.right),
        pauseWide: Math.round(pause.width),
        level: boxes.every((b) => b.top < pause.bottom && b.bottom <= pause.bottom + 2),
        smallest: Math.round(Math.min(...boxes.map((b) => Math.min(b.width, b.height)))),
        countTop: Math.round(Math.min(...counts)),
        stand: !!document.querySelector('[data-testid="fest-platestand"]'),
      };
    });
    check(
      `F12 ${w} x ${h}: the three power-ups are in the top bar right beside Pause, 48 px or more, counts inside the window; the plate stand is there`,
      bar.n === 3 &&
        bar.level &&
        bar.gap >= 0 &&
        bar.gap < bar.pauseWide / 2 &&
        bar.smallest >= 48 &&
        bar.countTop >= -1 &&
        bar.stand,
      bar,
    );
    await shot(page, `festival-bar-${w}`);
  }
}
// ... and a customer who leaves walks off the same way
await open("?festival=1", 12, 1392, 640);
await page.waitForSelector(q("fest-start"), { timeout: 15000 });
await page.click(q("fest-start"));
await page
  .waitForSelector(".fest-person.fest-leaving", { timeout: 90_000, polling: 100 })
  .catch(() => {});
const walkOut = await page.evaluate(() => {
  const e = document.querySelector(".fest-person.fest-leaving");
  const a = document.getAnimations().find((x) => x.animationName === "fest-walk-out");
  if (!e || !a) return null;
  a.pause();
  a.currentTime = 0;
  const from = e.getBoundingClientRect();
  a.currentTime = a.effect.getComputedTiming().duration - 1;
  const to = e.getBoundingClientRect();
  const walk = parseFloat(e.style.getPropertyValue("--walk"));
  return {
    walk,
    from: [Math.round(from.left), Math.round(from.right)],
    to: [Math.round(to.left), Math.round(to.right)],
    gone: walk < 0 ? to.right <= 3 : to.left >= innerWidth - 3,
  };
});
check("F12 a customer who leaves walks off past the window's edge", !!walkOut?.gone, walkOut);

// F14: the sorted stall
const stallPlaces = () =>
  page.evaluate(() => {
    const middle = (e) => {
      const r = e.getBoundingClientRect();
      return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
    };
    const places = {};
    for (const e of document.querySelectorAll('[data-testid^="fest-tray-"]'))
      places[e.dataset.testid.replace("fest-tray-", "")] = middle(e);
    const locked = {};
    for (const e of document.querySelectorAll('[data-testid="fest-slot-locked"]')) {
      locked[e.dataset.item] = e.textContent.trim();
      places[e.dataset.item] = middle(e);
    }
    return {
      places,
      locked,
      pantry: !!document.querySelector('[data-testid="fest-pantry"]'),
      rack: document.querySelector('[data-testid="fest-saucerack"]')?.textContent.trim(),
      plates: document.querySelectorAll('[data-testid^="fest-plate-"]').length,
    };
  });
for (const [w, h] of [
  [1819, 865],
  [844, 390],
]) {
  const seen = {};
  for (const stage of [3, 1]) {
    await open(`?festival=1&stage=${stage}`, 12, w, h);
    await page.waitForSelector(q("fest-start"), { timeout: 15000 });
    await page.click(q("fest-start"));
    await sleep(2500);
    seen[stage] = await stallPlaces();
    await shot(page, `festival-sorted-${w}-stage${stage}`);
  }
  // stage 1: a real tap on the locked chicken pan changes nothing
  const before = await page.evaluate(
    () => document.querySelector('[data-testid="fest-stage"]').innerHTML.length,
  );
  const [cx, cy] = seen[1].places.chicken;
  const under = await page.evaluate(
    (x, y) => document.elementFromPoint(x, y)?.closest("button")?.dataset.testid ?? null,
    cx,
    cy,
  );
  await page.mouse.click(cx, cy);
  await sleep(300);
  const grillAfter = await page.$$eval('[data-testid^="fest-grill-"]', (l) =>
    l.map((e) => e.dataset.item ?? "").join(""),
  );
  const names = Object.keys(seen[3].places).filter((n) => !n.startsWith("plate-"));
  const stayed = names
    .filter((n) => seen[1].places[n])
    .every((n) => {
      const [ax, ay] = seen[3].places[n];
      const [bx, by] = seen[1].places[n];
      return Math.abs(ax - bx) <= 2 && Math.abs(ay - by) <= 2;
    });
  check(
    `F14 ${w} x ${h}: sorted: the tray of pans and the Sauce Station; stage 3 all open; stage 1 the rest locked in their own places; a locked pan does nothing`,
    seen[3].pantry &&
      seen[3].rack === "Sauce Station" &&
      Object.keys(seen[3].locked).length === 0 &&
      names.length === 12 &&
      seen[3].plates === 4 &&
      seen[1].locked.chicken === "Stage 2" &&
      seen[1].locked.veggie === "Stage 3" &&
      seen[1].locked.ketchup === "Stage 2" &&
      seen[1].locked.lemonade === "Stage 2" &&
      seen[1].locked.milkshake === "Stage 3" &&
      seen[1].locked["plate-3"] === "Stage 2" &&
      seen[1].plates === 2 &&
      stayed &&
      under === null &&
      grillAfter === "" &&
      before > 0,
    {
      stage3: Object.keys(seen[3].places),
      stage1Locked: seen[1].locked,
      stayed,
      under,
      grillAfter,
    },
  );
}

// F15: the plates on the board
for (const [w, h] of [
  [1919, 908],
  [844, 390],
  [740, 360],
  [390, 844],
  [320, 568],
]) {
  await open("?festival=1&stage=3", 12, w, h);
  await page.waitForSelector(q("fest-start"), { timeout: 15000 });
  await page.click(q("fest-start"));
  await sleep(2500);
  const m = await page.evaluate(() => {
    const board = document.querySelector('img[src*="station-board"]').getBoundingClientRect();
    const plates = [...document.querySelectorAll('[data-testid^="fest-plate-"]')].map((b) =>
      b.querySelector(".fest-dish").getBoundingClientRect(),
    );
    return {
      boardBottom: Math.round(board.bottom),
      window: innerHeight,
      inside: plates.map(
        (p) =>
          p.left >= board.left + board.width * 0.08 &&
          p.right <= board.right - board.width * 0.08 &&
          p.top >= board.top + board.height * 0.095 &&
          p.bottom <= board.top + board.height * 0.81,
      ),
      middles: plates.map((p) => [p.left + p.width / 2, p.top + p.height / 2]),
    };
  });
  const picked = [];
  for (const i of [1, 3, 2, 0]) {
    await page.mouse.click(m.middles[i][0], m.middles[i][1]);
    await sleep(150);
    picked.push(
      await page.$eval('[data-testid^="fest-plate-"][data-selected]', (e) =>
        Number(e.dataset.testid.replace("fest-plate-", "")),
      ),
    );
  }
  // a burger on a lower plate: buns until it has one (they fill the empty plates in order), then a tap on the top of what is drawn there
  for (let n = 0; n < 4; n++) {
    if (await page.$eval(q("fest-plate-2"), (e) => !!e.dataset.parts)) break;
    await tapOn(q("fest-tray-bun"));
    await sleep(200);
  }
  await sleep(500);
  await page.mouse.click(m.middles[0][0], m.middles[0][1]);
  await sleep(150);
  const top = await page.evaluate(() => {
    const art = document.querySelector('[data-testid="fest-plate-2"] .fest-onplate');
    if (!art) return null;
    const layers = [...art.querySelectorAll("image")].map((e) => e.getBoundingClientRect());
    const r = layers.reduce((a, b) => (b.top < a.top ? b : a));
    // a point on the bun, a little below its top edge
    const x = r.left + r.width / 2;
    const y = r.top + r.height * 0.4;
    return {
      x,
      y,
      under: document.elementFromPoint(x, y)?.closest("button")?.dataset.testid ?? null,
    };
  });
  await shot(page, `festival-plates-${w}x${h}`);
  check(
    `F15 ${w} x ${h}: the whole board in view, four plates inside its flat surface; a tap on each picks it, and a tap on a lower plate's bun picks the lower one`,
    m.boardBottom <= m.window + 1 &&
      m.inside.length === 4 &&
      m.inside.every(Boolean) &&
      picked.join() === "1,3,2,0" &&
      top?.under === "fest-plate-2",
    { ...m, middles: undefined, picked, top },
  );
}

check(
  "F8 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nFESTIVAL E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
