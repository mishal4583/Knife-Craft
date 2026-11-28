/**
 * EVERY FESTIVAL'S MENU AND THE PIZZA OVEN (developer 2026-11-28: "design for all the levels and build"; game/festival/menus.ts, menu.ts).
 *
 *  A  the fifteen menus: one for each festival, fifteen places each, one name for a food wherever it is used, its own station names
 *  B  every food can be seen: a painted picture or a drawn look, never both and never neither, for each thing it is shown as
 *  C  every customer of every stage (40 seeds each) can be served from that stage's counter; a pizza and a pasta always have what makes them one
 *  D  the stages: each later one adds food; every food of the menu is on the counter by the third
 *  E  the counters on the screen: every festival's every stage fits upright and on its side, 48 px, nothing tapped under anything else
 *  F  the pizza oven: into the oven whole, not twice for one order, served when baked, charred if left, never stuck
 *
 * Winnability of every stage is festival-rival-qa E5.  Run: npx tsx scripts/festival-menus-qa.mts
 */
import { FESTIVAL_EVENTS, festivalEvent, paceOfStage } from "../src/game/festival/events.ts";
import {
  JOINS,
  MAX_TOPPINGS,
  ROLES,
  dishesOf,
  foodAt,
  menuKitchen,
  menuRound,
  placeOf,
  sortParts,
} from "../src/game/festival/menu.ts";
import { FESTIVAL_MENUS, MENU_FOODS, menuOf } from "../src/game/festival/menus.ts";
import {
  accuracyOf,
  act,
  cookerOf,
  plateTaker,
  slotPhase,
  startState,
  tick,
} from "../src/game/festival/kitchen.ts";
import { nextAction } from "../src/game/festival/bot.ts";
import { paceFor } from "../src/game/festival/tiers.ts";
import type {
  Action,
  FoodId,
  GameEvent,
  RoundConfig,
  RoundState,
} from "../src/game/festival/types.ts";
import {
  BASKET_ART,
  CHIP_ART,
  LAYERS,
  MEATS,
  SIDE_ART,
  TRAY_ART,
} from "../src/components/kc/festival/festivalArt.ts";
import { FOOD_LOOKS } from "../src/components/kc/festival/foodLooks.ts";
import {
  SMALLEST_SCALE,
  WIDE,
  WIDE_PLACES,
  portraitHeight,
  portraitLayout,
  tapTargets,
  wideLayout,
} from "../src/components/kc/festival/festivalLayout.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const STAGES = [1, 2, 3] as const;
const counter = (id: string, stage: number) =>
  menuKitchen(menuOf(id)!, paceOfStage(festivalEvent(id)!, stage));

console.log("A. The menus");
{
  assert(
    FESTIVAL_MENUS.length === 15 &&
      FESTIVAL_MENUS.every((m, i) => FESTIVAL_EVENTS[i]!.id === m.id) &&
      FESTIVAL_EVENTS.every((e) => !!e.round && e.lines?.length === 3),
    "A1: a menu for each of the fifteen festivals, in their order, every one playable with its rivals' lines",
  );
  const bad: string[] = [];
  for (const m of FESTIVAL_MENUS) {
    const foods = ROLES.map((r) => dishesOf(m)[r]);
    if (new Set(foods.map((f) => f.id)).size !== 15) bad.push(`${m.id}: a food stands twice`);
    for (const f of foods)
      if (!f.name || f.name.length > 14 || MENU_FOODS.get(f.id) !== f.name)
        bad.push(`${m.id}: ${f.id} is "${f.name}"`);
    for (const r of ["main1", "main2", "main3", "side", "drink1", "drink2", "drink3"] as const)
      if (!(m.bake && r.startsWith("main")) && !(dishesOf(m)[r].ms! > 0))
        bad.push(`${m.id}: ${r} has no cooking time`);
    const stacked = [...m.mains, ...m.toppings, ...m.sauces].map((f) => f.id);
    if ([...m.layers].sort().join() !== stacked.sort().join())
      bad.push(`${m.id}: its layers are not its mains, toppings and sauces`);
    if (!m.dish || !m.hot || !m.fry || !m.aBase) bad.push(`${m.id}: a word is missing`);
  }
  assert(
    bad.length === 0,
    "A2: fifteen foods each, one short name a food wherever it is used, cooking times, a stacking order and the station names",
    bad.slice(0, 8),
  );
  const pantries = FESTIVAL_MENUS.map((m) =>
    ROLES.map((r) => dishesOf(m)[r].id)
      .sort()
      .join(),
  );
  const bases = FESTIVAL_MENUS.map((m) => m.base.id);
  assert(
    new Set(pantries).size === 15 && new Set(bases).size === 15,
    "A3: no two festivals have the same counter or the same base",
  );
}

