"""
Builds public/business/fridge-sort/{bin-*,drawer-*,rack-*,shelf-glass}.webp from the Codex crate sheet (developer 2026-11-20: the Fridge Sort mock-up).

Source (git-ignored): Landscape Backdrops Assets/Fridge Sort Crates Assets/FSC-crates.png, 2560 x 1024, a transparent sheet of 5 x 2 cells (512 each), in reading order:
  1 roots  2 salad  3 stems  4 pods  5 fruit | 6 greens  7 butter  8 aromatics  9 dairy shelf strip  10 meat shelf strip
The prompt: docs/planning/FRIDGE-SORT-LANDSCAPE-MOCKUP-AND-CODEX-PROMPTS-2026-11-20.md.

Every crate is trimmed to its picture and placed on ONE canvas, bottom-aligned and centred, so the blank name slat on the crate's front sits at the same height in
all eight (the game puts the shelf's name tag over it at one fixed place). The canvas is 360 px wide. The shelf strip is trimmed and saved at 360 wide.

Run:  python scripts/make-fridge-sort-crates.py   (needs Pillow)
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get(
    "FSC_SRC",
    os.path.join(ROOT, "Landscape Backdrops Assets", "Fridge Sort Crates Assets", "FSC-crates.png"),
)
OUT = os.path.join(ROOT, "public", "business", "fridge-sort")
CELL = 512
CRATES = [
    ("bin-roots", 0, 0),
    ("bin-salad", 1, 0),
    ("bin-stems", 2, 0),
    ("bin-pods", 3, 0),
    ("drawer-fruit", 4, 0),
    ("drawer-greens", 0, 1),
    ("rack-butter", 1, 1),
    ("rack-aromatics", 2, 1),
]
STRIP = ("shelf-glass", 3, 1)  # the dairy strip; the meat strip (4, 1) is the same picture
WIDTH = 360

if not os.path.exists(SRC):
    sys.exit(f"missing {SRC}")
sheet = Image.open(SRC).convert("RGBA")


def cell(col, row):
    im = sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    return im.crop(box)


pics = [(name, cell(c, r)) for name, c, r in CRATES]
cw = max(p.width for _, p in pics)
ch = max(p.height for _, p in pics)
total = 0
for name, p in pics:
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(p, ((cw - p.width) // 2, ch - p.height), p)
    h = round(ch * WIDTH / cw)
    canvas = canvas.resize((WIDTH, h), Image.LANCZOS)
    path = os.path.join(OUT, name + ".webp")
    canvas.save(path, "WEBP", quality=88, method=6)
    total += os.path.getsize(path)
    print(f"{name:16s} {WIDTH} x {h}  {os.path.getsize(path) // 1024} KB")

name, c, r = STRIP
strip = cell(c, r)
h = max(1, round(strip.height * WIDTH / strip.width))
strip = strip.resize((WIDTH, h), Image.LANCZOS)
path = os.path.join(OUT, name + ".webp")
strip.save(path, "WEBP", quality=88, method=6)
total += os.path.getsize(path)
print(f"{name:16s} {WIDTH} x {h}  {os.path.getsize(path) // 1024} KB")
print(f"9 pictures, {total // 1024} KB in all")
