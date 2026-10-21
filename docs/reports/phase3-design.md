# KnifeCraft Phase 3 — design decisions (from inspection, 2026-10-21)

Repo: D:\byte\not8n\_clones\Knife-Craft (working tree only, nothing committed).

## Facts that drive the design
- Combo = cuts on the current step (scene `cuts.length - stepCutsAtStart`), milestones 5/10/15/20.
  Real campaign (243 orders, 716 cut steps): x5 reachable 100%, x10 95%, x12 89%, x15 0%
  (15 and 20 never fire today — max steps are 12–14 cuts).
- Pause = PauseManager -> scene.pause() + tweens.pauseAll(): the scene clock pauses with the game.
- Each order remounts Preparation (a new Phaser.Game): per-order state dies with the scene.
- Inspection: `inspectBusiness(save)` is pure, 7 categories with concrete reasons, no state, no money
  (fines live separately at End Business Day). Already shown live in BusinessInspections.tsx.
- Endless Restaurant already has seeded per-day events (restaurant/restaurantEvents.ts) — precedent
  for deterministic events.
- Geometry: per-ingredient *_GEOMETRY fracs × canvas width in PreparationScene.layout(); one painter
  per ingredient (textures/*Texture.ts); cut pieces crop the painted texture (so a recolour carries
  into pieces and the plate).

## Decisions
- Fever: triggers at the EXISTING x10 milestone, once per order (feverUsed), 6 s on the scene clock
  (pauses with the game), ends early at plating / restart / shutdown. No re-trigger while active.
  Presentation only: knife glow + trail, stronger flecks/drag/separation, pitch lift, vignette + bar
  (React), start/end sounds. No score change.
- Endless Prep Rush: new screen + its own small Phaser game (PrepRushScene) — conveyor, seeded
  fixed sequence, swipe/tap to cut, bins (Prepared / Missed), 60 s or 5 misses, results, replay,
  session-best only (no save field), no money.
- Chaos Director (pure module): session order counter; first event after 3 orders, then every 4th
  order; fixed rotation giant -> avalanche -> rush-hour -> grandma -> perfect-plating -> inspection;
  never on a first-play coaching level or Level <= 10, never when the board is due a scrape; an
  ineligible event is skipped to the next eligible. Decided at Preparation mount, kept on restart.
  - Giant: sizeScale 1.35 on step 0's ingredient (shared size factor with Giant Cucumber), clamped
    to the board.
  - Avalanche: one-ingredient engine -> a bounded burst (8 small veg) at order start, input owned
    like the scraper, swipe to slice, uncut roll off, Skip; then the order starts.
  - Rush Hour: no timers exist in prep -> presentation pace: plating/hand-off tweens x1.6, cooking clip
    x1.5, banner; restored (per-order scene/clip). No score/payout change.
  - Grandma's Challenge: objective "reach Clean x8 on one ingredient" from the scene's combo; result
    line on the Knife Report. No reward.
  - Perfect Plating: no plating interaction exists -> measured by the report's Evenness (90+);
    documented limitation; stamp on the Knife Report.
  - Inspection: friendly visit card at start, the live inspectBusiness() result at the report; no
    fines, no state; only where a restaurant (business) save exists.
- Variants: presentation variants of existing ingredients (no new IngredientId): golden tomato,
  giant cucumber (size factor 1.3), rainbow carrot, frosted onion, heirloom pepper. Canvas overlay
  after the painter, clipped to the silhouette (so pieces and plate carry it), cut accent flecks.
  Cadence: every 3rd session order that contains a variant base ingredient; not on coaching plays.
  Knife Report line "Made with a Golden Tomato". No reward, no unlock, no save field.
