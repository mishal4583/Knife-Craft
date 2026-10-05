# KnifeCraft — game map

How the game is organised. Two builds exist while the Unified Restaurant is
under construction (one build switch, `src/game/config/restaurantMode.ts`):

- **Release build** (`npm run build`, switch OFF): the shipped game. Its map
  is the "classic" column below.
- **Restaurant test build** (`VITE_RESTAURANT_MODE=1`, switch ON): the
  Unified Restaurant. When it is approved and released, the classic column
  goes away.

## One restaurant (switch ON)

There is ONE restaurant and ONE mode. Campaign and Business are no longer
two restaurants: the 250 levels are the restaurant's career, and Business is
its management.

```
KNIFECRAFT
├── Kitchen (home)            today's level, the restaurant's day, coming-up notices
├── Market                    knives · boards · Campaign Supplier · ingredients ·
│                             Blacksmith · smallwares · tableware · takeaway
│                             (the ONLY place anything is bought; no Staff tab)
├── Inventory                 what the restaurant has: fridge + ingredients | supplies
├── Restaurant (was Business) management, not a mode: Overview · Equipment · Staff ·
│                             Suppliers · Menu · Operations
└── Progress                  restaurant stage, milestones, Endless unlock

CAREER (Levels 1–250) — each level is one SERVICE of the restaurant day
  Day N opens ─► Pre-Service Check / opening card ─► service (cut, cook, serve)
             ─► … the day's services (Lunch + Dinner; + Breakfast from L51)
             ─► CLOSING TIME (chores, the day's count, spoiled food) ─► Day N+1

  L1   cooking fundamentals + the restaurant day
  L11  the menu (4 dishes) + menu guests          L71  takeaway (~30% of orders: box + bag)
  L15  ingredient stock                           L91  bigger restaurant (closing = End Business Day)
  L21  fridge + freshness (food ages)             L121 full restaurant management
  L31  dine-in: place settings, napkins,          L161 established
       dish soap, cleaning liquid                 L201 master
  L41  staff (Prep Cook; Server L46; Line Cook    L241 Grand Service → L250 finale
       L61; Cleaner L91; Head Chef L121; Manager L161)
  L51  cuisines with specialist chefs (Indian 51, Mediterranean 71, Mexican 81,
       Japanese 101, Chinese 121, Thai 141, Korean 161 — one Asian Chef)
  Menu: 4 dishes at L11 → 48 by L161 (restaurant/restaurantProgression.ts)
  Menu guests: after a level's own orders, 1–5 optional customers order from
  the active menu (from L11) — cooked in the same service, paid at menu price
  Market: bulk presets 5/25/50/100 with provisional discounts (consumables)
  Inventory: ⚠️ NEEDS ATTENTION across food, supplies, bottles, fridge, staff

ENDLESS RESTAURANT (after Level 250) — the same restaurant, open-ended days
  on the Business engine (open, serve menu orders, end the day). Before L250
  there is no separate Business Day.
```

Not yet built in the restaurant (see `docs/RESTAURANT_INTEGRATION_AUDIT.md`):
the final QA pass (N). Existing saves move in once with a starter crate
(phase M, `restaurant/restaurantMigration.ts`).

## Classic (switch OFF, the release today)

- **Campaign**: 250 levels, no stock; pay = a set amount minus a built-in food
  cost, plus level rewards and milestones.
- **Business Mode**: open-ended Business days on real stock, menu, staff,
  suppliers, inspections.
- **Endless Service**: after L250, loops the Service levels, $600/day cap.
- **Today's Special**: one featured level a day, $50 bonus.