console.log("B. Every food can be seen");
{
  const bad: string[] = [];
  const painted = (id: FoodId) =>
    id in LAYERS || id in TRAY_ART || id in SIDE_ART || id in CHIP_ART;
  for (const m of FESTIVAL_MENUS)
    for (const role of ROLES) {
      const id = dishesOf(m)[role].id;
      const look = FOOD_LOOKS[id];
      if (painted(id) === !!look)
        bad.push(`${m.id}: ${id} is ${look ? "both painted and drawn" : "neither"}`);
      if (look) continue;
      // a painted food must have every picture its role is shown with
      const need: boolean[] = [];
      if (!role.startsWith("drink")) need.push(id in TRAY_ART);
      if (role === "base" || role.startsWith("main") || /^(top|sauce)/.test(role))
        need.push(id in LAYERS);
      if (role.startsWith("main") || /^(top|sauce)/.test(role)) need.push(id in CHIP_ART);
      if (role.startsWith("main") && !m.bake) need.push(MEATS.includes(id));
      if (role === "side" || role.startsWith("drink")) need.push(id in SIDE_ART);
      if (role === "side") need.push(id === "fries" && !!BASKET_ART.raw);
      if (need.includes(false)) bad.push(`${m.id}: ${id} lacks a picture as its ${role}`);
    }
  assert(
    bad.length === 0,
    "B1: each food of each menu is painted (with every picture its place needs) or has a drawn look, never both",
    bad.slice(0, 10),
  );
  const unused = Object.keys(FOOD_LOOKS).filter((id) => !MENU_FOODS.has(id));
  assert(unused.length === 0, "B2: no look is drawn for a food nobody sells", unused);
  const sauces = FESTIVAL_MENUS.flatMap((m) => m.sauces).filter((f) => FOOD_LOOKS[f.id]);
  assert(
    sauces.every((f) => FOOD_LOOKS[f.id]!.shape === "bottle") &&
      FESTIVAL_MENUS.flatMap((m) => m.drinks)
        .filter((f) => FOOD_LOOKS[f.id])
        .every((f) => FOOD_LOOKS[f.id]!.shape === "cup"),
    "B3: a drawn sauce is a bottle and a drawn drink a cup",
  );
  const alike: string[] = [];
  for (const m of FESTIVAL_MENUS) {
    // two foods that can be on one plate never look the same (their order pictures tell them apart)
    const seen = new Map<string, string>();
    for (const f of [...m.mains, ...m.toppings, ...m.sauces]) {
      const look = FOOD_LOOKS[f.id];
      if (!look) continue;
      const key = `${look.shape} ${look.color}`;
      if (seen.has(key)) alike.push(`${m.id}: ${seen.get(key)} and ${f.id}`);
      seen.set(key, f.id);
    }
  }
  assert(alike.length === 0, "B4: no two toppings of a menu are drawn alike", alike);
}

