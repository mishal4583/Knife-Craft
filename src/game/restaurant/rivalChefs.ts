/**
 * THE RIVAL CHEFS (the "Chef Pride" plan, Phase 2, developer 2026-11-23: "the next restaurant to pass should be a person the player wants to beat").
 *
 * The city's 49 rival restaurants (restaurant/cityRanking.ts) each get a CHEF with a voice: one playful line while that restaurant is the next to pass
 * (`dare`), one when the player passes it (`beaten`) and, late in the game, one of RESPECT from the rival just behind the player (`respect`). Hand-written for every chef
 * (`dare`, `beaten`) and for the twelve the player meets last (`respect`); every other respect line, and any line a future rival is missing, comes from the cuisine and
 * district TEMPLATES below (picked by a fixed hash of the rival's id, so it never changes). Copy only: no save data, no money, no clock, no random.
 *
 * Tone rules (guardrails of the plan, enforced by `rival-chefs-qa`): the rival teases the SITUATION and brags about their own kitchen, never insults the player;
 * at most 70 characters per line; no population claim ("only 8% of chefs..."); no digits that pose as statistics.
 *
 * Where it shows: Restaurant Progress under "Next: pass ..." (`CityRankHero`), the Kitchen's rank card on a tall window, the celebration card when a rival
 * is passed (`celebrations.ts`) and, for the FEATURED rivals only (spaced a few levels apart so it never nags), one Paige message just before the level that passes
 * them (`assistant.ts` `rivalBeats`). All of it opens with the ranking news, from Level `RANKING_NEWS_FROM_LEVEL`.
 *
 * The names and lines are drafts for the developer to edit: change the text here, nothing else depends on it (the QA only checks length and tone).
 */

export type RivalChef = {
  /** The rival restaurant's id (cityRanking.ts `RIVAL_LIST`). */
  id: string;
  /** The chef's full name; the game says "Chef <first name>". */
  chef: string;
  /** Said while this restaurant is the next to pass. */
  dare: string;
  /** Said when the player passes it. */
  beaten: string;
  /** Said late in the game (the player in the city's top ten) by the rival just behind them: respect, never a jab. Hand-written for the last twelve rivals; the rest use a template. */
  respect?: string;
  /** Paige also announces this rival just before the level that passes them (a few, spaced out). */
  featured?: true;
};

