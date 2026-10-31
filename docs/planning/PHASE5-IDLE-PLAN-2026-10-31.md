# KnifeCraft — Phase 5: the idle economy (plan, 2026-10-31)

Request (developer 2026-10-31): "make a good and engaging plan for phase 5", with the status list:
Second Floor real-time 🟡; general idle production tied to demand, staff, stock and capacity ❌; an hourly gross/net
display ❌; offline earnings for the main restaurant ❌.

Name note: the repo already has an older "Phase 5" (Economy V3: `phase5-qa`, `phase5.mjs`, the gift streak "Phase 5 (B)").
This plan is the **idle phase**; its files and suites are called `idle-*`, `pace-*` and `away-*` so the two never mix.

Nothing here is built yet. This is the plan; Section 7 lists what I need from you.

---

## Status (2026-10-31, built, working tree, not committed)

Developer answers: "let the second floor stay real hours, rest do what best" → D11 later, D12 shift hour, D13 one combined
sheet, floor achievements badge-only. Steps 5A–5E are built; differences from the text below, found while building:

- **5A source of the numbers.** The plan said "the day history". In the campaign that history is empty until full
  operation (Level 54): the campaign closes through `closeDay`, which only runs the Business-day ledger from then on. So
  `closeDay` now saves each closed day's takings and running costs **from the wallet's own ledger** (entries after the
  day's opening mark), in `restaurantDay.paceDays` (latest 7, optional fields, old saves read). A day opened by an older
  build, or whose mark has left the kept ledger, records nothing rather than a wrong total.
- **5A no "total net".** The restaurant is per shift hour and the floor per real hour, so they are shown side by side and
  never added (the sample card below showed a total; it is not built, on purpose).
- **5B** built: bars and "Full in …" per station and for the floor, the takings lie on the Pickup Counter as a tappable pile
  (the table-cash bundles), the map's upstairs button shows the amount and "full". The Floor Server / Cleaner reasons were
  already on the station panels.
- **5C** built: the welcome-back sheet (after the daily gift) also lists the Second Floor's pile and the table cash as free
  rows; the ad line is the unchanged `welcome_back` bonus. Shown when away 30+ min and there is something to take or an ad to
  offer. No new free money.
- **5D** built: Closing Time names what waits on the Second Floor (optional, Close does not wait for it); badge-only
  achievements for $1,000 / $10,000 / $50,000 lifetime floor takings (`ach-floor-*`, reward 0). **Not built:** "collected a
  full floor 7 days running" (it needs a new streak record) and a separate "best time to check in" line ("Full in …" is that line).
- **5E changed.** The clock guard was **dropped**: reading the code, the only way to earn extra with the clock is to move it
  forward, which no client-side guard can stop; going back and forward again earns nothing extra, and collecting at a
  far-future clock freezes the timers until real time catches up. Locked in by `idle-qa` C1–C4. The 10-hour cap stays the limit.
- Tests: `scripts/idle-qa.mts` (23 checks), `tools/e2e/idle.mjs` (4), `tools/e2e/welcomeback.mjs` (7). The frozen campaign
  baseline and `restaurant-final-economy-qa` were run and did not move: Phase 5 adds no money source.

---

## 0. The idea in one line

> **The restaurant is something you run every day. Idle money is what is waiting for you when you come back — never a
> reason to stay away.**

You decided two things that shape everything below:

- **No free offline income** for the main restaurant: "we are the ones who hire staff for daily" (D5, 2026-10-31).
- **Welcome back** instead: a few hours of earnings, only for a rewarded ad, no free part (built, commit `d0c3b93`).

So the pasted list's last line, "offline earnings for the main restaurant are not built", is **decided, not missing**:
the main restaurant pays you for the services you play; the only time-based money is the Second Floor (real time, capped)
and the ad-gated Welcome back. Phase 5 makes that loop **visible, readable and rewarding to come back to**.

## 1. What exists today (checked in the code)

| Piece                                                             | State               | Where / evidence                                                                                                       |
| ----------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Second Floor earns in real time                                   | ✅ built            | `restaurant/secondFloor.ts`: five stations, $10–$41 an hour per station by level (Lv 1/2/3), all five at Lv 3 = $154/h |
| Cap of 8–10 hours                                                 | ✅ built            | `CAP_HOURS = [8, 9, 10]` for Lv 1/2/3; past the cap it simply stops                                                    |
| One ledger entry per collect                                      | ✅ built            | `collectFloor` → one `automation-income` entry, every clock restarts                                                   |
| A clock set backwards earns nothing                               | ✅ built and tested | `restaurant-second-floor-qa` E3; a forward jump is still capped                                                        |
| Staffing rules                                                    | ✅ built            | a Floor Server runs 2 stations, a Floor Cleaner keeps 3 clear (−25% per missing cleaner)                               |
| "Earning now: $X/h" on the Second Floor                           | 🟡 gross only       | `MarketSecondFloor.tsx` (`floorPerHour`)                                                                               |
| Welcome back ad bonus                                             | ✅ built            | `adBonuses.ts` (`welcome_back`), `welcomeback.mjs` 6/6                                                                 |
| Auto service (Prep Cook cuts, serves)                             | ✅ built            | Phase 4, runs only while the player is in the game                                                                     |
| Restaurant takings, wages, supplies per day                       | ✅ in the data      | `serviceReport.ts`, day history, `dailyPayroll`, ledger categories                                                     |
| Hourly gross/net for the whole business                           | ❌                  | nothing combines the pieces above                                                                                      |
| "What happened while you were away"                               | ❌                  | the Second Floor pile is only seen if you open the Pickup Counter                                                      |
| General idle production tied to demand / staff / stock / capacity | ❌                  | decision D11 below (I recommend **not now**)                                                                           |

## 2. The plan: five steps, each shippable alone

### 5A — The Pace: hourly gross and net (the number idle players love)

**What the player sees.** One card, "Pace", on Business → Overview and in the Closing report:

```
PACE · per hour                     Today      Average
  Restaurant   gross   +$412/h      +$388/h
               costs   −$118/h      −$120/h      (wages, supplies, upkeep, spoilage)
               net     +$294/h      +$268/h
  Second Floor net     +$96/h       (waiting: $384 · full in 2 h 10 m)
  ─────────────────────────────────
  Total net            +$390/h
```

- **An "hour" is a shift hour.** The game already pays staff by the shift hour (`SERVICE_SHIFT_HOURS`, hourly wage ×
  shift hours). Restaurant gross per hour = a day's takings ÷ the day's shift hours, so the staff wage and the income are
  on the same clock and net = gross − costs reads true. The Second Floor stays on **real** hours (that is how it earns).
- **Pure and derived.** No new save field: it reads the day history and ledger that already exist (the same single
  source of truth rule). `economy/pace.ts` (new, pure, no `Math.random`, no wallet, no ledger).
- **Short copy.** Numbers and icons; the longer explanation (what counts as a cost, what an hour is) goes behind an ⓘ
  (`InfoTip`), as the UI rule requires.
- **Honest.** Costs include everything the ledger already charges the day: wages, supplies, upkeep, spoilage, fines. If
  a day has no data (a new game) the card says "Serve your first day" instead of a zero.

**Tests.** `pace-qa` (new): gross − costs = net to the cent; the daily figure ties back to the ledger for a simulated
campaign (no money invented); no division by zero on a day with no shift; old saves read; text sizes and copy guards
(`ui-copy-qa`). Browser `pace.mjs`: the card shows after one served day, matches the closing report, fits 320×568.

### 5B — The Floor you can feel (visible, tempting, never nagging)

Today the floor is a screen you must remember to open. Make its progress **visible where the player already looks**:

1. **Cash piles at the Pickup Counter.** Reuse the table-cash bundles (`TableCash`, `bundleCount`): what the floor is
   holding is drawn as bundles on the counter on the restaurant map, growing as it fills. Same tap-to-collect language the
   player learned from the tables.
2. **Fill meters and "full in".** Each station shows a bar and "full in 2 h 10 m"; at the cap the bar turns amber and says
   "Full — not earning". A single "Collect $384" button at the top (already one ledger entry).
3. **Map badge.** At 80% full and at full, the Pickup Counter gets the existing attention badge (`attentionBadges.ts`):
   the badge the map already uses for things that need attention, never a popup.
4. **Why it is slow.** If a station earns nothing, say why in one line: "needs a Floor Server" / "tables not cleared: −25%".
   (The numbers exist; the reason is not shown today.)
5. **Upgrade preview.** The card for a station shows "Lv 2: +$6/h · pays back in 38 h" — the data is already there
   (`perHour`, price); this just puts it where the player decides.

**Tests.** extend `restaurant-second-floor-qa` (fill fraction, time to full, cap, backwards clock still 0, reason text);
browser `floorfeel.mjs`: bundles on the map grow with time (seeded timestamps), the badge shows at 80%, one tap collects,
wallet = ledger.

### 5C — While you were away (one calm return moment)

Welcome back is already built, but on return the player can meet **three separate things**: the daily gift, the Welcome back
ad, and the Second Floor pile. Make that one short, ordered moment:

```
🌙 WELCOME BACK · 3 h away
  Second Floor      $288  waiting            [Collect]            (free)
  On the tables     $64   waiting            [Collect]            (free)
  A few more hours of earnings  +$90         [📺 Watch]           (ad only)
                                             [Later]
```

- **The free money is only what the player already earned** (the floor's capped real-time pile and the table cash that
  was left). **No new free money is created.** The ad line is the existing `welcome_back` bonus, unchanged.
- **One sheet, one order:** daily gift → this sheet. No stacking of popups; "Later" never loses anything.
- **Calm rules kept:** it opens only on the Kitchen or map when nothing else is on screen (`homeCalm`), never over a
  service, a card or an ad.

**Tests.** `away-qa`: what the sheet offers is derived from the save and equals the ledger when collected (one entry per
pile, no entry for an empty one); the ad line appears only when ads are available and the cap is left; no double count
with the Second Floor ×2 ad. Browser `whileaway.mjs`: seeded 4 h away shows the three lines; collecting the floor and the
tables pays exactly their amounts; reload shows nothing again.

### 5D — Closing the loop: daily rhythm (small, high value)

The design comment on the floor already says "checking in twice a day pays". Turn that into a gentle rhythm without a
clock the player must obey:

- **"Best time to check in"** line on the Second Floor card (the hour it fills, from the cap), no notification.
- A **Closing Time** line: "Second Floor: $X waiting" so the night ritual (collect, chores, count) includes the floor.
- Achievements **without money** (pure pride): "First $1,000 from the floor", "Collected a full floor 7 days running".
  (Achievements that pay money change the achievement economy, so these are badge-only unless you say otherwise.)

**Tests.** `achievement-rewards-qa` untouched (no money); `ui-copy-qa`; a small `floor-rhythm` browser check.

### 5E — Safety and honesty for time-based money

- **Clock rules (kept):** backwards earns nothing, a forward jump is still capped; never negative.
- **One new guard (cheap):** remember the latest time the game has seen, in the existing floor state, and treat a clock that
  moves backwards **past** it as "now = latest seen" for new timers, so setting the clock back and then forward cannot
  re-earn time. Old saves read (missing field = no guard).
- **Accepted limit:** a determined player can move the clock forward a day to fill the cap once per change. It is a
  single-player game, the cap is 10 h, and the money is "extra on top of the campaign" by your rule; a server clock is not
  available. I document it rather than build a fake fix.
- **Economy bound:** `ad-bonuses-qa` F already bounds the ads at ~9.6% of the $292k target. Phase 5 adds no new money
  source, so `restaurant-final-economy-qa` and the frozen campaign baseline must not move at all; both are run unchanged.

## 3. Idle production tied to demand, staff, stock and capacity (D11)

The pasted list wants "general idle production" for the main restaurant. With D5 decided, the only safe version is
**production while the game is open**, not while it is closed. Two honest options:

|                            | Option 1 (recommended now)                                                                                        | Option 2 (later, if the numbers ask for it)                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idea                       | The Pace card (5A) _shows_ how demand, staff, stock and capacity limit each hour; the player fixes the bottleneck | "Staff-run services": with Prep Cook + Line Cook + Server hired, a quiet service replays on a timer while the app is open, using real stock and seats |
| New money                  | none                                                                                                              | yes (side income, capped)                                                                                                                             |
| Risk                       | none                                                                                                              | needs its own cap, an economy sim, and a way not to bypass the campaign (it must not give level progress)                                             |
| Fits "we hire staff daily" | yes                                                                                                               | yes, but doubles Auto's job                                                                                                                           |

**Recommendation:** ship 5A–5C first and read the Pace numbers for a while. If the players are left with nothing to do while
they wait for stock, build Option 2 as **Phase 5F** with its own plan. This is exactly the "who automates what" question
(D10) you left open, so the two should be decided together.

**The Pace card is also the bottleneck finder.** A one-line tip under it names the limit that costs the most per hour right
now: "Capacity: the fridge is full — 3 dishes can't be stocked" / "Staff: no Server — tables are idle" / "Demand: the menu
is small". It uses data that exists (`marketNeeds`, `staffRequirements`, `endlessDemand`, fridge usage), so it needs no new
rule — it only points.

## 4. Order of work and size

| Step | What                                  | Size         | Needs your decision   |
| ---- | ------------------------------------- | ------------ | --------------------- |
| 5A   | Pace card (hourly gross/net)          | medium       | D12 (what an hour is) |
| 5B   | Floor you can feel                    | medium       | none                  |
| 5C   | While you were away sheet             | small–medium | D13                   |
| 5D   | Rhythm lines, badge-only achievements | small        | none                  |
| 5E   | Clock guard, docs, bounds             | small        | none                  |
| 5F   | Idle production while the app is open | large        | D11 + D10             |

5A first (everything else quotes its numbers), then 5B and 5C, then 5D and 5E. Each step ends green on its own gates:
tsc, ESLint 0 errors, Prettier on changed files, build, preflight, the suites it touches, and a browser check at
320×568, 360×640, 390×844, 430×900 and 768×1024.

## 5. Rules this plan keeps

- One wallet, one ledger, **one entry per real movement**; the pace is derived, never stored.
- No new top-level save field; the clock guard lives inside the existing `business.secondFloor` state.
- Old saves work (every new field optional). Determinism: no `Math.random()` for money.
- Money from the floor stays "extra on top of the campaign economy"; the frozen baseline does not move.
- Inventory stays read-only; the Market stays the only place to buy.
- Short game copy, long text behind ⓘ; touch targets ≥ 48 px.
- English only; no external requests; ads only through `PlayablesSDK.ts`.

## 6. How the player feels it (the engagement thread)

1. Morning: the sheet says what waited overnight — "$288 on the floor, $64 on the tables" — and offers one optional ad.
2. Service: Auto and the Prep Cook run the grind; the Pace card says whether hiring one more person pays.
3. Closing: collect the tables, collect the floor, do the chores, count — one ritual, nothing forgotten.
4. Night: the counter's bundles keep growing; the floor shows when it will be full. Tomorrow has a reason.

## 7. Decisions for the developer

| #   | Decision                                                                                                                | My recommendation                           |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| D11 | Production while the app is open (Option 2, §3): build now, later, or never?                                            | Later (5F), after the Pace numbers are seen |
| D12 | An "hour" for the restaurant = a **shift hour** (the unit staff are paid in); the Second Floor stays on real hours. OK? | Yes                                         |
| D13 | On return, one combined "While you were away" sheet (free money = only what was already earned + the one ad line)?      | Yes                                         |
| D10 | Who automates what (carried over): one Prep Cook switch, or Prep Cook + Line Cook + Server                              | Decide with D11                             |
| —   | Achievements for the floor: badge-only, or with money?                                                                  | Badge-only                                  |

Not in Phase 5, by your decisions: free offline income for the main restaurant (D5), push notifications, server time.
