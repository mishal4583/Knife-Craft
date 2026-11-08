# Dishwashing, full screen: "the sink is the screen" (plan + asset list)

Status: PLAN ONLY (2026-11-09). No code changed yet.
Developer request 2026-11-09 (with two screenshots): "the dishwashing screen needs to be optimized: the list of utensils to be washed is covering a large portion of the screen and the dishwashing sink image needs to be full screen or something to increase the effect of washing the dishes. Make a plan for it and give Codex prompts for the image assets or background."
Companion file with EVERY Codex art prompt: `DISHWASHING-FULLSCREEN-CODEX-PROMPTS-2026-11-09.md` (assets are saved to `D:\WORKS\GAMES\Knife Craft\Wash Assets`; say if you want another folder).
Decisions the developer must make are in §9 (recommendation first); the plan assumes the recommendations.

**Short answers**
- **What is wrong?** The modal is a card with a header, a 3-column list of every utensil (15 chips in 5 rows), the sink picture, a status line, a progress bar, the rack and a footer. On a phone the list alone takes about **62% of the card's height**, so the sink, the part you play, shows only about **a fifth** of it at first and the rest is a scroll away.
- **The fix in one line:** make the sink the whole screen (portrait art, the dish about 1.5× bigger), shrink the list to a one-row **"Up next" strip** (current piece + the next four + "+13"), keep the full list one tap away in a **bottom sheet**, and move the status, progress and rack into a slim **dock** at the bottom.
- **More washing feel:** layered water, suds that grow as you scrub, bubbles, ripples and a splash where the sponge goes, a running tap, a rinse spray hose, steam, a "squeaky clean" glint sweep and a dish that glides into a real **drying rack**; four soft synthesized sounds.
- **Rules untouched:** the dirt, scrub, rinse and pay rules (`restaurant/dishDirt.ts`, `cleaningDirt.ts`, the ledger/supplies) do not change. Only the screen's layout, art and effects change, so `dish-washing-qa` is unaffected.
- **Art:** 21 new image files (§6; the companion file has every prompt). The screen works with the CURRENT `premium-sink.webp` while the art is being made (§7, phase 1), so layout can ship first.
- **How big:** about 6-7 working days (§8); layout (the biggest win) is 2 days.

---

## 1. What the code does today (so nothing is invented)

- `src/components/kc/restaurant/WashUpSink.tsx` (1813 lines) is the whole game: a portal modal (`data-testid="wash-up-sink"`, `z-[110]`) holding one `section` card `w-[min(420px,100%)] max-h-[calc(100%-24px)] overflow-y-auto rounded-[28px] p-4`.
- Inside the card, top to bottom: the **header** (🫧 Dishwashing, "18 in the sink · by hand, nothing breaks", the × close), the **list** `ol[data-testid="wash-up-lines"]` (`grid-cols-3`, one chip per utensil kind with `×n` or `done/n`), the **scene** (a dark frame holding `dishwashing/premium-sink.webp`, 720×540, drawn at `aspect 360/280`, the dish as inline SVG, the stains, suds, the sponge following the finger), the **status** line, the **progress** bar, the **rack** (`wash-up-rack`: ✓ chips as each kind finishes), an optional summary, and the footer (Done / buy soap / "the rest washes at the next START").
- The scene's own coordinate system is fixed at `DISH_SCENE = 360 × 280` (`dishDirt.ts`); the dish sits at `DISH_PLATE (180, 165)`; each piece has a zoom (`DISH_ZOOM`) and a sponge reach (`DISH_BRUSH`). The pointer is mapped from the scene's `getBoundingClientRect()`, so **the scene can be drawn at any size without changing a rule**.
- Entry points: `SinkWash` (Cleanliness → Dishwashing card, Pre-Service Check and Closing Time rows) opens it; a Cleaner / hired help washes the same queue without it.
- Tests that touch it: `tools/e2e/dishwashing.mjs` (ids `wash-up-sink`, `wash-up-surface`, `wash-up-status`, `wash-up-lines`, `wash-up-rack`), `scripts/dish-washing-qa.mts` (rules only).
- Art that exists: `public/dishwashing/premium-sink.webp` (720×540, landscape) and the optional painted-pieces prompts of 2026-11-07 (`DISHWASHING-CODEX-PROMPTS-2026-11-07.md`, not wired).

