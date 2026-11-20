/**
 * PAINTED PICTURES IN PLACE OF AN ICON (developer 2026-11-20: "use proper emojis or assets throughout the game"). Playgama 4.3.2 does not allow an emoji where an icon
 * belongs, and the line icons of `emojiIcons.ts` stood in for them; the developer wants the game's own coloured, painted pictures instead. `iconFor` looks here FIRST:
 * an emoji with a painting is drawn as that painting (an `<img>`, 1.4 em), everything else keeps its line icon until its painting arrives.
 *
 * Two sources:
 *  - the 160 px ingredient paintings that already exist (`public/business/ingredients/`), for the foods whose emoji they depict faithfully;
 *  - the icon sheets Codex paints (`docs/planning/ICON-PAINTED-ASSETS-CODEX-PROMPTS-2026-11-20.md`), built by `scripts/make-icon-assets.py` into `public/icons/<name>.webp`.
 *    Add a line to `ICON_FILES` when a picture is delivered (the name is the file's name, no extension).
 *
 * Keys are emoji with no variation selector and no skin tone (like `EMOJI_ICONS`).
 */
const INGREDIENT: Readonly<Record<string, string>> = {
  "🍅": "tomato",
  "🥔": "potato",
  "🧅": "onion",
  "🧄": "garlic",
  "🧀": "cheddar",
  "🫑": "pepper",
  "🍄": "mushroom",
  "🥒": "cucumber",
  "🥭": "mango",
  "🥦": "broccoli",
  "🥑": "avocado",
  "🌶": "chilli",
  "🌽": "corn",
  "🍍": "pineapple",
  "🍆": "eggplant",
  "🎃": "pumpkin",
  "🥥": "coconut",
  "🍠": "sweetpotato",
  "🍑": "peach",
  "🥝": "kiwi",
  "🍐": "pear",
  "🍓": "strawberry",
  "🍉": "watermelon",
  "🥕": "carrot",
  "🥬": "lettuce",
  "🍎": "apple",
  "🍋": "lemon",
  "🍊": "orange",
  "🍇": "grapes",
  "🥖": "baguette",
  "🍞": "bread",
  "🧈": "butter",
  "🫛": "peapod",
  "🥩": "steak",
  "🐟": "salmon",
  "🫚": "ginger",
  "🌿": "basil",
};

/** Delivered icon pictures: emoji -> file name in `public/icons/` (none yet; see the Codex list). */
export const ICON_FILES: Readonly<Record<string, string>> = {};

const base = (): string => import.meta.env?.BASE_URL ?? "/";

/** The painted picture's URL for an emoji (normalised), or null when it has none yet. */
export function paintedFor(key: string): string | null {
  const own = ICON_FILES[key];
  if (own) return `${base()}icons/${own}.webp`;
  const food = INGREDIENT[key];
  if (food) return `${base()}business/ingredients/${food}.webp`;
  return null;
}

/** Every emoji that has a painting, for the QA. */
export const PAINTED_EMOJI: readonly string[] = [
  ...Object.keys(INGREDIENT),
  ...Object.keys(ICON_FILES),
];
