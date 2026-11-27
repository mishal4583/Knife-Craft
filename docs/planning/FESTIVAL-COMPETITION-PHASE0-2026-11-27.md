# Festival Fast Food Competition: Phase 0 report (2026-11-27)

**Status (updated 2026-11-27):** the developer approved. DECISIONS: 1 yes (rename, manifest, gitignore, Phase 1 + a plain-art Burger round while Codex works); 2 use the game's rivals; 3 "do whatever is best" (the gap counted after the festival before is played, as proposed); 4 "start from 5 or something, then gradually increase the toughness (reduce the cooking time and all and add more customers if possible, don't let players wait too much time)"; 5 "do whatever necessary" (`business.festivals`). Step 0b, Phase 1 and Phase 2a are BUILT (see REFERENCE "The Festival Fast Food Competition").

**Where the build differs from the design below:** customers at once go up to **4** (not 3; events 1-2: 2, 3-7: 3, 8-15: 4), shown in both layouts and 48 px safe; burgers carry at most **3 toppings**; patience grows with the order's size; the rival's final score is **52-68 %** of a fast simulated player's (not 55-85 %), tuned so a tap each 0.8 s wins every pace; the Mini-games entry is a **full-width card** (not a ninth tile); there is no Paige unlock line yet; a plate has a **bin** and burnt food is tapped away.

**Original status:** audit and design only. No game code was changed and no existing art file was touched (one check picture was added: `Festival competition assets/previews/wrong_names_check.png`).

## Verdict

- **The art style is good** and matches the reference. **The asset library is not ready to build from.**
- 26 of the 95 dish files show a different dish from their name.
- The kitchen kit a cooking game needs is missing: raw and burnt food, empty stations, food in its trays, stackable burger layers, and upright (phone) backgrounds.
- **The plan is buildable**, with the changes in section 3. Phase 1 and a plain-art Burger round can start now, while Codex makes the Burger kit.

## 1. Asset check

Checked by script (every PNG: size, transparency, edges, duplicates) and by eye (contact sheets of every picture).

### 1.1 What is there

| Category | Files | Note |
|---|---:|---|
| Backgrounds | 15 | 1920×1080, all different, good. **Landscape only** |
| Finished dishes | 95 | 26 wrongly named |
| Ingredients | 73 | 16 have a grey-white haze |
| Customers | 36 | 20 single poses + 4 four-mood sets |
| Rival chefs | 24 | 4 with four poses + 8 single |
| Player staff | 20 | not needed by the plan's gameplay |
| Equipment | 28 | many have food drawn into them |
| Trays and containers | 20 | all empty |
| UI icons / power-ups / effects | 32 / 20 / 20 | good quality |
| Props / celebration / pointers | 20 / 14 / 2 | |
| **Total** | **419 PNG, 270 MB** (with sheets) | |

### 1.2 Defects

**A. 26 wrong dish names.** It looks like cut-up 2×2 sheets were saved into the next folder. Picture: `Festival competition assets/previews/wrong_names_check.png`. Every right picture exists, only under a wrong name or folder, so this needs **renaming, not new art**:

