# KnifeCraft — Handoff (Playgama edition)

Last updated: 2026-09-29. Written at the end of the Claude Code session that
created this repository, so the next session can continue without the old
conversation.

## 1. Where things stand

| Item | State |
|---|---|
| Primary codebase | this repo, `D:\WORKS\GAMES\Playgama\KnifeCraft` |
| Retired codebase | `D:\WORKS\GAMES\Knife Craft` (YouTube Playables build, GitHub `mishal4583/Knife-Craft`). Its last commit `1af591f` is the base of this repo's history (`youtube-original/main`). It still has the story change as **uncommitted** edits; leave it alone. |
| Distribution | Playgama → its catalog + partner platforms ("distribute everywhere", no exclusions). No direct YouTube Playables release. |
| Platform SDK | Playgama Bridge v2 (detected by Playgama: bridge 2.2.0, engine javascript) |
| Live sandbox | https://playgama.ai/play/gm6cvisosg — status ACTIVE, published 2026-09-26, running archive `knifecraft-playgama-1.0.0` (the **old** 13-beat intro, no Skip). Launch steps now say the sandbox is OUTDATED (form/covers changed since). |
| Latest local build | this repo at HEAD: re-paced intro + Skip story (not uploaded yet) |

## 2. Playgama cabinet (MCP `playgama-developer-cabinet`)

- applicationId `cmuiim0sh1qcalc0hiuw6xwlp`, title "KnifeCraft", status DRAFT
  (never submitted to moderation), engine `js`, agent claude-code / claude-opus.
- Archive `knifecraft-playgama-1.0.0` — id `cmuiime751qcnma0hudv5rc2r`,
  3,102,601 bytes, processing DONE, bridgeSdk FOUND, state PASSED,
  game_ready ARRIVED, bridge config VALID. Zip: `releases/KnifeCraft-Playgama-v1.0.0.zip`.
- Form: description + how-to-play filled (EN), devices iOS/Android/Desktop,
  portrait only, no multiplayer/leaderboards/social/IAP,
  `distributeEverywhere: true`, `excludedPlatforms: []`, no external link.
- Covers: all three slots filled (square = `playgama/covers/upload/square-800x800.png`,
  portrait = `portrait-1080x1920.png` (Poster.png centre-cropped from 1280 wide),
  landscape = `landscape-1920x1080.png` (Landscape.png trimmed from 1081 px tall)).
- Launch steps (2026-09-29): archive DONE, bridge DONE, covers DONE,
  form BLOCKED (NO_CERTIFICATION — a human must certify in the QA Tool),
  sandbox OUTDATED (CHANGED), share AVAILABLE, traffic DONE.
- Traffic: a FREE run (12 creatives, $6 internal budget) RUNNING
  2026-09-26 → 2026-09-29 16:06 UTC, posts on r/playgamabridge and Threads;
  an earlier 1-day FREE run FINISHED. Next traffic is PAID (verdict
  PAYMENT_REQUIRED) — only ever start traffic after asking the developer.
- Revenue share (Playgama wiki, checked 2026-09-28): playgama.com 50%;
  partner sites 70% up to $1k/month, $700 + 80% to $3k, $2,300 + 90% above;
  $100 payout threshold; bank transfer or crypto; non-exclusive.

## 3. What was done (chronological)

1. Business Mode UX overhaul (Market-style 7 tabs, visual Overview; no
   economy change), Business third in the bottom nav — committed `1af591f`.
2. Playgama conversion of a copy of the game (this repo):
   `PlayablesSDK.ts` rewritten over Bridge (same exports), `SaveManager`
   via Bridge storage, `main.tsx` → `startPlatform()`, Bridge CDN script in
   `index.html`, `public/playgama-bridge-config.json`, platform-neutral UI
   copy (App aside, ReplayBonusSheet), preflight + ads QA retargeted to
   Bridge. Uploaded as `knifecraft-playgama-1.0.0`, Bridge detected, form +
   covers, sandbox published and traffic started (by the developer).
3. Audit (no code change): Levels 1–10 and between-level flow — see §4.
4. Story presentation audits (three passes, no code change) — findings in §5.
5. Story pacing + Skip story implemented (main repo, then ported here):
   38.7 s → 21.5 s timed, 13 → 14 beats, new approved copy, one idempotent
   completion path, per-beat advancing, CSS transitions. QA:
   `scripts/story-intro-qa.mts` (63 checks) + `tools/e2e/introskip.mjs`.
