"""
Builds the Market's painted icons from the generated source art (developer 2026-11-03: the supply and staff emoji did not match
their names; Codex made the art, branch codex/fridge-sort-art-publish).

Run:  python scripts/make-market-assets.py        (needs Pillow, numpy and scipy; use `python`, not the MSYS `python3`)

Input (LOCAL ONLY, gitignored: the PNGs are 59 MB, they never go into git):
  art-source/market-supplies/S1..S6-*.png   4 x 3 atlases of 362 x 362 cells, read left to right, top to bottom
  art-source/staff/floor-server.png, floor-cleaner.png

Output (these small WebP files ARE committed):
  public/business/supplies/<supply id>.webp         160 x 160, transparent, ~6-10 KB each (62 files)
  public/business/staff-portraits/floor-server.webp, floor-cleaner.webp   320 x 320 like the existing portraits

What it does to a supply atlas cell:
  1. cuts the cell out of the atlas;
  2. removes the haze: the generator left a faint warm glow (alpha 1-60) over most of the sheet. Alpha below LO becomes 0, alpha
     above HI becomes 255, and in between it ramps, so soft edges stay soft;
  3. deletes any leftover island smaller than 2 % of the biggest blob (stray specks);
  4. crops to the item, scales it to fit a 148 px box (never bigger than the cell), centres it on a 160 x 160 canvas;
  5. writes lossy WebP with alpha.
The cell order is the order of SUPPLY_CATALOG (art-source/market-supplies/ASSET-MANIFEST.md). market-art-qa.mts checks that every
supply id has a file and that the files stay inside the size budget.
"""

import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art-source", "market-supplies")
STAFF_SRC = os.path.join(ROOT, "art-source", "staff")
OUT = os.path.join(ROOT, "public", "business", "supplies")
PORTRAITS = os.path.join(ROOT, "public", "business", "staff-portraits")

CELL = 362
COLS, ROWS = 4, 3
CANVAS = 160
BOX = 148
LO, HI = 56, 205  # alpha ramp that removes the haze
ISLAND_FRACTION = 0.02

ATLASES = {
    "S1-culinary-tools.png": [
        "stock-pot", "saucepans", "frying-pans", "saute-pans", "tongs", "spatulas",
        "ladles", "whisks", "peelers", "graters", "skimmers", "sheet-pans",
    ],
    "S2-culinary-tableware.png": [
        "mixing-bowls", "storage-containers", "measuring-cups", "kitchen-scales", "thermometers", "oven-mitts",
        "dinner-forks", "dessert-forks", "dinner-knives", "steak-knives", "teaspoons", "soup-spoons",
    ],
    "S3-tableware-packaging.png": [
        "dinner-plates", "side-plates", "soup-bowls", "dessert-plates", "water-glasses", "highball-glasses",
        "coffee-tea-set", "water-jugs", "salt-pepper", "napkin-holders", "menu-stands", "microwave-containers",
    ],
    "S4-packaging.png": [
        "foil-containers", "thali-containers", "kraft-boxes", "burger-boxes", "food-wrap", "deli-sheets",
        "paper-bags", "carry-bags", "tissues", "paper-napkins", "wet-wipes", "cutlery-packs",
    ],
    "S5-cleaning.png": [
        "toothpicks", "tamper-labels", "dish-soap", "cleaning-liquid", "floor-cleaner", "disinfectant",
        "hand-soap", "toilet-paper", "paper-towels", "sponges-cloths", "bin-liners", "mop-bucket",
    ],
    "S6-cleaning-tools.png": ["brooms", "toilet-brushes"],
}


def clean(cell: Image.Image) -> Image.Image | None:
    a = np.array(cell.convert("RGBA")).astype(np.float32)
    alpha = np.clip((a[..., 3] - LO) / (HI - LO), 0.0, 1.0)
    # drop islands: keep blobs at least ISLAND_FRACTION of the biggest one
    labels, n = ndimage.label(alpha > 0.5)
    if n == 0:
        return None
    sizes = ndimage.sum(np.ones_like(labels), labels, index=range(1, n + 1))
    keep = {i + 1 for i, s in enumerate(sizes) if s >= ISLAND_FRACTION * sizes.max()}
    # a pixel survives if it is part of a kept blob or within 3 px of one (soft edge)
    solid = np.isin(labels, list(keep))
    near = ndimage.binary_dilation(solid, iterations=3)
    alpha = np.where(near, alpha, 0.0)
    a[..., 3] = alpha * 255.0
    out = Image.fromarray(a.astype(np.uint8), "RGBA")
    box = out.getbbox()
    return out.crop(box) if box else None


def fit(img: Image.Image) -> Image.Image:
    w, h = img.size
    scale = min(BOX / w, BOX / h, 1.0)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(img, ((CANVAS - img.width) // 2, (CANVAS - img.height) // 2), img)
    return canvas


def main() -> int:
    missing = [n for n in list(ATLASES) if not os.path.exists(os.path.join(SRC, n))]
    if missing:
        print("missing source atlases (they are local-only, copy them from the Codex branch):", missing)
        return 1
    os.makedirs(OUT, exist_ok=True)
    total = 0
    count = 0
    for name, ids in ATLASES.items():
        atlas = Image.open(os.path.join(SRC, name)).convert("RGBA")
        for i, sid in enumerate(ids):
            col, row = i % COLS, i // COLS
            cell = atlas.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
            item = clean(cell)
            if item is None:
                print("EMPTY CELL", name, i, sid)
                return 1
            path = os.path.join(OUT, f"{sid}.webp")
            fit(item).save(path, "WEBP", quality=82, method=6, alpha_quality=85)
            total += os.path.getsize(path)
            count += 1
    print(f"{count} supply icons, {total / 1024:.0f} KB total, {total / count / 1024:.1f} KB each")
    os.makedirs(PORTRAITS, exist_ok=True)
    for name in ("floor-server", "floor-cleaner"):
        src = os.path.join(STAFF_SRC, f"{name}.png")
        if not os.path.exists(src):
            print("missing staff portrait", src)
            return 1
        im = Image.open(src).convert("RGB")
        side = min(im.size)
        left, top = (im.width - side) // 2, (im.height - side) // 2
        im = im.crop((left, top, left + side, top + side)).resize((320, 320), Image.LANCZOS)
        path = os.path.join(PORTRAITS, f"{name}.webp")
        im.save(path, "WEBP", quality=82, method=6)
        print(f"{name}.webp {os.path.getsize(path) / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