console.log("C. The customers");
{
  const bad: string[] = [];
  let biggest = 0;
  for (const m of FESTIVAL_MENUS)
    for (const stage of STAGES) {
      const pace = paceOfStage(festivalEvent(m.id)!, stage);
      const kitchen = menuKitchen(m, pace);
      const asked = new Set<FoodId>();
      for (let seed = 1; seed <= 40; seed++) {
        const round = menuRound(m, pace, seed);
        if (round.orders.length !== pace.orders) bad.push(`${m.id} ${stage}: orders`);
        for (const order of round.orders)
          for (const item of order.items) {
            if (item.kind === "side") {
              asked.add(item.item);
              if (!kitchen.cookers.some((c) => c.serves && c.cookMs[item.item] !== undefined))
                bad.push(`${m.id} ${stage}: nothing makes ${item.item}`);
              continue;
            }
            biggest = Math.max(biggest, item.parts.length);
            item.parts.forEach((p) => asked.add(p));
            if (item.parts[0] !== m.base.id) bad.push(`${m.id} ${stage}: no base first`);
            if (item.parts.join() !== sortParts(item.parts, m).join())
              bad.push(`${m.id} ${stage}: not in stacking order`);
            if (!m.mains.some((x) => item.parts.includes(x.id)))
              bad.push(`${m.id} ${stage}: a ${m.dish} with no main`);
            for (const p of item.parts) {
              if (!kitchen.trays.some((t) => t.item === p))
                bad.push(`${m.id} ${stage}: no pan for ${p}`);
              const most = p === m.base.id ? 1 : (kitchen.limits[p] ?? 0);
              if (item.parts.filter((x) => x === p).length > most)
                bad.push(`${m.id} ${stage}: too many ${p}`);
            }
            for (const group of m.always ?? []) {
              const here = group.filter((f) => kitchen.trays.some((t) => t.item === f));
              if (here.length && here.filter((f) => item.parts.includes(f)).length !== 1)
                bad.push(`${m.id} ${stage}: not exactly one of ${here.join("/")}`);
            }
          }
      }
      // every food on the counter is asked for by somebody
      const never = kitchen.trays.map((t) => t.item).filter((t) => !asked.has(t));
      if (never.length) bad.push(`${m.id} ${stage}: never asked for ${never.join()}`);
    }
  assert(
    bad.length === 0,
    "C1: every customer of every stage can be served from its counter, and every food on it is asked for (40 seeds each)",
    bad.slice(0, 10),
  );
  assert(
    biggest <= 2 + MAX_TOPPINGS + 1,
    `C2: no plate is bigger than the Burger's biggest (${biggest} parts)`,
  );
}

console.log("D. The stages");
{
  const bad: string[] = [];
  for (const m of FESTIVAL_MENUS) {
    const foods = (s: number) => {
      const k = counter(m.id, s);
      return new Set<FoodId>([
        ...k.trays.map((t) => t.item),
        ...k.cookers.flatMap((c) => c.perSlot ?? []),
      ]);
    };
    if (!(foods(1).size < foods(2).size && foods(2).size < foods(3).size))
      bad.push(`${m.id}: ${foods(1).size}, ${foods(2).size}, ${foods(3).size} foods`);
    if ([...foods(1)].some((f) => !foods(2).has(f))) bad.push(`${m.id}: a food leaves`);
    const all = ROLES.map((r) => dishesOf(m)[r].id);
    const left = all.filter((f) => !foods(3).has(f));
    if (left.length) bad.push(`${m.id}: never on the counter: ${left.join()}`);
    if (m.id !== "burger" && JSON.stringify(m.stages) !== "[3,6,10]") bad.push(`${m.id}: stages`);
  }
  assert(
    bad.length === 0,
    "D1: every festival's stages add food, and the third has the whole menu",
    bad.slice(0, 8),
  );
  assert(
    JOINS.base === 1 && JOINS.main1 === 1 && JOINS.drink1 === 1 && JOINS.side === 1,
    "D2: a first counter always has a base, a main, a drink and a side",
  );
}