export const RIVAL_CHEFS: readonly RivalChef[] = [
  {
    id: "corner-toast",
    chef: "Bea Marlow",
    dare: "Toast is easy. Come back when yours is perfect.",
    beaten: "Fine, you out-toasted me. Once.",
  },
  {
    id: "noodle-nook",
    chef: "Ken Ito",
    dare: "My noodles are long. Your patience had better be longer.",
    beaten: "Slurp. Well cut, chef.",
  },
  {
    id: "sunny-side",
    chef: "Dolly Ray",
    dare: "Eggs, hash, no mercy. Try to keep up.",
    beaten: "Okay, okay. You can have the corner booth.",
  },
  {
    id: "pita-pocket",
    chef: "Dario Haddad",
    dare: "Fast hands are cheap. Steady hands win services.",
    beaten: "...Nice plating. Don't get used to it.",
  },
  {
    id: "bean-there",
    chef: "Maya Osei",
    dare: "Bean There says you'll wobble in a full dining room.",
    beaten: "Fine. The coffee's on me. Just this once.",
  },
  {
    id: "salad-days",
    chef: "Luca Verde",
    dare: "Anyone can toss a salad. Can you cut one evenly?",
    beaten: "Even slices. I'm almost impressed.",
  },
  {
    id: "the-soup-pot",
    chef: "Hugo Brandt",
    dare: "Slow and steady wins the soup. Rushing loses it.",
    beaten: "Hmph. That was a decent broth, chef.",
  },
  {
    id: "taco-hut",
    chef: "Rosa Cruz",
    dare: "Taco Hut serves a hundred a night. Can you?",
    beaten: "Okay, you handle a rush. Respect.",
  },
  {
    id: "mamas-kitchen",
    chef: "Ines Alvarado",
    dare: "Mama Ines says you cook too fast to cook with love.",
    beaten: "Mama is proud. Don't tell anyone.",
    featured: true,
  },
  {
    id: "curry-corner",
    chef: "Arjun Rao",
    dare: "Spice takes patience. Do you have any?",
    beaten: "A fair hand with spice. You lead, for now.",
  },
  {
    id: "little-bistro",
    chef: "Claire Duval",
    dare: "Bistro rules: clean cuts or no table.",
    beaten: "Magnifique. Almost as clean as mine.",
    featured: true,
  },
  {
    id: "wok-n-roll",
    chef: "Jun Wei",
    dare: "The wok is hot. Is your timing?",
    beaten: "Fast and tidy. I'll allow it.",
  },
  {
    id: "green-fork",
    chef: "Tess Alder",
    dare: "Vegetables don't forgive sloppy cuts.",
    beaten: "Fresh work. The greens approve.",
    featured: true,
  },
  {
    id: "pasta-fresca",
    chef: "Gianni Moro",
    dare: "Fresh pasta, fresh rival. Try to keep up.",
    beaten: "Bravo. Now stay there if you can.",
  },
  {
    id: "harbor-grill",
    chef: "Nils Haugen",
    dare: "The sea is rough. Dinner service will be rougher.",
    beaten: "You rode the wave. Well sailed.",
    featured: true,
  },
  {
    id: "olive-and-fig",
    chef: "Selene Kallas",
    dare: "Mediterranean calm beats city rush every time.",
    beaten: "You kept your calm. I noticed.",
  },
  {
    id: "seoul-food",
    chef: "Min-jun Park",
    dare: "Seoul Food never sends out a messy plate.",
    beaten: "Tidy plates. We have a worthy rival.",
  },
  {
    id: "bangkok-bowl",
    chef: "Nok Siri",
    dare: "Sweet, sour, hot, salty. Can you balance them?",
    beaten: "Balanced. I'll remember your name.",
  },
  {
    id: "the-copper-pan",
    chef: "Etienne Roux",
    dare: "The Copper Pan has seen many newcomers. Impress me.",
    beaten: "The pan nods. Barely.",
    featured: true,
  },
  {
    id: "casa-verde",
    chef: "Elena Ruiz",
    dare: "Casa Verde dares you to keep the heat and the calm.",
    beaten: "You kept both. Muy bien.",
  },
  {
    id: "maple-and-sage",
    chef: "Wren Holloway",
    dare: "Everything on my menu grew nearby. What's your story?",
    beaten: "A good story, well told.",
  },
  {
    id: "spice-route",
    chef: "Samir Haddad",
    dare: "The route is long. Few arrive on time.",
    beaten: "You arrived. And on time.",
    featured: true,
  },
  {
    id: "luigis",
    chef: "Luigi Bianchi",
    dare: "Luigi's has fed this street for fifty years. Beat that.",
    beaten: "Fifty years, and you pass me in a season. Impressive.",
  },
  {
    id: "blue-anchor",
    chef: "Tom Marlin",
    dare: "Steady as an anchor. Can you say the same?",
    beaten: "You held your course. Fair winds.",
  },
  {
    id: "zen-garden",
    chef: "Haru Tanaka",
    dare: "A calm knife is a fast knife. Find your calm.",
    beaten: "Calm hands. I bow.",
    featured: true,
  },
  {
    id: "the-rustic-table",
    chef: "Walt Ferris",
    dare: "Plain food, no tricks. Harder than it looks.",
    beaten: "Plain and perfect. I respect it.",
  },
  {
    id: "saffron-house",
    chef: "Priya Nair",
    dare: "Saffron is costly. So is a wasted plate.",
    beaten: "No waste, good flavor. You earned it.",
  },
  {
    id: "petit-jardin",
    chef: "Odile Fontaine",
    dare: "Le Petit Jardin is delicate. Your knife must be too.",
    beaten: "Delicate indeed. Bravo.",
  },
  {
    id: "golden-ladle",
    chef: "Bram Kessler",
    dare: "Stew takes hours. Do you have the patience?",
    beaten: "You ladled that victory nicely.",
    featured: true,
  },
  {
    id: "hanami",
    chef: "Aiko Sato",
    dare: "Blossoms fall fast. Will your streak?",
    beaten: "Your blossoms lasted. Bravo.",
  },
  {
    id: "aegean-blue",
    chef: "Nikos Pappas",
    dare: "The Aegean is calm. Your rush hour won't be.",
    beaten: "You sailed through. Opa!",
  },
  {
    id: "jade-dragon",
    chef: "Lian Zhou",
    dare: "The dragon guards its place. Come and take it.",
    beaten: "The dragon bows. Briefly.",
  },
  {
    id: "hearth-and-ember",
    chef: "Rurik Dane",
    dare: "Fire doesn't forgive. Neither does Hearth & Ember.",
    beaten: "You stood the heat. Respect.",
    featured: true,
  },
  {
    id: "la-cantina",
    chef: "Mateo Salas",
    dare: "La Cantina Real is loud, proud and busy. Match it.",
    beaten: "You matched it. ¡Felicidades!",
  },
  {
    id: "the-orchard",
    chef: "Ivy Calder",
    dare: "The Orchard changes with the season. Can you?",
    beaten: "You adapt well. The season is yours.",
  },
  {
    id: "marigold",
    chef: "Kavya Menon",
    dare: "Modern Indian, old-school standards. Ready?",
    beaten: "Standards met. Marigold approves.",
  },
  {
    id: "silver-birch",
    chef: "Sven Lund",
    dare: "Nordic cooking is quiet and exact. Be exact.",
    beaten: "Quiet and exact. Well done.",
    featured: true,
  },
  {
    id: "trattoria-sole",
    chef: "Sofia Rinaldi",
    dare: "The Sole never rushes dinner. Never.",
    beaten: "You made time, and it showed.",
    respect: "You cook with heart, Chef. The Sole gives you its table.",
  },
  {
    id: "kimchi-house",
    chef: "Ji-ho Han",
    dare: "Kimchi House stays bold. Are you?",
    beaten: "Bold plates. You've earned your spot.",
    respect: "Fire, patience, balance. You have all three. Respect.",
  },
  {
    id: "the-velvet-spoon",
    chef: "Victor Alaric",
    dare: "The Velvet Spoon serves the city's finest. Prove it.",
    beaten: "The Spoon yields. Politely.",
    respect: "A velvet touch on every plate. Take a bow, Chef.",
    featured: true,
  },
  {
    id: "lotus-and-lime",
    chef: "Mali Chai",
    dare: "Lotus & Lime is bright and fast. Stay bright.",
    beaten: "Bright and fast. I'll try harder.",
    respect: "Bright, clean, kind. Lotus and Lime tips its hat.",
  },
  {
    id: "the-iron-chef",
    chef: "Brock Anders",
    dare: "The Iron Skillet has no soft edges. Neither do I.",
    beaten: "Hard edges, clean cuts. We're even.",
    respect: "I do not hand out praise. Consider this a salute.",
  },
  {
    id: "cedar-and-salt",
    chef: "Marin Cole",
    dare: "Coastal cooking is honest. Is your knife?",
    beaten: "Honest work. Salt of the earth.",
    respect: "Honest food, honest hands. You have earned your place.",
  },
  {
    id: "chez-margaux",
    chef: "Margaux Lenoir",
    dare: "Chez Margaux has standards. Are you ready for them?",
    beaten: "Standards met. I'm almost jealous.",
    respect: "Chez Margaux bows to you. And that is not easy.",
    featured: true,
  },
  {
    id: "kaiseki-mori",
    chef: "Takeshi Mori",
    dare: "Kaiseki is patience on a plate. Show yours.",
    beaten: "Patience and precision. I bow.",
    respect: "Patience and precision, still. I bow once more.",
  },
  {
    id: "the-grand-larder",
    chef: "Augustin Pell",
    dare: "The Grand Larder feeds a thousand. Can you?",
    beaten: "A thousand plates, no crumbs. Grand.",
    respect: "A thousand plates, and you never lost your calm. Grand.",
  },
  {
    id: "aurora",
    chef: "Freya Nystrom",
    dare: "Aurora's tasting menu has never missed a beat. Don't.",
    beaten: "Not one beat missed. Remarkable.",
    respect: "Not one beat missed, even up here. Remarkable.",
    featured: true,
  },
  {
    id: "the-crown-kitchen",
    chef: "Reginald Ashby",
    dare: "The Crown Kitchen wears its title lightly. Take it if you can.",
    beaten: "The crown slips. Wear it well.",
    respect: "The crown fits you. Wear it with kindness.",
  },
  {
    id: "maison-lumiere",
    chef: "Amelie Laurent",
    dare: "One star left in this city. Reach for it.",
    beaten: "Maison Lumière salutes you, Chef.",
    respect: "Maison Lumière shines brighter for knowing you.",
  },
];

