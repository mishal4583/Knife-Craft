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
├── Business (→ "Restaurant") management, not a mode: Overview · Equipment · Staff ·
│                             Suppliers · Menu · Operations
└── Progress                  restaurant stage, milestones, Endless unlock

CAREER (Levels 1–250) — each level is one SERVICE of the restaurant day
  Day N opens ─► Pre-Service Check / opening card ─► service (cut, cook, serve)
             ─► … the day's services (Lunch + Dinner; + Breakfast from L51)
             ─► CLOSING TIME (chores, the day's count, spoiled food) ─► Day N+1

  L1   menu (2 dishes) + the restaurant day     L71  takeaway (~30% of orders: box + bag)
  L11  pantry: real ingredient stock            L91  full operation (closing = End Business Day)
  L21  fridge + freshness (food ages)           L121 expansion
  L31  dine-in: place settings, napkins,       L161 established
       dish soap, cleaning liquid
  L41  staff                                    L201 master
  L51  cuisines + specialist chefs              L241 Grand Service → L250 finale
  Menu: 2 dishes at L1 → 48 by L241 (restaurant/restaurantProgression.ts)
  Menu guests: after a level's own orders, 1–5 optional customers order from
  the active menu (from L6) — cooked in the same service, paid at menu price

ENDLESS RESTAURANT (after Level 250) — the same restaurant, open-ended days,
  orders from the active menu (phase L; not built yet)
```

Not yet built in the restaurant (see `docs/RESTAURANT_INTEGRATION_AUDIT.md`):
bulk buying (H), staff
requirements (I), specialist chefs (J), Endless Restaurant (L), the separate
Business service entry's removal and the Restaurant name (L), migration (M).

## Classic (switch OFF, the release today)

- **Campaign**: 250 levels, no stock; pay = a set amount minus a built-in food
  cost, plus level rewards and milestones.
- **Business Mode**: open-ended Business days on real stock, menu, staff,
  suppliers, inspections.
- **Endless Service**: after L250, loops the Service levels, $600/day cap.
- **Today's Special**: one featured level a day, $50 bonus.
