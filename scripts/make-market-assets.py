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


# The SPOILED TWINS (Fridge Check, "Fresh Check Assets/C20..C24"): every ingredient drawn spoiled, in the same cell order as A7..A11.
SPOILED_OUT = os.path.join(ROOT, "public", "business", "ingredients-spoiled")
SPOILED_SHEETS = {"C20-spoiled-1.png": "A7.png", "C21-spoiled-2.png": "A8.png", "C22-spoiled-3.png": "A9.png",
                  "C23-spoiled-4.png": "A10.png", "C24-spoiled-5.png": "A11.png"}


# The chicken's twin is a drumstick but the game's chicken is a raw breast (ING_SINGLES): it keeps the generic overlays instead.
SPOILED_SKIP = {"chicken"}


def build_spoiled() -> int:
    os.makedirs(SPOILED_OUT, exist_ok=True)
    total = 0
    count = 0
    for sheet, fresh_sheet in SPOILED_SHEETS.items():
        src = os.path.join(ROOT, "Fresh Check Assets", sheet)
        if not os.path.exists(src):
            print("missing spoiled sheet (local-only):", src)
            return 1
        atlas = Image.open(src).convert("RGBA")
        cw, ch = atlas.width // COLS, atlas.height // ROWS
        for i, iid in enumerate(ING_ATLASES[fresh_sheet]):
            if not iid or iid in SPOILED_SKIP:
                continue
            col, row = i % COLS, i // COLS
            cell = atlas.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
            item = clean(cell, ING_LO, ING_HI)
            if item is None:
                print("EMPTY SPOILED CELL", sheet, i, iid)
                return 1
            path = os.path.join(SPOILED_OUT, f"{iid}.webp")
            fit(item).save(path, "WEBP", quality=80, method=6, alpha_quality=85)
            total += os.path.getsize(path)
            count += 1
    print(f"{count} spoiled twins, {total / 1024:.0f} KB total, {total / count / 1024:.1f} KB each")
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


# the game screen's frame pieces: (output name, source sheet, box in the sheet or None = find by blob, output width, alpha lo, hi)
FS_UI = [
    # the big woven basket the bought food arrives in (Fridge Sort, 2026-11-05): A6 whole
    ("basket", "A6.png", (0, 0, 1672, 941), 560),
    ("hud-wide", "A12.png", (26, 196, 791, 496), 360),
    ("hud-small", "A12.png", (820, 226, 1385, 468), 260),
    ("hud-round", "A12.png", (1391, 218, 1661, 499), 96),
    ("hud-tag", "A12.png", (1675, 204, 2168, 474), 220),
    ("starbar-frame", "A13.png", (35, 93, 2137, 450), 480),
    ("starbar-fill", "A13.png", (67, 455, 2100, 628), 480),
    ("star-full", "A14.png", (176, 119, 670, 598), 96),
    ("star-empty", "A14.png", (839, 119, 1333, 599), 96),
    ("crate-back", "A4.png", (31, 26, 1903, 801), 560),
    ("crate-front", "A5.png", (31, 88, 1903, 766), 560),
    ("result-panel", "A16.png", (0, 0, 1422, 1103), 520),
]
MAGNET_ORDER = ["tomato", "carrot", "apple", "lemon", "cheese", "fish", "chef-hat", "whisk", "star", "heart", "chilli", "mushroom"]


def build_fridge_ui() -> int:
    total = 0
    for name, sheet, box, width in FS_UI:
        src = os.path.join(FRIDGE_SRC, sheet)
        if not os.path.exists(src):
            print("missing fridge art (local-only):", src)
            return 1
        item = clean(Image.open(src).convert("RGBA").crop(box), 50, 160)
        if item is None:
            print("EMPTY", name)
            return 1
        item = item.resize((width, max(1, round(item.height * width / item.width))), Image.LANCZOS)
        path = os.path.join(FS_OUT, f"{name}.webp")
        item.save(path, "WEBP", quality=84, method=6, alpha_quality=85)
        total += os.path.getsize(path)
    src = os.path.join(FRIDGE_SRC, "A17.png")
    if not os.path.exists(src):
        print("missing fridge art (local-only):", src)
        return 1
    sheet = Image.open(src).convert("RGBA")
    cw, ch = sheet.width // 4, sheet.height // 3
    for i, mid in enumerate(MAGNET_ORDER):
        col, row = i % 4, i // 4
        cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
        item = clean(cell, 110, 215)
        if item is None:
            print("EMPTY MAGNET", mid)
            return 1
        path = os.path.join(FS_OUT, f"magnet-{i + 1:02d}.webp")
        fit(item).save(path, "WEBP", quality=84, method=6, alpha_quality=85)
        total += os.path.getsize(path)
    print(f"fridge sort frame art: {total / 1024:.0f} KB")
    return 0


