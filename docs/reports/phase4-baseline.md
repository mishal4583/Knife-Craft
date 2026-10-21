# KnifeCraft Phase 4 — baseline (2026-10-21, before changes)

Exists:
- Recipe Book (`kc/Recipes.tsx`: RecipeBook + RecipeDetail), reached from the Order Board's 📖 button. One entry per
  campaign level (recipeBook.ts), chapter tabs, upcoming = "Upcoming Recipe", a binary "Prepared" stamp. Its documented
  rule (levelMastery.ts, Law 4 / "corrective pass"): no numeric/percentage readout, never a graded rating.
- Persisted per recipe: `save.recipeProgress[recipeId] = { best: number|null, done: boolean }` — best = max(prior, score)
  of the 0–100 Knife Report score, updated on every completion incl. replays (App.recordPreparationResult and the
  campaign-service / batch recorders). Business orders do not read or write it (V3-16 isolation).
- Grade thresholds (CutEvaluator): Masterful 95, Clean 85, Honest 70, Rustic 50, Learning 0.
- Knife Report (Phase 1 New Best digits, Phase 3 specials lines), cooking clip (CookingClip), plating + hands (scene),
  ServiceOrderComplete (Serve latch, settlement, Phase 2 reaction cheer/nod, tip, cash vacuum, wallet roll), classic
  OrderComplete.
- Customers: 12 emoji identities (customerDefinitions.ts: name, avatar, greeting), picked with Math.random per order
  (ServiceManager.buildServiceOrder / createBatchGroupSession); a pooled generic reaction line per serve
  (CUSTOMER_REACTIONS). Service sessions live in React state (not saved). No sprites, no customer art assets, no dish art
  (dishes are emoji). Order model = one recipe per order (no quantity).
- Phase 3 variants exist (session-only, not persisted). Story: THE LAST WISH beats + milestone mask; Grandma speaks on
  Levels 1–15 (firstLevels.ts).
Missing: tiers, mastery presentation, personalities, any coordination beyond the existing order.
Reusable: recipeProgress (tiers derive from `best` → persistent with no new field), qualityFor, customer definitions,
ServiceOrderComplete reaction slot, Preparation phases, Phase 3 specials card.
Persistence conflict: best combo, variant-used and memory-seen per recipe are NOT in the schema → session-only;
a persistent record would need e.g. `recipeProgress[id].bestCombo`/`.variants` — proposed for approval, not added.
Tier/first-plate memories need no field: they fire when `best`/`done` cross a threshold, which happens once per recipe.
Rule conflict: tiers are a graded label in the cookbook, which Law 4 ruled out; the Phase 4 brief requires them → shown
as words only (no digits), "Prepared" kept; flagged in the report.
