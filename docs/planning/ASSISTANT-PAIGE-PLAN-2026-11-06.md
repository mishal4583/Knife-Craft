# Paige, the personal assistant: plan (2026-11-06)

Status: PLANNED, nothing built. Art prompts: `ASSISTANT-PAIGE-CODEX-PROMPTS-2026-11-06.md`.
"Paige" is a working name (decision D1).

## 1. The idea

The developer wants a personal assistant, a beautiful and friendly young woman, who is **hired at Level 1** and then
**teaches the whole game, from the first plate to the last level**. She pops up on the screen like an NPC advisor
(a half-body cut-out character in a corner of the screen, with a speech bubble beside her), says one or two short
lines, points at the button to press, and goes away. Reference concept only: a character who overlaps the game
screen and talks in a bubble. Her design is her own (not the reference girl).

She does not add a new system. She is **one voice on top of the three guidance systems the game already has**:

| Already in the game | What Paige does with it |
|---|---|
| `firstRunGuide.ts` (the first-run hand: hire, buy, kitchen, open, start; captions like "1️⃣ Hire your Server and Cashier first") | Her bubble says the caption; the hand (`PointerHand`) stays. One new first step before them: "meet Paige". |
| `restaurantGuide.ts` (`GuideStep` rules, shown by `GuideCard` over the Kitchen; Later / Show me; `business.guideSeen`) | `GuideCard` is re-skinned with her portrait and bubble. The rules, the "seen" memory and the reminder timing do not change. |
| `coaching.ts` + `coachGhost.ts` (the ghost knife on the board, first play of a level that teaches a technique) | Untouched. Paige says ONE line just before the first cut ("Swipe across the food"), then stays out of the cutting screen. |
| `systemsIntroducedAt(level)` (unlock cards), mini-game how-to cards (Fridge Sort, Stockroom Sort, Fridge Check) | Paige introduces each one once, with a "Show me" that opens it. The how-to cards stay as they are. |

## 2. How she appears (the player's view)

1. **A new game:** after the story intro, Paige walks in: "Hi, I'm Paige, your assistant. I'll show you everything."
   A **Hire Paige** card in the Market (first step, before the Server and the Cashier) costs **$0 and has no wage**
   (decision D2). The tap hires her: a small cheer, the portrait joins "Your team".
2. **Then the first-run hand:** hire the Server and the Cashier, buy the food, back to the Kitchen, open, start. Each step is her
   bubble (1 line, ≤ 90 characters) plus the pointing hand on the real button.
3. **From then on, a beat appears at a calm moment** (Kitchen, Market, a result screen), never more than **one per
   screen visit**, never again once seen.
4. **Ask Paige:** a small round button (her face) in the Kitchen and Market top bar opens **Paige's notebook**: the last tips,
   a "show me again" for each, and a switch "Tips: On / Off". Off means no bubble ever pops up by itself (the notebook stays).
5. **Where she never shows up:** the cutting scene (Phaser), a running service, a rewarded or interstitial ad, a paused game,
   an open modal, the first 1.2 s after a screen opens, a result's money count.

## 3. What she teaches, start to end (the beat map)

Keyed to the game's own rules, not to hard-coded level numbers (levels move: the campaign was re-numbered to 148).
The trigger for each beat is the existing rule or unlock (`isSystemLive`, `systemsIntroducedAt`, a `GuideStep` rule id,
`firstRunHand`, the mini-game gates). Lines below are drafts (copy rule §10: a few words; anything longer goes behind ⓘ).

