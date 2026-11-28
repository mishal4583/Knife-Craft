// EVERY FESTIVAL IN A REAL BROWSER, restaurant build (developer 2026-11-28: "design for all the levels and build": game/festival/menus.ts).
// Run with tsx, because it plays with the game's own simulated player:  npx tsx tools/e2e/festival-menus.mjs
//   G1 all fifteen festivals, their third stage (the whole menu), on two desktop shapes, an upright phone and the smallest phone: twelve pans and nothing
//      locked, no broken picture, every tap target 48 px, no name cut off or lying on another, each chef's whole name
//   G2 the first stage of each: what is not on the menu yet waits locked, with its stage
//   G3 a whole PIZZA round with real taps: toppings on the raw dough, the pizza into the oven, out when baked, served; a win, nothing paid
//   G4 no console errors
// Screenshots: out/festival-menus-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  SAVE_KEY,
  launch,
  seedSave,
  shot,
  sleep,
} from "./harness.mjs";
import { nextAction } from "../../src/game/festival/bot.ts";
import { FESTIVAL_EVENTS, festivalEvent, paceOfStage } from "../../src/game/festival/events.ts";
import { cookerOf } from "../../src/game/festival/kitchen.ts";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
const q = (id) => `[data-testid="${id}"]`;

const level = 20;
const save = seedSave({
  credits: 50_000,
  business: {
    ...MOVED_IN_BUSINESS,
    assistant: PAIGE_QUIET,
    sectionsSeen: ["shop", "inventory", "rack", "business"],
  },
  levelProgress: {
    currentLevelId: `level-${level}`,
    highestUnlockedLevelId: `level-${level}`,
    completedLevelIds: Array.from({ length: level - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});
const { browser, page, logs } = await launch();

async function open(number, stage, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${base}?festival=${number}&stage=${stage}`, { waitUntil: "domcontentloaded" });
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
  await page.waitForSelector(q("fest-start"), { timeout: 15000 });
}
const stored = () =>
  page.evaluate(async (key) => {
    const [raw] = await window.bridge.storage.get([key]);
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }, SAVE_KEY);

const measure = () =>
  page.evaluate(async () => {
    const stage = document.querySelector('[data-testid="fest-stage"]');
    await Promise.all([...stage.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
    const boxes = (sel) =>
      [...stage.querySelectorAll(sel)].map((e) => ({
        id: e.dataset.testid ?? e.textContent,
        r: e.getBoundingClientRect(),
      }));
    const crossing = (list, slack) =>
      list.flatMap((a, i) =>
        list
          .slice(i + 1)
          .flatMap((b) =>
            Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > slack &&
            Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > slack
              ? [`${a.id} / ${b.id}`]
              : [],
          ),
      );
    const buttons = boxes("button");
    return {
      pans: stage.querySelectorAll('[data-testid^="fest-tray-"]').length,
      locked: [...stage.querySelectorAll('[data-testid="fest-slot-locked"]')].map((e) =>
        e.textContent.trim(),
      ),
      broken: [...stage.querySelectorAll("img")]
        .filter((i) => !i.naturalWidth)
        .map((i) => i.getAttribute("src")),
      small: buttons.filter((b) => b.r.width < 47.5 || b.r.height < 47.5).map((b) => b.id),
      outside: buttons
        .filter((b) => b.r.left < -1 || b.r.right > innerWidth + 1 || b.r.bottom > innerHeight + 1)
        .map((b) => b.id),
      overlaps: crossing(buttons, 1),
      cut: [...stage.querySelectorAll(".fest-tray-name, .fest-who")]
        .filter((n) => n.offsetParent && n.scrollWidth > n.clientWidth + 1)
        .map((n) => n.textContent),
      namesOnNames: crossing(boxes(".fest-tray-name"), 2),
      // every pan, sauce and machine shows something
      empty: [...stage.querySelectorAll('[data-testid^="fest-tray-"]')]
        .filter((b) => !b.querySelector("img.fest-tray-food, svg.fest-tray-food"))
        .map((b) => b.dataset.testid),
      sideways: document.documentElement.scrollWidth > innerWidth,
    };
  });
const bad = (m) =>
  m.broken.length +
  m.small.length +
  m.outside.length +
  m.overlaps.length +
  m.cut.length +
  m.namesOnNames.length +
  m.empty.length +
  (m.sideways ? 1 : 0);

// G1: the whole menu, three sizes
for (const [w, h] of [
  [1819, 865],
  [1280, 720],
  [390, 844],
  [320, 568],
]) {
  const wrong = [];
  for (const event of FESTIVAL_EVENTS) {
    await open(event.number, 3, w, h);
    await page.click(q("fest-start"));
    await page.waitForSelector(q("fest-bubble"), { timeout: 10000 });
    await sleep(700);
    const m = await measure();
    if (bad(m) || m.pans !== 12 || m.locked.length) wrong.push({ id: event.id, ...m });
    if (w !== 320) await shot(page, `festival-menus-${event.number}-${event.id}-${w}`);
  }
  check(
    `G1 ${w} x ${h}: all fifteen festivals' whole menus: twelve pans, every picture, 48 px tap targets, no name cut or on another`,
    wrong.length === 0,
    wrong.slice(0, 4),
  );
}

// G2: the first stage of each
{
  const wrong = [];
  for (const event of FESTIVAL_EVENTS) {
    await open(event.number, 1, 1280, 720);
    await page.click(q("fest-start"));
    await page.waitForSelector(q("fest-bubble"), { timeout: 10000 });
    const m = await measure();
    const kitchen = event.round(paceOfStage(event, 1), 1).kitchen;
    if (
      bad(m) ||
      m.pans !== kitchen.trays.length ||
      !m.locked.length ||
      !m.locked.every((t) => /^Stage [23]$/.test(t))
    )
      wrong.push({ id: event.id, pans: m.pans, want: kitchen.trays.length, ...m });
  }
  check(
    "G2 the first stage of each festival: its own pans, and what comes later waits locked with its stage",
    wrong.length === 0,
    wrong.slice(0, 3),
  );
}

// G3: a whole pizza round with real taps
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
        word: b.querySelector(".fest-serve")?.textContent ?? "",
      })),
      customers: [...document.querySelectorAll('[data-testid="fest-bubble"]')].map((b) => ({
        id: Number(b.dataset.id),
        seat: Number(b.dataset.seat),
        order: b.dataset.order.split(","),
      })),
    };
  });
  const plain = (item) => ({ item, quality: "good" });
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
          return { item: s.item, t, ...(s.dish ? { dish: s.dish.split("+").map(plain) } : {}) };
        }),
      ];
    }),
  );
  return {
    ...seen,
    state: {
      done: seen.phase !== "play",
      cookers,
      customers: seen.customers.map((c) => ({
        id: c.id,
        seat: c.seat,
        patience: 1,
        max: 1,
        wants: c.order.map((w) => {
          const done = w.startsWith("done:");
          const what = w.replace("done:", "");
          return {
            done,
            item: what.includes("+")
              ? { kind: "dish", parts: what.split("+") }
              : { kind: "side", item: what },
          };
        }),
      })),
      plates: seen.plates.map((p) => p.parts.map(plain)),
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
{
  const pizza = festivalEvent("pizza");
  await open(pizza.number, 1, 1280, 720);
  const before = await stored();
  const oven = !!(await page.$(q("fest-oven")));
  await page.click(q("fest-start"));
  const round = pizza.round(paceOfStage(pizza, 1), 1);
  let baked = 0;
  let sawBake = false;
  let sawOven = false;
  const from = Date.now();
  while (Date.now() - from < 150_000) {
    const now = await screenState(round);
    if (now.phase !== "play") break;
    sawBake ||= now.plates.some((p) => p.word === "Bake");
    if (!sawOven && now.spots.grill.some((s) => s.dish)) {
      sawOven = true;
      await shot(page, "festival-menus-pizza-oven");
    }
    const action = nextAction(round, now.state);
    if (!action) {
      await sleep(120);
      continue;
    }
    if (action.kind === "cooker" && action.cooker === "grill") baked++;
    const el = await page.$(selectorFor(action));
    const box = el && (await el.boundingBox());
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(150);
  }
  await page.waitForSelector(q("fest-result"), { timeout: 60_000 }).catch(() => {});
  await sleep(900);
  await shot(page, "festival-menus-pizza-result");
  const won = await page.$eval(q("fest-result"), (e) => e.dataset.won).catch(() => null);
  const served = await page.$eval('[data-testid="festival-game"]', (e) => e.dataset.served);
  const after = await stored();
  check(
    "G3 a pizza round with real taps: the brick oven, Bake on a finished pizza, pizzas taken out of the oven, every customer served, a win, no money moved",
    oven &&
      sawBake &&
      sawOven &&
      baked >= 5 &&
      won === "true" &&
      Number(served) === round.orders.length &&
      after.credits === before.credits &&
      after.business.festivals?.record?.pizza?.wins === 1,
    { oven, sawBake, sawOven, baked, won, served, record: after.business.festivals?.record?.pizza },
  );
}

check(
  "G4 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nFESTIVAL MENUS E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
