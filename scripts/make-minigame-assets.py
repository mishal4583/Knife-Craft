"""
Builds the Mini-games sheet's pictures (developer 2026-11-18) from 'Mini-games Sheet Assets' (Codex, the MG-*.png files) into
public/business/minigames/ as small WebP files.

    python scripts/make-minigame-assets.py

Plan and prompts: docs/planning/MINIGAMES-SHEET-ART-PLAN-AND-CODEX-PROMPTS-2026-11-18.md.
Sizes are 3x the largest a phone shows them at (the same rule as the other mini-games). The nine-slice pictures (cards, panel, glow) are CROPPED
to their painted edge first (two of the cards carry transparent margins), and the slice sizes the screen uses are in
src/components/kc/minigamesArt.ts; scripts/mini-games-qa.mts checks that the two agree.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Mini-games Sheet Assets"
OUT = ROOT / "public" / "business" / "minigames"
OUT.mkdir(parents=True, exist_ok=True)

total = 0


def put(name, src_name, size=None, crop=None, quality=84):
    """Crop (left, top, right, bottom in source pixels), resize to `size` (w, h) or keep, save as WebP."""
    global total
    im = Image.open(SRC / src_name).convert("RGBA")
    if crop:
        im = im.crop(crop)
    if size:
        im = im.resize(size, Image.LANCZOS)
    path = OUT / (name + ".webp")
    im.save(path, "WEBP", quality=quality, method=6, alpha_quality=100)
    total += path.stat().st_size
    print(f"{name:20s} {im.size[0]:4d}x{im.size[1]:<4d} {path.stat().st_size / 1024:6.1f} KB")


# the eight game icons (shown at 76 css px; 288 = ~3.8x)
for game in (
    "inspection",
    "fridge-sort",
    "sauce",
    "stockroom",
    "fridge-check",
    "car-park",
    "dessert-run",
    "kitchen-dispatch",
):
    put(f"icon-{game}", f"MG-icon-{game}.png", (288, 288), quality=82)

# the cards: nine-slice. Ready fills its canvas; resting and locked carry transparent top and bottom margins, cropped away.
put("card-ready", "MG-card-ready.png", (288, 288), crop=(0, 0, 384, 384))
put("card-resting", "MG-card-resting.png", (288, 267), crop=(0, 15, 384, 371))  # 384 x 356 painted
put("card-locked", "MG-card-locked.png", (288, 281), crop=(0, 4, 384, 378))  # 384 x 374 painted
put("ready-glow", "MG-ready-glow.png", (288, 288))
# the sheet panel: rounded top corners, flat bottom; the 10 px transparent strip at the very top is cropped
put("sheet-panel", "MG-sheet-panel.png", (384, 376), crop=(0, 10, 512, 512))
# furniture
put("title-ribbon", "MG-title-ribbon.png", (576, 144))
put("close-button", "MG-close-button.png", (144, 144))
put("pill-ready", "MG-pill-ready.png")
put("pill-rest", "MG-pill-rest.png")
put("pill-locked", "MG-pill-locked.png")
put("lock-badge", "MG-lock-badge.png", (96, 96))
put("badge-ready", "MG-badge-ready.png")
put("shortcut-icon", "MG-shortcut-icon.png", (192, 192))
put("header-sparkle", "MG-header-sparkle.png", (192, 96))

print(f"total {total / 1024:.0f} KB in {len(list(OUT.glob('*.webp')))} files")
