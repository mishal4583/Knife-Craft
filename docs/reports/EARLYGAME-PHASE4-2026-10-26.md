# KnifeCraft — Early-game transformation, phase 4 (2026-10-26): everything by Level 5, paid staff hires

Base: `claude/early-game-walkins` at `057d728` (phase 1 `e0523e5`, phase 2 `362553e` + `a046786`,
phase 3 `057d728`) on `main` `1965342`. Work: `claude/early-game-unlocks`. Not merged or
deployed; nothing uploaded to Playgama. **No save field added.**

Developer direction (2026-10-26): "I need everything to be unlocked at or before level 5. just do
it", then "don't make any staff hire for free, let them pay for it".

## 1. What was found first

- Hiring already opened with Business at L5 (since phase 2), but every role was free and unpaid
  until L29. Free early hires paid off: each cook or server adds a seat (from L16 a free
  walk-in), a Prep Cook takes 3 % off ingredients, and a Cleaner cleans for free.
- Knives, boards, kitchen tiers, kitchen helpers, the Second Floor (L10, stations L60), map rooms
  (up to L71) and Progress (L10) opened through Level 60+.

## 2. What changed

**Everything for sale or open by Level 5** (`config/earlyUnlocks.ts`, `EARLY_UNLOCK_CAP` = 5):

| What | Before | Now |
|---|---|---|
| Knives (Santoku … Obsidian) | L5–L56 | **L5** (same prices) |
| Cutting boards | L5–L66 | **L5** |
| Kitchen tiers (Growing … Grand) | L16 / 29 / 35 / 46 / 56 | **L5** (same $16k–$29k; still in order) |
| Kitchen helpers | L13 / 32 / 44 | **L5** |
| Staff roles | L5 (free) | **L5, paid** |
| Specialist chefs | their cuisine's level (L16–59) | **L5, paid** |
| Second Floor / its 6 stations | L10 / L60 | **L5 / L5** |
| Map rooms (incl. the Dining Area) | up to L71 (Dining L31) | **L5** (the Restroom with its Cleanliness tab, L10) |
| Progress section | L10 | **L5** |

**Not moved** (they are rules, not unlocks):
- the campaign's teaching stages: fridge, dine-in, staff *requirements*, cuisines, takeaway …
- cleaning (L10) and the tools requirement (L10);
- the menu dishes, which follow the cuts taught;
- Endless (after L150).

**Paid hires** (`staffRequirements.ts` `hireRestaurantStaff`):
- **The fee:** every role and chef pays `HIRE_FEE_DAYS` (3) days of its full wage once, in whole
  dollars, with one `staff-purchase` ledger entry:

  | Prep Cook | Line Cook | Head Chef | Server | Cleaner | Manager | Each specialist |
  |---|---|---|---|---|---|---|
  | $120 | $136 | $210 | $113 | $84 | $180 | $136 |

- **Every hire:** all-or-nothing; letting go refunds nothing; hiring again pays again.
- **Wages are unchanged:** nothing before L29, half pay to L55, full from L56.
- **No soft-lock:** if the next service **requires** a hire and the wallet can't cover the fee,
  the fee goes on the existing supplier credit. It is owed and repaid from the next earnings.
  An optional hire that's short is refused ("Not enough money — need $X more.").
- **Classic Business Mode:** its free hire is unchanged.

**Copy and display:**
- Hire buttons read "👋 Hire · $120.00"; "Free" copy is gone; the "coming up" notice names the
  chef's fee.
- The check's "To hire" row shows the total fee; the Cleaner card shows its fee.
- The Level 10 card still names the Santoku and Maple Board (now the cheapest knife and board).
- A level's old "Unlocks: Cleaver" hint (L28) no longer shows, because it is false now
  (`liveUnlockReward`).

**Follow-ups fixed:** the Dining Area opens at L5 (was 31), and the check's "1 dishes" / "1 stock
items" are now singular.

**Old saves:** hired staff stay hired, and nothing is re-charged. Wallet and ledger are kept. A
pre-V2.5 save keeps exactly the kitchen tiers its level granted (`LEGACY_KITCHEN_GRANT_LEVEL`) —
the cap never hands out tiers.

## 3. Economy (simulator, Level 150)

