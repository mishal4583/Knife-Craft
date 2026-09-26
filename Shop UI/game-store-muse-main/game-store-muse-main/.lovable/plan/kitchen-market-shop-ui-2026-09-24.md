# Kitchen Market Shop UI

## Goal
Build a polished, production-friendly React/TypeScript shop interface based on the supplied game screens, using the wide `image.png` artwork as the top market scene rather than recreating it in code.

## What I’ll build
- Replace the placeholder home screen with the complete market shop.
- Use the supplied wide market image as the top visual and keep all controls readable around it.
- Add six working shop tabs: Knives, Cutting Boards, Equipment, Staff, Suppliers, and Ingredients.
- Populate each tab with themed products, stats, prices, purchase/equip states, and clear feedback.
- Add a coin balance, cart quantities for ingredients, and responsive layouts for desktop and mobile.
- Keep shop data and interaction logic separated into small TypeScript modules/components so it can be merged into the game code and connected to SaveManager later.

## Visual direction
- Warm illustrated kitchen atmosphere, wood framing, parchment panels, brass/gold highlights, and green purchase actions.
- Faithful to the reference images without embedding the reference UI screenshots themselves.
- The provided wide market artwork remains the actual top image.

## Technical details
- React + TypeScript on the existing TanStack Start/Vite project.
- Semantic design tokens in the global stylesheet; no backend or database.
- In-memory demo state only, with a small persistence adapter boundary documented for later SaveManager wiring.
- Route-specific title, description, Open Graph, and Twitter metadata.
- Verify the finished screen in the live preview at desktop and mobile sizes.
