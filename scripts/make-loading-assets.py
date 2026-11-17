"""
Builds the loading screen's pictures (developer 2026-11-18) from the folder 'Loading Screen Assets' into public/loading/ as small WebP files, and prints the tiny
blurred placeholder (a data: URI) that index.html paints before anything else has arrived.

    python scripts/make-loading-assets.py

Sources (Codex, 2026-11-18): Knife-Craft-Loading-Background-v2 (empty kitchen), Knife-Craft-Logo-v2, Knife-Craft-Chef-Cutout-v2,
Knife-Craft-Prep-Board-Foreground-v2, Knife-Craft-Loading-Progress-Frame-v2. (The "Concept" picture has words painted into it and is NOT used.)
Sizes are chosen for weight, not for the sharpest phone: the loading screen must not slow the game's own files (about 250 KB in all), and the background is a soft, busy picture that upscales well.
The progress frame is cropped to its visible shape; the track rectangle is measured here and written to CSS in index.html (see TRACK below).
"""

import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Loading Screen Assets"
OUT = ROOT / "public" / "loading"
OUT.mkdir(parents=True, exist_ok=True)


def save(img, name, quality, lossless=False):
    path = OUT / name
    img.save(path, "WEBP", quality=quality, method=6, lossless=lossless)
    print(f"{name:14s} {img.size[0]:4d}x{img.size[1]:<4d} {path.stat().st_size / 1024:6.1f} KB")


def fit_width(img, w):
    return img.resize((w, round(img.size[1] * w / img.size[0])), Image.LANCZOS)


# the background: opaque, 9:16
bg = Image.open(SRC / "Knife-Craft-Loading-Background-v2.png").convert("RGB")
save(bg.resize((576, 1024), Image.LANCZOS), "bg.webp", 60)

# the logo: transparent
logo = Image.open(SRC / "Knife-Craft-Logo-v2.png").convert("RGBA")
save(fit_width(logo, 520), "logo.webp", 84)

# the chef: transparent; the cutout carries a thin yellow fringe on its edge, so the alpha is pulled in by one pixel and softened
chef = Image.open(SRC / "Knife-Craft-Chef-Cutout-v2.png").convert("RGBA")
r, g, b, a = chef.split()
a = a.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
chef = Image.merge("RGBA", (r, g, b, a))
save(fit_width(chef, 420), "chef.webp", 80)

# the board with the tomato and cucumber: transparent above it
board = Image.open(SRC / "Knife-Craft-Prep-Board-Foreground-v2.png").convert("RGBA")
save(fit_width(board, 640), "board.webp", 78)

# the progress frame: cropped to its visible shape (+ a small margin)
frame = Image.open(SRC / "Knife-Craft-Loading-Progress-Frame-v2.png").convert("RGBA")
X0, Y0, X1, Y1 = 168, 20, 728, 160  # 560 x 140 of the 900 x 180 source
frame = frame.crop((X0, Y0, X1, Y1))
save(frame, "bar-frame.webp", 90)
# the cream track inside it, in the source's pixels: x 209..687, y 50..88  ->  as shares of the cropped picture
tx, ty, tw, th = 209 - X0, 50 - Y0, 687 - 209 + 1, 88 - 50 + 1
print(
    "TRACK (share of bar-frame.webp): left %.2f%% top %.2f%% width %.2f%% height %.2f%%"
    % (tx / 560 * 100, ty / 140 * 100, tw / 560 * 100, th / 140 * 100)
)

# the placeholder: a 18 x 32 blur of the background, as a tiny WebP data: URI (painted by index.html before any picture has arrived)
tiny = bg.resize((18, 32), Image.LANCZOS)
buf = io.BytesIO()
tiny.save(buf, "WEBP", quality=40, method=6)
uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
(OUT / "placeholder.txt").write_text(uri, encoding="ascii")
print(f"placeholder    {len(uri)} chars (public/loading/placeholder.txt: paste into index.html's --bs-tiny)", file=sys.stderr)

total = sum(p.stat().st_size for p in OUT.glob("*.webp"))
print(f"total {total / 1024:.0f} KB")
