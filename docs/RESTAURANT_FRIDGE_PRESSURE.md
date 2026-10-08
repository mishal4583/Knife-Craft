# Fridge pressure: measurement and decision (2026-10-06)

> **Update 2026-10-08 — realistic portions.** Stock per plate fell ~2.5× (a 0.3 lb tomato, not a
> pound per technique step), so the completionist's fridge peak is now L91 35 / L250 51 of 140
> (was 61 / 102): the bigger fridges matter later. Whether to shrink capacities is open for the
> developer (docs/HANDOFF.md, item 42). The numbers below are the 2026-10-06 measurement.

The brief: measure with the current values first, then make the smallest
evidence-based change. No fixed-level forcing, no capacity cuts, no
soft-locks.

Measured by `scripts/restaurant-fridge-pressure-qa.mts`. It observes the
real simulations step by step and changes nothing about how they play:

- the completionist and a diligent player of the full restaurant
  simulation (`scripts/restaurantCampaignSim.mts`);
- the Endless Restaurant, 30 days (`scripts/restaurant-endless-qa.mts`
  `playDay`, events on).

Units are ingredient units (one fridge slot each).

## Campaign — completionist (buys every item)

| Level | Menu | Orders | Bought | Used | Spoiled | Peak / capacity | That day's whole need |
|---|---|---|---|---|---|---|---|
| L11 | 4 | 2 | 0 | 0 | 0 | 0 / 40 Basic (0 %) | 0 (stock from L15) |
| L31 | 11 | 1 | 8 | 1 | 0 | 8.3 / 40 Basic (21 %) | 8.1 (20 %) |
| L51 | 18 | 4 | 11 | 11.1 | 0 | 11.1 / 40 Basic (28 %) | 31.4 (78 %) |
| L71 | 25 | 4 | 19 | 19.1 | 0 | 19.9 / 80 Commercial (25 %) | 40.2 (50 %) |
| L91 | 29 | 5 | 21 | 21.1 | 0 | 28.7 / 80 Commercial (36 %) | 49.9 (62 %) |
| L121 | 42 | 5 | 12 | 12.5 | 0 | 27.2 / 140 Professional (19 %) | 32.5 (23 %) |
| L161 | 48 | 5 | 14 | 13.6 | 0 | 30.4 / 140 Professional (22 %) | 46.4 (33 %) |
| L181 | 48 | 5 | 15 | 14.5 | 0 | 30.3 / 140 Professional (22 %) | 43.5 (31 %) |
| L250 | 48 | 3 | 8 | 7.7 | 0 | 23.4 / 140 Professional (17 %) | 66.7 (48 %) |

- Highest occupancy over the whole campaign: 45 % (L61, guest stock).
- The two fridge upgrades (L70 → Commercial, L92 → Professional) are the
  completionist buying every item. No upgrade was forced by a full fridge.
- No level reached the 85 % "nearly full" mark.
- Events: none, since events are Endless only.

## Campaign — diligent player (buys a fridge only when one is full)

- Stays on the **Basic 40** for all 250 levels.
- Peak 70 % (L206, menu-guest stock).
- No step reached 85 %, and no upgrade was forced.

## Endless Restaurant (30 days, events on)

| Restaurant | Customers/day | Bought | Spoiled | Peak / capacity | Biggest day's whole need | Events |
|---|---|---|---|---|---|---|
| Fully staffed, 48 dishes | 71.9 | 6,547 | 0.3 | 22.8 / 140 (16 %) | 272 units (195 % of the fridge) | rush 4, group 4 days |
| Thin staff, 48 dishes | 30.6 | 2,770 | 2.3 | 22.7 / 140 (16 %) | 111 units (79 %) | rush 4, group 4 days |

## Why the fridge never binds

The Pre-Service Check (and the Endless restock) asks only for what the next
service (or order) is short of. Stock arrives just in time and is used
straight away:

- spoilage is about zero;
- the fridge holds only one service's food;
- the restaurant's growth never meets the fridge's limits.

A day's whole need does grow, from 20 % of the fridge at L31 to 78 % at
L51 on the Basic, and in Endless to twice the largest fridge. The pressure
exists, but only for a player who stocks a whole day at once, and the game
never asks for that.

## Decision

**No value was changed.**

- The fridge sizes (40 / 80 / 140) and freshness are not the cause, and
  cutting capacity or forcing upgrades at fixed levels is ruled out.
- The one natural lever is how much a player stocks at once: per service,
  as now, or per restaurant day.
- Moving the check to a per-day restock would make the Basic tight around
  L51 and the Commercial around L91–L101, with no forcing. But it changes:
  - the purchase flow (core gameplay);
  - spoilage risk (economy).
- Because of that, it is left to the developer and the economy pass
  (`docs/ECONOMY_TODO.md` row 30), not made here.
