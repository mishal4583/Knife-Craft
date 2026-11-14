"""
Builds Paige's sharp cutouts for phone screens: the SAME 12 poses of the current look, redrawn large (developer 2026-11-11: the current look is
enough; 2026-11-13: she looks soft on a phone, new art is wanted).

Run:  python scripts/make-paige-cutouts.py        (needs Pillow and numpy; use `python`, not the MSYS `python3`)

Input (LOCAL ONLY, gitignored): Paige Cutout Assets/
  cutout-<pose>.png  one per pose (wave, explain, point, tip, cheer, thumbs, oops, surprised, think, sorry, clap, clipboard), ANY size
                     (1024 x 1536 is what the prompts ask for), transparent background, Paige from the head to the hips
  nameplate.png      optional: a blank brass plate, about 512 x 128, transparent (the word PAIGE is drawn by the game)
Output (committed, small WebP): public/business/assistant/cutout-<pose>.webp and nameplate.webp

What the script does, so the art does not have to be pixel-exact:
  - clears the soft glow around the figure (alpha below 24) and trims the empty border;
  - sizes every pose by its HEAD-TO-HIP height (the top of the hair to the bottom cut), so she is the same size in every pose even when the
    pictures came out at different scales; raised hands above the head are found and do not count (see `body_top`);
  - puts every pose on ONE canvas, bottom-aligned, with her hips on the same x, so changing pose never makes her jump.

The game uses a cutout when its file exists and the first set of poses (pose-<pose>.webp) when it does not, so any subset works.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "Paige Cutout Assets")
OUT = os.path.join(ROOT, "public", "business", "assistant")
POSES = ["wave", "explain", "point", "tip", "cheer", "thumbs", "oops", "surprised", "think", "sorry", "clap", "clipboard"]
# Her head-to-hip height in the output. She is shown up to 520 CSS px tall: 1040 px is two device pixels for each (the old poses were 324).
BODY_H = 1040
MAX_KB_EACH = 140


def clean(img: Image.Image) -> Image.Image:
    a = np.array(img.convert("RGBA"))
    a[a[..., 3] < 24] = 0
    out = Image.fromarray(a)
    box = out.getbbox()
    return out.crop(box) if box else out


def hip_x(img: Image.Image) -> float:
    """The middle of the figure in its bottom rows (the hips), as in make-assistant-assets.py."""
    a = np.array(img)[..., 3]
    band = a[max(0, img.height - max(8, img.height // 40)) :, :]
    xs = np.nonzero(band > 128)[1]
    return float(xs.mean()) if xs.size else img.width / 2


def body_top(img: Image.Image) -> int:
    """
    The row where her HEAD starts. A raised hand or fist can be higher than the hair, so the top of the picture is not always the head: the
    head is the first row, from the top, where the figure is wide (at least 18 % of the picture's width) right above the hips' column.
    """
    a = np.array(img)[..., 3] > 128
    cx = int(round(hip_x(img)))
    half = max(4, int(img.width * 0.09))
    lo, hi = max(0, cx - half), min(img.width, cx + half)
    rows = np.nonzero(a[:, lo:hi].mean(axis=1) > 0.6)[0]
    return int(rows[0]) if rows.size else 0


def main() -> int:
    if not os.path.isdir(SRC):
        print(f"No source folder: {SRC}")
        return 1
    os.makedirs(OUT, exist_ok=True)
    cut: list[tuple[str, Image.Image, float]] = []
    for pose in POSES:
        path = os.path.join(SRC, f"cutout-{pose}.png")
        if not os.path.exists(path):
            continue
        src = Image.open(path)
        if src.mode != "RGBA" or np.array(src)[..., 3].min() > 0:
            print(f"SKIPPED {pose}: no transparent background (ask for a transparent PNG)")
            continue
        img = clean(src)
        body = img.height - body_top(img)
        s = BODY_H / max(1, body)
        if s > 1.6:
            print(f"note: {pose} is small ({img.width} x {img.height}); it is enlarged {s:.1f}x and will look soft")
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
        cut.append((pose, img, hip_x(img)))
    if cut:
        left = max(x for _, _, x in cut)
        right = max(im.width - x for _, im, x in cut)
        half = int(round(max(left, right))) + 2
        height = max(im.height for _, im, _ in cut)
        for pose, im, x in cut:
            canvas = Image.new("RGBA", (half * 2, height), (0, 0, 0, 0))
            canvas.paste(im, (int(round(half - x)), height - im.height), im)
            out = os.path.join(OUT, f"cutout-{pose}.webp")
            quality = 86
            canvas.save(out, "WEBP", quality=quality, method=6)
            while os.path.getsize(out) > MAX_KB_EACH * 1024 and quality > 60:
                quality -= 6
                canvas.save(out, "WEBP", quality=quality, method=6)
            print(f"cutout-{pose}.webp {canvas.width} x {canvas.height}, {os.path.getsize(out) / 1024:.0f} KB")
    built = len(cut)
    plate = os.path.join(SRC, "nameplate.png")
    if os.path.exists(plate):
        clean(Image.open(plate)).save(os.path.join(OUT, "nameplate.webp"), "WEBP", quality=90, method=6)
        built += 1
    print(f"Built {built} file(s) into {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
