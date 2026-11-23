/**
 * THE RIVAL CHEFS (the "Chef Pride" plan, Phase 2, developer 2026-11-23: "the next restaurant to pass should be a person the player wants to beat").
 *
 * The city's 49 rival restaurants (restaurant/cityRanking.ts) each get a CHEF with a voice: one playful line while that restaurant is the next to pass
 * (`dare`), and one when the player passes it (`beaten`). Copy only: no save data, no money, no clock, no random (the lines are fixed text).
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
  },
  {
    id: "kimchi-house",
    chef: "Ji-ho Han",
    dare: "Kimchi House stays bold. Are you?",
    beaten: "Bold plates. You've earned your spot.",
  },
  {
    id: "the-velvet-spoon",
    chef: "Victor Alaric",
    dare: "The Velvet Spoon serves the city's finest. Prove it.",
    beaten: "The Spoon yields. Politely.",
    featured: true,
  },
  {
    id: "lotus-and-lime",
    chef: "Mali Chai",
    dare: "Lotus & Lime is bright and fast. Stay bright.",
    beaten: "Bright and fast. I'll try harder.",
  },
  {
    id: "the-iron-chef",
    chef: "Brock Anders",
    dare: "The Iron Skillet has no soft edges. Neither do I.",
    beaten: "Hard edges, clean cuts. We're even.",
  },
  {
    id: "cedar-and-salt",
    chef: "Marin Cole",
    dare: "Coastal cooking is honest. Is your knife?",
    beaten: "Honest work. Salt of the earth.",
  },
  {
    id: "chez-margaux",
    chef: "Margaux Lenoir",
    dare: "Chez Margaux has standards. Are you ready for them?",
    beaten: "Standards met. I'm almost jealous.",
    featured: true,
  },
  {
    id: "kaiseki-mori",
    chef: "Takeshi Mori",
    dare: "Kaiseki is patience on a plate. Show yours.",
    beaten: "Patience and precision. I bow.",
  },
  {
    id: "the-grand-larder",
    chef: "Augustin Pell",
    dare: "The Grand Larder feeds a thousand. Can you?",
    beaten: "A thousand plates, no crumbs. Grand.",
  },
  {
    id: "aurora",
    chef: "Freya Nystrom",
    dare: "Aurora's tasting menu has never missed a beat. Don't.",
    beaten: "Not one beat missed. Remarkable.",
    featured: true,
  },
  {
    id: "the-crown-kitchen",
    chef: "Reginald Ashby",
    dare: "The Crown Kitchen wears its title lightly. Take it if you can.",
    beaten: "The crown slips. Wear it well.",
  },
  {
    id: "maison-lumiere",
    chef: "Amelie Laurent",
    dare: "One star left in this city. Reach for it.",
    beaten: "Maison Lumière salutes you, Chef.",
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