def build_wall() -> int:
    """The kitchen wall and counter behind Fridge Sort (A3, opaque): scaled to 420 px wide."""
    src = os.path.join(FRIDGE_SRC, "A3.png")
    if not os.path.exists(src):
        print("missing fridge art (local-only):", src)
        return 1
    im = Image.open(src).convert("RGB")
    im = im.resize((420, round(im.height * 420 / im.width)), Image.LANCZOS)
    path = os.path.join(FS_OUT, "kitchen-wall.webp")
    im.save(path, "WEBP", quality=74, method=6)
    print(f"kitchen-wall.webp {os.path.getsize(path) / 1024:.0f} KB")
    return 0


# ── Stockroom Sort (developer 2026-11-06; plan docs/planning/STOCKROOM-SORT-MINIGAME-PLAN-2026-11-06.md) ─────────────────────────────────
# Source: the Codex PNGs in "Iventory Assets/" (the developer's folder name; local only, gitignored). Output: public/business/stockroom/.
SR_SRC = os.path.join(ROOT, "Iventory Assets")
SR_OUT = os.path.join(ROOT, "public", "business", "stockroom")
SR_GOODS = os.path.join(SR_OUT, "goods")
SR_CANVAS, SR_BOX = 112, 106  # a slot is about 52 px wide: 2x for sharp phone screens
SR_SHEETS = {
    "I10-goods-1.png": ATLASES["S1-culinary-tools.png"],
    "I11-goods-2.png": ATLASES["S2-culinary-tableware.png"],
    "I12-goods-3.png": ATLASES["S3-tableware-packaging.png"],
    "I13-goods-4.png": ATLASES["S4-packaging.png"],
    "I14-goods-5.png": ATLASES["S5-cleaning.png"],
    "I15-goods-6.png": ATLASES["S6-cleaning-tools.png"],
}


