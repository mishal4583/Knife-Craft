"""
Builds public/progress/<sheet>/<slug>.webp and src/game/progressArtFiles.ts from the Codex sheets of the Restaurant Progress page
(developer 2026-11-25: docs/planning/RESTAURANT-PROGRESS-CODEX-PROMPTS-2026-11-25.md, docs/planning/RESTAURANT-PROGRESS-REDESIGN-PLAN-2026-11-25.md).

Sources (not part of the build): "Restaurant Progress Assets/RP-<sheet>.png", transparent sheets in the grids of scripts/progress-sheets.json (columns x rows of cells,
the pictures in reading order, the first N cells filled).

A picture is cut by its SHAPE, not by the grid line (the Codex pictures fill their cell and often cross its edge): the sheet is split into connected shapes of opaque
pixels (a shape a few pixels apart from its part, like the sparkles round a coin or the leaves round a plaque, is joined to it by a small dilation), and every shape goes
to the cell its centre is in. A cell may have several shapes (they are joined); a speck far smaller than the main shape is dropped. Each picture is then trimmed to its
shape and written as a WebP with its alpha:
  - the icon sheets (icons-a, icons-b, icons-c) and the medals are centred on a SQUARE canvas (the page puts them in square slots);
  - every other sheet keeps the picture's own proportions, fitted to the sheet's output size ("out": the long side in pixels).
A sheet marked "mode": "cell" (the goal vignettes: soft-edged scenes that touch their neighbour's glow) is cut by its cell instead, trimmed to the picture inside it.
A cell with no shape (a picture missing), a shape in a cell that should be empty, or a picture bigger than its cell stops the build with a list.

Output size rules (REFERENCE section 10, "Image size budget"): the whole folder stays under 2 MB, no file over 90 KB; the quality steps down for a file that is too big.
Run:  python scripts/make-progress-assets.py   (needs Pillow, numpy, scipy)
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("RP_SRC", os.path.join(ROOT, "Restaurant Progress Assets"))
OUT = os.path.join(ROOT, "public", "progress")
TS = os.path.join(ROOT, "src", "game", "progressArtFiles.ts")
SQUARE = {"icons-a", "icons-b", "icons-c", "medals"}
SHAPE_ALPHA = 12  # a pixel with at least this alpha is part of a shape
JOIN = 7  # shapes closer than about 2 x this many pixels are one picture
SPECK = 0.004  # a shape smaller than this share of its cell's main shape is a speck
MARGIN = 0.05  # empty margin round a square picture
MAX_KB = 90
TOTAL_KB = 2048

sheets = json.load(open(os.path.join(ROOT, "scripts", "progress-sheets.json"), encoding="utf8"))["sheets"]
names = []
problems = []
total_kb = 0.0
os.makedirs(OUT, exist_ok=True)


def encode(im, q):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=q, method=6, alpha_quality=80)
    return buf.getvalue()


for sheet_id, spec in sheets.items():
    path = os.path.join(SRC, f"RP-{sheet_id}.png")
    if not os.path.exists(path):
        problems.append(f"{sheet_id}: the sheet file is missing ({path})")
        continue
    img = Image.open(path).convert("RGBA")
    cw, ch = spec["cell"]
    exp = (cw * spec["cols"], ch * spec["rows"])
    if img.size != exp:
        problems.append(f"{sheet_id}: the sheet is {img.size[0]} x {img.size[1]}, expected {exp[0]} x {exp[1]}")
        continue
    arr = np.array(img)
    alpha = arr[..., 3]
    mask = alpha >= SHAPE_ALPHA
    by_cell_mode = spec.get("mode") == "cell"
    joined = ndimage.binary_dilation(mask, structure=np.ones((3, 3), bool), iterations=JOIN)
    labels, n = (np.zeros(mask.shape, int), 0) if by_cell_mode else ndimage.label(joined)
    # which cell each shape belongs to: the cell of the centre of its opaque pixels
    by_cell = {}
    idx = np.arange(1, n + 1)
    areas = ndimage.sum(mask, labels, idx)
    centres = ndimage.center_of_mass(mask, labels, idx)
    for lab, area, (cy, cx) in zip(idx, areas, centres):
        if area < 30:
            continue
        cell = int(cy // ch) * spec["cols"] + int(cx // cw)
        by_cell.setdefault(cell, []).append((lab, float(area)))
    filled = len(spec["slugs"])
    for cell in by_cell:
        if cell >= filled:
            problems.append(f"{sheet_id}: a picture sits in cell {cell + 1}, which should be empty (the sheet lists {filled})")
    out_dir = os.path.join(OUT, sheet_id)
    os.makedirs(out_dir, exist_ok=True)
    for i, slug in enumerate(spec["slugs"]):
        if by_cell_mode:
            col, row = i % spec["cols"], i // spec["cols"]
            region = np.zeros(mask.shape, bool)
            region[row * ch : (row + 1) * ch, col * cw : (col + 1) * cw] = True
            ys, xs = np.where(region & mask)
            if len(xs) < 400:
                problems.append(f"{sheet_id}/{slug}: the cell is empty")
                continue
            # a hair of stray pixels at the extremes is ignored
            l, r = np.percentile(xs, [0.05, 99.95]).astype(int)
            t, b = np.percentile(ys, [0.05, 99.95]).astype(int)
        else:
            shapes = sorted(by_cell.get(i, []), key=lambda s: -s[1])
            if not shapes:
                problems.append(f"{sheet_id}/{slug}: the cell is empty")
                continue
            main = shapes[0][1]
            keep = [lab for lab, a in shapes if a >= main * SPECK]
            region = np.isin(labels, keep)
            ys, xs = np.where(region & mask)
            t, b, l, r = ys.min(), ys.max(), xs.min(), xs.max()
            if (r - l + 1) > cw * 1.25 or (b - t + 1) > ch * 1.25:
                problems.append(f"{sheet_id}/{slug}: bigger than its cell (two pictures merged?)")
        crop = arr[t : b + 1, l : r + 1].copy()
        # a neighbour's glow that overlaps the box is cleared: only this picture's own shapes stay
        crop[~region[t : b + 1, l : r + 1], 3] = 0
        pic = Image.fromarray(crop)
        if sheet_id in SQUARE:
            side = int(max(pic.size) / (1 - 2 * MARGIN))
            canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            canvas.paste(pic, ((side - pic.size[0]) // 2, (side - pic.size[1]) // 2))
            pic = canvas.resize((spec["out"], spec["out"]), Image.LANCZOS)
        else:
            k = spec["out"] / max(pic.size)
            pic = pic.resize((max(1, round(pic.size[0] * k)), max(1, round(pic.size[1] * k))), Image.LANCZOS)
        data = b""
        for q in (76, 70, 64, 58, 52):
            data = encode(pic, q)
            if len(data) / 1024 <= MAX_KB:
                break
        if len(data) / 1024 > MAX_KB:
            problems.append(f"{sheet_id}/{slug}: {len(data) // 1024} KB even at the lowest quality")
        with open(os.path.join(out_dir, f"{slug}.webp"), "wb") as f:
            f.write(data)
        total_kb += len(data) / 1024
        names.append(f"{sheet_id}/{slug}")

if total_kb > TOTAL_KB:
    problems.append(f"the pictures are {total_kb:.0f} KB in total, over the {TOTAL_KB} KB budget")

if problems:
    print("PROBLEMS:")
    for p in problems:
        print("  -", p)
names.sort()
with open(TS, "w", encoding="utf8", newline="\n") as f:
    f.write(
        '/**\n * The Restaurant Progress paintings that exist as files in public/progress/ (the names are in scripts/progress-sheets.json: "<sheet>/<slug>").\n'
        " * GENERATED by scripts/make-progress-assets.py from the Codex sheets; the page shows today's icons for any picture not listed here.\n */\n"
    )
    f.write("export const PROGRESS_ART_FILES: readonly string[] = [\n")
    for n in names:
        f.write(f'  "{n}",\n')
    f.write("];\n")
print(f"{len(names)} pictures, {total_kb:.0f} KB in total -> public/progress/ and src/game/progressArtFiles.ts")
sys.exit(1 if problems else 0)
