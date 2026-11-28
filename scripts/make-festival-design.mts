/**
 * Writes the design sheet of all 45 festival levels from the game's own data, so it can never disagree with what is played:
 * docs/planning/FESTIVAL-ALL-LEVELS-DESIGN-2026-11-28.md. Run: npx tsx scripts/make-festival-design.mts
 */
import { writeFileSync } from "node:fs";
import { FESTIVAL_EVENTS, paceOfStage, stageNews } from "../src/game/festival/events.ts";
import { menuKitchen } from "../src/game/festival/menu.ts";
import { MENU_FOODS, menuOf } from "../src/game/festival/menus.ts";
import { rivalChefOf } from "../src/game/restaurant/rivalChefs.ts";
import { RIVALS } from "../src/game/restaurant/cityRanking.ts";

const OUT = "docs/planning/FESTIVAL-ALL-LEVELS-DESIGN-2026-11-28.md";
const name = (id: string) => MENU_FOODS.get(id) ?? id;
const list = (ids: readonly string[]) => ids.map(name).join(", ");

const sections = FESTIVAL_EVENTS.map((event) => {
  const menu = menuOf(event.id)!;
  const rows = [1, 2, 3].map((stage) => {
    const pace = paceOfStage(event, stage);
    const kitchen = menuKitchen(menu, pace);
    const rival = event.rivals[stage - 1]!;
    const chef = rivalChefOf(rival)?.chef ?? "";
    const stall = RIVALS.find((r) => r.id === rival)?.name ?? "";
    const foods = [
      ...kitchen.trays.map((t) => t.item),
      ...kitchen.cookers.flatMap((c) => c.perSlot ?? []),
    ];
    const adds = stage === 1 ? list(foods) : `+ ${list(stageNews(event, stage).foods)}`;
    return `| ${stage} | ${chef} (${stall}) | ${pace.orders} | ${pace.atOnce} | ${pace.grillSlots} | ${(pace.patienceMs / 1000).toFixed(0)} s | ${adds} |`;
  });
  const how = menu.bake
    ? `**Put everything on the raw ${menu.base.name.toLowerCase()}, bake the whole ${menu.dish} in the ${menu.hot.toLowerCase()}, take it out and it is served.**`
    : `Start with the ${menu.base.name.toLowerCase()}; cook ${list(menu.mains.map((m) => m.id))} on the ${menu.hot.toLowerCase()} and lay one on it; add the cold toppings and sauces; tap the finished ${menu.dish} to serve.`;
  return [
    `## ${event.number}. ${event.emoji} ${event.name}`,
    "",
    how,
    `Side: ${name(menu.side.id)} (${menu.fry.toLowerCase()}). Drinks: ${list(menu.drinks.map((d) => d.id))}.${menu.always ? ` Every ${menu.dish} has ${menu.always.map((g) => `one of ${list(g)}`).join(" and ")} (once on the menu).` : ""}${menu.double ? ` Later stages may ask for a second ${name(menu.mains[0].id).toLowerCase()}.` : ""}`,
    "",
    "| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |",
    "|---|---|---:|---:|---:|---:|---|",
    ...rows,
    "",
  ].join("\n");
});

const head = `# The 45 festival levels (developer 2026-11-28: "design for all the levels and build")

Written by \`scripts/make-festival-design.mts\` from the game's data (do not edit by hand; change \`src/game/festival/\` and run it again).

## One kitchen shape
Every festival has the same fifteen places, so the sorted stall, the stage ramp and the fairness proof hold for all of them: a **base**, three
**mains** (cooked on the hot station), five **toppings**, two **sauces**, one **side** (the second cooker) and three **drinks**. A food keeps its
place at every stage; what a stage has not got waits there, locked. Burger keeps exactly the rounds it had. A new festival starts further down its
menu (its food is new, the player is not). Toppings go on after cooking, except **Pizza**, which has its own step: the oven.

**Difficulty:** the ramp is the one in \`tiers.ts\` (unchanged). The simulated player (festival-rival-qa E5) wins all 45 levels at one tap every
0.8 s (98-100 %). At one tap every 1.2 s it wins the early festivals every time, but from about the ninth festival the second and third stages are
mostly lost: **play the late festivals on a real phone and say if they are too fast.** Unlocks: Burger at Level 10; each next festival after the
third stage of the one before and 10 more services.

`;
writeFileSync(OUT, head + sections.join("\n"));
console.log(`${OUT}: ${sections.length} festivals`);
