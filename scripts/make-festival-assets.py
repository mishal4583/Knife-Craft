"""Cut the Festival Competition's art into small WebP files for the game.

Run from the repository root with:  py scripts/make-festival-assets.py

Source: Festival competition assets/ (the developer's Codex art, local and gitignored)
Output: public/festival/{burger,people,ui}/*.webp  (kitchenFestivalArt.ts lists them; festival-config-qa checks every one)

This is the Burger Festival's first cut (Phase 2a): the existing art, with the stations drawn in code until the Burger kit arrives
(docs/planning/FESTIVAL-CODEX-PROMPT-2026-11-27.md). Rivals use the game's own portraits (public/portraits/rivals).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Festival competition assets"
OUTPUT = ROOT / "public" / "festival"

SHARED = "00_shared"
# output (under public/festival) -> (source, box size, trim to the drawing)
ASSETS: dict[str, tuple[str, int, bool]] = {
    "burger/bun-top": (f"{SHARED}/ingredients/ingredient_burger_bun_top_sesame.png", 128, True),
    "burger/patty": (f"{SHARED}/ingredients/ingredient_beef_patty.png", 128, True),
    "burger/chicken": (f"{SHARED}/ingredients/ingredient_crispy_chicken_fillet.png", 128, True),
    "burger/cheese": (f"{SHARED}/ingredients/ingredient_cheddar_slice.png", 128, True),
    "burger/lettuce": (f"{SHARED}/ingredients/ingredient_lettuce_leaf.png", 128, True),
    "burger/tomato": (f"{SHARED}/ingredients/ingredient_tomato_slice.png", 128, True),
    "burger/onion": (f"{SHARED}/ingredients/ingredient_onion_rings.png", 128, True),
    "burger/pickles": (f"{SHARED}/ingredients/ingredient_pickle_slices.png", 128, True),
    "burger/fries": (f"{SHARED}/ingredients/ingredient_french_fries.png", 160, True),
    "burger/milkshake": ("01_burger_festival/food/food_strawberry_milkshake.png", 160, True),
    "burger/burger": ("01_burger_festival/food/food_double_cheeseburger.png", 192, True),
    "ui/trophy": (f"{SHARED}/ui_icons/ui_competition_trophy_gold.png", 128, True),
    "ui/star": (f"{SHARED}/ui_icons/ui_star_gold.png", 96, True),
    "ui/hand": (f"{SHARED}/pointers_tutorial/tutorial_pointer_hand.png", 128, True),
    "ui/power-patience": (f"{SHARED}/powerups/customer_patience.png", 128, True),
    "ui/power-instant": (f"{SHARED}/powerups/instant_cooking.png", 128, True),
    "ui/power-freeze": (f"{SHARED}/powerups/order_freeze.png", 128, True),
    "ui/smoke": (f"{SHARED}/effects/cooking_smoke.png", 128, True),
    "ui/confetti": (f"{SHARED}/effects/effect_victory_confetti.png", 320, False),
    "ui/first-trophy": (f"{SHARED}/celebration/first_place_trophy.png", 200, True),
}
# The four customers drawn in four moods (each set is one person; they do not match the plain portraits, so only the sets are used).
PEOPLE = ["elderly_woman", "office_man", "student_woman", "tourist_man"]
MOODS = ["happy", "neutral", "impatient", "excited"]
PERSON_BOX = 300
BACKDROP = "01_burger_festival/background/background_burger_festival_full.png"


def clean(image: Image.Image) -> Image.Image:
    """Clear the faint haze, and drop small loose pieces of a neighbouring picture that touch an edge."""
    rgba = np.array(image.convert("RGBA"))
    alpha = rgba[..., 3]
    alpha[alpha < 14] = 0
    labels, count = ndimage.label(alpha > 40)
    if count > 1:
        sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, count + 1))
        biggest = float(sizes.max())
        height, width = alpha.shape
        for index, box in enumerate(ndimage.find_objects(labels), start=1):
            ys, xs = box
            at_edge = xs.start <= 1 or ys.start <= 1 or xs.stop >= width - 1 or ys.stop >= height - 1
            if at_edge and sizes[index - 1] < 0.2 * biggest:
                alpha[ndimage.binary_dilation(labels == index, iterations=3)] = 0
    rgba[..., 3] = alpha
    return Image.fromarray(rgba, "RGBA")


def fit(image: Image.Image, box: int, trim: bool) -> Image.Image:
    if trim:
        drawn = image.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
        if drawn:
            image = image.crop(drawn)
    image.thumbnail((box, box), Image.LANCZOS)
    return image


def save(image: Image.Image, name: str, quality: int) -> int:
    target = OUTPUT / f"{name}.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=quality, method=6)
    return target.stat().st_size


def main() -> int:
    if not SOURCE.is_dir():
        print(f"Missing source folder: {SOURCE}", file=sys.stderr)
        return 1
    total = 0
    for name, (src, box, trim) in ASSETS.items():
        total += save(fit(clean(Image.open(SOURCE / src)), box, trim), name, 86)
    for who in PEOPLE:
        for mood in MOODS:
            picture = clean(Image.open(SOURCE / SHARED / "customers" / f"customer_{who}_{mood}.png"))
            # the four moods keep one canvas and one scale, so the face never jumps when the mood changes
            picture.thumbnail((PERSON_BOX, PERSON_BOX), Image.LANCZOS)
            total += save(picture, f"people/{who.replace('_', '-')}-{mood}", 84)
    backdrop = Image.open(SOURCE / BACKDROP).convert("RGB").resize((1280, 720), Image.LANCZOS)
    total += save(backdrop, "burger/backdrop", 80)
    count = len(ASSETS) + len(PEOPLE) * len(MOODS) + 1
    print(f"{count} pictures, {total / 1024:.0f} KB in {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
