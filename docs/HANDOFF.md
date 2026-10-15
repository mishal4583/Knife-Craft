# KnifeCraft — Handoff (Playgama edition)

Last updated: 2026-10-08. Written at the end of the Claude Code session that
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

## 3. Current status (2026-10-15)

- `main` = `f350657`: finishing plan W1–W5 done and pushed; all gates green
  (99 QA suites, 46 e2e on both builds with the stub Bridge); Pages deployed.
  - W1 story: milestones at 140/165/190/220 and THE LAST PAGE at 250
    (bit 2048), catch-up window 10.
  - W2 first load: nothing under the intro, `game_ready` on the intro's
    first frame (slow phone 6.3 s → 0.63 s).
  - W3 synthesized audio and music, with a Music toggle.
  - W4 story polish.
  - W5 economy: half wages L41–90 (skipped when unaffordable), +1 menu
    guest from L51, guest-only tables don't block; completionist $187,057.
- `releases/KnifeCraft-Playgama-v1.3.0.zip` is built (gitignored, rebuild
  from `main`). Uploading it to Playgama and the real-Bridge check are for
  the developer to do.
- **Protocol (developer 2026-10-11):** no commit, push, merge or deploy
  without explicit approval. Report only test results that actually ran.
- **Waiting on the developer:**
  - the supplier change (alternative: Wholesale −15%, Premium quality +1%);
  - F5 provisional values (bulk tiers, Endless events, Today's Special)
    after their Level 1–60 playtest;
  - the deferred campaign-data split (startup bundle).
- Codex / experiments: work on a branch (`codex/...`); only a push to
  `main` deploys Pages.
- History, the old audits and the numbered log: `docs/HISTORY.md`.

## 6b. Current state (2026-10-09, end of session)

- `main` has Passes 1–3 and the Pass 2 review fixes (pushed 2026-10-09 at
  the developer's request for testing on Pages).
- Release order agreed: Pass 1 → Pass 2 (+ review fixes) → Pass 3, then
  test Levels 1–15 together on Pages before `main`.

### Running the browser tests in the cloud container
- Serve: `npx vite preview --host 127.0.0.1 --port 4173 --strictPort`
  (plain `localhost`/IPv6 fails); classic build:
  `VITE_RESTAURANT_MODE=0 npx vite build --outDir /tmp/claude-0/classic-dist`
  served on 4174.
- Chrome: `CHROME_PATH=/tmp/claude-0/chrome-nosandbox.sh` (a wrapper:
  `exec /opt/pw-browsers/chromium-1194/chrome-linux/chrome --no-sandbox "$@"`),
  `KC_URL=http://127.0.0.1:4173/`.
- The Bridge CDN is blocked here: run the tests from a COPY of
  `tools/e2e` (`/tmp/claude-0/e2erun`, node_modules symlinked) whose
  `harness.mjs` answers `https://bridge.playgama.com/...` with the official
  npm build (`/tmp/claude-0/pgb/package/dist/playgama-bridge.js`) via
  `page.setRequestInterception` (cooperative: respond priority 1000,
  continue priority 0). `lazyload.mjs` intercepts itself: run it with
  `KC_OWN_INTERCEPT=1` and let its own handler serve the Bridge. Never
  commit these test-env patches.
- `restaurant*.mjs` on the restaurant build; every other e2e on the
  classic build. Run them one at a time (parallel runs time out).

## 7. Useful facts

- Starting wallet $1,240.00 (124,000 cents). Levels 1–10 on a first run pay
  $667 in order settlements + $636 completion rewards (after the G2 fix).
- Intro timing: Part 1 7.6 s, Part 2 6.0 s, Part 3 7.9 s; measured live
  22.4 s including two prompt button presses; Skip closes in ~130 ms.
- Bundle impact of the story change: main JS +~0.4 KB gz, CSS +~0.2 KB gz.
- Tests run in headless Chrome only; no real-device test has been done yet.
