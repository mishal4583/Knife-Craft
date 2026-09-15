# Story integration — THE LAST WISH (report)

Presentation layer only. No new phase, no new gameplay architecture, no dialogue framework. The layer reads
**one** existing counter (`Save.played()`) and writes **three** presentation keys (`story.introDone`,
`story.ms`, `story.fin`). It touches exactly two game-side things, both presentation: the camera state and
`storyBare` (whether the board is drawn dressed).

## Beat coverage (brief → build)

| Brief item | Where | Timing |
|---|---|---|
| 30–60s inheritance opening | `OPENING` 4 beats → `FRESH` 4 → `CHEF` 5 = **13 beats**, one continuous run | ~40s unskipped, tap-to-advance throughout |
| Grandparent's final wish | `OPENING[2]` — `bedside` art, veil, the wish as its own `sQuote` with a held pause | 5.6s |
| Key handoff | `OPENING[3]` — `keys` prop art, ends on `[OPEN THE RESTAURANT]` | player-gated |
| "Fresh Start" clean / light renovation | `FRESH[0..2]` — `sDecline → sClean` tint shift, `CLEAN` / `SMALL REPAIRS` step labels, dust + spark fx | ~9s |
| Life savings → board + knife + ingredients | `FRESH[3]` — three `.sCard`s, coins fx flying **into** the cards; ingredient card paints real `PAINT.tomato/cucumber/carrot` | player-gated |
| Chef intro / prep-cook role | `CHEF[0..3]` — 4 one-line exchanges, portrait + bubble. Payload line: "I'll handle the cooking. You handle the prep." | ~11s |
| Level 1 starts immediately after | `CHEF[4]` `onEnter` → `SceneFlow.prep(); startRecipe(0)`; the run's coda repeats it so a skip lands in the same place | cuttable on beat exit |
| Progression milestones | `MILES` at played 3 / 8 / 20 / 45 — quiet `#storyMs` card, fired from `Story.flush()` on Prep Again / Next Recipe, bitmask-persisted, never blocks a prep | 4.2s each |
| Level 100 payoff | `FINALE` 4 beats — restored room, `dining` art, "You built this.", `THE RESTAURANT LIVES ON` | ~17s, once (`story.fin`) |

## Reused (nothing rebuilt)

- **KitchenScene / StationLayout** — every beat plays over the *live* kitchen. There is no story background.
- **Camera + SceneFlow** — beats declare `cam:'ROOM'|'STATION'`; `Camera.go(...,900)` and `SceneFlow.prep()`
  do the moving. `storyLock` stops SceneFlow's input-driven push while a beat is up.
- **Progression** — `Save.played()`, untouched. No economy, no story counter.
- **Storage** — the existing `Store` module (3 keys), in the regression suite's save/restore list.
- **Result screen / pantry / HUD** — hidden by one `body.storyOn` rule; `run()` calls the existing
  `hideResult()` / `closePantry()`.
- **Ingredient art** — the savings card calls `PAINT[id]` with the real `geom`. The story invents no food.
- **Motion language** — existing ease-out 150–250ms vocabulary, `clamp()`/vmin type, cream-on-walnut palette.
- **Debug affordance** — the `STORY` tab reuses the `#debugTab` pattern; chapter list reuses the pantry card.

## New this pass (visual assets / screens)

All inline SVG in `ART`, flat shapes in the existing palette — **zero asset files, payload unchanged**:
`bedside`, `keys`, `chef`, `you`, `dining`, `board`, `knife`. Plus the DOM screens `#story` (scrim / veil /
shade / fx / stage / panel), `#storyMs` (milestone card), `#storyTab` + `#chapters` (chapter jumps for
walking the flow without grinding 100 plates).

## Fixed this turn

1. **Finale beats 1–2 said the same thing twice** ("the best in town" in both). Beat 1 is now the
   realisation the brief asks for — "You came here to keep a promise. / You stayed because you wanted to." —
   and "I built this" lands as beat 3's second line. The ranking claim stays in beat 2 only.
2. **Gendered copy** — "Grandpa" in the finale quote and the level-45 milestone contradicted the
   grandparent-neutral opening. Now "They would be proud." / "They would have loved seeing this."
3. **Chapter labels were hardcoded** ("4 BEATS" against a 13-beat New Game run). Now derived from the
   sequence lengths, so they cannot drift again.

## One fix outside the story layer (sizing, found while verifying)

The layer plays *over* the live kitchen, so a blank kitchen is a blank story. On a host whose first layout
pass reports a zero-size window (iframes, deferred layout), `resize()` committed a 0×0 canvas,
`KitchenScene.ensure` then divided by a layer dimension and threw non-finite values into
`setTransform`/`createLinearGradient` — caught by the frame guard, and the room never painted again because
nothing re-measured without a window `resize` event. Three guards, one sizing path:

- `resize()` refuses a zero measurement rather than committing it.
- `KitchenScene.ensure` returns early on a zero-size canvas — nothing to paint yet.
- `checkSize()` re-measures on the first non-zero layout, driven by a `ResizeObserver` on
  `documentElement` where available and by a per-frame size-key check in `step` everywhere else. Both call
  the existing `resize`.

Verified: forcing `canvas.width/height = 0` and drawing leaves `__kcError` null (previously a `TypeError` in
`drawFar`), and restoring the size repaints — centre pixel rgb(229,100,88), the tomato.

## Remains to be implemented

- **Milestone thresholds are a guess** (3 / 8 / 20 / 45 plates against a 100-level arc). They want one pass
  against real level pacing in the production repo.
- **No audio for the story layer.** Cadence keeps playing underneath; no beat has its own sting, and the
  wish/finale would carry one. Deliberately out of scope here.
- **Equipment upgrades and reinvested profits** are narrated, not modelled — the brief put economy
  off-limits, so the savings beat is a moment, not a transaction.
- **`regress()` does not assert the story layer**; it *mutes* it (sets the three keys, restores after). Worth
  three assertions in the repo: the opening ends cuttable, `flush()` fires each milestone once, the finale
  fires once at 100.
- Untouched by design: ingredient artwork, cutting, peeling, recipes, economy, progression logic.
