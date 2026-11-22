"""
Builds the six WIDE kitchen pictures (public/landscape-art/true/kitchen-0N.webp, 1920 x 1080) from the developer's new Codex paintings (developer 2026-11-22: "use these images as the
kitchen background images instead of the current ones"). They are the Kitchen home's and the cutting scene's backdrop in a wide window, one per kitchen skin (Humble ... Grand).

Source (git-ignored, the developer's folder): knifecraft_kitchen_webp/Landscape/skin-01.png ... skin-06.png, 1920 x 1080 each.
Run:  python scripts/make-kitchen-wide.py   (needs Pillow)
Env: KITCHEN_WIDE_SRC, KITCHEN_WIDE_OUT: for tests.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("KITCHEN_WIDE_SRC", os.path.join(ROOT, "knifecraft_kitchen_webp", "Landscape"))
OUT = os.environ.get("KITCHEN_WIDE_OUT", os.path.join(ROOT, "public", "landscape-art", "true"))
SIZE = (1920, 1080)

problems = []
total = 0
for n in range(1, 7):
    src = os.path.join(SRC, f"skin-0{n}.png")
    if not os.path.exists(src):
        problems.append(f"skin-0{n}.png is missing")
        continue
    im = Image.open(src).convert("RGB")
    if im.size != SIZE:
        im = im.resize(SIZE, Image.LANCZOS)
    out = os.path.join(OUT, f"kitchen-0{n}.webp")
    im.save(out, "WEBP", quality=80, method=6)
    kb = os.path.getsize(out) / 1024
    total += kb
    print(f"kitchen-0{n}.webp {kb:.0f} KB")
print(f"total {total:.0f} KB")
for p in problems:
    print("PROBLEM", p)
sys.exit(1 if problems else 0)
