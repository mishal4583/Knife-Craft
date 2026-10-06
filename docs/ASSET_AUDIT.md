# Asset audit (2026-10-06)

Every tracked image, video, font, icon and audio file in the repository,
checked before anything was deleted. Checks per file: static imports,
`import.meta.glob` patterns, dynamic / template-string paths, CSS `url()`,
`index.html`, `public/`, `vite.config.ts`, Phaser loader calls, tests, and
whether it appears in the production build (`dist/assets`). Guarded by
`scripts/unused-assets-qa.mts`.

Findings that shape the list:

- **No audio files exist.** Sound is synthesised at runtime
  (`AudioManager.ts`, Web Audio).
- **Phaser loads no files.** No `this.load.*` call exists; every ingredient,
  knife and board texture is drawn in code (`src/game/textures/*`,
  `scenes/knifeProfile.ts`).
- Only `src/assets/**` and `public/**` can reach the build.

## USED (bundled or served)

| Files | How |
|---|---|
| `src/assets/kitchen/skin-01…06.webp` + `thumbs/` (12) | imported by `KitchenBackground.tsx` |
| `src/assets/kitchen-bg.jpg` | imported by `Preparation.tsx` |
| `src/assets/story/intro-*.webp` (7) | imported by `CinematicIntro.tsx` |
| `src/assets/video/chef-*.{webm,mp4}` + `-poster.webp` (18) | imported by `CookingClip.tsx` |
| `src/assets/shop-mobile/*.webp` (2) | `import.meta.glob` in `Shop.tsx` |
| `src/assets/fonts/*.woff2` (3) | `url()` in `src/styles.css` |
| `public/favicon.ico` | `<link rel="icon">` in `index.html` |
| `public/playgama-bridge-config.json` | read by the Playgama Bridge at startup |
| `public/robots.txt` | served as is |

## POTENTIALLY USED — kept on purpose (not bundled)

| Files | Why kept |
|---|---|
| `src/assets/shop/*.webp` (2, 515 KB) | the full-size originals the `shop-mobile/` copies are made from (documented in `Shop.tsx`) |
| `Bread.mp4`, `Curry.mp4`, `Fruit cups.mp4`, `Plating.mp4`, `Salads.mp4`, `gemini_generated_video_aa3f242a - Trim.mp4` | the source uploads of the six cooking clips (CLAUDE.md §9) — needed to re-cut a clip |
| `Intro Story/Scene *.png` (7) | the painted originals of the intro scenes (`src/assets/story/` holds the web copies) |
| `playgama/covers/**`, `playgama/screenshots/**` (22) | uploaded to the Playgama cabinet by hand; `source/portrait-1080x1920.png` and `upload/portrait-1080x1920.png` are identical because the source was already the exact size |
| `knifecraft_kitchen_webp/` (6), `Knifecraft vegetables/`, `Shop UI/`, `Market.png` | reference-only folders carried from the original repo (CLAUDE.md §11). `knifecraft_kitchen_webp/` is byte-identical to `src/assets/kitchen/skin-01…06.webp`; the favicons inside the reference projects equal `public/favicon.ico`. Not part of the build; removing them is a repository-housekeeping decision, not an unused-asset one |

## SAFE TO REMOVE — removed

| File | Evidence |
|---|---|
| `src/assets/kitchen$f` (404 KB) | byte-identical to `src/assets/kitchen/skin-06.webp` (same MD5); no reference of any kind; not in either build |
| `src/assets/tomato.webp` (15 KB) | no reference of any kind; not in either build (the only "tomato" image reference is `tomato.png` inside the separate `Knifecraft vegetables/` reference project) |

Nothing else qualifies.

## Note (not changed)

`index.html` links the icon as `/favicon.ico` (root-absolute). When the game
is served from a sub-path (as on Playgama's CDN) that request can miss; the
browser tests have logged it as a failed request. Harmless, but `./favicon.ico`
would be the sub-path-safe form — left for a release-packaging check.
