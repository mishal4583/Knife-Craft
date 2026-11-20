"""
Smoothness acceptance check for the wide restaurant maps and the Second Floor (developer 2026-11-21: "the colour is okay, but the picture feels too sharpened, not realistic or smooth").
The Codex pictures carry a lot of micro-contrast and edge halos (an over-sharpened, crunchy look); the portrait references are softer. A repainted picture is accepted when, compared with
the picture it replaces (same file name in the OLD folder):
  colour   unchanged: every channel's mean within 0.02, mean saturation within 0.03        (the colour is approved: only the quality changes)
  layout   unchanged: a 128 x 72 grey copy differs by at most 0.05 on average              (the tap areas, lock chips and people routes are measured on the old picture)
  smooth   the fine-detail energy (variance of the Laplacian at 960 x 540) is 35 % to 75 % of the old one   (smoother, but not blurred away)
  halos    the share of pixels with an edge overshoot (> 40 grey levels above a 1.2 px blur) is at most 70 % of the old one

Run:  python scripts/check-map-quality.py <new folder> [old folder]       (old folder default: Landscape Backdrops Assets/true-landscape; exit 1 on any failure)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW = sys.argv[1] if len(sys.argv) > 1 else ""
OLD = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "Landscape Backdrops Assets", "true-landscape")
NAMES = [
    "TL-restaurant-01-humble.png",
    "TL-restaurant-02-growing.png",
    "TL-restaurant-03-established.png",
    "TL-restaurant-04-neighborhood-cafe.png",
    "TL-restaurant-05-flourishing-cafe.png",
    "TL-restaurant-06-grand.png",
    "TL-second-floor.png",
]


def grey(im):
    return np.asarray(im.convert("L")).astype(float)


def fine(im):
    g = grey(im.resize((960, 540), Image.LANCZOS))
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())


def halo(im):
    h = im.resize((960, 540), Image.LANCZOS)
    return float((np.abs(grey(h) - grey(h.filter(ImageFilter.GaussianBlur(1.2)))) > 40).mean())


def colour(im):
    a = np.asarray(im.convert("RGB").resize((200, 112))).astype(float) / 255
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return a.reshape(-1, 3).mean(0), float(sat.mean())


def layout(a, b):
    ga = grey(a.resize((128, 72), Image.LANCZOS)) / 255
    gb = grey(b.resize((128, 72), Image.LANCZOS)) / 255
    return float(np.abs(ga - gb).mean())


if not NEW:
    sys.exit("usage: python scripts/check-map-quality.py <new folder> [old folder]")
failed = 0
for name in NAMES:
    pn, po = os.path.join(NEW, name), os.path.join(OLD, name)
    if not os.path.exists(pn):
        print(f"MISSING {name}")
        failed += 1
        continue
    n, o = Image.open(pn).convert("RGB"), Image.open(po).convert("RGB")
    if n.size != (1920, 1080):
        print(f"FAIL {name}: size {n.size}, must be 1920 x 1080")
        failed += 1
        continue
    bad = []
    (cn, sn), (co, so) = colour(n), colour(o)
    if np.abs(cn - co).max() > 0.02 or abs(sn - so) > 0.03:
        bad.append(f"colour changed (RGB {np.abs(cn - co).max():.3f}, saturation {abs(sn - so):.3f})")
    lay = layout(n, o)
    if lay > 0.05:
        bad.append(f"layout changed ({lay:.3f} > 0.05)")
    ratio = fine(n) / fine(o)
    if ratio > 0.75:
        bad.append(f"not smoother enough (fine detail {ratio:.0%} of the old, need 75% or less)")
    if ratio < 0.35:
        bad.append(f"too blurred (fine detail {ratio:.0%} of the old, need 35% or more)")
    hr = halo(n) / max(halo(o), 1e-9)
    if hr > 0.7:
        bad.append(f"edge halos remain ({hr:.0%} of the old, need 70% or less)")
    print(f"{'PASS' if not bad else 'FAIL'} {name}  detail {ratio:.0%}  halos {hr:.0%}  layout {lay:.3f}", "; ".join(bad))
    failed += bool(bad)
print(f"\n{failed} of {len(NAMES)} pictures fail" if failed else "\nALL PASS: smoother, same colour, same layout")
sys.exit(1 if failed else 0)
