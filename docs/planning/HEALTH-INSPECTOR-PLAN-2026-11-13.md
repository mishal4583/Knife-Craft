# The health inspector's visit: plan (developer 2026-11-13, "the inspection is not built, plan for that, build it")

Status: **sections 1 to 6 are BUILT** (rules, the card, the tests). Section 7 lists what is not built and needs your word.

## 1. What was missing

- The game talks about an inspector (the Cleaner's hire reason, the Progress screen, the "Clean" star), but the only inspection that ever
  ran was the day-end one of full operation, which starts at the campaign's LAST level (91). A player never met him.
- That day-end inspection (`business/businessInspection.ts`) stays as it is for Level 91 and Endless. This plan adds his **visit during the
  campaign**, built on the things a campaign player already handles.

## 2. The visit, in the player's words

1. From **Level 13**, when you open a level for the first time, the Pre-Service Check may show **"🕵️ Health inspector at the door"**.
2. The card lists what he will look at, as it is right now, with a tick, a warning or a cross on each row, and what grade that would be.
3. Each row that is not a tick has a button to fix it first: **Clean**, **Throw out**, **Fridge**, **Buy**.
4. **"🚪 Let him in"** runs the visit. START waits for it (one tap, always possible, so it can never lock the game).
5. The card turns into the result: a big **A, B or C**, what it did, and when he is back.

## 3. What he checks (the restaurant as it is, no dice)

| Check | Tick | Warning | Cross |
|---|---|---|---|
| 🧹 Cleaning tasks left open (the morning's own setup chores do not count) | none | 1 or 2 | 3 or more |
| 🗑️ Expired food in the fridge | none | | any |
| ❄️ Fridge room | under 95 % full | 95 % or more | never (only a bigger fridge or cooking makes room) |
| 🧼 Dish soap | in stock | none | |
| 🧴 Cleaning liquid | in stock | none | |

A cross on any row is a **C**; a warning on any row is a **B**; five ticks are an **A**.

## 4. What a grade does

| Grade | Effect | He is back in |
|---|---|---|
| **A** | Hype for the Second Floor: +20, then +30, then +40 for A grades in a row. No money. | 6 levels |
| **B** | Nothing (a warning). Ends the A streak. | 4 levels |
| **C** | A fine of **5 % of that level's pay**, whole dollars (about $40 at Level 13, $104 at Level 20, $180 late). One "inspection-fine" ledger entry. A wallet that cannot pay it pays nothing. | 2 levels |

- Why no money for an A: campaign pay is a frozen baseline (CLAUDE section 7); Hype is the reward the other mini-games already use.
- Why the fine is small: it is a nudge, not a punishment. A simulated player who NEVER cleans pays about $1,800 in the whole campaign
  (of about $408,000 earned) until the Cleaner is hired; a careful player pays nothing.
- It pushes the things that already exist: the chores, Throw Out Expired, the bigger fridge, soap in the Market, hiring the Cleaner, and the
  day's Cleaner for an ad (`day_cleaner`).

## 5. Rules for the code

- `src/game/restaurant/healthInspector.ts`, pure: `inspectorRows`, `gradeFor`, `inspectorAt` (the card's view: "due" or "done"),
  `runInspectorVisit` (the only place the fine and the Hype are applied). No clock, no random.
- State `business.healthInspector = { nextLevel, streak, visits, last }` (optional, read through `healthInspectorOf`; an old save has none and
  meets him at its next level). No new top-level save field.
- The Pre-Service Check plan carries `inspector`; "due" opens the sheet and blocks START (`servicePlanNeedsSheet`, `canStart`).
- Card: `components/kc/restaurant/HealthInspectorCard.tsx` (short copy, an ⓘ for the rest, 48 px buttons, no level named).
- App: `letInspectorIn` runs the rule on the latest save; analytics `health_inspection { level, grade, fine, failed }`.
- A replay never has a check, so never a visit.

## 6. Tests

- `scripts/health-inspector-qa.mts` (32 checks): when he comes, what he sees, what each grade does, the ledger and the cash identity,
  old and odd saves, two simulated campaigns, the wiring.
- `tools/e2e/precheckvisits.mjs` (restaurant build): the card at 390 and 320 px, Grade C with its fine, Grade A with its Hype.
- The simulator (`scripts/restaurantCampaignSim.mts`) lets him in on every visit, so the economy suites include the fines.
- Seeded browser saves keep him away by default (`INSPECTOR_AWAY` in the harness), so older tests still test what they were written for.

## 7. Not built: yours to decide

1. **A rewarded ad on a bad grade** ("🎬 Second look: he checks again after you fix it, the fine is returned"). A new placement needs your
   yes. The player can already fix everything BEFORE letting him in, so the ad would only help someone who tapped too fast.
2. **Money for a Grade A** (for example a "clean kitchen bonus" of 2 % of the level's pay). It would raise the campaign's total income a
   little, so the frozen figures would need re-recording.
3. **A face for him** (a painted inspector with a clipboard, like Paige's cutouts). The card uses 🕵️ today; say the word and I write the
   Codex prompts.
4. **Telling the player one level before** ("The inspector comes tomorrow", from Paige). Today he simply stands at the door, and the card
   lets the player tidy up before opening it.
5. **More checks later**: the fridge's condition and the staff's wages are checked by the Level 91 day-end inspection only; they are not
   part of the campaign visit because a campaign player cannot act on them yet.