| Folder | File now (`food_….png`) | The picture shows | Should be |
|---|---|---|---|
| 07 | `avocado_greens_bowl` | grilled corn | 08 / `grilled_corn` |
| 07 | `rainbow_quinoa_bowl` | BBQ ribs | 08 / `bbq_ribs` |
| 08 | `bbq_chicken_skewers` | spinach ravioli with butter | 09 / `spinach_ravioli` |
| 08 | `bbq_ribs` | spaghetti with tomato and basil | 09 / `spaghetti_marinara` |
| 08 | `grilled_corn` | creamy penne | 09 / `creamy_penne` |
| 08 | `grilled_sausage_plate` | lasagna slice | 09 / `lasagna_slice` |
| 09 | `creamy_penne` | shrimp rice bowl | 10 / `shrimp_rice_bowl` |
| 09 | `lasagna_slice` | fried calamari with lemon | 10 / `calamari_lemon` |
| 09 | `spaghetti_marinara` | grilled salmon with lemon | 10 / `grilled_salmon_lemon` |
| 09 | `spinach_ravioli` | seafood paella | 10 / `seafood_paella` |
| 10 | `calamari_lemon` | bread loaf with butter | 11 / `bread_loaf_butter` |
| 10 | `grilled_salmon_lemon` | croissant on a plate | 11 / `croissant_plated` |
| 10 | `seafood_paella` | blueberry muffin on a plate | 11 / `blueberry_muffin_plated` |
| 10 | `shrimp_rice_bowl` | cinnamon roll on a plate | 11 / `cinnamon_roll_plated` |
| 13 | `beef_taco_trio` | paneer skewers (Indian) | 12 / `paneer_tikka_skewers` |
| 13 | `chicken_burrito_cutaway` | chicken biryani (Indian) | 12 / `chicken_biryani` |
| 13 | `loaded_mexican_nachos` | three tacos in a stand | 13 / `taco_trio_stand` |
| 13 | `burrito_rice_bean_bowl` | a halved burrito, not a bowl | 13 / `chicken_burrito_plated` |
| 14 | `herb_butter_salmon` | loaded nachos (Mexican) | 13 / `loaded_nachos_guacamole` |
| 14 | `seared_steak_vegetables` | burrito bowl (Mexican) | 13 / `burrito_bowl` |
| 14 | `scallops_puree` | steak with mash | 14 / `steak_mash` |
| 14 | `truffle_mushroom_risotto` | salmon with asparagus | 14 / `herb_butter_salmon` |
| 15 | `champion_burger_platter` | fine-dining tasting plate, no burger | 15 / `tasting_plate_fine` |
| 15 | `champion_cloche_platter` | truffle mushroom risotto | 14 / `truffle_mushroom_risotto` |
| 15 | `golden_pasta_tasting` | steak and lobster under a gold lid | 15 / `champion_cloche_platter` |
| 15 | `world_signature_tasting_platter` | scallops on purée | 14 / `scallops_puree` |

Some targets reuse a name that another wrong file holds now, so rename through temporary names.

**B. Grey-white haze over the whole canvas (16 ingredients):** basil sprig, bell pepper strips, black beans bowl, black olive rings, grilled chicken strips, guacamole bowl, mozzarella, mushroom slices, nacho chips, pepperoni slices, pizza dough, salsa bowl, sweetcorn, taco shell, tomato sauce bowl, tortilla. They would show as pale squares in the game. (Five customer mood files have a very faint haze too.)

**C. Cutting leftovers.** About 40 files keep a piece of a neighbouring picture at an edge (a floating hand beside the server, slivers beside trays and some dishes). 8 of 24 rival pictures and 9 of 20 staff pictures are sliced at an edge (the French pastry chef's hat, the staff's arms).

**D. Mood pictures do not match the plain portraits.** `customer_tourist_man` is a bearded, red-haired backpacker; `customer_tourist_man_happy` is a young man in a straw hat. The elderly woman and the office man change the same way; the student changes clothes. **Each four-mood set is consistent within itself**, so use the 4 sets as 4 characters and do not pair them with the plain portraits. The other 20 customers have one pose, so they cannot show waiting or impatience.

**E. No cooking states.** The only raw/cooked pair is ramen. `ingredient_beef_patty.png` is **already cooked**: there is no raw patty, no half-cooked or burnt patty, no raw or burnt fries, and no filled cola cup. `ingredient_onion_rings.png` is raw red onion, not fried rings.

**F. Stations have food baked in** (flat-top grill, deep fryers, wok, toaster, blender, rice cooker, noodle boiler, juicer), so they cannot be empty, cooking or ready. The pictures are also drawn from different angles at different scales, so food will not sit in a station slot or stack into a burger convincingly.

**G. No upright backgrounds.** The game is upright-first on phones. A 1920×1080 picture shown on an upright phone keeps only its middle third. The reference screen and the Royal Cooking screens need this: Burger needs a 1080×1920 background now, the others later.

**H. Paperwork is stale.** The master manifest lists 31 files; the catalog says customers, rivals and dishes "still need generation". `00_shared/food`, `00_shared/serving_items` and every event's `ingredients`, `equipment`, `trays`, `decorations` and `event_ui` folders are empty. I will build my own manifest from the real files.