console.log("E. The counters on the screen");
{
  const bad: string[] = [];
  for (const m of FESTIVAL_MENUS)
    for (const stage of STAGES) {
      const pace = paceOfStage(festivalEvent(m.id)!, stage);
      const kitchen = menuKitchen(m, pace);
      const items = kitchen.trays.map((t) => placeOf(m, t.item));
      for (const t of kitchen.trays) {
        if (foodAt(m, placeOf(m, t.item)) !== t.item) bad.push(`${m.id}: ${t.item}'s place`);
        if (!WIDE_PLACES.includes(placeOf(m, t.item))) bad.push(`${m.id}: no place for ${t.item}`);
      }
      const counts = {
        atOnce: pace.atOnce,
        grill: pace.grillSlots,
        plates: pace.plates,
        trays: items.length,
        trayItems: items,
        drinks: cookerOf(kitchen, "drink")!.slots,
      };
      for (const [name, layout, scale] of [
        ["upright", portraitLayout(counts, 960), SMALLEST_SCALE.portrait],
        ["upright tall", portraitLayout(counts, portraitHeight(390, 844)), SMALLEST_SCALE.portrait],
        ["wide", wideLayout(counts, WIDE.w), SMALLEST_SCALE.wide],
        ["widest", wideLayout(counts, WIDE.maxW), SMALLEST_SCALE.wide],
      ] as const) {
        const targets = tapTargets(layout);
        targets.forEach(([x, y, w, h], i) => {
          if (w * scale < 48 || h * scale < 48) bad.push(`${m.id} ${stage} ${name}: small`);
          for (const [bx, by, bw, bh] of targets.slice(i + 1))
            if (
              Math.min(x + w, bx + bw) - Math.max(x, bx) > 0.5 &&
              Math.min(y + h, by + bh) - Math.max(y, by) > 0.5
            )
              bad.push(`${m.id} ${stage} ${name}: overlap`);
        });
      }
    }
  assert(
    bad.length === 0,
    "E1: every festival's every stage: each food has a place, and every tap target is 48 px and clear of the others, upright and wide",
    bad.slice(0, 8),
  );
}

