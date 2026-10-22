# Landscape artwork handoff for Claude

This pack contains 28 landscape background images for responsive landscape layouts. The files are artwork only; no game code or asset routing was changed here.

## Recommended responsive use

- Keep the existing portrait artwork for portrait viewports.
- Select these landscape backgrounds when the game viewport is landscape, using the same scene key as its current screen/cleaning area.
- These images are 1672×940 or 1672×941 (approximately 16:9). Keep the whole scene visible with a centered `cover` background or image treatment; check important room details at the target viewport sizes.
- Cleaning images are clean room bases. Keep dirt/stain sprites, cleaning tool interactions, progress, and rewards as separate game layers.
- The six cleaning filenames map to the six restaurant upgrade tiers. If the game uses different tier IDs, map by order/capacity rather than relying on the filename spelling.

## Main screens and business sections

Paths below are relative to `public/` and can be used as asset references in the game:

| Section | Asset |
| --- | --- |
| Kitchen | `landscape-art/sections/kitchen.webp` |
| Inventory | `landscape-art/sections/inventory.webp` |
| Market | `landscape-art/sections/market.webp` |
| Business overview | `landscape-art/sections/business.webp` |
| Restaurant | `landscape-art/sections/restaurant.webp` |
| Staff | `landscape-art/sections/staff.webp` |
| Suppliers | `landscape-art/sections/suppliers.webp` |
| Menu | `landscape-art/sections/menu.webp` |
| Operations | `landscape-art/sections/operations.webp` |
| Equipment | `landscape-art/sections/equipment.webp` |

## Cleaning scenes by upgrade tier

| Tier | Kitchen | Dining | Restroom |
| --- | --- | --- | --- |
| Humble | `landscape-art/cleaning/kitchen-humble.webp` | `landscape-art/cleaning/dining-humble.webp` | `landscape-art/cleaning/restroom-humble.webp` |
| Growing | `landscape-art/cleaning/kitchen-growing.webp` | `landscape-art/cleaning/dining-growing.webp` | `landscape-art/cleaning/restroom-growing.webp` |
| Established | `landscape-art/cleaning/kitchen-established.webp` | `landscape-art/cleaning/dining-established.webp` | `landscape-art/cleaning/restroom-established.webp` |
| Neighborhood cafe | `landscape-art/cleaning/kitchen-neighborhood-cafe.webp` | `landscape-art/cleaning/dining-neighborhood-cafe.webp` | `landscape-art/cleaning/restroom-neighborhood-cafe.webp` |
| Flourishing cafe | `landscape-art/cleaning/kitchen-flourishing-cafe.webp` | `landscape-art/cleaning/dining-flourishing-cafe.webp` | `landscape-art/cleaning/restroom-flourishing-cafe.webp` |
| Grand | `landscape-art/cleaning/kitchen-grand.webp` | `landscape-art/cleaning/dining-grand.webp` | `landscape-art/cleaning/restroom-grand.webp` |

## Suggested scene lookup shape

Use the existing screen routing and restaurant tier state to select a path, for example:

```ts
const landscapeCleaningArt = {
  kitchen: {
    humble: "/landscape-art/cleaning/kitchen-humble.webp",
    growing: "/landscape-art/cleaning/kitchen-growing.webp",
    established: "/landscape-art/cleaning/kitchen-established.webp",
    neighborhoodCafe: "/landscape-art/cleaning/kitchen-neighborhood-cafe.webp",
    flourishingCafe: "/landscape-art/cleaning/kitchen-flourishing-cafe.webp",
    grand: "/landscape-art/cleaning/kitchen-grand.webp",
  },
  // Add matching dining and restroom entries using the table above.
};
```

Treat the lookup above as a reference only; adapt its keys and responsive breakpoint to the existing game architecture.