**I. Size and git.** 270 MB must never be committed or shipped, and the folder is **not in `.gitignore`** (add it with Phase 1). Cut to WebP at game sizes it is small: a 1280×720 background ≈ 150 KB, a dish ≈ 16 KB, a customer ≈ 21 KB, a station ≈ 35 KB. Estimate: Burger ≈ 1.5–2 MB, all 15 ≈ 12–18 MB (today's `dist/` is 80 MB). Load only the open event's pictures.

### 1.3 Required (from the asset prompt) against available

| Required | State |
|---|---|
| 15 backgrounds | ✅ landscape · ❌ upright · ❌ separate midground, foreground, crowd, light layers (not essential) |
| Ingredients | ⚠️ a good set; not the full per-event lists |
| Finished dishes | ⚠️ after renaming, still no festival has its whole menu (Burger: 4 of 11) |
| Cooking states | ❌ |
| Equipment | ⚠️ look good; not usable as live stations |
| Filled trays | ❌ |
| 20 customers × 8 expressions | ⚠️ 4 characters with 4 moods; no disappointed or victory |
| 8 rivals × 8 poses | ⚠️ 4 rivals × 4 poses; no defeated, victory, frustrated (see 3.3) |
| Event signs and decorations, event UI | ❌ (shared props only) |
| UI icons | ⚠️ missing lock, info, close, sound on/off; also needed: patience hearts, bin, ready and burnt badges |
| Power-ups, effects, celebration | ✅ |
| Pointers | ⚠️ one hand, one arrow ring (enough to start) |
| Sprite sheets, previews, manifests, catalog | ⚠️ raw generation sheets; stale |

### 1.4 Burger Festival (Phase 2) readiness

- **Usable now:** landscape background, crispy chicken burger, double cheeseburger, fries box, strawberry milkshake, bun, lettuce, tomato, cheese, pickle and onion pictures, empty cup, plate, 4 mood customers, UI icons, patience / instant-cook / freeze power-ups, steam, smoke and burst effects, confetti, trophies, medals, pointer hand.
- **Missing:** the whole kit in `FESTIVAL-CODEX-PROMPT-2026-11-27.md`.
- A **burger layer kit** draws every burger on the board *and* in the order bubble, with any toppings. That removes the need for a separate picture of each burger variant.

### 1.5 Sound

The game uses recorded sound only. `bell`, `chime`, `coin`, `pop`, `slide`, `till`, `tick` and `wrong` cover much of it. There is **no grill sizzle, fryer bubbling, drink pour, crowd cheer or win fanfare**. These need CC0 recordings with credit lines. I will list each file, source and size and ask before downloading.

## 2. What to take from the Royal Cooking screens

1. Upright, one screen, only 4–6 things to touch at first, each very large.
2. One tap moves food along: raw tray → cooker → plate.
3. A clear "ready" badge on the cooker; a bin for burnt food.
4. The order bubble shows the **exact** dish, variants included (with or without ketchup).
5. Tapping a finished item delivers it to the customer who ordered it.
6. Patience as hearts; two or three customers at a time; few bars and panels.

The landscape reference is a good desktop layout. It will **not** fit a phone as drawn (5 bubbles, a goals panel, two score bars). It also shows a **"DESSERT RUN" badge** and "Level 10", which must not be copied.

## 3. Where the plan meets the game (please decide)

1. **91 levels, not 90.** The campaign ends at Level 91 (the finale). Festival 09 at 90 is one level before it; the post-campaign events start after 91.
2. **Level numbers are never shown** in unlock text in the restaurant game (developer rule; `useUnlockText`). Locked cards say "Opens in 3 services", and the HUD shows the event number, not "Level 10".
3. **Rivals:** the game already has **49 named rival chefs with painted portraits** (`public/portraits/rivals/`). Use them, as your prompt asks. The 8 new Codex chefs would be strangers. The game's portraits are softer than the new glossy art: fine inside a framed medallion for now; later Codex can repaint the 15 hosts in the new style from those portraits, with 3 moods.
4. **New mini-game rule (CLAUDE.md §10):** plain art first; no rewards or ads until you have played it on a real phone and it feels good. So Phase 2 pays **stars and a trophy, no money**.
5. **25 serves are very close together.** Six events in 25 serves is about 4 orders apart, and a grown restaurant can serve more than 25 in one day. I propose keeping 25 but counting the next gap only **after the previous festival has been played** (section 8).
6. **"Serve 45 orders"** would make a round of 10 minutes or more. Rounds of 2–3 minutes: 8 orders in Event 1, rising to 20 in Event 15.
7. **At most 3 customers at once**, in both layouts: 4 bubbles are too tight at 320 px, and rotating the phone must not change the difficulty. Later events get harder through stations, steps and combinations.
8. **Power-ups:** start with 3 free ones per round (Patience, Instant Cook, Freeze). No "+" button, purchases or ads (each needs your explicit yes). Drop "Ingredient Refill" (festival stock is not your Inventory) and leave "Double Reward" until money exists.
9. **Wrong customer:** not possible by design (rule 5 in section 2). A finished item nobody ordered just stays on its plate.
10. **Level 20** will open both the Pizza Festival and Dessert Run. Harmless, but the festival card should wait for the Dessert Run one.

## 4. Existing architecture (what the festival must fit)

- React 19 + Vite + TypeScript + Tailwind. Phaser is only for cutting. The newer mini-games draw on a canvas or in the DOM on a fixed stage: 540×960 upright and 960×540 landscape, each with its own layout.
- Screens are chosen by `ScreenId` in `ScreensRouter.tsx`; most app logic is in `App.tsx` (very large). The Kitchen's **Mini-games sheet** reads one list, `game/business/miniGames.ts`; mini-games have `?name=<level>` preview links and a shared `LevelPicker`.
- Save: `SaveData` through `SaveManager`; new state is **one optional `business.<name>` field** read by a clamping function. Money: one wallet and one ledger. Today's mini-games pay no money.
- Platform: only `PlayablesSDK.ts` talks to Playgama. `PauseManager` carries the platform's and ads' pause. Side note: **none of the mini-games I checked (Unload the Van, Dessert Run, Sauce Station, Car Park) listens to it**; the Van's clock would keep running through a platform pause. The festival must listen, and I can fix the Van separately if you want.
- After Level 91 the player runs the **Endless Restaurant**. The save already counts every menu order served in its lifetime (`business.finance.lifetime.orderCount`).
- QA: 205 suites in `scripts/`, browser tests in `tools/e2e/`.

## 5. Reuse

| Need | Existing |
|---|---|
| Rival names, cuisine, district, portrait, voice | `cityRanking.ts`, `rivalChefs.ts`, `rivalPortraitPath` |
| Entry point | Mini-games sheet (`miniGames.ts`) |
| Locked text | `useUnlockText` |
| Seeded randomness | `businessDeterministicRandom.ts` |
| Pause, sound | `PauseManager`, `AudioManager` |
| Celebration, short help | `CelebrationCard`, `InfoTip`, shared buttons and cards |
| Layout | the 540×960 / 960×540 stage pattern of Unload the Van |
| Save, analytics | `SaveManager`, `sendAnalyticsEvent` |

Not reused: campaign cooking (cutting), Business Inventory, Market, order generator and customers (the festival has its own stall and crowd). Dessert Run is not touched.

## 6. Proposed architecture

```
src/game/festival/          pure rules: no React, wallet, clock or Math.random
  types.ts   events.ts      the 15 events as data
  recipes.ts                steps from a few primitives
  kitchen.ts                station state machine (a tick takes the elapsed time)
  orders.ts  serve.ts       seeded customers; which waiting order an item satisfies
  scoring.ts rival.ts       score, combo, goals; the rival's timeline
  schedule.ts state.ts      unlock rules; the save reader
src/components/kc/festival/ Select, Game (its own lazy chunk), Counter, Station,
                            OrderBubble, RivalBar, ResultCard, assets.ts
scripts/make-festival-assets.py   gitignored art folder -> public/festival/<event>/ WebP + manifest
```

Built data-driven from the first line, so Phase 3 becomes hardening, not a rewrite. DOM with CSS transform and opacity (no new library). Restaurant build only.

## 7. Data model

```ts
type FestivalEvent = {
  id: string; number: number; name: string;
  unlock: { level: number } | { gap: number };       // gap = orders served after the previous event
  rivalId: string;                                    // one of the 49
  art: { wide: string; tall: string };
  stations: { id: string; kind: "cook" | "pour" | "board"; slots: number;
              cookMs?: number; readyMs?: number }[];  // readyMs = time before it overcooks
  ingredients: string[];
  recipes: { id: string; points: number; steps: Step[] }[];
  menu: { recipeId: string; weight: number; fromOrder: number }[];
  round: { orders: number; atOnce: number; patienceMs: number; arriveMs: number };
  rival: { share: number; slips: number };            // share of the best possible score
  goals: { served: number; accuracy: number };
};
type Step =
  | { do: "add"; item: string }                       // tap it onto the board or vessel
  | { do: "cook"; station: string; item: string }     // raw -> cooking -> ready -> over -> burnt
  | { do: "turn"; station: string }                   // flip or fold inside the window
  | { do: "pour"; station: string };
```

**Host rivals:** Burger Sunny Side Diner · Pizza Luigi's Trattoria · Sandwich Corner Toast Co. · Breakfast Bean There Café · Street Food The Pita Pocket · Asian Wok 'n' Roll · Healthy The Green Fork · BBQ Hearth & Ember · Pasta Pasta Fresca · Seafood The Blue Anchor · Bakery The Orchard Room (no rival is a bakery) · Indian Curry Corner · Mexican La Cantina Real · Gourmet Aurora · Championship Maison Lumière (#49). A festival never changes the city ranking.

## 8. Progression and unlock

- **Events 1–9:** open when the player reaches Level 10, 20 … 90. A star on the Mini-games button and one short Paige line. Never forced, never blocks a level.
- **Events 10–15:** after the campaign is complete. Counted in Endless Restaurant orders:

| Event | Opens after |
|---|---|
| Seafood | 4 orders after the campaign is complete |
| Bakery | 4 orders after Seafood was first played |
| Indian Street Food | 4 after Bakery |
| Mexican | 4 after Indian |
| Gourmet | 4 after Mexican |
| Grand Championship | 5 after Gourmet (25 in all) |

The select screen shows "2 more orders". Losing counts as played, so no one gets stuck. A player past a milestone already (an old save) finds those events open.
- **Replay:** any opened event, any time. A one-time prize is never paid again.

## 9. Cooking and recipes

- One tap moves food: tray → first free slot; ready food → the waiting plate; topping → the plate.
- Station states: empty → cooking → **ready** (badge, bell) → overcooked → burnt (smoke; tap the bin). First event: one grill, long ready window, nothing else to burn.
- Pizza, pasta, pancakes, dosa and bowls are the same four steps in different orders (pasta: cook → add → add; dosa: pour → cook → add → turn). "Spread" stays a tap.
- **Instructions are never part of the difficulty** (developer rule): the bubble shows the exact dish, and touching a bubble shows its steps in pictures, at every tier.

## 10. Orders

- Generated from the event's menu with a seed (event + attempt), so a retry can replay the same round and tests are repeatable.
- Order: `id, seat, items[{recipeId, extras, done}], patienceMs, state (waiting|served|left), quality`.
- Combinations grow with the event: one item (1–3), item + side or drink (4–9), three items (10+).
- A finished item goes to the **longest-waiting** customer who wants exactly it. Each delivered item restores a little patience.

## 11. Rival

- The rival's whole timeline is fixed from the seed when the round starts: when each order is finished, plus 0–3 visible slips with a short surprised line. No rubber-banding, no cheating, no pretending to be a person.
- Final score = `share` × the best possible score for that round (found by a test player): about 55 % in Event 1, 85 % in Event 15.
- Lines at the start, when you pass them, when they lead, and at the end, in the voice each chef already has. No insults.
- **Fairness is proved by test, on 200 seeds for every event:** a player who reacts in 1.0 s wins; a player who does nothing loses; in Event 1 a slow player (2 s) still wins.

## 12. Scoring

| Part | Rule |
|---|---|
| Item | burger 100, side 40, drink 30 (per event) × quality: ready ×1.0, overcooked ×0.6 (burnt cannot be served) |
| Speed | up to +30 % from the patience left when the order completes |
| Combo | ×1.0, +0.1 for each order served in a row, up to ×1.5 |
| Breaks combo | a customer leaves; food burns |
| Accuracy | items delivered perfectly ÷ items cooked (burnt, overcooked and binned lower it) |
| Winner | higher score; a tie goes to the player |
| Stars | 1 win · 2 win + accuracy goal · 3 win + accuracy + orders goal |

Result card: both scores, orders, accuracy, customers lost, best combo, mistakes, stars, one useful tip after a loss, "Try again" in one tap.

## 13. Save and economy impact

**Save (needs approval):** one optional field, no new top-level field; old saves need no migration.

```ts
business.festivals?: {
  v: 1;
  record: Record<eventId, { plays: number; wins: number; best: number; stars: 0|1|2|3;
                            playedAtOrder?: number }>;
  campaignDoneAtOrder?: number;     // lifetime order count when the campaign was completed
  prizes?: string[];                // only if money prizes are approved later
}
```

The second number is needed because the lifetime order count also counts menu guests served during the campaign. No save in the middle of a round (2–3 minutes; leaving restarts it).

**Economy:** Phases 1–3 move **no money** and use no ingredients or supplies, so wallet, ledger and the frozen campaign figures do not change. A later option (needs approval): one prize per event on its first win, one new ledger type `festival-prize`, nothing on replays. No ads, no purchases.

## 14. Roadmap

| Step | Work | Gate |
|---|---|---|
| 0b | Rename the 26 files, rebuild the manifest, add the art folder to `.gitignore` | your yes |
| 1 | Mini-games entry, event data, unlock rules, select screen, `?festival=1` preview | tests |
| 2a | Burger round fully playable with current art and plain shapes: stations, orders, serving, rival, score, result. No money | **you play it on your phone** |
| 2b | Put in the Burger kit art and sounds; upright and landscape polish | your yes |
| 3 | Harden the engine against Pizza, Pasta and Dosa recipes | tests |
| 4–6 | Events in small batches; each event's art ordered **only then** (about 25–45 new pictures each, 400–600 in all) | your yes per batch |
| 7 | Full pass: every event, sizes, performance, store text and screenshots | release |

Codex can make the Burger kit during steps 1–2a.

## 15. Testing

- `festival-config-qa`: every event's recipes can be completed with its stations; every picture it names exists, is the right size and weight.
- `festival-rules-qa`: station states, serving match, patience, combo, score, ties, power-ups, pause.
- `festival-rival-qa`: the 200-seed fairness proof; the same seed gives the same rival.
- `festival-save-qa`: fresh and old saves, unlock at each milestone, locked cannot start, the 25-order schedule, interrupted and repeated events, no duplicate record or prize, no new top-level field.
- Guards: no change to Dessert Run files; economy suites unchanged; all 205 suites after each phase.
- `tools/e2e/festival.mjs`: a whole round by real taps at 320×568, 360×640, 390×844, 430×900, 768×1024, 844×390 and 1280×720; 48 px targets, no overlap, no console errors.
- Every picture checked against its name on a labelled sheet before it goes in.

## 16. Risks

| Risk | Answer |
|---|---|
| Art from mixed angles looks pasted on | one-camera Burger kit; try it in 2b before ordering other events |
| Crowding on small phones | 3 customers, few panels, designed upright first |
| Memory and load on cheap phones | own lazy chunk, only the open event's pictures, small WebP |
| Slowdown with many moving things | transform and opacity only, few animated nodes |
| Clock runs through pauses or ads | `PauseManager`, time passed in to the rules |
| Scope: 15 events | vertical slice first; stop and judge after Burger |
| `App.tsx` regressions | only an entry and a route there; all logic in the festival folders |
| Committing 270 MB | `.gitignore` in step 0b |
| Competition with the main game | never forced, never blocks, no money at first |

## 17. What cannot be done safely as written

1. Showing "Level 10" in unlock text or the HUD (restaurant rule).
2. Money rewards in Phase 2 (new mini-game rule, and a new money source needs approval).
3. 8 new rival chefs beside the existing 49.
4. "Ingredient Refill" or ingredient management tied to Inventory.
5. Buying power-ups or an ad for them without explicit approval.
6. Saving in the middle of a round.
7. Building "after Level 90 the campaign is complete": it is complete after Level 91.

## 18. Decisions needed before Phase 1

1. Approve step 0b and Phase 1 + 2a (plain-art Burger round, no money)?
2. Use the game's 49 rival chefs? (recommended: yes)
3. The 25-order schedule counted after each festival is played? (recommended: yes)
4. Rounds of 2–3 minutes and at most 3 customers? (recommended: yes)
5. Approve the one new save field `business.festivals`? (needed from Phase 1)
