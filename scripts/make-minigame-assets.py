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

# the cards: nine-slice. Ready fills its canvas; resting and locked are made from ready (below).
put("card-ready", "MG-card-ready.png", (288, 288), crop=(0, 0, 384, 384))
def recolor_ready(name, paper_rgb, wood_sat, wood_val, paper_cut, light_margin):
    """The resting and locked cards (developer 2026-11-18: the four grey cards had only a plank on top and one below, no sides, and the dark
    locked card had no left edge). Codex's MG-card-resting.png / MG-card-locked.png are those open plaques, so both are made from the READY
    frame: the same rounded frame all round, its wood recoloured, its lights taken out, its paper tinted (`paper_rgb` is the new paper colour,
    given as the ready paper's mean (248, 220, 177) scaled to it). Same size and slice as card-ready."""
    import numpy as np
    from matplotlib import colors as mc
    from scipy.ndimage import median_filter

    global total
    a = np.array(Image.open(OUT / "card-ready.webp").convert("RGBA")).astype(float) / 255
    rgb, al = a[:, :, :3], a[:, :, 3]
    hsv = mc.rgb_to_hsv(rgb)
    sat, val = hsv[:, :, 1], hsv[:, :, 2]
    paper = (sat < paper_cut[0]) & (val > paper_cut[1])
    out = rgb.copy()
    out[paper] = np.clip(rgb[paper] * (np.array(paper_rgb) / np.array([248, 220, 177])), 0, 1)
    wood = ~paper
    hsv[:, :, 1] = np.where(wood, sat * wood_sat, sat)
    hsv[:, :, 2] = np.where(wood, val * wood_val, val)
    out[wood] = mc.hsv_to_rgb(hsv)[wood]
    lum = out.mean(axis=2)
    med = np.dstack([median_filter(out[:, :, c], size=11) for c in range(3)])
    lights = wood & (lum > med.mean(axis=2) + light_margin) & (al > 0.9)
    out[lights] = med[lights]
    im = Image.fromarray((np.dstack([out, al]) * 255).round().astype("uint8"), "RGBA")
    path = OUT / (name + ".webp")
    im.save(path, "WEBP", quality=84, method=6, alpha_quality=100)
    total += path.stat().st_size
    print(f"{name:20s} {im.size[0]:4d}x{im.size[1]:<4d} {path.stat().st_size / 1024:6.1f} KB")


# dusty brown frame, cool grey-beige paper
recolor_ready("card-resting", (228, 218, 197), 0.58, 0.80, (0.45, 0.80), 0.07)
# dark walnut frame, dark leather paper
recolor_ready("card-locked", (61, 42, 36), 0.60, 0.42, (0.60, 0.72), 0.05)
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
