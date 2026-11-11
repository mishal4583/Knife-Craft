"""
Builds Paige's standalone cutouts (developer 2026-11-11: "Paige is a standalone character cutout, on the left, with a big speech bubble").

Run:  python scripts/make-paige-cutouts.py        (needs Pillow; use `python`, not the MSYS `python3`)

Input (LOCAL ONLY, gitignored): Paige Cutout Assets/
  cutout-<pose>.png  one per pose (wave, explain, point, tip, cheer, thumbs, oops, surprised, think, sorry, clap, clipboard),
                     768 x 1024, transparent background, the SAME canvas, scale and standing place in every file
  nameplate.png      a blank brass plate, about 512 x 128, transparent (the word PAIGE is drawn by the game)
Output (committed, small WebP): public/business/assistant/cutout-<pose>.webp and nameplate.webp

The game uses a cutout when its file exists and the first set of half-body poses (pose-<pose>.webp) when it does not, so any subset works.
Soft glow around the figure (alpha 1-24) is cleared; the white sticker outline (opaque) is kept.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "Paige Cutout Assets")
OUT = os.path.join(ROOT, "public", "business", "assistant")
POSES = ["wave", "explain", "point", "tip", "cheer", "thumbs", "oops", "surprised", "think", "sorry", "clap", "clipboard"]
CANVAS = (768, 1024)


def clean(img: Image.Image) -> Image.Image:
    a = np.array(img.convert("RGBA"))
    a[a[..., 3] < 24] = 0
    return Image.fromarray(a)


def main() -> int:
    if not os.path.isdir(SRC):
        print(f"No source folder: {SRC}")
        return 1
    os.makedirs(OUT, exist_ok=True)
    built = 0
    for pose in POSES:
        path = os.path.join(SRC, f"cutout-{pose}.png")
        if not os.path.exists(path):
            continue
        img = clean(Image.open(path))
        if img.size != CANVAS:
            img = img.resize(CANVAS, Image.LANCZOS)
        img.save(os.path.join(OUT, f"cutout-{pose}.webp"), "WEBP", quality=88, method=6)
        built += 1
    plate = os.path.join(SRC, "nameplate.png")
    if os.path.exists(plate):
        clean(Image.open(plate)).save(os.path.join(OUT, "nameplate.webp"), "WEBP", quality=90, method=6)
        built += 1
    print(f"Built {built} file(s) into {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