6. This repo set up as the primary one: git history, CLAUDE.md, this file,
   covers / screenshots / Playgama docs / release zip moved in, e2e tools.

## 4. Open issues from the Level 1–10 audit (not fixed yet)

Priority order as agreed in the audit (P0 = before wide release):

- **P0 — G1: Serve → "Back to Kitchen" without "Finish Level"** pays the
  order settlement but never completes the level; every retry counts as a
  first play and pays again (reproduced: +$45 twice on Level 2). Cause:
  the service `onExit` in `App.tsx` never finishes the level and replay
  detection only reads `completedLevelIds`.
- **P0 — G2: first-ever Level 1 runs the legacy path**
  (`App.tsx` load effect sets `screen="gameplay"` without
  `onSelectLevel`/`startCampaignLevel`): no customer/Serve, pays only the
  $48 settlement, the $50 completion reward is never paid, no Level Complete
  banner; replays of Level 1 use the normal service path.
  Check the Economy V2 simulation before/after fixing (baseline must not move
  unexplained).
- P1: "Back to Kitchen" (Served screen + pause menu) actually goes to the
  Order Board; next level's Prepare button is below the fold from Level 6
  (no auto-scroll); Level 10's +$80 toast is replaced by the story
  milestone banner; Level 10 "Reward: Santoku" is not granted (it becomes
  buyable for $350 when Level 10 unlocks); order payout and completion reward
  are shown separately (never a total); Levels 8/9 instructions omit the
  Peel step; peel shows no progress ("0/1 peel" until done).
- P2: first-load bundle (main 782 KB / Phaser chunk 1.44 MB raw), Business
  code in the main bundle, stale "Next: Santoku · Lv 10" hints, Knife Report
  copy, faint destination label under the HUD card, nav highlights Kitchen on
  the Order Board, unused tracked assets `src/assets/kitchen$f` and
  `src/assets/tomato.webp`.

## 5. Story presentation — remaining recommendations

Implemented: pacing, Skip, per-beat entrance, tint crossfade, art drift,
reduced-motion fallback, double-tap / tap-through protections.

Not implemented (from the audits, all CSS/asset-free):

- Story timers do not pause on a platform pause (subscribe `StoryOverlay`
  to `PauseManager`; freeze CSS animations with a paused class).
- Reuse the already-downloaded `kitchen-bg.jpg` as the story background
  plate so the last beat dissolves straight into Level 1 (same image).
- Render the existing `fx` data (dust/spark/coins) with CSS particles;
  class hooks on existing SVGs (lamp flicker, key glint, chef breathing).
- Larger dialogue portraits + speaker handoff; ≥12 px card/label text;
  better contrast on the dark "decline" tint.
- Milestone banners: a story variant placed below screen headers, queued
  after the Level Complete toast instead of replacing it.
- Finale: its button says "BACK TO THE KITCHEN" but leaves the player on
  the Order Board (one-line navigation change — needs the developer's OK).
- Pause the Level 1 scene underneath the intro after SCENE_READY (it costs
  ~19% main thread while hidden) — never delay `gameReady`.

## 6. Next steps (suggested order)

1. Fix P0 G1 and G2 (with focused QA + Economy V2 regression).
2. Build, zip `releases/KnifeCraft-Playgama-v1.0.1.zip`, upload as archive
   `knifecraft-playgama-1.0.1`, confirm Bridge FOUND / state PASSED.
3. Ask the developer, then `publish_sandbox` the new archive (the sandbox
   is currently OUTDATED and runs the old intro).
4. Certify in the QA Tool (`get_archive_qa_tool_link` with
   `mode: certification`), then the developer submits the form to
   moderation in the cabinet.
5. P1 UX fixes, then the story presentation items in §5.

## 7. Useful facts

- Starting wallet $1,240.00 (124,000 cents). Levels 1–10 on a first run pay
  $667 in order settlements + $586 completion rewards (with G2's missing $50).
- Intro timing: Part 1 7.6 s, Part 2 6.0 s, Part 3 7.9 s; measured live
  22.4 s including two prompt button presses; Skip closes in ~130 ms.
- Bundle impact of the story change: main JS +~0.4 KB gz, CSS +~0.2 KB gz.
- Tests run in headless Chrome only; no real-device test has been done yet.
