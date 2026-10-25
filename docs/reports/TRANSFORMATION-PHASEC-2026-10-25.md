# KnifeCraft — Transformation Phase C (2026-10-25)

**Scope delivered:** Feature A (interactive cooking), prototyped on Garlic Bread.
Feature B (early restoration) was audited only: every option needs new prices and/or art,
so it waits for your decision (§4).

Base: `main` at `0e0d83b` (Phase B, deployed to Pages). Work: local branch `phase-c-wip`,
not committed or pushed.

## 1. What the player can now do (restaurant build)

Every Garlic Bread order (Level 5, the menu guest, Business / Endless) now ends in the
oven instead of the passive bread film:
- after the cut, the tray slides into the oven and the bread bakes;
- a bar fills from Pale through a marked **Golden** window to Toasty;
- "🧤 Take it out" ends the bake, and a line follows: *A touch pale — still tasty.* /
  *Golden and crisp!* / *Extra toasty!*;
- left alone, the tray comes out by itself at Toasty. There is no failure;
- the Knife Report then follows, exactly as after the film.

**The doneness changes nothing but that line.** Score, grade, pay, tip and stock come from
the cut, as before (by decision: no approval to change scoring). Every other recipe keeps
its cooking film.

## 2. Files

**New:**
- `src/game/cooking/ovenStep.ts`: the recipe list, the bake timings, doneness, labels,
  lines and the bread colour. Pure.
- `src/components/kc/game/OvenStep.tsx`: the oven view.
  - Take it out finishes once.
  - An interrupted bake clears its timers and fires nothing.
  - Reduced Motion: no slide or glow, the same bake.
- `scripts/oven-step-qa.mts`: QA, sections A–E.
- `tools/e2e/ovenstep.mjs`: browser checks O1–O6.

**Changed:**
- `src/components/kc/game/Preparation.tsx`: the `ovenCooking` prop. For an oven recipe the
  oven takes the film's place (`cooking === "playing"`), and `onDone` is the film's own
  (`setCooking("off"); setPhase("result")`).
- `src/App.tsx`: `ovenCooking: true` in the restaurant build only (service orders).
- `tools/e2e/solver.mjs`: takes the tray out in the golden window.

## 3. Tests

**Gates:**
- `npx tsc --noEmit -p .`: clean.
- ESLint: 0 errors, 9 warnings (the existing baseline).
- `npm run build`: OK. `npm run preflight`: pass.

**QA:** `oven-step-qa` passes; all suites **119 / 119**.

**Browser** (local Chromium, `vite preview`, the Bridge served from npm 2.3.1):
- `ovenstep.mjs` passes 6 / 6:
  - O1: the oven replaces the film after the cut;
  - O2: it fits 320 / 390 / 768 px, with a 48 px button on screen and no sideways scroll;
  - O3: a double tap in the golden window takes it out once ("Golden and crisp!"), then
    the Knife Report;
  - O4: Serve pays once (one settlement entry);
  - O5: Reduced Motion bakes at once and comes out by itself;
  - O6: no console errors.
- Regression run: see §6.

**Screenshots** (local e2e `out/`): `oven-1-in`, `oven-320`, `oven-390`, `oven-768`,
`oven-2-golden`, `oven-3-out`.

**Visual note:** the bread's browning is a colour filter on the 🍞 emoji and reads weakly.
The bar and its golden window carry the timing. Painted bread frames (raw / golden / dark)
would read much better; that needs art.

## 4. Feature B — early restoration (audit, not implemented)

**Today:**
- the restoration is the six kitchen tiers (`restoration.ts` names four stages over them);
- the first build, the Growing Kitchen, unlocks at **L16 for $16,000** (restaurant price).
  Then $20k (L29), $21k (L35), $24k (L46), $29k (L56);
- **nothing visible changes in the room from L1 to L16.** The map's fridge overlay
  (`FridgeMapOverlay`) is the only purchase drawn there today.

**What "small visible steps" would need:**
1. **Items to buy:** repairs between L2 and L16 (fix the stove, a lamp, paint, a table,
   the door). These are **new prices**, so an economy change: the frozen campaign
   baseline moves.
2. **Ownership:** the save already has a retired field, `ownedKitchenInvestmentIds`
   (string[], from the retired Kitchen Investments). It could hold these items with
   **no new save field**, but reusing it is still a save-meaning change.
3. **Art:** each step needs a visible change on the Kitchen and map paintings. That means
   new overlays or variants of the humble kitchen (5–8 images). You offered to generate these.

**No-new-state option** (no prices, no art): a "Restoration" progress strip on the Kitchen
showing the existing next tier, its price and the wallet's progress towards it. It makes
progress visible but changes nothing in the room.

## 5. Decisions needed

1. **Oven feeding the score?** Should landing in the golden window affect anything — the
   reaction, a tip, the grade? Today it is words only.
2. **Other recipes:** extend the oven to the other bread dishes (Tomato Basil Toast,
   Bruschetta), then pot / fry / grill steps?
3. **Feature B:** approve new early-repair prices (I'd model them in the simulator first),
   the reuse of `ownedKitchenInvestmentIds`, and the art route. Or choose the progress
   strip only.
4. **Art (optional):** three painted Garlic Bread frames (raw, golden, dark), about
   256 × 128 px each, transparent PNG, for the tray.

## 6. Regression run

**Pass:** servicefloor, restaurantday, restaurantguests, phase4, phase6, knifereport,
levelflow (restaurant and classic builds), platingskip.

**Fail, not Phase C:**

| Suite | Evidence |
|---|---|
| cookingclip | Crashes before any check on `main` as well (recorded in the Phase B release check). |
| phase2 | **Intermittent on `main` as well.** On this branch, 1 of 3 runs passed fully; the others failed C4 (auto-collect wallet pill) or A8 / A9 / B0 (the cloth wipe). On `main` (`0e0d83b`, rebuilt today), 1 of 2 runs failed C4 the same way (`shown 40000`, `credits 64500`) and 1 passed. None of these checks touch the oven. |

**First run only:** phase4, phase6 and classic levelflow failed because the dev servers and
the classic preview had stopped (`ERR_CONNECTION_REFUSED`). With them restarted, all pass.

## 7. Economy and save compatibility

- No save field. Saves, the economy, levels and recipes are unchanged since `0e0d83b`
  (QA E1).
- The oven has no wallet, ledger, score, grade or save code (QA D1).
- Serve pays once (browser O4).