| # | Beat id | Trigger | Draft line | Points at |
|---|---|---|---|---|
| 1 | `meet` | new game, after the intro | "Hi, I'm Paige! I'll guide you, step by step." | Hire Paige |
| 2 | `hire-team` | first-run step `hire` | "First, hire a Server and a Cashier." | Hire buttons |
| 3 | `buy-food` | step `buy` | "Now buy food for your first dish." | first Buy |
| 4 | `to-kitchen` | step `to-kitchen` | "Done! Back to the Kitchen." | Kitchen tab |
| 5 | `open` | step `open` | "Tap Open for service." | Open button |
| 6 | `start` | step `start` | "Press Start, then cut!" | Start |
| 7 | `first-cut` | first level begins | "Swipe across the food to slice it." | (none) |
| 8 | `first-pay` | first result | "You earned cash! It buys more food." | Collect |
| 9 | `restock` | food low | "Running low. Visit the Market." | Market tab |
| 10 | `menu` | Menu unlocks | "Pick what customers can order." | Menu |
| 11 | `pantry`, `fridge-sort` | ingredient-stock live | "Sort the delivery into the fridge for bonus Hype." | mini-game chip |
| 12 | `cleaning` | cleanliness live | "A clean kitchen keeps customers happy." | Clean tasks |
| 13 | `second-floor` | Second Floor opens | "Your upper floor earns cash even when you're away." | Floor tab |
| 14 | `stockroom-sort` | Stockroom Sort opens | "Stock the new shelves fast for stars." | chip |
| 15 | `freshness`, `fridge-check` | freshness live; Fridge Check opens | "Check the fridge before closing." | chore |
| 16 | `dine-in`, `staff`, `cuisines`, `takeaway`, `bigger`, `expansion`, `established`, `master`, `grand` | `systemsIntroducedAt` | one line each: what is new and where to tap | the new tab |
| 17 | `achievements` | existing guide step | "Tap Collect on your achievements." | Progress |
| 18 | `blacksmith`, `knives`, `boards` | existing guide steps | "A sharper knife cuts cleaner." | Workshop |
| 19 | `cleaner`, `supplier`, `floor-server`, `floor-machine`, `prep-cook-cuts` | existing guide steps | one line each | their screens |
| 20 | `ad-*` (one per rewarded placement: floating cash, welcome back, daily gift, Golden Guest, Flood, Skip ahead, replay bonus) | the placement's FIRST appearance | "Watch a short ad for a bonus. Optional!" | the ad button |
| 21 | `ranking` | city ranking opens | "Climb the city ranking to be No. 1." | Ranking |
| 22 | `milestone-*` (every ~10 levels) | level reached | a one-line cheer, ties to the next goal | (none) |
| 23 | `finale` | last levels | a warm goodbye / thank-you | (none) |

About 55 to 65 beats in all. The ad beats follow CLAUDE.md §2: they say what the ad gives, say it is optional, and never push.
Paige never says an ad is needed to progress. No beat promises money that is not real.

**Voice rules:** warm, quick, encouraging; 1 to 2 bubbles per beat, ≤ 90 characters each, no jargon, at most one emoji,
English only. She never scolds. After a failure: one supportive line, not a lecture.

## 4. Technical plan

**New files**
- `src/game/restaurant/assistant.ts`: pure and deterministic. `ASSISTANT_BEATS` (id, `when(save, where)`, `lines[{text, pose}]`,
  optional `target`, `once`, `priority`), `assistantBeatFor(save, where)`, `markAssistantSeen(save, beat)`,
  `hireAssistant(save)`, `assistantHired(save)`. It reuses `firstRunHand`, `guideStepFor`, `systemsIntroducedAt`; it
  duplicates none of their logic.
- `src/components/kc/assistant/AssistantHost.tsx`: mounted once in `App.tsx`; owns the queue, the "never here" rules, and the
  hand/ring on the target.
- `AssistantBubble.tsx` (bubble with typed-in text, Next / Got it / Skip tips), `PaigePortrait.tsx` (a pose from the pose
  sheet), `PaigeNotebook.tsx` (Ask Paige), `AssistantHireCard.tsx` (the free hire in the Market).
- `scripts/assistant-qa.mts`, `tools/e2e/assistant.mjs`.
- Art step `python scripts/make-market-assets.py --assistant`: cuts the Codex sheets by shape into
  `public/business/assistant/` (one WebP per pose, about 25 KB each, about 400 KB in all).

**Changed files:** `businessTypes.ts` (`business.assistant?: { hired: boolean; seen: string[]; tipsOff?: boolean }`; the
save rule: extend `business`, no new top-level field), `firstRunGuide.ts` (the new `meet` step), `GuideCard.tsx` (her skin),
`App.tsx` (mount, `hireAssistantAction`), `Kitchen.tsx` and `Shop.tsx` (the Ask Paige button, `data-assist` markers on the
targets), `restaurantNews.ts` only if a row is wanted.

