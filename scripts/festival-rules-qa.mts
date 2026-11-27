/**
 * FESTIVAL RULES QA (developer 2026-11-27: Festival Fast Food Competition, Phase 1 and the Burger round; docs/planning/FESTIVAL-COMPETITION-PHASE0-2026-11-27.md).
 *
 *  A  the fifteen events: ids, numbers, hosts among the city's 49 rivals (with their portraits), unlocks (Levels 10-90, then 4+4+4+4+4+5 = 25 orders)
 *  B  the Burger kitchen and its customers: five scripted first orders; every order can be made with that pace's counter; the same seed, the same round
 *  C  the counter: trays, cooking, ready, overcooked, burnt, where a topping lands, serving the longest waiting, nothing to the wrong one, the bin
 *  D  patience, customers walking up, combos, score, accuracy, stars (a tie is the player's), the three power-ups
 *  E  pure: no random, clock, money, ledger, stock or save in the rules
 *  F  three stages a festival (RULE CHANGE, developer 2026-11-28; ten before): customers rise with every stage and every festival, each stage adds
 *     something, and the burners open as the player goes
 *
 * Run: npx tsx scripts/festival-rules-qa.mts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  FESTIVAL_STAGES,
  FESTIVAL_WAIT_SERVICES,
  paceOfStage,
  FESTIVAL_EVENTS,
  FESTIVAL_FIRST_LEVEL,
  festivalRound,
  stageNews,
  stageWithBurners,
} from "../src/game/festival/events.ts";
import {
  BURGER_JOINS,
  FIRST_ORDERS,
  MAX_TOPPINGS,
  burgerKitchen,
  burgerOrders,
  burgerRound,
} from "../src/game/festival/burger.ts";
import { PACES, paceFor, stagePace } from "../src/game/festival/tiers.ts";
import {
  FREEZE_MS,
  accuracyOf,
  act,
  cookerOf,
  orderScore,
  patienceFor,
  plateTaker,
  resultOf,
  slotPhase,
  startState,
  targetPlate,
  tick,
} from "../src/game/festival/kitchen.ts";
import type {
  Action,
  Customer,
  FoodId,
  GameEvent,
  OrderSpec,
  RoundConfig,
  RoundState,
} from "../src/game/festival/types.ts";
import { rivalChefOf } from "../src/game/restaurant/rivalChefs.ts";
import { RIVALS } from "../src/game/restaurant/cityRanking.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}

console.log("A. The fifteen events");
{
  assert(
    FESTIVAL_EVENTS.length === 15 &&
      FESTIVAL_EVENTS.every((e, i) => e.number === i + 1) &&
      new Set(FESTIVAL_EVENTS.map((e) => e.id)).size === 15,
    "A1: fifteen events, numbered 1-15, each its own id",
  );
  const rank = new Map(RIVALS.map((r, i) => [r.id, i]));
  const hosts = FESTIVAL_EVENTS.flatMap((e) => e.rivals);
  const bad = hosts.filter(
    (id) => !rank.has(id) || !rivalChefOf(id) || !existsSync(`public/portraits/rivals/${id}.webp`),
  );
  // RULE CHANGE (developer 2026-11-28): three stages, three different rival restaurants each (was one host a festival)
  assert(
    bad.length === 0 && hosts.length === 45 && new Set(hosts).size === 45,
    "A2: each festival has three rivals of the city's 49, none used twice, each with its chef and painted portrait",
    bad,
  );
  assert(
    FESTIVAL_EVENTS.every((e) =>
      e.rivals.every((id, i) => i === 0 || rank.get(id)! > rank.get(e.rivals[i - 1]!)!),
    ),
    "A3: a festival's rivals come in the city's order, the weaker restaurant first",
  );
  // RULE CHANGE (developer 2026-11-28): "the final 3rd round unlocks the next festival ... playable only after 10 serves or levels" replaces the
  // schedule of Levels 10-90 and the 25 orders after the campaign
  assert(
    FESTIVAL_STAGES === 3 &&
      FESTIVAL_WAIT_SERVICES === 10 &&
      FESTIVAL_FIRST_LEVEL === 10 &&
      JSON.stringify(FESTIVAL_EVENTS[0]!.unlock) === JSON.stringify({ kind: "level", level: 10 }) &&
      FESTIVAL_EVENTS.slice(1).every((e) => e.unlock.kind === "previous"),
    "A4: the first opens at Level 10; every other one after the third stage of the one before, 10 services later",
  );
  assert(
    FESTIVAL_EVENTS.filter((e) => e.round)
      .map((e) => e.id)
      .join() === "burger" && FESTIVAL_EVENTS.every((e) => !e.round === !e.lines),
    "A5: only the Burger Festival can be played yet, and every playable event has its rival's lines",
  );
  const lines = FESTIVAL_EVENTS[0]!.lines!.map((l) => Object.values(l));
  assert(
    lines.length === 3 &&
      lines.every((set) => set.length === 6 && set.every((l) => l.length > 5 && l.length <= 48)) &&
      new Set(lines.flat()).size === 18,
    "A6: each of the three rivals says its own short lines (start, ahead, passed, slip, beaten, won)",
    lines.flat().filter((l) => l.length > 48),
  );
}

console.log("B. The Burger kitchen and its customers");
{
  assert(
    JSON.stringify(burgerOrders(paceFor(1), 7)) === JSON.stringify(FIRST_ORDERS) &&
      FIRST_ORDERS.length === 5 &&
      FIRST_ORDERS[0]!.items.length === 1 &&
      paceFor(1).orders === 5 &&
      paceFor(1).atOnce === 2,
    "B1: the first round is five scripted customers, two at once, the first wanting a plain burger (developer: start from 5)",
  );
  const bad: string[] = [];
  for (const pace of PACES) {
    const kitchen = burgerKitchen(pace);
    for (let seed = 1; seed <= 40; seed++) {
      const orders = burgerOrders(pace, seed);
      if (orders.length !== pace.orders)
        bad.push(`t${pace.tier} s${seed}: ${orders.length} orders`);
      for (const o of orders) {
        if (o.items.length < 1 || o.items.length > 3)
          bad.push(`t${pace.tier}: ${o.items.length} items`);
        for (const item of o.items) {
          if (item.kind === "side") {
            const makes = kitchen.cookers.some(
              (c) => c.serves && c.cookMs[item.item] !== undefined,
            );
            if (!makes) bad.push(`t${pace.tier}: no station makes ${item.item}`);
            continue;
          }
          const counts = new Map<FoodId, number>();
          for (const p of item.parts) counts.set(p, (counts.get(p) ?? 0) + 1);
          // RULE CHANGE (developer 2026-11-27, "add the assets and everything"): the Codex kit's veggie patty is a third meat
          if (
            counts.get("bun") !== 1 ||
            !(["patty", "chicken", "veggie"] as const).some((m) => counts.has(m))
          )
            bad.push(`t${pace.tier}: not a burger ${item.parts.join("+")}`);
          for (const [p, n] of counts) {
            if (p !== "bun" && n > (kitchen.limits[p] ?? 0)) bad.push(`t${pace.tier}: ${n} x ${p}`);
            if (!kitchen.trays.some((t) => t.item === p))
              bad.push(`t${pace.tier}: no tray for ${p}`);
            if ((BURGER_JOINS[p] ?? (p === "bun" ? 1 : 99)) > pace.tier)
              bad.push(`t${pace.tier}: ${p} too early`);
          }
          const toppings = item.parts.filter(
            (p) => !["bun", "patty", "chicken", "veggie"].includes(p),
          ).length;
          if (toppings > MAX_TOPPINGS) bad.push(`t${pace.tier}: ${toppings} toppings`);
        }
      }
    }
  }
  assert(
    bad.length === 0,
    "B2: at every pace, every order can be made with that pace's counter (40 seeds each)",
    bad.slice(0, 6),
  );
  assert(
    JSON.stringify(burgerRound(paceFor(9), 123)) === JSON.stringify(burgerRound(paceFor(9), 123)) &&
      JSON.stringify(burgerOrders(paceFor(9), 123)) !==
        JSON.stringify(burgerOrders(paceFor(9), 124)),
    "B3: the same seed gives the same round, another seed other customers",
  );
  assert(
    festivalRound(FESTIVAL_EVENTS[0]!, 1)!.pace.tier === 1 &&
      festivalRound(FESTIVAL_EVENTS[0]!, 1, 15)!.pace.tier === 15 &&
      festivalRound(FESTIVAL_EVENTS[1]!, 1) === null,
    "B4: an event plays at its own pace (or the preview's); an unbuilt one has no round",
  );
  const joins = (item: FoodId) =>
    PACES.findIndex(
      (p) =>
        burgerKitchen(p).trays.some((t) => t.item === item) ||
        burgerKitchen(p).cookers.some((c) => c.cookMs[item] !== undefined),
    ) + 1;
  assert(
    joins("patty") === 1 &&
      joins("cola") === 1 &&
      joins("fries") === 1 &&
      joins("ketchup") === 3 &&
      joins("lemonade") === 4 &&
      joins("milkshake") === 6 &&
      joins("veggie") === 9 &&
      joins("mustard") === 10 &&
      burgerKitchen(paceFor(15)).trays.length === 12,
    "B5: the whole kit is on the menu as the pace rises (ketchup 3, lemonade 4, shake 6, veggie 9, mustard 10): 12 trays at most",
    { trays: burgerKitchen(paceFor(15)).trays.map((t) => t.item) },
  );
  const asked = new Set<FoodId>();
  for (let seed = 1; seed <= 60; seed++)
    for (const o of burgerOrders(paceFor(15), seed))
      for (const i of o.items)
        for (const part of i.kind === "dish" ? i.parts : [i.item]) asked.add(part);
  assert(asked.size === 15, "B6: and customers ask for every one of the 15 foods", [...asked]);
}

/* a small counter to try the rules on */
const pace1 = paceFor(1);
const withOrders = (orders: OrderSpec[], pace = pace1): RoundConfig => ({
  kitchen: burgerKitchen(pace),
  orders,
  pace: { ...pace, orders: orders.length },
});
const dish = (...parts: FoodId[]): OrderSpec["items"][number] => ({
  kind: "dish",
  parts: ["bun", ...parts],
});
const side = (item: FoodId): OrderSpec["items"][number] => ({ kind: "side", item });
class Sim {
  state: RoundState;
  events: GameEvent[] = [];
  constructor(readonly round: RoundConfig) {
    this.state = startState(round);
  }
  do(action: Action) {
    const step = act(this.round, this.state, action);
    this.state = step.state;
    this.events = [...step.events];
    return this;
  }
  wait(ms: number) {
    this.events = [];
    for (let left = ms; left > 0; left -= 100) {
      const step = tick(this.round, this.state, Math.min(100, left));
      this.state = step.state;
      this.events.push(...step.events);
    }
    return this;
  }
  hint() {
    return this.events.find((e) => e.type === "hint") as { text: string } | undefined;
  }
  tray(item: FoodId) {
    return this.do({ kind: "tray", item });
  }
  grill(slot: number) {
    return this.do({ kind: "cooker", cooker: "grill", slot });
  }
  plate(plate: number) {
    return this.do({ kind: "plate", plate });
  }
}
const grill = (sim: Sim) => cookerOf(sim.round.kitchen, "grill")!;

