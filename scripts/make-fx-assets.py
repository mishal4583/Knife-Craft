"""Cut the Codex FX sheets (FX Assets/FX-1..5.png) into small WebPs (developer 2026-11-26).

  FX-1 -> public/kitchen-fx/mist-1..2.webp   (whole cell, bottom-centre anchored, 160x240; the kitchen's steam is now a film made by
          scripts/make-steam-plume.py, developer 2026-11-27)
  FX-2 -> public/fx/flame-fire-1..6, flame-burner-1..6, flame-candle-1..6   (rows found by content; one shared crop per row so the base never jumps)
  FX-3 -> public/fx/glint-1..4, glow-1..4
  FX-4 -> public/fx/petal-1..6, leaf-1..6, bit-1..6
  FX-5 -> public/fx/confetti-1..8, coin-1..4, burst-1..4

Run: python scripts/make-fx-assets.py   (needs Pillow + numpy)
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "FX Assets"
KFX = ROOT / "public" / "kitchen-fx"
FX = ROOT / "public" / "fx"
KFX.mkdir(parents=True, exist_ok=True)
FX.mkdir(parents=True, exist_ok=True)


def load(n):
    return Image.open(SRC / f"FX-{n}.png").convert("RGBA")


def save(im, path, q=80):
    im.save(path, "WEBP", quality=q, method=6)
    return path.stat().st_size


def bbox(im, thr=6):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > thr)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def fit(im, box, maxdim, pad=2):
    x0, y0, x1, y1 = box
    c = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
    s = maxdim / max(c.size)
    if s < 1:
        c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    return c


def cells(im, cols, rows):
    cw, ch = im.width // cols, im.height // rows
    for j in range(rows):
        for i in range(cols):
            yield j, i, im.crop((i * cw, j * ch, (i + 1) * cw, (j + 1) * ch))


total = 0

# FX-1 mist: keep the whole cell, scaled to 160x240 (the sheet's first six cells were the old steam ribbons)
sheet = load(1)
names = [None] * 6 + ["mist-1", "mist-2"]
for (j, i, c), name in zip(cells(sheet, 4, 2), names):
    if name:
        total += save(c.resize((160, 240), Image.LANCZOS), KFX / f"{name}.webp", 78)

# FX-2 flames: split the sheet into row bands by empty alpha rows, one shared crop per band
sheet = load(2)
a = np.array(sheet)[:, :, 3]
rows_on = (a > 6).sum(axis=1) > 0
bands, start = [], None
for y, on in enumerate(rows_on):
    if on and start is None:
        start = y
    if not on and start is not None:
        bands.append((start, y))
        start = None
if start is not None:
    bands.append((start, len(rows_on)))
# merge small slivers into the previous band (sparks above a flame)
merged = []
for b in bands:
    if merged and b[0] - merged[-1][1] < 40:
        merged[-1] = (merged[-1][0], b[1])
    else:
        merged.append(b)
assert len(merged) == 3, merged
cw = sheet.width // 6
for (y0, y1), key, maxw in zip(merged, ["fire", "burner", "candle"], [200, 200, 64]):
    strip = [sheet.crop((i * cw, y0, (i + 1) * cw, y1)) for i in range(6)]
    boxes = [bbox(s) for s in strip]
    # shared crop: the union box, centred on the cell, so every frame keeps the same base
    ux0 = min(b[0] for b in boxes)
    ux1 = max(b[2] for b in boxes)
    uy0 = min(b[1] for b in boxes)
    uy1 = max(b[3] for b in boxes)
    s = maxw / (ux1 - ux0)
    s = min(s, 1.0) if maxw >= 100 else min(s * 1.0, 1.0)
    for i, f in enumerate(strip, 1):
        c = f.crop((ux0, uy0, ux1, uy1))
        c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
        total += save(c, FX / f"flame-{key}-{i}.webp", 80)

# FX-3 glints and glows
sheet = load(3)
names = [f"glint-{i}" for i in range(1, 5)] + [f"glow-{i}" for i in range(1, 5)]
for (j, i, c), name in zip(cells(sheet, 4, 2), names):
    total += save(fit(c, bbox(c, 4), 192 if name.startswith("glint") else 160, 4), FX / f"{name}.webp", 80)

# FX-4 particles
sheet = load(4)
names = [f"petal-{i}" for i in range(1, 7)] + [f"leaf-{i}" for i in range(1, 7)] + [f"bit-{i}" for i in range(1, 7)]
for (j, i, c), name in zip(cells(sheet, 6, 3), names):
    total += save(fit(c, bbox(c, 4), 96, 2), FX / f"{name}.webp", 82)

# FX-5 confetti, coin frames, bursts (coin frames share one canvas so they turn in place)
sheet = load(5)
cl = list(cells(sheet, 8, 2))
for k in range(8):
    c = cl[k][2]
    total += save(fit(c, bbox(c, 4), 72, 1), FX / f"confetti-{k + 1}.webp", 82)
coin = [cl[8 + k][2] for k in range(4)]
cb = [bbox(c, 4) for c in coin]
cx0, cy0 = min(b[0] for b in cb), min(b[1] for b in cb)
cx1, cy1 = max(b[2] for b in cb), max(b[3] for b in cb)
for k, c in enumerate(coin, 1):
    cc = c.crop((cx0, cy0, cx1, cy1))
    s = 112 / max(cc.size)
    cc = cc.resize((round(cc.width * s), round(cc.height * s)), Image.LANCZOS)
    total += save(cc, FX / f"coin-{k}.webp", 84)
for k in range(4):
    c = cl[12 + k][2]
    total += save(fit(c, bbox(c, 4), 128, 2), FX / f"burst-{k + 1}.webp", 84)

print("kitchen-fx files:", len(list(KFX.glob("*.webp"))), "fx files:", len(list(FX.glob("*.webp"))), "total KB:", round(total / 1024))