const BY_ID: Map<string, RivalChef> = new Map(RIVAL_CHEFS.map((c) => [c.id, c]));

/** The chef of a rival restaurant, or undefined for an id the list does not know. */
export const rivalChefOf = (rivalId: string): RivalChef | undefined => BY_ID.get(rivalId);

/** "Chef Dario": what the game calls them. */
export const chefCallName = (c: RivalChef): string => `Chef ${c.chef.split(" ")[0]}`;

/** `Chef Dario: “…”`, a line as shown on a card. */
export const chefSays = (c: RivalChef, kind: "dare" | "beaten"): string =>
  `${chefCallName(c)}: “${c[kind]}”`;

/** The rival chefs Paige also announces (a few, spaced out). */
export const FEATURED_RIVALS: readonly RivalChef[] = RIVAL_CHEFS.filter((c) => c.featured);

// ── Respect, and the template path ───────────────────────────────────────────

/** The respect line shows from this city rank up (the player in the top ten): late in the game, from the rival just behind them. */
export const RESPECT_FROM_RANK = 10;

/** What a template needs to know about a rival restaurant (cityRanking.ts `Rival`). */
export type RivalFacts = { id: string; name: string; cuisine: string; district: string };

export type RivalKind = "dare" | "beaten" | "respect";

/** The cuisine families the templates are written for, matched on the rival's cuisine text (first match wins). */
const FAMILIES: readonly (readonly [string, RegExp])[] = [
  ["french", /french|bistro|brasserie|haute/i],
  ["italian", /ital|pizza|pasta/i],
  ["asian", /chin|korea|japan|thai|noodle|sushi|ramen|viet|asian/i],
  ["indian", /indian|curry/i],
  ["mexican", /mexic|latin|taco/i],
  ["mediterranean", /greek|mediterr|middle|lebanese|turk/i],
  ["fine", /fine|chef's table|modern classic|tasting|coastal|seafood/i],
  ["cafe", /caf|bakery|coffee|breakfast/i],
  ["comfort", /diner|home|country|farm|street|grill|bbq|comfort/i],
];

/** The cuisine family of a rival, or "default". */
export const familyOf = (cuisine: string): string =>
  FAMILIES.find(([, re]) => re.test(cuisine))?.[0] ?? "default";

/** Two respect lines per cuisine family; `{name}` is the restaurant, `{district}` its district. */
export const RESPECT_TEMPLATES: Record<string, readonly [string, string]> = {
  french: ["{name} salutes you, Chef. Magnifique.", "Even {district} knows your name now. Bravo."],
  italian: [
    "Bravo, Chef. {name} would seat you anywhere.",
    "Pure {district} pride on that plate. Bravissimo.",
  ],
  asian: [
    "Sharp knife, steady heart. {name} bows to you.",
    "You earned this view, Chef. Well cut.",
  ],
  indian: [
    "Every spice in its place. {name} honours you.",
    "{district} will remember your cooking, Chef.",
  ],
  mexican: [
    "What flavour! {name} raises a glass to you.",
    "You cook with fire and heart. Respect, Chef.",
  ],
  mediterranean: [
    "Sun, salt and skill. {name} salutes you.",
    "{district} tips its hat to you, Chef.",
  ],
  fine: ["{name} is honoured to look up to you.", "Refined, calm, precise. Respect, Chef."],
  cafe: [
    "Warm plates, warm hearts. {name} toasts you.",
    "Well earned, Chef. The coffee is on {name}.",
  ],
  comfort: ["You made good food feel like home. Respect.", "{name} is proud to be passed by you."],
  default: ["{name} respects your cooking, Chef.", "Well earned, Chef. {district} is proud."],
};
export const DARE_TEMPLATES: readonly [string, string] = [
  "{name} holds {district}. Come and take it, Chef.",
  "{district} is watching. Do not wobble, Chef.",
];
export const BEATEN_TEMPLATES: readonly [string, string] = [
  "You passed {name}. Fair and square.",
  "{district} has a new favourite. Well done.",
];

/** A small fixed hash of a text (FNV-1a): the same rival always gets the same template. */
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

const fill = (t: string, r: RivalFacts): string =>
  t.replace("{name}", r.name).replace("{district}", r.district);

/** The TEMPLATE line of a rival: by its cuisine family and district, one of two, chosen by a fixed hash of its id. Deterministic; never blank. */
export function templateLine(kind: RivalKind, r: RivalFacts): string {
  const pair =
    kind === "respect"
      ? (RESPECT_TEMPLATES[familyOf(r.cuisine)] ?? RESPECT_TEMPLATES["default"]!)
      : kind === "dare"
        ? DARE_TEMPLATES
        : BEATEN_TEMPLATES;
  return fill(pair[hash(`${kind}:${r.id}`) % 2]!, r);
}

/** The line a chef says: their own hand-written one, else the template (so no rival is ever blank). */
export const rivalLine = (kind: RivalKind, chef: RivalChef | undefined, r: RivalFacts): string =>
  (chef?.[kind] || undefined) ?? templateLine(kind, r);

/** `Chef Claire: “…”`: the respect line of a rival chef, hand-written or templated. */
export const chefRespects = (c: RivalChef, r: RivalFacts): string =>
  `${chefCallName(c)}: “${rivalLine("respect", c, r)}”`;
