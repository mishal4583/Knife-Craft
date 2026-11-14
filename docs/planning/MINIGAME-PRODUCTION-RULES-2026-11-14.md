# Building a mini-game without the usual casual-game mistakes (developer 2026-11-14)

Source list (developer): starting with store art before the mechanic feels good; meta progression before the core action is satisfying; ads too
early in onboarding; unfair failure or a slow restart; testing only in the editor, not on real Android devices; ignoring ASO until the day
before launch. Every new mini-game (Arrow Dock, Pantry Match, Knife Honing, ...) follows these rules.

## The six rules, and how we check each

| Mistake | Rule for a new mini-game | Where it is checked |
|---|---|---|
| Art before the mechanic feels good | Build the core action with plain shapes first (coloured boxes, system fonts, the synthesized sounds). Look at it on a phone and tap it for a few minutes. Only a "yes, this is fun" opens the Codex art prompts. | Step 1 below is a gate: no art prompt is written before it |
| Meta before the core is satisfying | No stars, Hype, pins, rewards, unlocks or ledger lines until the bare round is fun. The reward is wired last and reuses the existing stars / Hype rules (no new currency, no new save field outside `business`). | The reward is its own commit, after the feel review |
| Ads too early | A new mini-game never shows an ad in its first round or its first level. Rewarded ads stay opt-in, one placement per spot, with a daily cap (CLAUDE.md §2); interstitials stay behind 3 completed levels and 150 s (`interstitialPolicy.ts`). | `playables-ads-qa`; a new placement is a new `AD_PLACEMENT` entry |
| Unfair failure / slow restart | (a) Every generated level is solvable by construction, with a QA suite that proves it for many seeds. (b) A mistake costs a little (a star, a few seconds), never "game over". (c) "Try again" is one tap and takes under a second; the board is the same, no ad, no loading. (d) The reason for a lost star is shown (as in the Sauce Station's "why not 3 stars"). | `<name>-qa.mts`: solvable for 500 seeds, difficulty rises smoothly, restart restores the same board |
| Only tested in the editor | The browser tests run at 320x568, 360x640, 390x844, 430x900 and 768x1024. Plus **a real phone**: the developer plays each new mini-game on an Android phone (Chrome, and the Playgama sandbox link) before it ships, and tells us about touch feel, sound and speed. We do not claim "feels good" without that. | HANDOFF "Not verified" line until the developer has played it |
| ASO at the last day | Store text, tags, screenshots and the cover are updated in the same release as the mini-game (see below). | Release checklist below |

## Order of work for one mini-game

1. **Prototype (plain art).** One screen, the core action, a round that ends. Rules and generator in a pure `.ts` module, a QA suite (solvable
   for many seeds, no clock, no random). Browser test of the touch path.
2. **Feel check on a phone.** The developer plays it. We change the numbers (speed, size, difficulty) until it is good. Nothing else is added.
3. **Failure and restart.** Mistake cost, the "why" line, one-tap retry, difficulty by level (a table).
4. **Reward and routine.** Where it sits in "Before you open", what the Prep Cook does for it (no stars), Hype / stars through the existing rules.
5. **Art.** Codex prompts only now; the game keeps working with the plain art until the pictures arrive (drop-in with fallback, as the sauce products).
6. **Release.** Gates, `BUILD_VERSION`, Playgama upload, then the store text.

## ASO / store checklist for each release that adds a mini-game

- Description and how-to-play (EN): one short line for the new mini-game, in the player's words ("Unload the van, pack the fridge").
- Screenshots (human upload in the console): one of the new mini-game, portrait, no UI clutter. Source in `playgama/screenshots/`.
- Cover and tags: keep the cooking / restaurant / puzzle tags; add the mini-game's genre word (puzzle, match, sort) where the platform allows.
- The first 5 seconds in the store clip or screenshot show the satisfying action, not a menu.
- Ask Playgama (`get_game_checklist`) for what is missing, and relay it word for word.

## What we measure after release (`sendAnalyticsEvent`, no personal data)

`minigame_started`, `minigame_finished` with `{ game, level, stars, mistakes, seconds }`, `minigame_retry`, `minigame_quit`. A quit rate far above the
other mini-games, or many retries on one level, means unfair failure: fix the table, not the copy.
