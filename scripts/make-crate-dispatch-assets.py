"""Build Kitchen Dispatch's local source art into small WebP assets.

Run from the repository root with:  py scripts/make-crate-dispatch-assets.py

Source: Crate Dispatch/CD-*.png (the painted pieces) and Crate Dispatch/<ingredient>.webp (local, gitignored;
prompts: docs/planning/CRATE-DISPATCH-CODEX-PROMPTS-2026-11-17.md)
Output: public/business/cratedispatch/*.webp

The crates and the gates are magenta-keyed: the game turns the key into each ingredient's colour in the browser
(components/kc/inventory/dessertRunArt.ts `recolorKeyed`), so one painted crate serves every ingredient.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Crate Dispatch"
OUTPUT = ROOT / "public" / "business" / "cratedispatch"

# output name -> (source file, output size or None, WebP quality, cut-out?)
ASSETS: dict[str, tuple[str, tuple[int, int] | None, int, bool]] = {
    "backdrop": ("CD-backdrop.png", (810, 1440), 80, False),
    "counter": ("CD-counter.png", (810, 315), 84, True),
    "frame": ("CD-frame.png", (810, 810), 86, True),
    "crate-2": ("CD-crate-2.png", None, 88, True),
    "crate-3": ("CD-crate-3.png", None, 88, True),
    "gate": ("CD-gate.png", None, 88, True),
    "tile": ("CD-tile.png", (128, 128), 88, False),
    "level-badge": ("CD-level-badge.png", (256, 213), 86, True),
    "title-sign": ("CD-title-sign.png", (640, 240), 86, True),
    "info-banner": ("CD-info-banner.png", (640, 160), 86, True),
    "timer-pill": ("CD-timer-pill.png", None, 86, True),
    "round-button": ("CD-round-button.png", (192, 192), 88, True),
    "booster-icons": ("CD-booster-icons.png", None, 86, True),
    "count-badge": ("CD-count-badge.png", None, 88, True),
    "label-plate": ("CD-label-plate.png", None, 88, True),
    "stars": ("CD-stars.png", None, 86, True),
    "win": ("CD-win.png", (576, 432), 84, True),
    "fail": ("CD-fail.png", (576, 432), 84, True),
    "puff": ("CD-puff.png", (128, 128), 88, True),
}
INGREDIENTS = ["tomato", "carrot", "lettuce", "onion", "cheddar", "salmon", "mushroom", "broccoli"]


def clean_alpha(image: Image.Image) -> Image.Image:
    """Zero the faint haze and drop tiny floating specks."""
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


def save(image: Image.Image, name: str, quality: int) -> int:
    target = OUTPUT / f"{name}.webp"
    image.save(target, "WEBP", quality=quality, method=6, exact=True)
    print(f"{target.name:26} {image.size[0]}x{image.size[1]} {target.stat().st_size // 1024} KB")
    return target.stat().st_size


def main() -> int:
    if not SOURCE.is_dir():
        print(f"Missing source folder: {SOURCE}", file=sys.stderr)
        return 1
    OUTPUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, (src, size, quality, cutout) in ASSETS.items():
        path = SOURCE / src
        if not path.is_file():
            print(f"Missing {path.name}", file=sys.stderr)
            return 1
        image = Image.open(path)
        image = clean_alpha(image) if cutout else image.convert("RGB")
        if size and image.size != size:
            image = image.resize(size, Image.LANCZOS)
        total += save(image, name, quality)
    for ingredient in INGREDIENTS:
        path = SOURCE / f"{ingredient}.webp"
        if not path.is_file():
            print(f"Missing {path.name}", file=sys.stderr)
            return 1
        image = clean_alpha(Image.open(path)).resize((192, 192), Image.LANCZOS)
        total += save(image, f"ingredient-{ingredient}", 86)
    print(f"total {total // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
