# KnifeCraft — Phase 8: customer variety and service quality (plan, 2026-11-01)

Request (developer 2026-11-01): "plan for phase 8", with the status list: special customers and tips exist 🟡 (mystery
guest, hygiene tip share); demand that scales with capacity ❌ (apart from some endless-mode demand logic).

Nothing here is built yet. Section 7 lists what I need from you.

---

## 1. What the game does today (read from the code, not from memory)

**Who comes (demand).** Campaign services take the level's own orders, then **menu guests** and **walk-ins**:

| Part | Rule today | Source |
|---|---|---|
| Menu guests | a fixed schedule by service: 1 from L5, 2 from L14, 4 from L33, 5 from L74, 6 from L115 | `MENU_GUESTS_SCHEDULE` |
| Seats | +1 / +1 / +2 once the kitchen is Neighborhood / Flourishing / Grand | `kitchenGuestSeats` |
| Walk-ins | 1 per service from the menu's level | `WALK_IN_RULES` |
| Capacity (a cap) | chef 2 + Prep Cook, Line Cook, Server, Head Chef 1 each + 1 per specialist = **10** at most | `GUEST_CAPACITY_RULES` |
| Pace | guests arrive every 35 s → 28 s → 22 s, patience 150 s → 120 s → 100 s; a walk-out is a lost sale only | `serviceFlow.ts` |

So **demand is a fixed timetable.** Nothing the player builds (menu size, reputation, a spotless kitchen) brings more
guests. And the capacity cap almost never binds: the most a service can ask for is 6 + 2 seats + 1 walk-in = 9, and
a full team serves 10. Hiring past what the timetable needs buys nothing, and a bigger menu pulls nobody. The
**Endless Restaurant** is the only place with a real demand rule (`endlessDemand.ts`: classic customers × popularity ×
menu pull, capped by team capacity).