console.log("C. The counter");
{
  const sim = new Sim(withOrders([{ items: [dish("patty", "cheese")] }]));
  assert(sim.tray("cheese").hint()?.text.includes("bun"), "C1: a topping needs a bun first");
  sim.wait(500).tray("bun");
  assert(
    sim.state.plates[0]!.length === 1 && sim.state.selected === 0,
    "C2: the bun takes the first free plate",
  );
  sim.tray("bun").tray("bun");
  assert(
    sim.hint()?.text === "Serve or bin a plate first",
    "C3: with every plate taken, the bun says so",
  );
  sim.tray("patty");
  assert(sim.state.cookers.grill![0]?.item === "patty", "C4: raw meat takes a grill spot");
  sim.grill(0);
  assert(sim.hint()?.text === "Not ready yet", "C5: food that is still cooking cannot be taken");
  const cook = grill(sim).cookMs.patty!;
  sim.wait(cook);
  assert(
    slotPhase(grill(sim), sim.state.cookers.grill![0]!) === "ready" &&
      sim.events.some((e) => e.type === "ready"),
    "C6: after its cooking time it is ready",
  );
  sim.grill(0);
  assert(
    sim.state.cookers.grill![0] === null &&
      sim.state.plates.some((p) => p.some((x) => x.item === "patty")),
    "C7: a ready patty moves onto a plate with a bun",
  );
  const at = sim.state.selected;
  sim.plate(at);
  assert(
    sim.hint()?.text === "No one ordered it like this yet" && sim.state.served === 0,
    "C8: a plate nobody ordered like this stays where it is (nothing goes to the wrong customer)",
  );
  sim.tray("cheese");
  assert(
    !!plateTaker(sim.state, sim.state.selected),
    "C9: with the cheese on, a customer wants it exactly",
  );
  sim.plate(sim.state.selected);
  assert(
    sim.state.served === 1 &&
      sim.state.done &&
      sim.state.score > 0 &&
      sim.state.perfect === 1 &&
      sim.state.cooked === 1,
    "C10: tapping it serves them, scores it and counts the patty as perfect",
    sim.state,
  );
}
{
  // burning, overcooking and the bin
  const sim = new Sim(withOrders([{ items: [dish("patty")] }, { items: [dish("patty")] }]));
  sim.wait(500).tray("patty");
  const def = grill(sim);
  const cook = def.cookMs.patty!;
  sim.wait(cook + def.readyMs + 200);
  assert(
    slotPhase(def, sim.state.cookers.grill![0]!) === "over",
    "C11: left too long it is overcooked",
  );
  sim.wait(def.overMs);
  assert(
    slotPhase(def, sim.state.cookers.grill![0]!) === "burnt" &&
      sim.state.wasted === 1 &&
      sim.state.cooked === 1,
    "C12: then burnt, counted as wasted",
  );
  sim.grill(0);
  assert(
    sim.state.cookers.grill![0] === null && sim.state.wasted === 1,
    "C13: one tap clears burnt food (never counted twice)",
  );
  sim
    .tray("bun")
    .tray("patty")
    .wait(cook + def.readyMs + 200)
    .grill(0);
  assert(
    sim.state.plates[0]!.at(-1)?.quality === "over",
    "C14: an overcooked patty can still be served, as overcooked",
  );
  sim.plate(0);
  assert(sim.state.served === 1 && sim.state.perfect === 0, "C15: served, but not perfect");
  sim.tray("bun").tray("patty").wait(cook).grill(0).do({ kind: "bin" });
  assert(
    sim.state.plates[sim.state.selected]!.length === 0 && sim.state.wasted === 2,
    "C16: the bin empties the chosen plate and counts the cooked food on it as wasted",
  );
  assert(
    sim.do({ kind: "bin" }).hint()?.text === "Tap a plate, then the bin",
    "C17: the bin on an empty plate says what to do",
  );
}
{
  // RULE CHANGE (developer 2026-11-27, the Codex drink machine): each drink has its own machine (cola tap, lemonade tap, shake blender)
  const first = cookerOf(burgerKitchen(pace1), "drink")!;
  const full = cookerOf(burgerKitchen(paceFor(6)), "drink")!;
  assert(
    first.slots === 1 &&
      first.perSlot!.join() === "cola" &&
      full.slots === 3 &&
      full.perSlot!.join() === "cola,lemonade,milkshake",
    "C18: a machine a drink, left to right, as each drink joins the menu",
  );
  const shakes = new Sim(withOrders([{ items: [side("milkshake")] }], paceFor(6)));
  shakes.wait(500).do({ kind: "cooker", cooker: "drink", slot: 1 });
  shakes.do({ kind: "cooker", cooker: "drink", slot: 2 });
  assert(
    shakes.state.cookers.drink![1]?.item === "lemonade" &&
      shakes.state.cookers.drink![2]?.item === "milkshake",
    "C19: tapping a machine makes its own drink",
  );
  const sim = new Sim(withOrders([{ items: [side("cola")] }, { items: [side("cola")] }]));
  sim.wait(500).wait(pace1.arriveMs);
  sim.do({ kind: "cooker", cooker: "drink", slot: 0 }).wait(30_000 > 0 ? 3000 : 0);
  assert(
    sim.state.customers.length === 2 &&
      slotPhase(cookerOf(sim.round.kitchen, "drink")!, sim.state.cookers.drink![0]!) === "ready",
    "C20: a drink never spoils",
  );
  const longest = Math.min(...sim.state.customers.map((c) => c.id));
  sim.do({ kind: "cooker", cooker: "drink", slot: 0 });
  assert(
    sim.state.served === 1 &&
      !sim.state.customers.some((c) => c.id === longest) &&
      sim.state.cooked === 0,
    "C21: a finished item goes to whoever has waited longest (drinks do not count for accuracy)",
  );
}
{
  // where a topping lands
  const sim = new Sim(
    withOrders([{ items: [dish("patty", "lettuce")] }, { items: [dish("patty", "cheese")] }]),
  );
  sim.wait(500).wait(pace1.arriveMs).tray("bun").tray("bun");
  const kitchen = sim.round.kitchen;
  sim.state = {
    ...sim.state,
    plates: [
      [
        { item: "bun", quality: "good" },
        { item: "patty", quality: "good" },
        { item: "lettuce", quality: "good" },
      ],
      [
        { item: "bun", quality: "good" },
        { item: "patty", quality: "good" },
      ],
    ],
    selected: 0,
  };
  assert(
    targetPlate(kitchen, sim.state, "cheese") === 1,
    "C22: a topping goes to the plate where it leads to an order, not blindly to the chosen one",
  );
  sim.state = { ...sim.state, selected: 1 };
  assert(
    targetPlate(kitchen, sim.state, "lettuce") === 1,
    "C23: the chosen plate wins when it leads to an order too",
  );
  assert(sim.plate(0).state.served === 1, "C24: a finished plate is served at once, chosen or not");
  assert(sim.plate(1).state.selected === 1, "C25: tapping an unfinished plate chooses it");
}

