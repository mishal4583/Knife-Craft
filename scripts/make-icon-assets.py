"""
Builds public/icons/<slug>.webp and src/lib/paintedIconFiles.ts from the Codex icon sheets (developer 2026-11-21: the 10 sheets are delivered).

Sources (git-ignored): Icon Sheets Assets/IS-<sheet>.png, transparent sheets of 5 x 5 (awards-nature 6 x 5) cells of 400 px, in the reading order of scripts/icon-sheets.json
(the prompts: docs/planning/ICON-PAINTED-ASSETS-CODEX-PROMPTS-2026-11-20.md).

An icon is cut by its SHAPES, not by the grid line: the sheet is split into connected shapes of opaque pixels (a shape that is only a few pixels apart from its neighbour, like the
sparkles round a party popper, is joined to it by a small dilation), and every shape goes to the cell its centre is in. So an icon that spills a few pixels over its cell line (a house
base, a crane hook) is cut whole, and never carries a piece of its neighbour. Each icon is then trimmed to its shape, centred on a square canvas with a 6 % margin, and resized to 128 px.

Output: public/icons/<slug>.webp (128 x 128, transparent) and src/lib/paintedIconFiles.ts (emoji -> slug), read by src/lib/paintedIcons.ts.
Run:  python scripts/make-icon-assets.py   (needs Pillow, numpy, scipy)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("IS_SRC", os.path.join(ROOT, "Icon Sheets Assets"))
OUT = os.path.join(ROOT, "public", "icons")
TS = os.path.join(ROOT, "src", "lib", "paintedIconFiles.ts")
SIZE = 128
CELL = 400
MARGIN = 0.06

sheets = json.load(open(os.path.join(ROOT, "scripts", "icon-sheets.json"), encoding="utf8"))
os.makedirs(OUT, exist_ok=True)
mapping = {}
problems = []
total_kb = 0


def norm(e):
    """The key `emojiIcons.ts` uses: no variation selector, no skin tone."""
    return "".join(c for c in e if c != "️" and not ("\U0001F3FB" <= c <= "\U0001F3FF"))


for sh in sheets:
    path = os.path.join(SRC, f"IS-{sh['sheet']}.png")
    if not os.path.exists(path):
        sys.exit(f"missing {path}")
    im = Image.open(path).convert("RGBA")
    cols, rows = sh["cols"], sh["rows"]
    if im.size != (cols * CELL, rows * CELL):
        problems.append(f"{sh['sheet']}: size {im.size}, expected {(cols * CELL, rows * CELL)}")
    a = np.asarray(im)[..., 3]
    solid = a > 24
    # join the pieces of one icon (a sparkle, a drop beside a bottle): a small dilation, so two icons that are only a few pixels apart are NOT joined
    joined = ndimage.binary_dilation(solid, structure=np.ones((3, 3)), iterations=4)
    labels, n = ndimage.label(joined)
    H, W = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    grid_cell = np.minimum(yy // CELL, rows - 1) * cols + np.minimum(xx // CELL, cols - 1)
    cell_of = np.full((H, W), -1, dtype=int)  # which icon's cell each solid pixel belongs to
    for lab in range(1, n + 1):
        m = (labels == lab) & solid
        cnt = np.bincount(grid_cell[m], minlength=rows * cols)
        if cnt.sum() < 40:
            continue  # a stray speck
        ys, xs = np.nonzero(m)
        # the cell of the shape's CENTRE (an icon that spills over its cell line is still that cell's icon); only a shape clearly bigger than one icon is two icons touching
        main = int(min(ys.mean() // CELL, rows - 1) * cols + min(xs.mean() // CELL, cols - 1))
        if (xs.max() - xs.min()) > 1.35 * CELL or (ys.max() - ys.min()) > 1.35 * CELL:
            cell_of[m] = grid_cell[m]
            problems.append(f"{sh['sheet']}: two icons touch near cell {main + 1}: split on the grid line (check by eye)")
        else:
            cell_of[m] = main
    rgba = np.asarray(im).copy()
    for i, (emoji, slug, what) in enumerate(sh["icons"]):
        mine = (cell_of == i)
        if mine.sum() < 40:
            problems.append(f"{sh['sheet']} #{i + 1} {slug}: no shape found")
            continue
        ys, xs = np.nonzero(mine)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        # the soft edge pixels round the shape (alpha 1-24) belong to it too: take the dilated shape's alpha inside the box
        near = ndimage.binary_dilation(mine, structure=np.ones((3, 3)), iterations=2) & ~((cell_of >= 0) & ~mine)
        piece = rgba[y0:y1, x0:x1].copy()
        piece[~near[y0:y1, x0:x1]] = 0
        icon = Image.fromarray(piece, "RGBA")
        side = int(max(icon.width, icon.height) * (1 + 2 * MARGIN))
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2), icon)
        canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
        out = os.path.join(OUT, slug + ".webp")
        canvas.save(out, "WEBP", quality=90, method=6, alpha_quality=95)
        total_kb += os.path.getsize(out) / 1024
        if slug in mapping.values():
            problems.append(f"duplicate slug {slug}")
        mapping.setdefault(norm(emoji), slug)  # 👵 and 👵🏻 are one key: the first (neutral) picture wins

lines = [
    "/**",
    " * Emoji -> painted icon file in `public/icons/`, written by `scripts/make-icon-assets.py` from the Codex icon sheets (developer 2026-11-21). Do not edit by hand.",
    " * Keys are emoji with no variation selector and no skin tone (like `EMOJI_ICONS`).",
    " */",
    "export const PAINTED_ICON_FILES: Readonly<Record<string, string>> = {",
]
for k in sorted(mapping, key=lambda x: [ord(c) for c in x]):
    lines.append(f'  "{k}": "{mapping[k]}",')
lines.append("};")
open(TS, "w", encoding="utf8", newline="").write("\n".join(lines) + "\n")
print(f"{len(mapping)} icons written to public/icons/ ({total_kb:.0f} KB) and {os.path.relpath(TS, ROOT)}")
for p in problems:
    print("PROBLEM", p)
sys.exit(1 if problems else 0)
