"""Cuts the Codex sheets of 2026-11-25 into the game's pictures (developer 2026-11-25).

  python scripts/make-chef-assets.py

Reads scripts/chef-art-sheets.json:
  - the 49 rival chef busts (Rival Chef Assets/RV-1..5.png, 5 x 2 cells, city-ranking order) -> public/portraits/rivals/<rival-id>.webp
  - the 5 prestige emblems (Prestige Assets/PR-1.png)                                          -> public/progress/prestige/tier-0..4.webp
  - the health inspector (Inspector Assets/HI-1.png: arrival, pleased, neutral, disappointed)   -> public/portraits/inspector/<pose>.webp
  - the 5 Franchise branch emblems (Branch Assets/BR-1.png, OPTIONAL: skipped until Codex has made it) -> public/progress/branches/branch-1..5.webp

The source folders are Codex output (not part of the build). A rival bust keeps its whole cell (every cell is the same size and scale, so the faces match); the emblems and
the inspector are trimmed to the picture, with thin stray marks between cells ignored, then fitted into a transparent box of the stated size, bottom-centred.
"""
import json
import os
import sys

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = json.load(open(os.path.join(ROOT, "scripts", "chef-art-sheets.json"), encoding="utf-8"))


def cells(sheet_path, cols, rows, cell):
    im = Image.open(sheet_path).convert("RGBA")
    cw, ch = cell
    if im.size != (cw * cols, ch * rows):
        sys.exit(f"{sheet_path}: expected {cw * cols}x{ch * rows}, got {im.size[0]}x{im.size[1]}")
    for r in range(rows):
        for c in range(cols):
            yield im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))


def trimmed(im, pad=6):
    """The picture's own box: thin slivers (a stray line at a cell edge) are removed first by an erosion of the alpha, then the box is grown back a little."""
    alpha = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    core = alpha.filter(ImageFilter.MinFilter(9))
    box = core.getbbox() or alpha.getbbox()
    if not box:
        return None
    l, t, r, b = box
    l, t, r, b = max(0, l - 4 - pad), max(0, t - 4 - pad), min(im.width, r + 4 + pad), min(im.height, b + 4 + pad)
    return im.crop((l, t, r, b))


def fit(im, size):
    """Scaled to fit the box, bottom-centred on a transparent canvas of exactly `size`."""
    w, h = size
    s = min(w / im.width, h / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(im.resize((nw, nh), Image.LANCZOS), ((w - nw) // 2, h - nh))
    return out


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=84, method=6)
    return os.path.getsize(path)


total = 0
count = 0

# rivals: whole cells, scaled down (the same scale for every face)
spec = SPEC["rivals"]
ids = list(spec["ids"])
i = 0
for sheet in spec["sheets"]:
    for cell in cells(os.path.join(ROOT, spec["folder"], sheet), spec["cols"], spec["rows"], spec["cell"]):
        if i >= len(ids):
            if cell.getchannel("A").getbbox() is not None and (cell.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()):
                sys.exit(f"{sheet}: a picture in a cell that no rival owns")
            continue
        small = cell.resize(tuple(spec["size"]), Image.LANCZOS)
        total += save(small, os.path.join(ROOT, spec["out"], ids[i] + ".webp"))
        count += 1
        i += 1
if i != len(ids):
    sys.exit(f"cut {i} rival busts, expected {len(ids)}")

# prestige emblems and the inspector: trimmed, fitted
for key in ("prestige", "inspector", "branches"):
    spec = SPEC[key]
    if spec.get("optional") and not os.path.exists(os.path.join(ROOT, spec["folder"], spec["sheet"])):
        print(f"{key}: {spec['folder']}/{spec['sheet']} is not there yet (optional), skipped")
        continue
    names = spec["names"]
    for name, cell in zip(names, cells(os.path.join(ROOT, spec["folder"], spec["sheet"]), spec["cols"], spec["rows"], spec["cell"])):
        pic = trimmed(cell)
        if pic is None:
            sys.exit(f"{key}/{name}: an empty cell")
        total += save(fit(pic, tuple(spec["size"])), os.path.join(ROOT, spec["out"], name + ".webp"))
        count += 1

print(f"{count} pictures, {total / 1024:.0f} KB in all")