def _cells_by_shape(sheet: Image.Image, cols: int, rows: int) -> dict[int, Image.Image]:
    """Cuts a sheet into its cells by SHAPE, not by the grid lines: Codex let tall items (spatula, ladle, peeler) reach past their cell, so
    every blob goes to the cell holding its centre, and a cell is the union of its blobs (two glasses, a broom and its dustpan)."""
    a = np.array(sheet.convert("RGBA"))
    cw, ch = a.shape[1] // cols, a.shape[0] // rows
    labels, n = ndimage.label(a[..., 3] > 40)
    out: dict[int, Image.Image] = {}
    groups: dict[int, list[int]] = {}
    for i, (cy, cx) in enumerate(ndimage.center_of_mass(a[..., 3] > 40, labels, range(1, n + 1)), start=1):
        if (labels == i).sum() < 600:
            continue  # a speck
        cell = min(rows - 1, int(cy // ch)) * cols + min(cols - 1, int(cx // cw))
        groups.setdefault(cell, []).append(i)
    for cell, ids in groups.items():
        mask = np.isin(labels, ids)
        mask = ndimage.binary_dilation(mask, iterations=4)  # keep the soft edge
        b = a.copy()
        b[..., 3] = np.where(mask, b[..., 3], 0)
        img = Image.fromarray(b, "RGBA")
        box = img.getbbox()
        if box:
            out[cell] = img.crop(box)
    return out


def _fit_to(img: Image.Image, canvas: int, box: int) -> Image.Image:
    w, h = img.size
    scale = min(box / w, box / h)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    c = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    c.paste(img, ((canvas - img.width) // 2, (canvas - img.height) // 2), img)
    return c


def _save(img: Image.Image, name: str, folder: str, quality: int = 82) -> int:
    path = os.path.join(folder, name + ".webp")
    img.save(path, "WEBP", quality=quality, method=6, alpha_quality=88)
    return os.path.getsize(path)


# (sheet, columns, rows, [(cell, output name, output width)]); every cell is cut by shape.
SR_UI = [
    ("I06-lock-parts.png", 2, 1, [(0, "lock-closed", 96), (1, "lock-open", 96)]),
    ("I07-parcels.png", 2, 1, [(0, "parcel-closed", 96), (1, "parcel-open", 96)]),
    ("I20-boosters.png", 4, 2, [(0, "boost-undo", 96), (1, "boost-hint", 96), (2, "boost-shelf", 96), (3, "boost-time", 96), (4, "boost-shuffle", 96), (5, "boost-blank", 96), (6, "boost-locked", 96), (7, "boost-ad", 96)]),
    ("I21-ribbons.png", 4, 1, [(0, "ribbon-sage", 260), (1, "ribbon-gold", 260), (2, "ribbon-copper", 260), (3, "burst", 160)]),
    ("I22-fx.png", 4, 2, [(0, "spark-1", 64), (1, "spark-2", 64), (2, "spark-3", 64), (3, "spark-4", 64), (4, "puff-1", 96), (5, "puff-2", 96), (6, "puff-3", 96), (7, "puff-4", 96)]),
    ("I26-badges.png", 4, 3, [(i, f"badge-{i + 1:02d}", 112) for i in range(12)]),
]
SR_SINGLE = [("I23-stamp.png", "stamp", 176), ("I25-delivery-truck.png", "truck", 240),
             ("I03-cubby.png", "cubby", 520), ("I04-unit-top.png", "unit-top", 640), ("I05-unit-plinth.png", "unit-plinth", 640)]


def build_stockroom() -> int:
    if not os.path.isdir(SR_SRC):
        print("missing source folder (local-only):", SR_SRC)
        return 1
    os.makedirs(SR_GOODS, exist_ok=True)
    total = 0
    count = 0
    for sheet, ids in SR_SHEETS.items():
        src = os.path.join(SR_SRC, sheet)
        if not os.path.exists(src):
            print("missing goods sheet:", src)
            return 1
        cells = _cells_by_shape(Image.open(src), COLS, ROWS)
        for i, sid in enumerate(ids):
            if i not in cells:
                print("EMPTY GOODS CELL", sheet, i, sid)
                return 1
            total += _save(_fit_to(cells[i], SR_CANVAS, SR_BOX), sid, SR_GOODS)
            count += 1
    goods = total
    for sheet, cols, rows, parts in SR_UI:
        src = os.path.join(SR_SRC, sheet)
        if not os.path.exists(src):
            print("missing sheet:", src)
            return 1
        cells = _cells_by_shape(Image.open(src), cols, rows)
        for cell, name, width in parts:
            if cell not in cells:
                print("EMPTY CELL", sheet, cell, name)
                return 1
            img = cells[cell]
            img = img.resize((width, max(1, round(img.height * width / img.width))), Image.LANCZOS)
            total += _save(img, name, SR_OUT)
    for fname, name, width in SR_SINGLE:
        src = os.path.join(SR_SRC, fname)
        if not os.path.exists(src):
            print("missing image:", src)
            return 1
        img = Image.open(src).convert("RGBA")
        if name in ("unit-top", "unit-plinth", "cubby"):
            # crop to the VISIBLE wood (alpha over 40): the faint shadow around it would make the picture bigger than the cubby it shows
            ys, xs = np.where(np.array(img)[..., 3] > 40)
            img = img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
        else:
            cells = _cells_by_shape(img, 1, 1)
            img = cells[0]
        img = img.resize((width, max(1, round(img.height * width / img.width))), Image.LANCZOS)
        total += _save(img, name, SR_OUT)
    # the supplies room behind the board (opaque)
    for fname, name in (("I01-backdrop-supplies.png", "backdrop"),):
        im = Image.open(os.path.join(SR_SRC, fname)).convert("RGB")
        im = im.resize((540, round(im.height * 540 / im.width)), Image.LANCZOS)
        path = os.path.join(SR_OUT, name + ".webp")
        im.save(path, "WEBP", quality=70, method=6)
        total += os.path.getsize(path)
    print(f"stockroom sort art: {count} goods ({goods / 1024:.0f} KB), {total / 1024:.0f} KB in all")
    return 0


# ── Fridge Check (restaurant/fridgeCheck.ts): the closing-night inspection, Codex art in "Fresh Check Assets/" ───────────────────
FC_SRC = os.path.join(ROOT, "Fresh Check Assets")
FC_OUT = os.path.join(ROOT, "public", "business", "fridge-check")
# (sheet, columns, rows, [(cell, output name, output width)]); every cell is cut by shape (the sheets carry a faint haze, alpha 1-39).
FC_UI = [
    ("C03-stamps.png", 3, 1, [(0, "stamp-keep", 176), (1, "stamp-bin", 176), (2, "stamp-first", 176)]),
    ("C04-bins.png", 2, 1, [(0, "bin-open", 240), (1, "bin-closed", 240)]),
    ("C05-props.png", 4, 2, [(0, "flag", 112), (1, "label-green", 128), (2, "label-yellow", 128), (3, "label-red", 128),
                             (4, "tape", 112), (5, "marker", 128), (6, "film-dispenser", 128), (7, "tray", 144)]),
    ("C07-freshness-icons.png", 4, 1, [(0, "icon-fresh", 88), (1, "icon-aging", 88), (2, "icon-near", 88), (3, "icon-spoiled", 88)]),
    ("C08-overlays.png", 4, 3, [(i, f"ov-{i + 1:02d}", 200) for i in range(12)]),
    ("C09-spoil-fx.png", 4, 2, [(0, "fly-1", 72), (1, "fly-2", 72), (2, "fly-3", 72), (3, "wisp-tall", 96), (4, "wisp-wide", 128),
                                (5, "drop", 56), (6, "drip", 72), (7, "cobweb", 120)]),
    ("C10-wrap-film.png", 3, 1, [(0, "wrap-round", 300), (1, "wrap-box", 300), (2, "wrap-long", 300)]),
    ("C11-badges.png", 4, 3, [(i, f"pin-{i + 1:02d}", 112) for i in range(12)]),
]
FC_SINGLE = [("C02-card.png", "card", 340), ("C06-steel-shelf.png", "shelf", 640)]


def build_fridge_check() -> int:
    if not os.path.isdir(FC_SRC):
        print("missing source folder (local-only):", FC_SRC)
        return 1
    os.makedirs(FC_OUT, exist_ok=True)
    total = 0
    for sheet, cols, rows, parts in FC_UI:
        src = os.path.join(FC_SRC, sheet)
        if not os.path.exists(src):
            print("missing sheet:", src)
            return 1
        cells = _cells_by_shape(Image.open(src), cols, rows)
        for cell, name, width in parts:
            if cell not in cells:
                print("EMPTY CELL", sheet, cell, name)
                return 1
            img = cells[cell]
            img = img.resize((width, max(1, round(img.height * width / img.width))), Image.LANCZOS)
            total += _save(img, name, FC_OUT)
    for fname, name, width in FC_SINGLE:
        src = os.path.join(FC_SRC, fname)
        if not os.path.exists(src):
            print("missing image:", src)
            return 1
        img = Image.open(src).convert("RGBA")
        # crop to the VISIBLE art (alpha over 40): the faint shadow around it would make it bigger than it looks
        ys, xs = np.where(np.array(img)[..., 3] > 40)
        img = img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
        img = img.resize((width, max(1, round(img.height * width / img.width))), Image.LANCZOS)
        total += _save(img, name, FC_OUT)
    # the cold room behind the cards (opaque)
    src = os.path.join(FC_SRC, "C01-backdrop-coldroom.png")
    if not os.path.exists(src):
        print("missing image:", src)
        return 1
    im = Image.open(src).convert("RGB")
    im = im.resize((540, round(im.height * 540 / im.width)), Image.LANCZOS)
    path = os.path.join(FC_OUT, "backdrop.webp")
    im.save(path, "WEBP", quality=70, method=6)
    total += os.path.getsize(path)
    print(f"fridge check art: {len(os.listdir(FC_OUT))} files, {total / 1024:.0f} KB in all")
    return 0


def main() -> int:
    if "--stockroom" in sys.argv:  # only the Stockroom Sort art (needs just "Iventory Assets/")
        return build_stockroom()
    if "--fridgecheck" in sys.argv:  # only the Fridge Check art (needs just "Fresh Check Assets/")
        return build_fridge_check() or build_spoiled()
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
    if build_fridge_sort() != 0 or build_fridge_ui() != 0 or build_wall() != 0:
        return 1
    if build_stockroom() != 0:
        return 1
    if os.path.isdir(FC_SRC) and (build_fridge_check() != 0 or build_spoiled() != 0):
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
