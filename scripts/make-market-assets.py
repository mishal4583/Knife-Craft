"""
Builds the Market's painted icons from the generated source art (developer 2026-11-03: the supply and staff emoji did not match
their names; Codex made the art, branch codex/fridge-sort-art-publish).

Run:  python scripts/make-market-assets.py        (needs Pillow, numpy and scipy; use `python`, not the MSYS `python3`)

Input (LOCAL ONLY, gitignored: the PNGs are 59 MB, they never go into git):
  art-source/market-supplies/S1..S6-*.png   4 x 3 atlases of 362 x 362 cells, read left to right, top to bottom
  art-source/fridge-sort/A7..A11.png, ingredient-green-chili.png, ingredient-chicken-breast.png
  art-source/staff/floor-server.png, floor-cleaner.png

Output (these small WebP files ARE committed):
  public/business/supplies/<supply id>.webp         160 x 160, transparent, ~6-10 KB each (62 files)
  public/business/ingredients/<ingredient id>.webp  160 x 160, transparent (57 files), from art-source/fridge-sort/A7..A11 (+ two
                                                    corrected single sprites: green chili and chicken breast)
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
FRIDGE_SRC = os.path.join(ROOT, "art-source", "fridge-sort")
ING_OUT = os.path.join(ROOT, "public", "business", "ingredients")

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


# The ingredient sheets: A7..A11, 12 cells each ("" = an intentionally empty cell). Their glow is stronger than the supplies' (a pale
# halo around each item), so the alpha ramp starts higher.
ING_LO, ING_HI = 96, 215
ING_ATLASES = {
    "A7.png": ["tomato", "carrot", "cucumber", "onion", "potato", "mushroom", "pepper", "zucchini", "eggplant", "broccoli", "corn", "celery"],
    "A8.png": ["lettuce", "cabbage", "cauliflower", "spinach", "asparagus", "radish", "beetroot", "sweetpotato", "greenbean", "fennel", "artichoke", "peapod"],
    "A9.png": ["pumpkin", "turnip", "chilli", "springonion", "garlic", "ginger", "basil", "parsley", "cilantro", "bread", "baguette", ""],
    "A10.png": ["strawberry", "apple", "orange", "lemon", "avocado", "pear", "peach", "pineapple", "watermelon", "mango", "kiwi", "pomegranate"],
    "A11.png": ["grapes", "coconut", "lime", "cheddar", "mozzarella", "butter", "tofu", "chicken", "steak", "salmon", "", ""],
}
# Corrected single sprites (the original cell is replaced): the chili is GREEN (the name says so), the chicken is a raw BREAST.
ING_SINGLES = {"chilli": "ingredient-green-chili.png", "chicken": "ingredient-chicken-breast.png"}


def clean(cell: Image.Image, lo: int = LO, hi: int = HI) -> Image.Image | None:
    a = np.array(cell.convert("RGBA")).astype(np.float32)
    alpha = np.clip((a[..., 3] - lo) / (hi - lo), 0.0, 1.0)
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


def build_ingredients() -> int:
    os.makedirs(ING_OUT, exist_ok=True)
    total = 0
    count = 0
    for name, ids in ING_ATLASES.items():
        src = os.path.join(FRIDGE_SRC, name)
        if not os.path.exists(src):
            print("missing ingredient atlas (local-only):", src)
            return 1
        atlas = Image.open(src).convert("RGBA")
        for i, iid in enumerate(ids):
            if not iid:
                continue
            if iid in ING_SINGLES:
                continue  # the corrected sprite below replaces this cell
            col, row = i % COLS, i // COLS
            cell = atlas.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
            item = clean(cell, ING_LO, ING_HI)
            if item is None:
                print("EMPTY CELL", name, i, iid)
                return 1
            path = os.path.join(ING_OUT, f"{iid}.webp")
            fit(item).save(path, "WEBP", quality=82, method=6, alpha_quality=85)
            total += os.path.getsize(path)
            count += 1
    for iid, fname in ING_SINGLES.items():
        src = os.path.join(FRIDGE_SRC, fname)
        if not os.path.exists(src):
            print("missing corrected sprite (local-only):", src)
            return 1
        item = clean(Image.open(src).convert("RGBA"), ING_LO, ING_HI)
        if item is None:
            print("EMPTY SPRITE", fname)
            return 1
        path = os.path.join(ING_OUT, f"{iid}.webp")
        fit(item).save(path, "WEBP", quality=82, method=6, alpha_quality=85)
        total += os.path.getsize(path)
        count += 1
    print(f"{count} ingredient sprites, {total / 1024:.0f} KB total, {total / count / 1024:.1f} KB each")
    return 0


FS_OUT = os.path.join(ROOT, "public", "business", "fridge-sort")
# (output name, source sheet, cell box (x0, y0, x1, y1) in the sheet, output width)
FS_PARTS = [
    ("bin-roots", "A24-veg-bins.png", (0, 0, 512, 512), 300),
    ("bin-salad", "A24-veg-bins.png", (512, 0, 1024, 512), 300),
    ("bin-stems", "A24-veg-bins.png", (1024, 0, 1536, 512), 300),
    ("bin-pods", "A24-veg-bins.png", (1536, 0, 2048, 512), 300),
    ("drawer-fruit", "A25-drawers.png", (0, 0, 512, 512), 300),
    ("drawer-greens", "A25-drawers.png", (512, 0, 1024, 512), 300),
]
# the door's two racks are cut out of the empty door (A23, an opaque painting): (x0, y0, x1, y1) in its 737 x 2135 pixels
FS_DOOR = [("rack-butter", (80, 540, 665, 760), 300), ("rack-aromatics", (80, 1085, 650, 1400), 300)]
# one glass shelf cut from the fridge (A1): the floor of the Dairy and Meat bands
FS_SHELF = ("shelf-glass", (205, 435, 895, 520), 360)


def build_fridge_sort() -> int:
    os.makedirs(FS_OUT, exist_ok=True)
    total = 0
    for name, sheet, box, width in FS_PARTS:
        src = os.path.join(FRIDGE_SRC, sheet)
        if not os.path.exists(src):
            print("missing fridge art (local-only):", src)
            return 1
        cell = Image.open(src).convert("RGBA").crop(box)
        item = clean(cell, 70, 200)
        if item is None:
            print("EMPTY", name)
            return 1
        item = item.resize((width, max(1, round(item.height * width / item.width))), Image.LANCZOS)
        path = os.path.join(FS_OUT, f"{name}.webp")
        item.save(path, "WEBP", quality=84, method=6, alpha_quality=85)
        total += os.path.getsize(path)
    door_src = os.path.join(FRIDGE_SRC, "A23-door-empty.png")
    shelf_src = os.path.join(FRIDGE_SRC, "A1.png")
    for name, box, width in FS_DOOR + [FS_SHELF]:
        src = door_src if name.startswith("rack") else shelf_src
        if not os.path.exists(src):
            print("missing fridge art (local-only):", src)
            return 1
        part = Image.open(src).convert("RGBA").crop(box)
        part = part.resize((width, max(1, round(part.height * width / part.width))), Image.LANCZOS)
        path = os.path.join(FS_OUT, f"{name}.webp")
        part.save(path, "WEBP", quality=84, method=6, alpha_quality=85)
        total += os.path.getsize(path)
    print(f"fridge sort art: {total / 1024:.0f} KB")
    return 0


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
    if build_ingredients() != 0:
        return 1
    if build_fridge_sort() != 0:
        return 1
    os.makedirs(PORTRAITS, exist_ok=True)
    for name in ("floor-server", "floor-cleaner", "cashier"):
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
