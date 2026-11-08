"""
Dishwashing full-screen art build (developer 2026-11-09; Codex kit W01-W21 in docs/planning/DISHWASHING-FULLSCREEN-CODEX-PROMPTS-2026-11-09.md).

Reads the generated PNGs from `Wash Assets/` (local only, gitignored) and writes the game's WebP files into `public/dishwashing/`. A file that has not
been delivered yet is skipped: the sink draws its CSS stand-in for that layer (washArt.ts), so the game is complete with any part of the art.

Run: python scripts/make-wash-assets.py
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "Wash Assets")
OUT = os.path.join(ROOT, "public", "dishwashing")

# (source, output, scale, quality)
JOBS = [
    ("W01-backdrop.png", "backdrop.webp", 0.75, 74),
    ("W02-water.png", "water.webp", 0.75, 80),
    ("W03-ripples.png", "ripples.webp", 0.75, 80),
    ("W04-foam-rim.png", "foam-rim.webp", 0.75, 80),
    ("W06-bubbles.png", "bubbles.webp", 0.5, 82),
    ("W07-droplets-splash.png", "droplets.webp", 0.5, 82),
    ("W08-tap-stream.png", "tap-stream.webp", 0.75, 82),
    ("W09-rinse-spray.png", "rinse-spray.webp", 0.5, 82),
    ("W10-steam-wisps.png", "steam.webp", 0.5, 80),
    ("W11-glints.png", "glints.webp", 0.5, 84),
    ("W12-clean-ribbon.png", "clean-ribbon.webp", 0.5, 84),
    ("W13-tools.png", "tools.webp", 0.5, 84),
    ("W14-soap-pump.png", "soap-pump.webp", 0.5, 84),
    ("W15-soap-blobs.png", "soap-blobs.webp", 0.5, 84),
    ("W16-rack-back.png", "rack-back.webp", 0.5, 82),
    ("W17-rack-front.png", "rack-front.webp", 0.5, 82),
    ("W18-cutlery-cup.png", "cutlery-cup.webp", 0.5, 84),
    ("W19-queue-tray.png", "queue-tray.webp", 0.5, 82),
    ("W20-slot-states.png", "slot-states.webp", 0.5, 84),
    ("W21-mist-vignette.png", "mist.webp", 0.25, 70),
]


FULL_SCENES = {"W01-backdrop.png"}


def has_alpha(im: Image.Image) -> bool:
    """A real transparent layer has transparent pixels. A picture with a painted checkerboard (alpha 255 everywhere) does not."""
    a = np.array(im.getchannel("A"))
    return float((a < 250).mean()) > 0.02


def key_ripples(im: Image.Image) -> Image.Image:
    """W03 came with a painted checkerboard: the pale-BLUE wave strokes are kept (alpha from how blue a pixel is), the neutral squares go."""
    rgb = np.array(im.convert("RGB")).astype(float)
    a = np.clip((rgb[..., 2] - rgb[..., 0] - 5) * 9, 0, 255).astype(np.uint8)
    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2], out[..., 3] = 235, 248, 255, a
    return Image.fromarray(out, "RGBA")


def split_foam() -> int:
    """W05 is a sheet of three seamless foam tiles: each becomes its own file (foam-1 light, foam-2 medium, foam-3 heavy) so it can repeat."""
    path = os.path.join(SRC, "W05-foam-tiles.png")
    if not os.path.exists(path):
        print("  skip W05-foam-tiles.png (not delivered yet)")
        return 0
    im = Image.open(path).convert("RGBA")
    cell = im.size[0] // 3
    total = 0
    for i in range(3):
        tile = im.crop((i * cell, 0, (i + 1) * cell, im.size[1])).resize((256, 256), Image.LANCZOS)
        dest = os.path.join(OUT, f"foam-{i + 1}.webp")
        tile.save(dest, "WEBP", quality=80, method=6)
        total += os.path.getsize(dest)
        print(f"  foam-{i + 1}.webp        256 x 256  {os.path.getsize(dest) / 1024:.0f} KB")
    return total


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    total = split_foam()
    for src, out, scale, quality in JOBS:
        path = os.path.join(SRC, src)
        if not os.path.exists(path):
            print(f"  skip {src} (not delivered yet)")
            continue
        im = Image.open(path).convert("RGBA")
        if src not in FULL_SCENES and not has_alpha(im):
            if src == "W03-ripples.png":
                print(f"  note {src}: no real transparency (a painted checkerboard): keyed by blueness")
                im = key_ripples(im)
            else:
                print(f"  REDO {src}: no real transparency (alpha is 255 everywhere: a painted checkerboard). Not built.")
                continue
        w, h = im.size
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        dest = os.path.join(OUT, out)
        im.save(dest, "WEBP", quality=quality, method=6)
        size = os.path.getsize(dest)
        total += size
        print(f"  {out:20s} {im.size[0]} x {im.size[1]}  {size / 1024:.0f} KB")
    print(f"total {total / 1024:.0f} KB (budget 700 KB for the kit)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
