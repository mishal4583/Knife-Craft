"""Build the Dessert Run mini-game's local PNG source art into small WebP assets.

Run from the repository root with:  py scripts/make-dessert-run-assets.py

Source: Dessert Run Assets/*.png (local and gitignored; see docs/planning/DESSERT-RUN-CODEX-PROMPTS-2026-11-16.md)
Output: public/business/dessertrun/*.webp

The waiters stay magenta-keyed here: the game turns the magenta waistcoat, beret and bow tie into each of
the ten cube colours when it starts (components/kc/inventory/dessertRunArt.ts), so one waiter costs one file.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Dessert Run Assets"
OUTPUT = ROOT / "public" / "business" / "dessertrun"

# name -> (output size or None to keep, WebP quality, is it a cut-out)
ASSETS: dict[str, tuple[tuple[int, int] | None, int, bool]] = {
    "DR-backdrop": ((810, 1440), 80, False),
    "DR-plate": ((768, 768), 86, True),
    "DR-aisle": ((128, 256), 80, True),
    "DR-table": ((480, 240), 84, True),
    "DR-guest-plate": ((256, 128), 86, True),
    "DR-cart": ((192, 192), 86, True),
    "DR-spot": ((384, 192), 86, True),
    "DR-counter": ((810, 480), 82, True),
    "DR-guests": ((768, 576), 84, True),
    "DR-waiter-stand": ((768, 192), 86, True),
    "DR-waiter-run": ((768, 384), 86, True),
    "DR-waiter-b-stand": ((768, 192), 86, True),
    "DR-waiter-b-run": ((768, 384), 86, True),
    "DR-win": ((576, 432), 84, True),
    "DR-jam": ((576, 432), 84, True),
    "DR-sparkle": ((128, 128), 86, True),
}


def clean_alpha(image: Image.Image) -> Image.Image:
    """Zero the faint haze and drop tiny floating specks, which the cut-out step can leave behind."""
    rgba = np.array(image.convert("RGBA"))
    alpha = rgba[..., 3]
    alpha[alpha < 10] = 0
    labels, count = ndimage.label(alpha > 0)
    if count > 1:
        sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, count + 1))
        for index, size in enumerate(sizes, start=1):
            if size < 60:
                alpha[labels == index] = 0
    rgba[..., 3] = alpha
    return Image.fromarray(rgba, "RGBA")


def main() -> int:
    if not SOURCE.is_dir():
        print(f"Missing source folder: {SOURCE}", file=sys.stderr)
        return 1
    OUTPUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, (size, quality, cutout) in ASSETS.items():
        path = SOURCE / f"{name}.png"
        if not path.is_file():
            print(f"Missing {path.name}", file=sys.stderr)
            return 1
        image = Image.open(path)
        image = clean_alpha(image) if cutout else image.convert("RGB")
        if size and image.size != size:
            image = image.resize(size, Image.LANCZOS)
        target = OUTPUT / (name.removeprefix("DR-") + ".webp")
        image.save(target, "WEBP", quality=quality, method=6, exact=True)
        total += target.stat().st_size
        print(f"{target.name:22} {image.size[0]}x{image.size[1]} {target.stat().st_size // 1024} KB")
    print(f"total {total // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
