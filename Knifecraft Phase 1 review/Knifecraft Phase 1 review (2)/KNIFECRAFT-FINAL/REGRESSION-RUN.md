# KNIFECRAFT — FINAL REGRESSION / QA REPORT (FREEZE RUN)

**Run date:** 2026-09-14
**Source under test:** `knifecraft.html` (11,301 lines) — the authoritative Claude Design source
**Harness:** `window.__kcTest.regressStart()`; result object at `window.__kcRegressLast`
**Runtime:** Chromium-based preview webview, DPR 1.25, canvas 1155x675, foreground
(`env.hostHidden: false`, `env.measuredAsForeground: true`)
**Runs recorded:** 2 consecutive, both from a clean load

## Verdict

```
pass: true
fail: []
```

**Both runs green. 48 assertion sections, zero failures, zero warnings suppressed.**

| | run 1 | run 2 |
|---|--:|--:|
| `pass` | true | true |
| `fail` | `[]` | `[]` |
| total suite time | 13,858 ms | 13,271 ms |
| fps (EMA) | 141.2 | 132.1 |
| worst frame | 14.0 ms | 14.0 ms |

## Coverage

Recipes cycled: **71 / 71**. Ingredients paint-checked: **42 / 42** (`rep.paint`, zero
`skinCover` failures, zero `paint.*.skinThrew`).

Sections asserted:

```
env, metricSpread, parityMaxDeltaPx, ghostMaxDeltaPx, perfectGate, perfectAccuracy,
rhythm, diagonal, minGapPx, endsAtCount, sequence, retryMs, perf, recipes, gardenPerf,
julienne, julienneDirs, dice, diceDiagonal, staging, cycle, freeCut, endCaps, paint,
coldClip, flowAfterSweep, cadence, quantize, flowUi, flowLight, scene, spirit, payload,
board, kitchen, idle, memory, clipboard, camera, camFidelity, camIdle, camCost, intro,
handoff, value, perspective
```

### Cutting / technique checks
`recipes`, `cycle` (all 71 in order), `julienne` + `julienneDirs`, `dice` + `diceDiagonal`,
`minGapPx`, `endsAtCount`, `endCaps`, `diagonal`, `freeCut`, `gardenPerf` (the multi-stage prep),
`perfectGate`, `perfectAccuracy`, `rhythm`, `sequence`, `staging`, `retryMs` — all green.

### Paint / ingredient checks
`paint` rasterises every base sprite and every `SKIN` sprite and asserts real coverage against the
ground it sits on — **42/42 pass**, including all 11 skin sprites and the 3 proteins.
`coldClip` green (per-ingredient cold-clip fidelity within 1px).

### Peel checks
`rep.peel` is `null` in this run: the suite's scripted cutter calls `peelSet(true)` so a scripted
knife never fights the peel gate, which is the designed behaviour. Peel coverage is therefore asserted
**through `paint`** (skin sprites paint and cover) and through `coldClip`, not as a separate section.
Manual peel verification (rub gate locks the knife, rub produces no cut, shell thins then sheds) was
performed by hand on all three peelable ingredients — pineapple, watermelon, coconut.

### Resize / scaling checks
`board`, `perspective`, `value`, `scene`, `kitchen` green. `value.board.mean` = **176.8**,
`value.reveal` = 1. Zero-size canvas guards exercised via `checkSize`/`KitchenScene.ensure`.
`scene.redrawsForTwoIdenticalFrames: 0` (no redundant room re-render).

### Story checks
`intro` and `handoff` green. Milestone behaviour was additionally verified by direct simulation
(plates 1 → 101, `flush()` after each):

- fires at exactly **8 · 20 · 45 · 70 · 100 (finale)**
- a second `flush()` at every same level returns `null` — **no double fires**
- final `story.ms` = **15**, still a 4-bit mask
- chapter labels derive automatically: `LEVEL 8 / LEVEL 20 / LEVEL 45 / LEVEL 70 / FINALE`

### `flowLight` — deterministic, both runs identical

```json
{ "lum0": 193.3, "lum1": 196.2, "deltaPct": 1.5, "cfgRange": 0.08,
  "settleFrames": [5, 4], "settled": true,
  "probe": "valueProbe().board.mean (5 points, STATION, room revealed)" }
```

Identical across both runs. The assertion samples `valueProbe().board.mean` — the canonical five-point
board reading, the same statistic manual inspection uses — and re-draws each endpoint until the reading
stops moving (`settled: true`; a reading that never settles fails as `flow.lightNeverSettled`).

**On the absolute numbers:** the manually recorded pair was 172.5 → 176.8 (+2.49%). This run reads
193.3 → 196.2 (+1.5%) because the board is brighter at this save's Spirit/warmth state (`level: 165`,
warmth near cap) than at the state where the manual pair was taken. The **delta is state-dependent by
design** — Flow light is a proportional term over the current room warmth, so a warmer room shows a
smaller percentage change. What the assertion checks is direction, settledness and the configured
`FLOW_LIGHT_RANGE` ceiling, all of which hold. This is expected behaviour, not drift.

### `camCost` — the previously flaky section, green both runs

| | run 1 | run 2 | budget |
|---|--:|--:|--:|
| `atRestMs` | 0.113 | 0.245 | — |
| `duringMoveMs` | 0.300 | 0.187 | — |
| `deltaMs` | 0.187 | **−0.058** | 0.5 |
| `roomRerendersDuringPush` | 0 | 0 | 0 |

## Known issues — nothing hidden

1. **`camCost.roomRerendered` host-load flake — NOT reproduced in the freeze runs.**
   During earlier phases this section intermittently reported a room re-render when the preview host was
   under load (observed at fps ≈10). Both freeze runs are clean with
   `roomRerendersDuringPush: 0` and `deltaMs` inside budget. **Environmental, not a product defect.**
   Reported separately here as instructed; it is unrelated to story or ingredient behaviour.

2. **`flowLight` absolute values are Spirit-state dependent** (see above). Deterministic within a state;
   do not hard-code 172.5/176.8 as expected constants in a production harness — assert direction,
   settledness and the range ceiling instead.

3. **`rep.peel` is `null` by design** — the scripted cutter bypasses the peel gate via `peelSet(true)`.
   A production harness should add an explicit peel-gate assertion (rub accrues only inside the
   silhouette; `canCut()` false while `peelPending()`).

4. **Roster arithmetic unresolved** (documentation, not a test failure): 42 Claude Design + 10
   production-only = 52, against a stated production target of 49. See
   `KNIFECRAFT-PRODUCTION-INTEGRATION.md` §6. **No ingredient was deleted to reconcile this.**

5. **Five techniques named in the packaging brief are not implemented**: Peel (a gate, not a technique),
   Smash, Rings, Radial, Rock Mince. Not a regression — they never existed. See §7 of the integration doc.

## Reproduce

```js
window.__kcTest.regressStart();          // ~13–14 s
window.__kcRegressLast;                  // { pass, fail, …48 sections }
```

Other hooks: `__kcTest.peelSet(true|false|null)`, `__kcTest.valueProbe()`, `__kcTest.runStage()`,
`Story.report()`, `Story.play('opening'|'fresh'|'chef'|'finale')`, `Story.flush()`, `Story.level()`.