console.log("D. Patience, combos, score, stars and power-ups");
{
  const sim = new Sim(
    withOrders([
      { items: [dish("patty")] },
      { items: [dish("patty")] },
      { items: [dish("patty")] },
    ]),
  );
  sim.wait(300);
  assert(sim.state.customers.length === 0, "D1: the first customer takes a moment to walk up");
  sim.wait(200);
  assert(sim.state.customers.length === 1, "D2: then arrives");
  const max = sim.state.customers[0]!.max;
  sim.wait(max + 100);
  assert(
    sim.state.lost >= 1 && sim.state.combo === 0 && sim.events.some((e) => e.type === "left"),
    "D3: a customer whose patience runs out leaves, and the combo breaks",
  );
  const one = new Sim(withOrders([{ items: [dish("patty")] }, { items: [dish("patty")] }]));
  one.wait(500);
  one.state = { ...one.state, customers: [] };
  one.wait(100);
  assert(
    one.state.customers.length === 1,
    "D4: an empty counter fills at once: the player is never left waiting",
  );
  assert(
    patienceFor(30000, [dish("patty"), side("fries")]) === 35000 &&
      patienceFor(30000, [dish("patty", "cheese", "lettuce", "tomato")]) >
        patienceFor(30000, [dish("patty")]),
    "D5: bigger orders are given longer",
  );
}
{
  const kitchen = burgerKitchen(pace1);
  const customer = (patience: number, quality: "good" | "over"): Customer => ({
    id: 0,
    seat: 0,
    max: 30000,
    patience,
    wants: [{ item: dish("patty"), done: true, quality }],
  });
  const plain = orderScore(kitchen, customer(0, "good"), 1);
  assert(plain === 100, "D6: a plain burger is 40 for the bun and 60 for the patty", plain);
  assert(
    orderScore(kitchen, customer(30000, "good"), 1) === 130,
    "D7: up to 30 % more for patience left",
  );
  assert(orderScore(kitchen, customer(0, "over"), 1) === 60, "D8: overcooked counts 60 %");
  assert(
    orderScore(kitchen, customer(0, "good"), 3) === 120 &&
      orderScore(kitchen, customer(0, "good"), 30) === 150,
    "D9: the combo grows by 0.1 an order, to x1.5 at most",
  );
}
{
  const sim = new Sim(withOrders([{ items: [dish("patty")] }]));
  sim.wait(500).tray("patty");
  sim.do({ kind: "power", power: "instant" });
  assert(
    slotPhase(grill(sim), sim.state.cookers.grill![0]!) === "ready" &&
      sim.state.powers.instant === 0,
    "D10: Cook now finishes what is cooking, once",
  );
  assert(
    sim.do({ kind: "power", power: "instant" }).hint()?.text === "Used up for this round",
    "D11: each power works once a round",
  );
  sim.wait(4000);
  const before = sim.state.customers[0]!.patience;
  sim.do({ kind: "power", power: "patience" });
  assert(
    sim.state.customers[0]!.patience > before,
    "D12: Patience gives the waiting customers some back",
  );
  sim.do({ kind: "power", power: "freeze" });
  const held = sim.state.customers[0]!.patience;
  sim.wait(FREEZE_MS - 500);
  assert(
    Math.abs(sim.state.customers[0]!.patience - held) < 1,
    "D13: Freeze stops patience (cooking goes on)",
  );
  sim.wait(1500);
  assert(sim.state.customers[0]!.patience < held, "D14: then it runs again");
}
{
  const round = burgerRound(pace1, 1);
  const base = { ...startState(round), score: 500, served: 5, cooked: 10, perfect: 10, done: true };
  const stars = (s: Partial<RoundState>, rival = 400) =>
    resultOf(round, { ...base, ...s }, rival).stars;
  assert(
    stars({}) === 3 &&
      stars({ lost: 1 }) === 2 &&
      stars({ perfect: 8 }) === 1 &&
      stars({ score: 399 }) === 0,
    "D15: stars: win; 90 % perfect; no one left",
  );
  assert(
    resultOf(round, base, 500).won && !resultOf(round, { ...base, score: 0, served: 0 }, 0).won,
    "D16: a tie is the player's; serving no one never wins",
  );
  assert(
    accuracyOf({ ...base, cooked: 0, perfect: 0 }) === 1 &&
      accuracyOf({ ...base, cooked: 4, perfect: 3 }) === 0.75,
    "D17: accuracy is perfect cooked food over all cooked food",
  );
}

