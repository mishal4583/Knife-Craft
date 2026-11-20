/**
 * COLOURED LINE ICONS (developer 2026-11-21: "fix these black emojis issues ... find out all the pages with this issue and fix each and every one"). Until the painted icons arrive
 * (`paintedIcons.ts`, `docs/planning/ICON-PAINTED-ASSETS-CODEX-PROMPTS-2026-11-20.md`), every line icon of `emojiIcons.ts` was drawn in its text's colour, which is black on a cream
 * card: a big black coffee cup on a machine card looked like a missing picture. Now each icon gets the colour of the thing it stands for (a carrot orange, a drop blue, a heart red),
 * drawn over a thin dark outline so it reads on cream, wood and dark walnut alike. The colour is a plain table, by the emoji; an emoji not listed gets `DEFAULT`.
 */
const GROUPS: ReadonlyArray<readonly [string, string]> = [
  // reds
  ["#E5483E", "❤♥🍎🍒⛔🚫❓❔💥🎁📌📍🧲🎗🌡📉🚽🏁🍷🍾🥂🍶🥩⭕"],
  // oranges and warm foods
  ["#F08A24", "🔥🥕🍕🍗🍔🥐🍰🍳🥘🍲🥣🍜🍛☕🥤🍽🍴🥄🍊🌅☀🍦🥜🥚🍬🛒🧺🥡🛍🎉🎊🔔🛎🏃🚶🎵🍟"],
  // yellows and golds
  ["#E8B12A", "⭐🌟✨🏆🥇🎖🏅👑💰🪙💸💡⚡🏷📣🎯🌼🌻🏵🌙⌛⏳🧮⚖🕒⏱🍋🍯🥈🥉🙂😊😍😋😌😐🧽⚠🧹"],
  // greens
  ["#4FA33F", "💵✅🌿🍃🌱🪴🥬🥗♻🌲📈🟢🍏"],
  // blues and water
  [
    "#3F8EE8",
    "💳♾💧🧼🫧❄🧊🥛🧴🫙🪣🚻🌤🌀🔎🔍👀🕵ℹ🧪🐟🍣🍤🚗🚙🌍🗺🧭📊🔁⏸▶⏩⬆⬇↩➡➜➔🔜📱📺🎮💬🤖🏠🏬🏪🏙🌆📋📒📖📜📄📃📝💾🧾📅📆🗓",
  ],
  // pinks
  ["#E86A9A", "🌸🌷💐🥀🤍🍓😟🙁😬😤"],
  // purples
  ["#9A5BD0", "🍇🎨🎲🎛🍆"],
  // browns and wood
  ["#B8743A", "🪵🪑💺🚪🗄📦🥖🍞🏗🏛🚚🧻"],
  // people and hands
  ["#E0955A", "👤👥🧑👩👨👵👴👱🧔🧕👦🙎🙋🤵🤝👋✋👏👆👇👉🧤🦱"],
  // steel
  ["#8FA3B8", "📸🎬⬜🔪🗡🪓✂🔧🛠⚒🔨🧰⚙🛡🔒🔓🗑⚓📏📐🔆🏛🪶🧂🥢"],
];

const DEFAULT = "#5B8FD0";
const TABLE = new Map<string, string>();
for (const [color, list] of GROUPS) for (const ch of Array.from(list)) TABLE.set(ch, color);

/** The colour of an icon: the table's, else the default. `key` is the emoji as `emojiIcons.ts` stores it (no variation selector). */
export function iconColorFor(key: string): string {
  return TABLE.get(key) ?? TABLE.get(Array.from(key)[0] ?? "") ?? DEFAULT;
}

/** Whether an emoji has its own colour in the table (the QA counts the ones that fall back to the default). */
export const ICON_TABLE_HAS = (key: string): boolean =>
  TABLE.has(key) || TABLE.has(Array.from(key)[0] ?? "");

/** The dark rim drawn under every coloured icon, so it stands off a cream card and off dark wood. */
export const ICON_RIM = "#33200f";