| Profile | Phase 3 | **Phase 4** | Change | Why |
|---|---|---|---|---|
| Saver | $269,069 | **$267,682** | −$1,387 | exactly its 10 required hires' fees |
| Completionist (Local) | $134,203 | **$132,916** | −$1,287 | the same fees, minus timing ripples |
| Completionist (Wholesale / Premium) | $134,393 / $135,825 | **$133,073 / $134,107** | −$1,320 / −$1,718 | |
| Prudent completionist | $134,353 | **$132,855** | −$1,498 | fees; lowest cash $399.95 at L35 (the Indian Chef's $136 + that service's supplies), never credit |
| Broke player | $70,354 | **$70,354** | $0 | its 10 required hires went on supplier credit ($1,387) and were repaid |

**What else happened:**
- **Early unlocks barely moved the totals.** The simulated buyers are limited by cash, not by
  unlock levels, and prices are unchanged.
- **The completionist's purchases** are $168,430 of items (as before) plus $1,115 of fees paid
  from the wallet; two fees ($272) went on credit.
- **Other figures:**
  - the frozen campaign figure is unchanged (Net $101,005, all freeze gates pass);
  - the classic (non-restaurant) simulation moved by ±$12 (purchase timing);
  - Endless start $134,203 → $132,916.
- **Band:** the completionist stays inside $100k–$150k.

## 4. Tests

**Gates:**
- typecheck clean; ESLint 0 errors and the same 9 warnings; build and preflight pass;
- Prettier clean on every changed file that was formatted at the base. The three catalogs
  (knives, boards, kitchen tiers) were not, and are left so.

**QA:** 124 suites, one run per change set:
- the final full run: 122 pass;
- `staff-hire-qa` A1: fixed after that run, passes;
- `phase5-qa` A1 / A3: compare the working tree with `HEAD` and pass once committed (verified
  after the commit).

**New `staff-hire-qa`** (21 checks):
- the fee table;
- one charge, refused when short, already hired, re-hire, L4 refused;
- specialists from L5;
- wages unchanged and paid in one place;
- a paid hire adds a seat;
- every unlock ≤ L5 with no price changed;
- old saves, and the pre-V2.5 tier migration;
- the App wiring.

**Expectations changed on purpose** (a comment in each, citing the developer's 2026-10-26 rule):

| Suite | Old expectation | New |
|---|---|---|
| `restaurant-second-floor-qa` | floor L10, stations L60 | L5 / L5 |
| `restaurant-first-levels-qa` | Progress L10; Santoku / Maple L10 | L5 |
| `restaurant-backoffice-qa` | Growing Kitchen locked at L5 | checked at L4 |
| `restaurant-progression-qa` S6 | specialist only from its cuisine | from L5 (the plain add moves no money) |
| `restaurant-campaign-sim-qa` B3 | "free hiring" | required hires on credit, all repaid |
| `restaurant-final-economy-qa` T3 / S3 | purchases $168,430; prudent ≥ $400 | + fees paid from the wallet; ≥ $350 |
| `economy-v2-*` (equipment, final K2–4, staff C) | catalog / helper levels | capped at L5 |
| `economy-v25-qa` A1 / A5 | $31,674 / $29,808 | $31,686 / $29,796 |
| `level-ux-qa` S1, `progression-preview-qa` C / D / H / K7 | hints of tiers and knives after L5 | no late unlock hints; tiers in order, for sale by L5 |
| guards (`oven-step` E1 / E2, `next-kitchen-strip` E1, `service-floor` E1, `early-menu` E1) | the files they pin are unchanged | only the files this phase must change are excluded, each named; in App.tsx only lines inside `hireStaff` and the walk-in label |

**Browser:**

| Test | Result |
|---|---|
| `paidstaff.mjs` (new) | 6/6 at 320 and 390 px: buttons show fees, one $120 entry, refused at $50, Mexican Chef at L5, Second Floor open at L5 |
| kitchenstrip, marketsecondfloor, restaurantsecondfloor, staff | 5/5, 6/6, 11/11, 7/7, after their level pins were updated |
| restaurantstafflife, earlymenu, walkins, restaurantguests, restaurantmenu | 5/5, 6/6, 6/6, 9/9, 5/5 |
| levelflow, restaurantday, practicepay, ovenrecipes | 12/12, 9/9, 4/4, 7/7 |
| restaurantfirstlevels | 13/13 (the established page-load variant) |

- **Known baseline failures:** `ingredients.mjs` (14 of 20) and `supplies.mjs` (1 of 13) fail the
  same checks as on `1965342`.
- **Screenshots:** `paidstaff-320.png` and `paidstaff-390.png` (the local e2e `out/`).

## 5. Limits

- A Level 5 player can see every kitchen tier but can't afford one yet ($16,000 for the first).
  Prices were not changed in this phase.
- The day Cleaner (per-day wage or ad) and a hired Cleaner now both cost money.
- The refused-walk-in behaviour from phase 3 is unchanged.