console.log("E. Pure");
{
  const files = readdirSync("src/game/festival").map((f) => `src/game/festival/${f}`);
  const dirty = files.filter((f) => {
    const code = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    return /Math\.random|Date\.now|new Date\(|appendLedgerEntry|economyLedger|\.credits\b|purchaseIngredient|consumeUsableIngredients|persist\(|localStorage|window\./.test(
      code,
    );
  });
  assert(
    dirty.length === 0 && files.length >= 9,
    "E1: the festival rules use no random, clock, money, ledger, stock, storage or window",
    dirty,
  );
  const bad = files.filter((f) => /from "react"|from "@\/components/.test(readFileSync(f, "utf8")));
  assert(bad.length === 0, "E2: and no screen code", bad);
}

console.log("F. Three stages a festival");
// RULE CHANGE (developer 2026-11-28: "keep only 3 stages ... try to increase customers as players progress stages and festivals"): ten stages before
{
  const burger = FESTIVAL_EVENTS[0]!;
  const stages = [1, 2, 3];
  const grid = FESTIVAL_EVENTS.map((e) => stages.map((s) => stagePace(e.number, s)));
  assert(
    JSON.stringify(burger.menu) === JSON.stringify([1, 5, 10]) &&
      JSON.stringify(stages.map((s) => paceOfStage(burger, s).tier)) === "[1,5,10]",
    "F1: the Burger Festival's three stages go further down its menu each time",
  );
  assert(
    JSON.stringify(grid[0]!.map((p) => p.orders)) === "[5,8,11]" &&
      JSON.stringify(grid[14]!.map((p) => p.orders)) === "[19,22,25]" &&
      grid.every((row, e) =>
        row.every(
          (p, s) =>
            (s === 0 || p.orders === row[s - 1]!.orders + 3) &&
            (e === 0 || p.orders === grid[e - 1]![s]!.orders + 1),
        ),
      ),
    "F2: 3 more customers every stage, 1 more every festival at the same stage (Burger 5, 8, 11; the Championship 19, 22, 25)",
    grid.map((row) => row.map((p) => p.orders).join("/")),
  );
  const rises = (pick: (p: (typeof PACES)[number]) => number) =>
    grid.every((row, e) =>
      row.every(
        (p, s) =>
          (s === 0 || pick(p) >= pick(row[s - 1]!)) &&
          (e === 0 || pick(p) >= pick(grid[e - 1]![s]!)),
      ),
    );
  assert(
    rises((p) => p.atOnce) &&
      rises((p) => p.grillSlots) &&
      rises((p) => p.plates) &&
      JSON.stringify(grid[0]!.map((p) => p.atOnce)) === "[2,3,3]" &&
      JSON.stringify(grid[14]!.map((p) => p.atOnce)) === "[4,4,4]" &&
      Math.max(...grid.flat().map((p) => p.atOnce)) === 4,
    "F2b: waiting at once (2 to 4), burners and plates never fall, along a festival or from one to the next",
  );
  assert(
    rises((p) => -p.cookSpeed) && rises((p) => p.rivalShare) && rises((p) => -p.overMs),
    "F2c: nor does the timing ease: cooking, spoiling and the rival",
  );
  const quiet = stages.slice(1).filter((s) => {
    const n = stageNews(burger, s);
    return !(n.foods.length && n.grill && n.plate && n.customers === paceOfStage(burger, s).orders);
  });
  assert(
    quiet.length === 0 && !stageNews(burger, 1).foods.length,
    "F3: each later stage adds new food, a burner, a plate and more customers",
    quiet,
  );
  const counter = (s: number) => festivalRound(burger, 1, paceOfStage(burger, s))!.kitchen;
  const last = new Set<string>([
    ...counter(3).trays.map((t) => t.item),
    ...counter(3).cookers.flatMap((c) => Object.keys(c.cookMs)),
  ]);
  const left = Object.keys(BURGER_JOINS).filter((f) => !last.has(f));
  assert(left.length === 0, "F4: by the third stage every food of the kit is on the counter", left);
  const burners = stages.map((s) => cookerOf(counter(s), "grill")!.slots);
  assert(
    JSON.stringify(burners) === "[2,3,4]",
    "F5: two burners, then three, then all four",
    burners,
  );
  assert(
    stageWithBurners(burger, 3) === 2 &&
      stageWithBurners(burger, 4) === 3 &&
      stageWithBurners(burger, 5) === 0,
    "F6: a locked burner's tag names the stage that opens it (Stage 2, Stage 3)",
  );
}

console.log(failures ? `\nFESTIVAL RULES QA: ${failures} FAILED` : "\nFESTIVAL RULES QA: ALL PASS");
process.exit(failures ? 1 : 0);
