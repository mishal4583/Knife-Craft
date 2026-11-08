"""
Delivery Inspection art build (developer 2026-11-08; Codex kit D01-D10 in docs/planning/DELIVERY-INSPECTION-CODEX-PROMPTS-2026-11-08.md).

Reads the generated PNGs from `Delivery Inspection Assets/` (local only, gitignored) and writes the game's WebP files into
`public/business/inspection/`. A file that has not been delivered yet is skipped: the game draws its CSS stand-in for it (InspectionParts.tsx).

  D01-backdrop.png          -> backdrop.webp      540 x 960
  D02-crate-back.png        -> crate-back.webp    1000 x 520 (as is, half size is enough: 500 x 260)
  D03-crate-front.png       -> crate-front.webp   500 x 150
  D04-defects.png (4 x 3)   -> defects.webp       half size, 512 x 384 (cells of 128)
  D05-decoys.png (3 x 2)    -> decoys.webp        half size, 384 x 256
  D06-markers.png (2 x 2)   -> markers.webp       half size
  D07-magnifier.png         -> magnifier.webp     256 x 256
  (D08 spoilage life and D09 the guide clipboard are NOT built: the game does not use them yet. Add a line to JOBS when it does.)
  D10-pins.png (4 x 3)      -> pins.webp          half size
Optional twins: T01-spoiled-twins.png -> twins.webp (6 x 4 cells of 160, like the fresh sheets), T02 -> twins-bakery.webp

Run: python scripts/make-inspection-assets.py
"""
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "Delivery Inspection Assets")
OUT = os.path.join(ROOT, "public", "business", "inspection")

# (source, output, scale, quality)
JOBS = [
    ("D01-backdrop.png", "backdrop.webp", 0.5, 76),
    ("D02-crate-back.png", "crate-back.webp", 0.5, 82),
    ("D03-crate-front.png", "crate-front.webp", 0.5, 82),
    ("D04-defects.png", "defects.webp", 0.5, 84),
    ("D05-decoys.png", "decoys.webp", 0.5, 84),
    ("D06-markers.png", "markers.webp", 0.5, 84),
    ("D07-magnifier.png", "magnifier.webp", 0.5, 84),
    ("D10-pins.png", "pins.webp", 0.5, 84),
    ("T01-spoiled-twins.png", "twins.webp", 160 / 256, 82),
    ("T02-spoiled-bread-cheese.png", "twins-bakery.webp", 160 / 256, 82),
]


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for src, out, scale, quality in JOBS:
        path = os.path.join(SRC, src)
        if not os.path.exists(path):
            print(f"  skip {src} (not delivered yet)")
            continue
        im = Image.open(path).convert("RGBA")
        w, h = im.size
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        dest = os.path.join(OUT, out)
        im.save(dest, "WEBP", quality=quality, method=6)
        size = os.path.getsize(dest)
        total += size
        print(f"  {out:22s} {im.size[0]} x {im.size[1]}  {size / 1024:.0f} KB")
    print(f"total {total / 1024:.0f} KB (budget 450 KB for the kit)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
