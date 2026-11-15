"""Build the Car Park mini-game's local PNG source art into small WebP assets.

Run from the repository root with:  py scripts/make-car-park-assets.py

Source: Car Park Assets/*.png (local and gitignored)
Output: public/business/carpark/*.webp
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Car Park Assets"
OUTPUT = ROOT / "public" / "business" / "carpark"

BACKDROP = "car-park-backdrop"
VEHICLES: dict[str, tuple[int, int]] = {
    **{f"car-{color}": (160, 320) for color in ("red", "blue", "yellow", "green", "orange", "purple", "white", "grey")},
    **{f"van-{color}": (160, 480) for color in ("red", "blue", "yellow", "green", "orange", "purple", "white", "grey")},
    **{f"bus-{color}": (160, 640) for color in ("blue", "yellow", "green", "white")},
    "tow-truck": (160, 480),
}
UI: dict[str, tuple[int, int]] = {
    **{f"neighbour-{mood}": (144, 144) for mood in ("happy", "worried", "annoyed", "angry")},
    "heart-full": (72, 72),
    "heart-empty": (72, 72),
    "honk": (128, 128),
    "puff": (128, 128),
}

BACKDROP_SIZE = (720, 1280)
BACKDROP_MAX_BYTES = 220 * 1024
VEHICLE_MAX_BYTES = 30 * 1024
UI_MAX_BYTES = 20 * 1024


def save_webp(image: Image.Image, destination: Path, max_bytes: int) -> None:
    quality = 88
    while quality >= 48:
        image.save(destination, "WEBP", quality=quality, method=6)
        if destination.stat().st_size <= max_bytes:
            return
        quality -= 6
    raise RuntimeError(f"Could not fit {destination.name} below {max_bytes // 1024} KB")


def trimmed_rgba(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    if alpha.getextrema()[0] > 0:
        raise ValueError(f"{path.name} has no transparent background")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"{path.name} is empty")
    return image.crop(bounds)


def fit_sprite(image: Image.Image, size: tuple[int, int], *, stretch: bool = False) -> Image.Image:
    width, height = size
    if stretch:
        # Bus source art is generated at a 1:3 canvas; the game uses it in a 1:4 cell.
        resized = image.resize((round(width * 0.94), round(height * 0.98)), Image.Resampling.LANCZOS)
    else:
        scale = min((width * 0.94) / image.width, (height * 0.98) / image.height)
        resized = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((width - resized.width) // 2, height - resized.height))
    return canvas


def main() -> int:
    if not SOURCE.is_dir():
        print(f"Missing local source folder: {SOURCE}", file=sys.stderr)
        return 1

    OUTPUT.mkdir(parents=True, exist_ok=True)
    built = 0

    backdrop_path = SOURCE / f"{BACKDROP}.png"
    backdrop = Image.open(backdrop_path).convert("RGB").resize(BACKDROP_SIZE, Image.Resampling.LANCZOS)
    save_webp(backdrop, OUTPUT / f"{BACKDROP}.webp", BACKDROP_MAX_BYTES)
    built += 1

    for name, size in VEHICLES.items():
        source = SOURCE / f"{name}.png"
        sprite = trimmed_rgba(source)
        output = fit_sprite(sprite, size, stretch=name.startswith("bus-"))
        save_webp(output, OUTPUT / f"{name}.webp", VEHICLE_MAX_BYTES)
        built += 1

    for name, size in UI.items():
        source = SOURCE / f"{name}.png"
        sprite = trimmed_rgba(source)
        output = fit_sprite(sprite, size)
        save_webp(output, OUTPUT / f"{name}.webp", UI_MAX_BYTES)
        built += 1

    print(f"Built {built} Car Park assets in {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
