"""
Builds public/dishes/<recipe id>.webp and src/game/dishArtFiles.ts from the Codex dish sheets (developer 2026-11-21: dish pictures for the starting card and the plates on the tables).

Sources (git-ignored): Dish Sheets Assets/DS-<NN>.png, transparent sheets of 4 x 4 cells of 512 px (2048 x 2048), in the reading order of scripts/dish-sheets.json
(the prompts: docs/planning/DISH-ART-CODEX-PROMPTS-2026-11-21.md). A sheet that is not there yet is skipped: deliver them in any order (a dish without a picture shows its icon on a plate).

A dish is cut from its own 512 px cell (the Codex plates stay inside their cells; only their faint baked shadow crosses the cell lines): only the SOLID pixels (alpha > CORE) and the
connected garnish are kept, so the shadow is dropped (the game draws its own). Each dish is trimmed, centred on a square canvas with a 5 % margin and resized to 320 px.

Output: public/dishes/<recipe id>.webp (320 x 320, transparent) and src/game/dishArtFiles.ts (the set of ids that have a picture).
Env: DS_SRC (sheet folder), DS_OUT (picture folder), DS_TS (the .ts file): for tests.
Run:  python scripts/make-dish-assets.py   (needs Pillow, numpy, scipy)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("DS_SRC", os.path.join(ROOT, "Dish Sheets Assets"))
OUT = os.environ.get("DS_OUT", os.path.join(ROOT, "public", "dishes"))
TS = os.environ.get("DS_TS", os.path.join(ROOT, "src", "game", "dishArtFiles.ts"))
SIZE = 320
CELL = 512
MARGIN = 0.05
CORE = 150  # the alpha above which a pixel is the dish itself (the baked shadow is fainter)

sheets = json.load(open(os.path.join(ROOT, "scripts", "dish-sheets.json"), encoding="utf8"))
os.makedirs(OUT, exist_ok=True)
done = []
problems = []
skipped = []
total_kb = 0

for sh in sheets:
    path = os.path.join(SRC, f"{sh['sheet']}.png")
    if not os.path.exists(path):
        skipped.append(sh["sheet"])
        continue
    im = Image.open(path).convert("RGBA")
    cols, rows = sh["cols"], sh["rows"]
    if im.size != (cols * CELL, rows * CELL):
        problems.append(f"{sh['sheet']}: size {im.size}, expected {(cols * CELL, rows * CELL)}")
    rgba = np.asarray(im).copy()
    for i, dish in enumerate(sh["dishes"]):
        r, c = divmod(i, cols)
        cell = rgba[r * CELL : (r + 1) * CELL, c * CELL : (c + 1) * CELL].copy()
        al = cell[..., 3]
        # the plate's soft baked shadow is faint but reaches across the cell lines: only the SOLID dish is kept (the game draws its own shadow under it)
        core = al > CORE
        labels, n = ndimage.label(ndimage.binary_dilation(core, structure=np.ones((3, 3)), iterations=4))
        keep = np.zeros_like(core)
        for lab in range(1, n + 1):
            part = (labels == lab) & core
            if part.sum() >= 300:  # the dish and its garnish; not a speck
                keep |= part
        if keep.sum() < 3000:
            problems.append(f"{sh['sheet']} #{i + 1} {dish['id']}: no dish found")
            continue
        ys, xs = np.nonzero(keep)
        if xs.min() <= 1 or ys.min() <= 1 or xs.max() >= CELL - 2 or ys.max() >= CELL - 2:
            problems.append(f"{sh['sheet']} #{i + 1} {dish['id']}: the dish reaches its cell edge (check by eye)")
        # the soft anti-aliased edge of the dish (alpha below CORE) stays: two pixels round the solid part
        mask = ndimage.binary_dilation(keep, structure=np.ones((3, 3)), iterations=2)
        cell[~mask] = 0
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        pad = 3
        x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(CELL, x1 + pad), min(CELL, y1 + pad)
        icon = Image.fromarray(cell[y0:y1, x0:x1], "RGBA")
        side = int(max(icon.width, icon.height) * (1 + 2 * MARGIN))
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2), icon)
        canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
        out = os.path.join(OUT, dish["id"] + ".webp")
        canvas.save(out, "WEBP", quality=88, method=6, alpha_quality=95)
        total_kb += os.path.getsize(out) / 1024
        done.append(dish["id"])

# the set of ids that have a picture: everything that is in the folder now (a sheet delivered earlier keeps its dishes)
have = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith(".webp"))
known = {d["id"] for sh in sheets for d in sh["dishes"]}
for h in have:
    if h not in known:
        problems.append(f"public/dishes/{h}.webp is not a dish of scripts/dish-sheets.json")
lines = [
    "/**",
    " * Which dishes have a painted picture in `public/dishes/<recipe id>.webp` (Codex, developer 2026-11-21: \"design the dishes with Codex and use them while serving too\").",
    " * Written by `scripts/make-dish-assets.py` from the dish sheets. Do not edit by hand.",
    " */",
    "export const DISH_ART_IDS: ReadonlySet<string> = new Set<string>([",
]
lines += [f'  "{h}",' for h in have if h in known]
lines.append("]);")
open(TS, "w", encoding="utf8", newline="").write("\n".join(lines) + "\n")
print(f"{len(done)} dishes cut now ({total_kb:.0f} KB); {len(have)} in the folder; sheets not delivered yet: {', '.join(skipped) or 'none'}")
for p in problems:
    print("PROBLEM", p)
sys.exit(1 if problems else 0)
