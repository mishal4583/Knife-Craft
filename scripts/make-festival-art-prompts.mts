/**
 * Writes the Codex art prompts for the fourteen festivals after the Burger's, from the menus themselves, so every file name and size is what the game
 * will look for: docs/planning/FESTIVAL-ALL-ART-CODEX-PROMPTS-2026-11-28.md. A food shared by two festivals is asked for once, in the first. A food
 * the Burger kit already painted is not asked for.
 *
 * Run: npx tsx scripts/make-festival-art-prompts.mts
 */
import { writeFileSync } from "node:fs";
import { FESTIVAL_EVENTS } from "../src/game/festival/events.ts";
import { FESTIVAL_MENUS } from "../src/game/festival/menus.ts";
import { FOOD_LOOKS } from "../src/components/kc/festival/foodLooks.ts";

const OUT = "docs/planning/FESTIVAL-ALL-ART-CODEX-PROMPTS-2026-11-28.md";
const FOLDER = "D:\\WORKS\\GAMES\\Knife Craft\\Festival competition assets\\gameplay";

type Job = { file: string; size: string; what: string };

const done = new Set<string>();
const cookwareDone = new Set<string>();
const sections: string[] = [];
let total = 0;

for (const menu of FESTIVAL_MENUS.slice(1)) {
  const event = FESTIVAL_EVENTS.find((e) => e.id === menu.id)!;
  const jobs: Job[] = [];
  const ask = (file: string, size: string, what: string) => {
    if (done.has(file)) return;
    done.add(file);
    jobs.push({ file, size, what });
  };
  /** Only foods with no painted picture yet. */
  const drawn = (id: string) => id in FOOD_LOOKS;

  for (const food of [menu.base, ...menu.mains, ...menu.toppings]) {
    if (!drawn(food.id)) continue;
    ask(
      `tray_${food.id}.png`,
      "400 x 266",
      `a shallow metal kitchen pan holding ${food.name.toLowerCase()}, ready to pick up${food === menu.base ? " (the plain base, uncooked or undressed)" : menu.mains.includes(food as never) && !menu.bake ? " (RAW)" : ""}`,
    );
  }
  for (const food of menu.sauces)
    if (drawn(food.id))
      ask(
        `tray_${food.id}.png`,
        "130 x 320",
        `a squeeze bottle of ${food.name.toLowerCase()}, standing, no label`,
      );
  for (const food of [menu.base, ...menu.mains, ...menu.toppings, ...menu.sauces]) {
    if (!drawn(food.id)) continue;
    const isBase = food === menu.base;
    const isSauce = menu.sauces.includes(food as never);
    ask(
      `layer_${food.id}.png`,
      "400 x 400",
      isBase
        ? `the ${menu.dish}'s base (${food.name.toLowerCase()}) alone, seen from the camera angle, filling the width, centred`
        : `${food.name.toLowerCase()} exactly as it lies ON TOP of a ${menu.dish} (${isSauce ? "a poured drizzle, no bottle" : menu.mains.includes(food as never) ? "COOKED" : "a flat layer of pieces"}), nothing under it, centred`,
    );
    if (!isBase)
      ask(
        `chip_${food.id}.png`,
        "144 x 110",
        `a small, bold picture of ${food.name.toLowerCase()} for a customer's order bubble; it must be easy to tell from the other toppings of this festival`,
      );
  }
  if (!menu.bake)
    for (const food of menu.mains)
      if (drawn(food.id))
        for (const [state, say] of [
          ["raw", "raw"],
          ["cooking", "half cooked, starting to brown"],
          ["cooked", "perfectly cooked"],
          ["burnt", "burnt black"],
        ] as const)
          ask(
            `meat_${food.id}_${state}.png`,
            "400 x 310",
            `${food.name.toLowerCase()} on the ${menu.hot.toLowerCase()}, ${say}; the SAME shape, size and position in all four pictures`,
          );
  if (drawn(menu.side.id)) {
    for (const [state, say] of [
      ["raw", "raw"],
      ["golden", "golden and ready"],
      ["burnt", "burnt black"],
    ] as const)
      ask(
        `basket_${menu.side.id}_${state}.png`,
        "394 x 440",
        `a wire fryer basket with a red handle holding ${menu.side.name.toLowerCase()}, ${say}; the SAME basket in the same place in all three`,
      );
    ask(
      `side_${menu.side.id}.png`,
      "302 x 360",
      `one serving of ${menu.side.name.toLowerCase()} in a paper carton or small dish, as it is handed to a customer`,
    );
  }
  for (const food of menu.drinks)
    if (drawn(food.id))
      ask(
        `cup_${food.id}.png`,
        "196 x 360",
        `a clear take-away cup of ${food.name.toLowerCase()} with a lid and straw, full`,
      );
  if (menu.hot === "Oven" && !cookwareDone.has("Oven")) {
    cookwareDone.add("Oven");
    ask(
      "station_oven.png",
      "1120 x 848",
      "a small brick oven seen from the front with a wide open mouth showing FOUR empty baking places on two shelves. Centre the four places at these points (fraction of width, height): back row (0.32, 0.23) and (0.67, 0.23); front row (0.31, 0.53) and (0.69, 0.53)",
    );
  }
  if (["Pot", "Wok", "Pan", "Tawa"].includes(menu.hot))
    ask(
      `cookware_${menu.hot.toLowerCase()}.png`,
      "400 x 280",
      `one empty ${menu.hot === "Pot" ? "pot of simmering water" : menu.hot === "Tawa" ? "flat Indian tawa griddle pan" : menu.hot.toLowerCase()} seen from above at the camera angle, to stand on a stove ring under the food`,
    );

  total += jobs.length;
  sections.push(
    `## ${event.number}. ${event.name} (${jobs.length} pictures)\n\n` +
      "```\n" +
      `KnifeCraft Festival gameplay art: ${event.name}. ART ONLY. Do not write or change any code.\n` +
      `Save into: ${FOLDER}\\${menu.id}\\\n` +
      "Use the attached pictures of the Burger Festival stall and kit as the style and camera reference, and follow the RULES at the top of this file.\n\n" +
      jobs
        .map((j, i) => `${String(i + 1).padStart(2)}. ${j.file}  (${j.size})  ${j.what}`)
        .join("\n") +
      "\n\nWhen all are saved, list every file with its real size, and check each one on a dark background for halos or leftover background.\n" +
      "```\n",
  );
}

