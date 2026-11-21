# Kitchen home in a wide window: what is built, and the one thing Codex can still add (developer 2026-11-21)

Reference: `docs/planning/reference/kitchen-home-mockup-2026-11-21.png` (the developer's concept).

## What is already built in code (no art needed)

In a wide window at least 520 px tall (the `landx` variant, `styles.css`); a phone on its side and the upright phone keep their old look:

- **Left rail:** a wooden panel with a gold edge and vine sprigs, a wider rail (108 px), three big rounded tiles (Kitchen lit in gold when it is the active place, Market and Restaurant dark with a gold rim and the red "!" badge), the place's name in the display font.
- **Top row:** City Ranking and Daily Gift cards (gift days as round gold tokens), the "$ on the table - Collect" pill as a gold pill of its own, the wallet and the round settings button.
- **Day pill** with a calendar icon.
- **Next Customer card:** wider, with the dish's own painted plate on its left edge (`public/dishes/`, the 221 dish pictures), a people icon on "Next customer", gold corner flourishes, the ingredient circle, and the green "Open for service" button with a bell icon.

## What Codex can add: the rail's three place icons (optional)

Today the tiles show the game's painted emoji icons (a house, a cart, a plate). The concept has bigger painted pictures: a chef's hat, a crate of vegetables, a laid table with two chairs. Send ONE prompt per icon, with the concept attached, and save each as a **512 x 512 transparent PNG**:

| Save as | Prompt |
|---|---|
| `Nav Icons Assets/kitchen.png` | `A single game-UI icon on a fully transparent background, 512 x 512 px: a tall white chef's toque (hat) with soft folds, glossy storybook painting, thin darker outline, warm light from the upper left, a soft shadow under it, centred, filling about 80 % of the square. No text, no frame, no background. Same style as the attached concept's "Kitchen" icon.` |
| `Nav Icons Assets/market.png` | `A single game-UI icon on a fully transparent background, 512 x 512 px: a small open wooden crate full of fresh vegetables (tomatoes, a carrot, a leafy green, a lemon), glossy storybook painting, thin darker outline, warm light from the upper left, a soft shadow under it, centred, filling about 80 % of the square. No text, no frame, no background. Same style as the attached concept's "Market" icon.` |
| `Nav Icons Assets/restaurant.png` | `A single game-UI icon on a fully transparent background, 512 x 512 px: a small round dining table with a white tablecloth, two wooden chairs, a plate and a candle, seen from slightly above, glossy storybook painting, thin darker outline, warm light from the upper left, a soft shadow under it, centred, filling about 80 % of the square. No text, no frame, no background. Same style as the attached concept's "Restaurant" icon.` |

When they are saved, tell me "nav icons are generated": I cut them to 160 px webp into `public/nav/`, list the ids in `src/game/navArt.ts`, and the rail shows them (until then it shows the existing icons; nothing waits on the art).

## Not built: the round menu button at the rail's bottom

The concept has a round "hamburger" button at the bottom of the rail. The game has no menu behind it today (Progress, Business, Inventory and Settings are reached from the Kitchen's own buttons). Tell me what it should open and I add it.