**Who they are (variety).** 12 named customers (a name, an emoji, one greeting line) and 5 **personalities** (Food
Critic, Impatient Regular, Mystery Guest, Grandma's Old Friend, Big Bruno). A personality is **presentation only**:
the 5th eligible order gets the next one in a fixed rotation, with an arrival card and a reaction line that follows
the dish's real grade. They pay and tip like anyone else, the Mystery Guest "reveals" a name and nothing happens,
and nothing is remembered (`personalities.ts`, the page session).

**How well we served them (quality).** Tip = 5 / 10 / 15 % of the pay for Honest / Clean / Masterful, scaled by the
hygiene share (`customerTips.ts`, `tipAfterHygiene`). A spotless streak adds a little to the quality share
(`serviceReport.ts`). Popularity moves daily with a pull toward the day's quality (`PopularityManager`), and the
Phase 5 floor adds up to +3. The City Ranking is reputation by services finished. There is **no per-service result
the player can read** ("how did tonight go?"), and walk-outs are not counted anywhere (the floor state is never saved).

**What is already good and must stay:** the level's own orders are deterministic and teach; a level can always be
finished; a walk-out costs nothing but the sale; no `Math.random`; one ledger entry per movement; the frozen campaign
baseline (Revenue 69,925 · Net 299,874) does not move.

---

## 2. The idea in one paragraph

**A restaurant fills up with what you have built, and you can see why.** Guests come in proportion to your standing
(reputation, menu, a clean kitchen, the hour of the day); the room and the team decide how many you can serve; the
guests you cannot serve are visible, and so is what would serve them. The guests themselves come in a few kinds that
behave differently in ways you can read at a glance (the hurried one, the family, the foodie), and every service ends
with a short **Service Report** — stars, wait, tips, walk-outs — so "service quality" is something the player aims at,
not a hidden multiplier.

Three rules keep it safe:

1. **Extra guests only ever add.** The level's own orders and today's schedule stay as the floor (so the early game and
   every lesson are untouched); pull adds on top, never takes away.
2. **No hidden math.** Every effect on a guest is a thing you can see on the card (a clock, a badge, a number of
   places), as the customers brief (§55) already says: "no complicated personality stats".
3. **No new money source, no new wallet.** Extra guests pay the dish's menu price through the existing Business
   payment rule, and are checked against the final-economy sims before they ship.

---

## 3. The plan, in steps

### 8A. Demand that scales (the headline)

A service's guests become **min(demand, capacity)**, where:

```
DEMAND   = today's timetable (the floor)
         + pull, 0 … +PULL_MAX, from four things the player owns:
             reputation   — the popularity score (tiers, like the Endless rule)
             menu         — how many cookable dishes are on the active menu (a dish nobody can cook pulls nobody)
             hour         — the shift: lunch and dinner rush (+1), afternoon tea is quiet (0)
             spotless     — the last service ended spotless (+1)
CAPACITY = seats (kitchen tiers) + team (today's rule), now able to be the limit
```

- The timetable stays as written, so nothing before the menu opens, and no level's own orders, change.
- The **hour** uses what already exists: a day has named shifts (Breakfast, Brunch, Lunch, Afternoon Tea, Dinner, Late
  Supper). A rush is a real reason to have the team and seats ready.
- To make capacity matter, `PULL_MAX` is sized so a developed restaurant asks for more than a thin team serves
  (e.g. 12–13 at the top against a full team's 10), so the next hire or the next kitchen tier shows up as more guests
  served. This is the "demand that scales with capacity" line: **both ends move, and the smaller one rules.**
- Guests the room or team cannot take are counted as **turned away** (new, see 8C). No penalty.
- The Endless Restaurant keeps its own rule (`endlessDemand.ts`), unchanged; the campaign rule borrows its shape so the
  two read the same.

New pure module `restaurant/guestDemand.ts` (`demandOf(save, level)` → `{ base, pull: {reputation, menu, hour,
spotless}, capacity, served, turnedAway }`); `menuGuestsFor` / `walkInsFor` call it. Nothing else changes in the
order engine.

### 8B. Customer variety (kinds you can read)

Keep the 12 names. Add **kinds**, each with one visible trait on the order card (a badge and a short line), picked
deterministically by service (seeded, like the menu guests):

| Kind | What you see | What it does (one thing) |
|---|---|---|
| Regular | nothing special | as today |
| Hurried | ⏱️ "In a hurry" | patience ×0.6, tips a little more when served inside the window |
| Family | 👨‍👩‍👧 "Table of 3–4" | one ticket, 2–3 dishes, one bigger bill; takes several places (the floor already draws parties) |
| Foodie | 🍴 "Knows their food" | orders from the top of the menu; tips on Masterful only |
| Takeaway | 🥡 "To go" | no table, short patience, uses the packaging the takeaway system already has |

The five **personalities become real**, each with one effect that follows its story:

- **Food Critic**: scores the cuts of that one dish; a Masterful dish leaves a small, capped popularity bump, a weak one
  a smaller dip (read through the existing daily-delta model, no new stored score).
- **Impatient Regular**: tips by how fast it was served (the prep time it already measures).
- **Mystery Guest**: the reveal pays: a tip and a line in the service report ("the food writer was here: 4★"), judged on
  hygiene and quality together.
- **Grandma's Old Friend**: the story one: a kind line, a small tip, a recipe-book memory (no stats).
- **Big Bruno**: a double portion for double pay (the Giant Eater idea, which the order card already hints).

They stay rare (today: every 5th order) and tied to **chapters**, so each cuisine brings its own: a new kind appears
with the chapter that fits (Family with Italian, Foodie with Japanese, and so on), which also makes the 13 chapters
feel different.

### 8C. Service quality, shown (the Service Report)

At the end of each service, the closing card gains a **Service Report** (it joins the Phase 5 "Closing Time" card, no
new screen):

- ★ rating for **this service** (1–5) from three visible parts: dishes (grade), waits (how long, any walk-outs),
  cleanliness (spotless or not). The parts are listed so the player sees which one cost a star.
- covers served · walked out · turned away · tips · average wait.
- one **tip for next time**, chosen from what cost the most ("2 guests left at the door — a Server shortens the wait").

What the rating does (small, capped, all through things that exist): it sets the **tip share** (the hygiene share in
`tipAfterHygiene` becomes the service share: spotless + fast + good grade tips more), it feeds the **daily popularity
pull** (the existing 0.32 pull toward "quality"), and it gives the **spotless** pull in 8A. It never touches pay.

Saved in `restaurantDay` as optional fields (like Phase 5's `paceDays`): the last 7 service results. No new top-level
save field, old saves read.

### 8D. Seeing it (so the player feels the growth)

- **Pickup Counter / map**: the floor shows kinds on the guests (the hurried one taps their foot; the family comes in a
  group), reading the same state.
- **Pace card** (Phase 5): a "Guests per service" line next to money per hour: "6 + 3 pull → 9 served, 2 turned away".
- **Journey** (Phase 7): milestones can say what they bring ("More guests: a Neighborhood Cafe seats 1 more").
- **Achievements** (badge-only, no money): "A full house", "Five-star service", "Spotless week", "Met the critic".

### 8E. Analytics and tests

- Events (stable snake_case, no personal data): `service_report` `{ stars, covers, walked_out, turned_away, guests_kind… }`.
- New suites: `guest-demand-qa` (the floor never drops; pull is capped; capacity rules; deterministic), `customer-kinds-qa`
  (each kind's one effect, rotation, chapter pools), `service-report-qa` (stars from parts, the tip share, saved shape,
  old saves). Browser: `tools/e2e/guests.mjs` (kinds on the floor, the report card).
- Economy: the **final-economy sims** (`restaurant-final-economy-qa`, `achievement-rewards-qa`) are rerun with the pull
  switched on; the frozen campaign baseline is checked unchanged; the lowest-cash check stays; extra income from pull is
  measured and reported in numbers before I ship (I will not guess it here).
- The git-diff guard suites flag new files; new files get documented exceptions (as in Phases 5 and 7).

---

## 4. Order of work

1. **8A** (the rule and its suite, the economy sim) — the base everything else reads.
2. **8C** (the report and the quality share) — gives the player the feedback loop.
3. **8B** (kinds, then personalities) — content on top of a working demand.
4. **8D** (the floor, the Pace line, the badges).
5. **8E** throughout; the full QA loop and the browser tests at the end.

Each step is shippable on its own; 8A + 8C already answer both lines of your status list.

---

## 5. Risks, said plainly

- **The economy.** More guests is more money. Pull is capped, the floor never drops, and the sims run before shipping;
  if the completionist's ending moves past what you want, I trim `PULL_MAX` rather than touching prices.
- **Too much to read.** Five kinds + five personalities + a report is a lot of copy. Each gets one badge and one short
  line; the rest goes behind ⓘ (the copy rule, `ui-copy-qa`).
- **Slow phones.** The floor already animates guests; kinds reuse the same sprites with a badge, no new art or assets.
- **The early game.** Nothing before the menu opens (L5) changes, and the level's own orders are never touched.
- **Hidden randomness.** Everything is seeded per service, as the menu guests are.

---

## 6. What I will not do

No hidden satisfaction number, no per-customer memory across days, no new currency, no review score that blocks
progress, no random walk-outs, and nothing that makes a level impossible to finish.

---

## 7. What I need from you

| # | Question | My recommendation |
|---|---|---|
| D-1 | **Extra guests only add** to today's timetable (it stays the floor) — or let a poor restaurant get *fewer* guests than today? | Only add (safe for the lessons and the early game) |
| D-2 | **How far can demand grow?** Today the most is 9 and a full team serves 10, so capacity never matters. Let a developed restaurant ask for about 12–13, so the team and seats become the limit? | Yes, about 12–13 at the top |
| D-3 | **Rush hours**: lunch and dinner bring one extra guest, afternoon tea none? | Yes |
| D-4 | **Customer kinds**: all five (Regular, Hurried, Family, Foodie, Takeaway), or start with three (Hurried, Family, Foodie)? | Three first, the rest later |
| D-5 | **Personalities with real effects** (critic nudges popularity, mystery guest tips and reviews) — or keep them as story only? | Real effects, small and capped |
| D-6 | **Service Report stars**: shown after every service, or only from the level where cleanliness and the Server open (about L31+)? | From the Server's level, so the early game stays gentle |
| D-7 | **Money for stars or the report?** (Like milestones, I suggest none; the achievements stay the only bonus money.) | None |
| D-8 | **Turned-away guests**: show them ("2 guests left because there were no seats") — a gentle nudge to build — or hide them? | Show them, no penalty |

Say "all recommended" and I start with 8A.

---

## 8. What was built (2026-11-01, "build what is best")

The developer said "build what is best, after building give me a report of added and skipped features", so every
question above was answered with my recommendation. Two of the recommendations changed shape when I met the code:
the pull starts at dine-in (L19), not at the menu (L5), so the early game is untouched (D-1/D-6), and the hour rush is
read from the open day's meal, not a clock.

**Added**

| Step | What | Where |
|---|---|---|
| 8A | Guest demand: timetable + kitchen seats + pull (reputation 60/75 → +1/+2, ≥10 cookable dishes → +1, Lunch/Dinner → +1, last service spotless → +1; capped at 4, from dine-in). Served = min(wanted, team capacity), the rest is turned away. The floor never drops. | `restaurant/guestDemand.ts`, `menuGuests.ts` (`menuGuestsFor`, `serviceGuestPlan`) |
| 8B | Hurried guests: about 1 menu guest or walk-in in 4 from dine-in; patience ×0.7; ⏱️ on their door face. A level's own orders are never hurried. | `serviceFlow.ts`, `Preparation.tsx` |
| 8C | Service Report: ★ 1–5 from dishes (Masterful 2, Clean 1), waits (nobody left, average wait under half the patience), clean (spotless); a part a service did not have is left out. Last 7 kept in `restaurantDay.serviceResults`. Closing card: stars, the three parts, covers / left / turned away / wait, one tip for next time. ±1 on the day's popularity. `service_report` analytics. Never money. | `restaurant/serviceQuality.ts`, `App.tsx` `completeCampaignLevel` |
| 8D | Pace card: "Guests next · Lunch 7", the parts of the pull as chips, turned away, last service's stars, an ⓘ. | `PaceCard.tsx`, `restaurant/guestReport.ts` |
| 8E | `guest-demand-qa` (16 checks) and `service-quality-qa` (25 checks); the git-diff guard exception in `oven-step-qa`; `restaurant-final-economy-qa` V3 updated. | `scripts/` |

**Measured (restaurant-final-economy-qa, the seven players)**

- Menu guests over the campaign: saver 570 → 800, completionist 694 → 863.
- Completionist end: $292,455 → $295,442 (+$2,987, about 1 %); the aim ($250k–$350k) holds; `economy-v2-final-qa` (the frozen baseline) passes unchanged.
- The saver's service-by-service fridge peak: 40 → 79.6. More guests per service need more stock at once, so a Basic fridge is now
  a real limit late in the campaign. Test V3 was changed to say so (a documented rule change, not a loosened assertion).

**Skipped, and why**

- **Family, Foodie and Takeaway kinds** (D-4 said three first; only Hurried was built). Family and Takeaway need the order engine to take a
  multi-dish ticket or a no-table path, and Foodie needs a tipping guest (menu guests do not tip today). Each is a change to the pay path,
  which I would not do without a measured plan.
- **Real effects for the five personalities** (D-5). They are assigned by a per-page-session counter ("a reload starts over"), so money must
  not hang on them yet: that would break the seeded-determinism rule. They first need a seeded per-service assignment, then the effects.
- **The stars changing the tip share.** The stars already include the hygiene part, and tips already scale by the hygiene share; replacing it
  would move money in `phase2-qa`'s guarded tip budget. The stars feed popularity only.
- **Tips and an average wait per guest kind in the report**, and **guest kinds on the floor sprites** (only the ⏱️ badge).
- **Badge-only achievements** ("A full house", "Five-star service", "Spotless week", "Met the critic").
- **Showing the milestone line "More guests: a Neighborhood Cafe seats 1 more"** in the Journey (Phase 7B is not started).
- **A browser test** (`tools/e2e/guests.mjs`): not written; the closing card and the Pace card were checked by the suites' source checks only.
- **A reload mid-service** loses the plates' scores kept for the report (they live in a ref), so that service's report counts only the plates served after the reload.