## 2. Goals and non-goals

**Goals:** (1) the sink and the dish are the biggest thing on screen, with no scrolling; (2) the list never covers the play area; (3) washing FEELS good (water, suds, bubbles, a glint when clean, a rack that fills); (4) it still works on every size (320×568 to 768×1024), with Reduced Motion, and with the current art as a fallback.
**Non-goals:** changing how scrubbing, rinsing, soap use, pay or the Cleaner work; new dish shapes; painted dishes (still the optional 2026-11-07 set); landscape layouts (the shell is portrait and contain-fits).

## 3. The new layout (logical 540 × 960, the shell scales it)

```
 ┌──────────────────────────────┐ 0
 │ ←  Dishwashing        🧼 18  │  HUD (wood plaques; ← = close)      0-90
 │ (●) ( ) ( ) ( ) ( )  +13  ▾  │  Up-next strip (tap = full list)    96-150
 │  ╔══════════ tap ═══════╗    │
 │  ║  suds     ____  hose ║    │
 │  ║  ripples (   )       ║    │  THE SINK = the stage, 500 wide      200-575
 │  ║  🧽  bubbles  dish   ║    │  (the dish ≈ 1.5× bigger than now)
 │  ╚══════════════════════╝    │
 │  Scrub the saucepan · 1 of 1 │  status plaque                       590-630
 │  ▓▓▓▓▓▓▓░░░░░░░░  64%        │  progress                            640-670
 │  ┌─ drying rack ──────────┐  │
 │  │ 🍽 🍽 🥄 🥄  3 / 18    │  │  dock: the rack fills                690-850
 │  └────────────────────────┘  │
 │  [ ✓ Done ]  the rest washes… │  footer                             870-960
 └──────────────────────────────┘ 960
```
- **No card, no padding, no scroll:** the section becomes `absolute inset-0` (the backdrop IS the art); text and buttons sit on wood plaques or on the art's calm areas.
- **Up-next strip (new, `SinkQueue.tsx`):** one row: the CURRENT piece (big, glowing ring), the next four (48 px circles with their icon and a tiny `×n`), then a "+13" chip and a ▾. Done kinds slide out to the left. **Tap anywhere on it opens the full list** as a half-height **bottom sheet** (the same 3-column chips as today, with done / n, closes by tap outside or ▾). The sheet is the old list, so nothing is lost and the test ids stay (`wash-up-lines` moves into the sheet and is mounted only when open; the strip gets `wash-up-queue`).
- **Stage (the sink):** the art is portrait (1080×1920): the basin's floor is the 4:3 box the dish lives in (x 40-1040, y 400-1150 of the art); the stage box is positioned over it and everything inside (water, suds, SVG dish, stains, sponge, FX) keeps the scene's 360×280 coordinates scaled by `stageWidth / 360` (about 1.39 on the 540 logical width, 1.5× larger than the old card's 0.9).
- **HUD:** ← (close; same Back arrow as the other mini-games), the title, and a soap/remaining chip (🧼 = soap left, from the existing supply; the number of pieces left).
- **Dock:** the rack is a painted drying rack (art) where each finished kind stands as a small piece; a "3 / 18" counter and the progress bar; Done / Buy soap appear in the footer as today.
- **Small phones (320×568):** the strip shrinks to 4 slots + "+N"; the dock's rack becomes a single row of ✓ chips (as now) so the stage never drops under 88% of the width; a short-screen rule (`h < 640`): the progress bar merges into the status plaque.
- **Result:** the list's share of the screen goes from about **62%** to about **6%** when closed; the stage goes from about **40%** of the card to about **44%** of the whole screen at ~1.5× the dish size.

## 4. The washing effects (all CSS transform/opacity + the art; no animation library)

| # | Effect | Trigger | How |
|---|---|---|---|
| 1 | Water sheet and caustics | always | art layer W02 + a slow CSS drift of the ripple tile W03 (translate, 12 s loop) |
| 2 | Suds that GROW | scrub progress | foam tiles W05 (light / medium / heavy) cross-fade over the basin as the piece's progress rises; the rim piles W04 fixed |
| 3 | Bubbles | the sponge moves | 2-4 bubble sprites (W06) spawn behind the sponge, float up 600 ms, pop (3-frame pop) |
| 4 | Ripple ring + droplets | scrub strokes | a ring (W07) expands from the sponge; 1-2 droplets (W07) fly off |
| 5 | Sponge squish | pointer speed | the sponge (W13) scales 0.94 / 1.04 with a foamy variant after the first strokes |
| 6 | Running tap | idle + rinse | the stream frames (W08) loop at the tap; stronger during RINSE |
| 7 | Rinse spray | rinse phase | the pre-rinse hose burst frames (W09) fan over the dish, suds wash off (opacity ↓) |
| 8 | Steam | always (soft) | wisps (W10) rise from the water, 8 s loops, 3 of them staggered |
| 9 | Squeaky clean | piece done | glint sweep (W11) + a "Squeaky clean!" ribbon (W12) for 600 ms + the existing ✨ |
| 10 | Dish to the rack | after the shine | the piece shrinks and arcs into its rack slot (W16/W17) with a small clink and a puff; the rack slot shows a mini piece |
| 11 | Soap | a piece starts | a soap pump (W14) dips and a blob (W15) lands on the sponge |
| 12 | Combo | existing combo counter | unchanged; the combo flame sits under the HUD |
| 13 | Mist edge | always | a soft vignette of steam (W21) at the screen edges |
- **Reduced Motion:** no drifting, no bubbles / ripples / droplets, no steam, no arc into the rack; static suds growth, a plain fade for the shine, the same rack fill.
- **Performance:** at most 6 live bubbles, 2 droplets, 3 steam wisps at once; all `will-change: transform, opacity` only on those; images are small WebP; nothing blocks the pointer (`pointer-events-none` on every FX layer).

### 4.1 Sounds (synth only, `AudioManager`, no files)
New named effects (the audio test's list is updated, a rule change): `scrub` (a soft filtered-noise swish whose gain follows pointer speed, throttled), `rinse` (a gentle water hiss while the rinse spray runs), `clink` (a plate set in the rack), `squeakyClean` (a short rising sparkle). The existing `squeak` stays for the sponge on glass.

## 5. Technical plan

### 5.1 Layout (the part that fixes your complaint)
- `WashUpSink.tsx`: keep ALL the game logic (queue, stains, scrub, rinse, phases, soap, the Cleaner hand-off). Replace only the shell: the `section` card becomes a full-bleed `absolute inset-0` container; the header, list, scene frame, status, progress, rack and footer move into the regions of §3.
- New small components (presentation only): `SinkQueue.tsx` (the strip), `SinkQueueSheet.tsx` (the full list in a bottom sheet, the old `ol`), `SinkDock.tsx` (status, progress, rack, footer), `SinkFx.tsx` (the effect layers). They take the existing derived values (`items`, `queue`, `cleanedCount`, `activeItem`, `phase`, `progress`, `status`, `washedByKind`) as props; no new rules.
- `DISH_SCENE` stays 360×280 and the stage is scaled with a CSS variable `--wash-s = stageWidth / 360` (measured with a `ResizeObserver`); the existing `getBoundingClientRect()` mapping keeps the pointer exact. The sponge size and brush reach stay in scene units, so they scale too.
- The old `premium-sink.webp` is the **fallback**: if the new portrait backdrop fails to load, the stage draws it `object-cover` inside the stage box on a dark-wood gradient (what shipping phase 1 looks like).

### 5.2 Art wiring
- `scripts/make-wash-assets.py` (new): reads `Wash Assets/` (local, gitignored), cuts the sheets, writes WebP into `public/dishwashing/` (budget **≤ 700 KB** for the kit: the 1080×1920 backdrop at 540×960 q76 is about 110 KB).
- `inspectionArt.ts`-style probe (`useWashArt(name)`): each layer renders only when its file exists, so the screen is complete with any subset of the art.

### 5.3 Tests
- Update `tools/e2e/dishwashing.mjs` for the new shell (ids kept where possible; `wash-up-lines` opens from `wash-up-queue`).
- New checks (in the same e2e, restaurant build, real browser): **S1** the stage is ≥ 92% of the shell's width and the modal has no vertical scroll at 320×568, 360×640, 390×844, 430×900 and 768×1024; **S2** the closed strip + HUD take ≤ 16% of the height; **S3** tapping the strip opens the full list with every utensil and `×n`; closing returns; **S4** scrubbing still cleans a plate (the same drag as today) and the rack fills; **S5** the piece sits at least 1.4× larger than the old card's; **S6** Back (×/←) closes and leaves the queue as it was; **S7** Reduced Motion hides bubbles / steam; **S8** no console errors; **S9** every touch target ≥ 48 px; **S10** the fallback (hide the new art) still looks right.
- `scripts/dishwash-layout-qa.mts` (pure): the strip's slot rule (current + next 4 + "+N", N correct, done kinds removed), the rack's per-kind counts, the scale formula, and that the rules files are unchanged (`git diff` guard on `dishDirt.ts`, `cleaningDirt.ts`).
- `audio-qa` lists the four new effects; `ui-copy-qa` and the 8.5 px minimum stay green.

### 5.4 Rules kept
Seeded, whole numbers, touch ≥ 48 px, text 12-14.5 px (badges 11 px, nothing under 8.5), the existing primitives and wood-and-paper look, no external requests, no new save field, never any change to money, soap use or the ledger (all untouched), English only, Reduced Motion honoured.

## 6. Assets (21 new files; every prompt is in the companion file)

| Id | What | Size |
|---|---|---|
| W01 | **Sink backdrop**, portrait full scene: wall, swan-neck tap, hose, counter, empty basin (the stage box x 40-1040, y 400-1150), calm rack zone, plain counter front | 1080×1920 |
| W02 | Basin **water sheet** (clear soapy water with caustics), aligned to the stage box | 1000×750 |
| W03 | **Ripple** tile (seamless water ripples) | 512×512 |
| W04 | **Foam rim piles** (suds along the basin edges), aligned to the stage box | 1000×750 |
| W05 | **Foam tiles**, 3 densities (light, medium, heavy), seamless, sheet 3×1 | 1536×512 |
| W06 | **Bubbles**: 8 soap bubbles + a 4-frame pop, sheet 4×3 | 1024×768 |
| W07 | **Droplets, splash crown, ripple ring, mist puff**, sheet 4×2 | 1024×512 |
| W08 | **Tap stream**, 6 loop frames (vertical stream with aerator splash), sheet 6×1 | 768×512 |
| W09 | **Rinse spray** burst, 6 frames (a fan of water), sheet 3×2 | 768×512 |
| W10 | **Steam wisps**, 3 shapes, sheet 3×1 | 768×384 |
| W11 | **Glints / sparkles**, 4 shapes, sheet 4×1 | 512×128 |
| W12 | **"Squeaky clean" ribbon** (blank banner with sparkles) | 640×180 |
| W13 | **Cleaning tools**: sponge, foamy sponge, pot brush, scouring pad, sheet 4×1 | 1536×384 |
| W14 | **Dish-soap pump bottle** with a blank level window | 256×512 |
| W15 | **Soap blobs / squirts**, 3 shapes, sheet 3×1 | 384×128 |
| W16 | **Drying rack, BACK layer** | 1000×420 |
| W17 | **Drying rack, FRONT layer** | 1000×220 |
| W18 | **Cutlery cup** (for forks, knives, spoons) | 256×320 |
| W19 | **"Up next" tray** (wooden rail with 6 blank round slots) | 1000×170 |
| W20 | **Slot states**: empty, current (glow), done (check), sheet 3×1 | 384×128 |
| W21 | **Steam mist vignette** (soft edge fog), full screen | 1080×1920 |

Reused: HUD plaques and the round button (`public/business/fridge-sort/hud-*`), the star bar and result art (not used here), ribbons and sparkles (`stockroom/`), the pointing hand, the dish pieces (still inline SVG; the painted-pieces set of 2026-11-07 stays optional), the `SupplyIcon` icons for the strip.
Optional later: the painted pieces D2-D7 (the older file), a night-time variant of the backdrop.

## 7. Phases and estimate

1. **Layout** (2 d): the full-bleed shell, strip + sheet, dock, scaling variable, HUD, fallback art. Ships alone with the CURRENT sink picture and CSS water/suds. This is the part that answers the complaint.
2. **Art wiring** (1 d): `make-wash-assets.py`, `useWashArt`, the layers in place (backdrop, water, foam rim, rack, tray).
3. **Effects** (2 d): suds growth, bubbles, ripples, droplets, tap and spray frames, steam, glint + ribbon, the dish into the rack, soap pump; Reduced Motion.
4. **Sounds + tests** (1 d): the four synth effects, `dishwash-layout-qa`, the e2e of §5.3, `audio-qa` update.
5. **Phone tuning** (1 d): the dish size, the strip's tap size, the effect density, performance on a mid-range phone (the developer's pass).
Total about **6-7 working days**.

## 8. Risks

- **The portrait art and the fixed 4:3 stage must line up** (the basin floor is the play area): the prompt gives exact pixel boxes and the QA overlays the stage box on the art in a screenshot.
- **Bigger dish, same scrub rules:** pointer precision improves; check the sponge size (60-72 scene px) does not look clumsy at 1.39×; tune `spongeSize` once.
- **Effects cost on low-end phones:** capped counts, CSS only, a "calm effects" auto-switch if the frame time is high (later).
- **Strip vs list parity:** the sheet must show exactly what the old list showed (tested).
- **Tuning by simulation only:** a real-phone pass is required.

## 9. Decisions for the developer (recommendation first)

- **D1. Where does the full list go?** (Recommended) An "Up next" strip + a bottom sheet on tap. (Option) a collapsed bar "18 left ▾" that expands a drawer; (Option) hide the list entirely and show only "3 / 18".
- **D2. Close button.** (Recommended) a ← Back arrow at the top left (like the other mini-games) plus Escape. (Option) keep the × at the top right.
- **D3. How big is the dish?** (Recommended) the stage fills the whole screen width (about 1.4-1.5× today). (Option) 1.2× with more art around the basin.
- **D4. The rack dock.** (Recommended) a painted drying rack where the washed pieces stand. (Option) keep the ✓ chips.
- **D5. Sounds.** (Recommended) four soft synth effects (scrub, rinse, clink, squeaky clean), off with Sound off. (Option) none.
- **D6. Effects density.** (Recommended) full (bubbles, steam, tap, hose); the Settings → Reduced motion turns them down. (Option) a lighter set by default.
- **D7. Asset folder.** `D:\WORKS\GAMES\Knife Craft\Wash Assets` (recommended; add to `.gitignore` when the art arrives).
- **D8. Ship order.** (Recommended) layout first with the current art (phase 1), then the art and effects as the Codex files arrive.
