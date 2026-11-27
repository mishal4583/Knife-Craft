"""Cut Unload the Van's cargo art (crate skins, door tags, delivery slip) into small WebP files.

Run from the repository root with:  py scripts/make-van-cargo-assets.py

Source: Van Cargo Assets/*.png (the developer's Codex art, local and gitignored; prompt: docs/planning/UNLOAD-THE-VAN-CARGO-PLAN-2026-11-27.md section 5)
Output: public/business/cratedispatch/skin-*.webp, tag-*.webp, slip.webp

A SKIN is greyscale shading and material detail, partly see-through, with an empty middle. The game lays it with "hard-light" over a crate painted in its
door's colour (kitchenDispatchDraw.ts), so one skin serves every colour and the colour stays easy to match. It is 9-sliced: each skin's own empty margin
is cut off (so every rim sits on the crate's edge), it is resized to one square, and its alpha is lifted a little. Every corner detail must stay inside
the shared corner SLICE (checked here), so the edge strips can stretch.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Van Cargo Assets"
OUTPUT = ROOT / "public" / "business" / "cratedispatch"

SKINS = ["produce", "pantry", "cold", "parcel", "tableware", "cleaning"]
SKIN_SIZE = 320  # kitchenDispatchArt.ts SKIN_SIZE
SKIN_SLICE = 80  # kitchenDispatchArt.ts SKIN_SLICE: the corner squares
ALPHA_LIFT = 1.35  # the painted shading is about half see-through; lifted so the material reads on a phone
TAG_SIZE = 96


def drawn_box(image: Image.Image, over: int = 24) -> tuple[int, int, int, int]:
    ys, xs = np.where(np.array(image)[..., 3] > over)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def load(name: str) -> Image.Image:
    return Image.open(SOURCE / f"{name}.png").convert("RGBA")


def save(image: Image.Image, name: str, quality: int) -> int:
    target = OUTPUT / f"{name}.webp"
    image.save(target, "WEBP", quality=quality, method=6, exact=True)
    print(f"{target.name:22} {image.size[0]}x{image.size[1]} {target.stat().st_size / 1024:.1f} KB")
    return target.stat().st_size


def skin(name: str) -> Image.Image:
    source = load(f"skin-{name}")
    assert source.size == (384, 384), f"skin-{name}: expected 384x384, got {source.size}"
    rgb = np.array(source)[..., :3].astype(int)
    seen = np.array(source)[..., 3] > 40
    spread = (rgb[seen].max(1) - rgb[seen].min(1)).mean()
    assert spread < 12, f"skin-{name} is not greyscale (mean channel spread {spread:.1f}): it would change the door colours"
    out = np.array(source.crop(drawn_box(source)).resize((SKIN_SIZE, SKIN_SIZE), Image.LANCZOS))
    alpha = out[..., 3].astype(float) * ALPHA_LIFT
    alpha[alpha < 6] = 0
    out[..., 3] = alpha.clip(0, 255).astype(np.uint8)

    # the middle is empty, so the item and the crate's colour show
    middle = out[SKIN_SLICE : SKIN_SIZE - SKIN_SLICE, SKIN_SLICE : SKIN_SIZE - SKIN_SLICE, 3]
    assert middle.max() == 0, f"skin-{name}: the middle is not transparent"
    # past the corner squares each edge strip is plain, so stretching it is safe: compare its two ends with its quarter points
    strips = (
        out[:SKIN_SLICE],
        out[-SKIN_SLICE:],
        out[:, :SKIN_SLICE].transpose(1, 0, 2),
        out[:, -SKIN_SLICE:].transpose(1, 0, 2),
    )
    for strip in strips:
        premultiplied = strip[..., :3].astype(float) * (strip[..., 3:4] / 255.0)
        full = np.concatenate([premultiplied, strip[..., 3:4].astype(float)], axis=2)
        plain = full[:, 100:110].mean(axis=1, keepdims=True)
        for at in (slice(SKIN_SLICE, SKIN_SLICE + 8), slice(SKIN_SIZE - SKIN_SLICE - 8, SKIN_SIZE - SKIN_SLICE)):
            drift = np.abs(full[:, at] - plain).mean()
            assert drift < 6, f"skin-{name}: corner detail reaches past the {SKIN_SLICE}px corner square (drift {drift:.1f})"
    return Image.fromarray(out, "RGBA")


def tag(name: str) -> Image.Image:
    source = load(f"tag-{name}")
    cut = source.crop(drawn_box(source))
    side = max(cut.size)
    square = Image.new("RGBA", (side, side))
    square.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
    return square.resize((TAG_SIZE, TAG_SIZE), Image.LANCZOS)


def paper_box(image: Image.Image) -> tuple[float, float, float, float]:
    """The blank cream paper's box on the clipboard, as fractions (left, top, right, bottom): the game writes the list inside it."""
    rgba = np.array(image).astype(int)
    r, g, b, a = rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3]
    cream = (a > 240) & (r > 225) & (g > 205) & (b > 165)
    labels, _ = ndimage.label(cream)
    here = labels[image.height // 2, image.width // 2]
    assert here, "slip: no blank paper in the middle"
    ys, xs = np.where(labels == here)
    return (
        xs.min() / image.width,
        ys.min() / image.height,
        (xs.max() + 1) / image.width,
        (ys.max() + 1) / image.height,
    )


def main() -> int:
    if not SOURCE.is_dir():
        print(f"Missing source folder: {SOURCE}", file=sys.stderr)
        return 1
    OUTPUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name in SKINS:
        total += save(skin(name), f"skin-{name}", 90)
    for name in ("delivered", "needed"):
        total += save(tag(name), f"tag-{name}", 90)
    slip = load("slip")
    slip = slip.crop(drawn_box(slip))
    total += save(slip, "slip", 86)
    left, top, right, bottom = paper_box(slip)
    print(f"slip: {slip.width} x {slip.height}; paper left {left:.3f} top {top:.3f} right {right:.3f} bottom {bottom:.3f}")
    print(f"total {total / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