**Targets:** a target is `data-assist="<id>"` on the real button. The host finds it with `querySelector`, follows its
rectangle (resize and scroll), draws a pulsing ring and the `PointerHand`, and puts the bubble on the opposite half so it
never covers the target. If the target is missing, the bubble shows without the ring (the beat is not lost).

**Layout:** Paige sits bottom-left (mirrored to the right when the target is on the left). The bubble is above her, max
width 300 px. At 320×568 she shrinks (compact mode: a bust only, the bubble on top). Buttons ≥ 48 px, text 12 to 14.5 px,
no sideways scroll, safe-area padding. Portrait-first, landscape too (`land:` classes).

**Economy and saves:** she costs **$0, has no wage, and writes no ledger entry** (a flag, not a wallet movement). The frozen
campaign baseline and `restaurant-final-economy-qa` are unaffected. Old saves: no `assistant` field means "not hired"; a
player past Level 1 gets a short **catch-up intro** (one bubble, free hire), then their next beats only; seen beats are
inferred from the rules that are already done (a step is DONE when its rule stops applying).

**Analytics** (`sendAnalyticsEvent`, snake_case, no personal data): `assistant_hired`, `assistant_beat_shown {beat, level}`,
`assistant_beat_done`, `assistant_tips_off`, `assistant_replay {beat}`.

**Audio:** synthesized only (`AudioManager`): one soft "pop" when she appears, a tick per bubble. Nothing else.

## 5. Assets (details in the prompts file)

New art is needed (the game has no character-with-poses art yet): a master character sheet; 12 poses on two sheets; the
speech-bubble kit; a hire portrait in the staff-portrait style; round avatars; a small UI kit (help button, notebook,
glow rings, arrows). Optional: a "meet" backdrop and outfit variants for later. Existing art reused: `PointerHand`, the
Stockroom `spark` / `puff` / `ribbon`, the paper and copper UI primitives, the staff-portrait frame.

## 6. Phases (about 9 to 10 working days)

| Phase | Work | Days |
|---|---|---|
| 0 | Decisions D1 to D8; art accepted | 0.5 |
| 1 | State, `assistant.ts` (beats, rules), `assistant-qa` | 1.5 |
| 2 | `AssistantHost`, bubble, portrait, notebook, targets | 2 |
| 3 | First-run flow: `meet`, the free hire, hand + bubble together | 1 |
| 4 | Beat script for the early game and the first systems | 1.5 |
| 5 | Beats for the later systems, mini-games, ads, milestones, the finale | 1.5 |
| 6 | e2e at five widths, a real-phone pass, Playgama build | 1 |

## 7. Decisions (recommendation first)

- **D1 name:** "Paige" (or give me yours). It is one constant.
- **D2 hire:** free, no wage (recommended: the game says "hire", the economy stays frozen). The alternative is a paid hire,
  which means a new fee in the opening cash and updated economy tests.
- **D3 players already past Level 1:** a one-bubble catch-up intro, free hire (recommended).
- **D4 art style:** the game's warm painted look with a cut-out half-body character (recommended), not a flat vector.
- **D5 `GuideCard`:** re-skin it with Paige (recommended) instead of two separate popups.
- **D6 side:** bottom-left by default, mirrored automatically.
- **D7 Ask Paige button and notebook:** yes (recommended; it is what makes forgetting safe).
- **D8 sound:** a soft pop only, no voice.

## 8. Risks

- **Tutorial fatigue** (the biggest): one beat per visit, once each, Tips Off, and a hard "never" list (section 2).
- **Covering the target:** the bubble goes opposite the target; QA checks it at five widths.
- **Copy volume:** about 60 beats, ≤ 90 characters each; `assistant-qa` fails any longer line (the `ui-copy-qa` idea).
- **Art consistency:** the master sheet is made first and attached to every later request.
- **Small phones:** compact mode at 320×568; tested.
- **Ads:** she explains rewarded ads honestly and never nags; no beat appears on an ad's close screen.