const head = `# Codex art prompts: the fourteen new festivals (2026-11-28)

Written by \`scripts/make-festival-art-prompts.mts\` from the menus (do not edit by hand; run the script again). ${total} pictures in all. **Nothing waits
for them:** every festival is playable now with plain drawn food, and a picture takes its place when it is integrated. Make **one festival at a
time**, in order, so a style problem is caught early. Attach to each prompt: a screenshot of the Burger Festival stall (for style and camera) and a
screenshot of that festival as it is now (from \`Festival Screenshots/\`, to show what each thing is).

## RULES FOR EVERY FILE (paste with every prompt)

\`\`\`
1. One picture per file, with exactly the file name and pixel size given. Never cut a file out of a sheet or grid.
2. PNG with a TRUE transparent background (real alpha; no painted checkerboard, no white or coloured box).
3. One object, with at most a small soft contact shadow. The whole object inside the canvas, filling about 80 % of it (a layer fills the width).
4. No text, letters, numbers or logos.
5. The same glossy 3D cartoon style as the Burger Festival kit. Every pan, station, cooking food and plate layer is seen from the SAME camera:
   looking down about 50 degrees, straight from the front, soft light from the top left.
6. After saving a file, open it and check it shows what its name says.
\`\`\`

`;
writeFileSync(OUT, head + sections.join("\n"));
console.log(`${OUT}: ${total} pictures in ${sections.length} festivals`);