console.log("F. The pizza oven");
{
  const pizza = menuOf("pizza")!;
  const pace = paceOfStage(festivalEvent("pizza")!, 1);
  const kitchen = menuKitchen(pizza, pace);
  const oven = cookerOf(kitchen, "grill")!;
  const margherita = sortParts(["dough", "pepperoni", "mozzarella"], pizza);
  const round: RoundConfig = {
    kitchen,
    pace: { ...pace, orders: 3 },
    orders: [0, 1, 2].map(() => ({ items: [{ kind: "dish" as const, parts: margherita }] })),
  };
  class Sim {
    state: RoundState = startState(round);
    events: GameEvent[] = [];
    do(action: Action) {
      const step = act(round, this.state, action);
      this.state = step.state;
      this.events = [...step.events];
      return this;
    }
    wait(ms: number) {
      for (let left = ms; left > 0; left -= 100)
        this.state = tick(round, this.state, Math.min(100, left)).state;
      return this;
    }
    hint() {
      return (this.events.find((e) => e.type === "hint") as { text: string } | undefined)?.text;
    }
    make() {
      for (const item of margherita) this.do({ kind: "tray", item });
      return this;
    }
    oven(slot: number) {
      return this.do({ kind: "cooker", cooker: "grill", slot });
    }
  }
  assert(
    oven.bake === true &&
      Object.keys(oven.cookMs).join() === "dough" &&
      kitchen.trays.every((t) => (t.to === "grill" ? false : true)),
    "F1: the pizza's toppings go on the raw dough: nothing is cooked on its own, and the oven bakes the whole pizza",
  );
  const sim = new Sim().wait(500);
  assert(
    sim.oven(0).hint() === "Tap a finished pizza to bake it",
    "F2: an empty oven says how to use it",
  );
  sim.make();
  const at = sim.state.selected;
  assert(!!plateTaker(sim.state, at, kitchen), "F3: a finished pizza somebody wants can be baked");
  sim.do({ kind: "plate", plate: at });
  assert(
    sim.state.served === 0 &&
      sim.state.plates[at]!.length === 0 &&
      sim.state.cookers.grill![0]?.dish?.length === 3 &&
      sim.events.some((e) => e.type === "cooking"),
    "F4: tapping it puts the whole pizza in the oven; the plate is free again; nobody is served yet",
  );
  assert(sim.oven(0).hint() === "Not ready yet", "F5: it cannot come out before it is baked");
  // one customer, one pizza in the oven: a second identical pizza is not wanted yet
  sim.make();
  assert(
    sim.state.customers.length === 1 && !plateTaker(sim.state, sim.state.selected, kitchen),
    "F6: the pizza in the oven counts as made: a second one is not baked for the same customer",
  );
  sim.wait(pace.arriveMs + 100);
  assert(
    !!plateTaker(sim.state, sim.state.selected, kitchen),
    "F7: until another customer wants one too",
  );
  sim.wait(oven.cookMs["dough"]!);
  assert(slotPhase(oven, sim.state.cookers.grill![0]!) === "ready", "F8: it bakes");
  sim.oven(0);
  assert(
    sim.state.served === 1 &&
      sim.state.cookers.grill![0] === null &&
      sim.state.cooked === 1 &&
      sim.state.perfect === 1 &&
      sim.state.score > 0,
    "F9: taken out when ready it is served, scored and counted as perfect",
    sim.state,
  );
  const burnt = new Sim().wait(500).make();
  burnt.do({ kind: "plate", plate: burnt.state.selected });
  burnt.wait(oven.cookMs["dough"]! + oven.readyMs + oven.overMs + 200);
  assert(
    slotPhase(oven, burnt.state.cookers.grill![0]!) === "burnt" && burnt.state.wasted === 1,
    "F10: left in too long it burns, counted once as wasted",
  );
  burnt.make();
  assert(
    !!plateTaker(burnt.state, burnt.state.selected, kitchen),
    "F11: a burnt pizza no longer counts: the order can be made again",
  );
  burnt.oven(0);
  assert(burnt.state.cookers.grill![0] === null, "F12: one tap clears it");
  const raw = new Sim().wait(500).make();
  raw.do({ kind: "bin" });
  assert(
    raw.state.cooked === 0 && raw.state.wasted === 0 && accuracyOf(raw.state) === 1,
    "F13: binning a raw pizza wastes nothing cooked",
  );
  const full = new Sim().wait(500 + pace.arriveMs * 3);
  const stuffed: RoundState = {
    ...full.state,
    cookers: {
      ...full.state.cookers,
      grill: full.state.cookers.grill!.map(() => ({
        item: "dough",
        t: 0,
        dish: [{ item: "dough", quality: "good" as const }],
      })),
    },
  };
  full.state = stuffed;
  full.make();
  full.do({ kind: "plate", plate: full.state.selected });
  assert(
    full.hint() === "The oven is full" && full.state.plates.some((p) => p.length === 3),
    "F14: with the oven full the pizza stays on its plate and says why",
  );
  const choice = nextAction(round, full.state);
  assert(
    choice?.kind !== "plate" || full.state.plates[choice.plate]!.length < 3,
    "F15: the coach never points a pizza at a full oven",
  );
}
{
  // the words on the screen are each festival's own
  const bad: string[] = [];
  for (const m of FESTIVAL_MENUS) {
    const round = menuRound(m, paceFor(3), 1);
    const empty = startState(round);
    const topping = act(round, empty, { kind: "tray", item: m.toppings[0].id }).events[0];
    const plate = act(round, empty, { kind: "plate", plate: 0 }).events[0];
    const say = (e: GameEvent | undefined) => (e?.type === "hint" ? e.text : "");
    if (say(topping) !== `Put ${m.aBase} on a plate first`) bad.push(`${m.id}: ${say(topping)}`);
    if (say(plate) !== `Tap the ${m.base.name.toLowerCase()} to start a ${m.dish}`)
      bad.push(`${m.id}: ${say(plate)}`);
  }
  assert(bad.length === 0, "F16: each festival's hints use its own words", bad.slice(0, 5));
}

console.log(failures ? `\nFESTIVAL MENUS QA: ${failures} FAILED` : "\nFESTIVAL MENUS QA: ALL PASS");
process.exit(failures ? 1 : 0);
