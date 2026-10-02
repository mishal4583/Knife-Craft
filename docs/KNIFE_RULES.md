# Knife rules — what KnifeCraft follows and where

Sources:

- the developer's **Knife_Rules.docx**, a compilation of the knife-skills
  articles "The Basics: Cutting Techniques" (Chef Sac) and the MICHELIN
  Guide's knife-cut glossary;
- the developer's own rules from the cutting reviews (the point-of-view
  tomato photos).

This file maps each rule to the code that enforces it and the QA that
checks it. Run the QA after any change to cutting:
`npx tsx scripts/cut-rules-qa.mts` and `npx tsx scripts/knife-stroke-qa.mts`.

## How the cook holds the knife and the food

| Rule | In the game | Code | QA |
| --- | --- | --- | --- |
| Knife in the right hand, food held with the left hand in a **claw grip** | The knife always comes from the lower right; the Slice card says "hold the food with your other hand in a claw grip" | `knifeTipDir` (knifeProfile.ts), `COACH_TEXT.slice` | knife-stroke A, cut-rules D |
| Seen from the cook's point of view, a cutting knife **stands on its edge** | While cutting, the blade is drawn foreshortened (spine and a sliver of the face). At rest it lies flat | `topViewProfile`, `CUT_SQUASH` | knife-stroke E |
| A **sharp** blade makes clean, even cuts | Edge on the cut line; a short slicing stroke, never a press | `tapStrokePose` | knife-stroke C |

## Which way the cuts run

| Rule | In the game | Code | QA |
| --- | --- | --- | --- |
| Slices go **across** the food (rondelles on carrot, cucumber, zucchini, leek; slices on tomato) — Level 1's style | Vertical cut lines for every cutting step, the knife vertical with the tip up | `primaryCutAxis` (cutPlan.ts) | cut-rules A1 (all 250 levels + Endless) |
| Horizontal lines **only when absolutely necessary** | (1) julienne: "slice it lengthwise into even slabs … into uniform strips"; (2) Dice's cross cuts: "slice across them into evenly sized cubes"; (3) a food drawn clearly taller than wide | `cutsLengthwise` (julienne), `liveAxis` (Dice), `TALL_ASPECT` | cut-rules A2–A5 |
| Chiffonade: roll the leaves, slice **perpendicular to the roll** | Across the roll: vertical lines | `primaryCutAxis` | cut-rules A1 |
| Dice / brunoise: strips first, then across them | Dice: vertical slices first, then the horizontal cross cuts | `liveAxis` + `primaryCutAxis` | cut-rules A5 |

## In what order

| Rule | In the game | Code | QA |
| --- | --- | --- | --- |
| With the knife in the right hand, start at the **right end** and work **left** as the claw hand steps back | The coaching ghost and every Slice/Chop/Dice card teach right to left; continuous Slice/Chop aims right to left | `nextCutIndex`, `nextOpenPosition`, `COACH_TEXT` | cut-rules B, D |
| Cross cuts start nearest the cook | Dice's horizontal set starts at the bottom | `nextCutIndex` | cut-rules B1 |

Taps still cut where the player taps (the nearest open slot), so a tap is
never ignored. The direction is taught, not forced.

## Between cuts

| Rule | In the game | Code | QA |
| --- | --- | --- | --- |
| The knife stays in the hand on the work between cuts | After every tap or swipe cut, the knife stays poised on that cut, stood on its edge. It is laid down on the board only when the step ends | `runTapCut` (stepDone), `poiseKnifeOn`, `layKnifeDown` in `beginStep` | cut-rules C |

## Uniform cuts

| Rule | In the game |
| --- | --- |
| Uniform cuts cook evenly and look professional | Guide slots are evenly spaced (`idealPositions`); grading rewards even spacing (unchanged) |
