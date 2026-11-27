"""Cut the Festival Competition's art into small WebP files for the game.

Run from the repository root with:  py scripts/make-festival-assets.py

Source: Festival competition assets/ (the developer's Codex art, local and gitignored)
Output: public/festival/{burger,people,ui}/*.webp  (rebuilt from nothing each run; festivalArt.ts names them, festival-save-qa checks them)

The Burger Festival's kit (docs/planning/FESTIVAL-CODEX-PROMPT-2026-11-27.md): stations, filled trays, food states, stackable burger layers,
the upright backdrop, two more customers and a few icons. Pictures that sit on one another keep one crop, so they line up. Rivals use the
game's own portraits (public/portraits/rivals).
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Festival competition assets"
OUTPUT = ROOT / "public" / "festival"

SHARED = "00_shared"
BURGER = "01_burger_festival"
EQUIPMENT = f"{BURGER}/equipment"

# output (under public/festival) -> (source, box size): trimmed to the drawing and fitted in a square of that size
SINGLES: dict[str, tuple[str, int]] = {
    # the stations (kitchenArt in festivalArt.ts; the grill and the board are the same shape and sit side by side)
    "burger/station-grill": (f"{EQUIPMENT}/station_grill_empty.png", 560),
    "burger/station-board": (f"{EQUIPMENT}/station_assembly_board.png", 560),
    "burger/station-plate": (f"{EQUIPMENT}/station_serving_plate.png", 220),
    "burger/station-fryer": (f"{EQUIPMENT}/station_fryer_empty.png", 220),
    "burger/station-bin": (f"{EQUIPMENT}/station_trash_bin.png", 180),
    "burger/station-blender": (f"{SHARED}/cooking_equipment/countertop_blender.png", 200),
    # what the player taps
    "burger/tray-bun": (f"{BURGER}/trays/tray_buns.png", 200),
    "burger/tray-patty": (f"{BURGER}/trays/tray_patty_raw.png", 200),
    "burger/tray-chicken": (f"{BURGER}/trays/tray_chicken_raw.png", 200),
    "burger/tray-veggie": (f"{BURGER}/trays/tray_veggie_patty_raw.png", 200),
    "burger/tray-cheese": (f"{BURGER}/trays/tray_cheese.png", 200),
    "burger/tray-lettuce": (f"{BURGER}/trays/tray_lettuce.png", 200),
    "burger/tray-tomato": (f"{BURGER}/trays/tray_tomato.png", 200),
    "burger/tray-onion": (f"{BURGER}/trays/tray_onion.png", 200),
    "burger/tray-pickles": (f"{BURGER}/trays/tray_pickles.png", 200),
    "burger/tray-ketchup": (f"{BURGER}/trays/bottle_ketchup.png", 160),
    "burger/tray-mustard": (f"{BURGER}/trays/bottle_mustard.png", 160),
    "burger/tray-fries": (f"{BURGER}/trays/tray_fries_raw.png", 200),
    # the order bubble's little pictures and the sides
    "burger/chip-cheese": (f"{SHARED}/ingredients/ingredient_cheddar_slice.png", 72),
    "burger/chip-lettuce": (f"{SHARED}/ingredients/ingredient_lettuce_leaf.png", 72),
    "burger/chip-tomato": (f"{SHARED}/ingredients/ingredient_tomato_slice.png", 72),
    "burger/chip-onion": (f"{SHARED}/ingredients/ingredient_onion_rings.png", 72),
    "burger/chip-pickles": (f"{SHARED}/ingredients/ingredient_pickle_slices.png", 72),
    "burger/chip-patty": (f"{BURGER}/food/patty_cooked.png", 72),
    "burger/chip-chicken": (f"{BURGER}/food/chicken_cooked.png", 72),
    "burger/chip-veggie": (f"{BURGER}/food/veggie_patty_cooked.png", 72),
    "burger/chip-ketchup": (f"{BURGER}/trays/bottle_ketchup.png", 72),
    "burger/chip-mustard": (f"{BURGER}/trays/bottle_mustard.png", 72),
    "burger/fries": (f"{BURGER}/food/fries_box_full.png", 180),
    "burger/milkshake": (f"{BURGER}/food/food_strawberry_milkshake.png", 180),
    # icons
    "ui/trophy": (f"{SHARED}/ui_icons/ui_competition_trophy_gold.png", 128),
    "ui/star": (f"{SHARED}/ui_icons/ui_star_gold.png", 96),
    "ui/hand": (f"{SHARED}/pointers_tutorial/tutorial_pointer_hand.png", 128),
    "ui/heart-full": (f"{SHARED}/ui_icons/ui_heart_full.png", 56),
    "ui/heart-empty": (f"{SHARED}/ui_icons/ui_heart_empty.png", 56),
    "ui/ready": (f"{SHARED}/ui_icons/ui_ready_bell.png", 80),
    "ui/warning": (f"{SHARED}/ui_icons/ui_burnt_warning.png", 80),
    "ui/lock": (f"{SHARED}/ui_icons/ui_lock.png", 72),
    "ui/trash": (f"{SHARED}/ui_icons/ui_trash.png", 80),
    "ui/power-patience": (f"{SHARED}/powerups/customer_patience.png", 128),
    "ui/power-instant": (f"{SHARED}/powerups/instant_cooking.png", 128),
    "ui/power-freeze": (f"{SHARED}/powerups/order_freeze.png", 128),
    "ui/smoke": (f"{SHARED}/effects/cooking_smoke.png", 128),
    "ui/first-trophy": (f"{SHARED}/celebration/first_place_trophy.png", 200),
    "ui/confetti": (f"{SHARED}/effects/effect_victory_confetti.png", 320),
}

# groups drawn on top of one another: one shared crop (the union of their drawings), so a change of state never moves or resizes them
MEATS = ["patty", "chicken", "veggie_patty"]
STATES = ["raw", "cooking", "cooked", "burnt"]
GROUPS: list[tuple[dict[str, str], int]] = [
    (
        {
            f"burger/meat-{'veggie' if meat == 'veggie_patty' else meat}-{state}": f"{BURGER}/food/{meat}_{state}.png"
            for meat in MEATS
            for state in STATES
        },
        200,
    ),
    (
        {
            "burger/cup-empty": f"{BURGER}/food/cup_empty.png",
            "burger/cup-cola": f"{BURGER}/food/cup_cola.png",
            "burger/cup-lemonade": f"{BURGER}/food/cup_lemonade.png",
        },
        180,
    ),
]

# the burger layers: Codex drew each centred on a 512 canvas, 400 wide; the middle 400 x 400 is kept so they stack by their centres
LAYERS = ["bun_bottom", "patty", "chicken", "veggie_patty", "cheese", "lettuce", "tomato", "onion", "pickles", "ketchup", "mustard", "bun_top"]
LAYER_NAMES = {"bun_bottom": "bun", "veggie_patty": "veggie", "bun_top": "lid"}
LAYER_SIZE = 200

# the drink machine: each tap (its coloured tank and nozzle) cut from the dispenser's picture, as fractions of its canvas
TAPS = {"burger/tap-cola": (0.205, 0.175, 0.497, 0.585), "burger/tap-lemonade": (0.503, 0.175, 0.795, 0.585)}

# the customers drawn in four moods, each one person. The last two were drawn to the waist: cropped to head and chest, so every face is as big
PEOPLE: dict[str, tuple[str, tuple[float, float, float, float] | None, str]] = {
    "elderly-woman": ("elderly_woman", None, "neutral"),
    "office-man": ("office_man", None, "neutral"),
    "student-woman": ("student_woman", None, "neutral"),
    "tourist-man": ("tourist_man", None, "neutral"),
    "teen-girl": ("teen_girl", (0.15, 0.015, 0.85, 0.715), "waiting"),
    "family-dad": ("family_dad", (0.195, 0.005, 0.805, 0.615), "waiting"),
}
MOODS = ["happy", "neutral", "impatient", "excited"]
PERSON_BOX = 300
BACKDROPS = {
    "burger/backdrop-wide": (f"{BURGER}/background/background_burger_festival_full.png", (1280, 720)),
    "burger/backdrop-tall": (f"{BURGER}/background/background_burger_festival_portrait.png", (720, 1280)),
}


def load(rel: str) -> Image.Image:
    return Image.open(SOURCE / rel).convert("RGBA")


def clean(image: Image.Image) -> Image.Image:
    """Clear the faint haze, and drop small loose pieces of a neighbouring picture that touch an edge."""
    rgba = np.array(image)
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


def drawn_box(image: Image.Image) -> tuple[int, int, int, int]:
    box = image.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    assert box, "an empty picture"
    return box


def shrink(image: Image.Image, box: int) -> Image.Image:
    image.thumbnail((box, box), Image.LANCZOS)
    return image


def save(image: Image.Image, name: str, quality: int = 86) -> int:
    target = OUTPUT / f"{name}.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=quality, method=6)
    return target.stat().st_size


def golden_from_raw(raw: Image.Image) -> Image.Image:
    """The golden basket: the raw basket with its pale fries turned golden, so the basket itself never changes between the two.
    (The delivered golden picture is a differently drawn basket without the handle, so it would jump when the fries are done.)"""
    rgba = np.array(raw).astype(np.float32)
    r, g, b = rgba[..., 0], rgba[..., 1], rgba[..., 2]
    high = np.maximum(np.maximum(r, g), b)
    low = np.minimum(np.minimum(r, g), b)
    saturation = (high - low) / np.maximum(high, 1)
    # the pale yellow of a raw fry: red over green over blue, clearly coloured (the steel is nearly grey), and not the red handle
    fry = (r >= g) & (g > b) & (saturation > 0.2) & (high > 120) & (g > 0.62 * r)
    soft = ndimage.gaussian_filter(fry.astype(np.float32), 1.0)[..., None]
    golden = np.stack([np.minimum(r * 1.0, 255), g * 0.80, b * 0.34], axis=-1)
    rgba[..., :3] = rgba[..., :3] * (1 - soft) + golden * soft
    return Image.fromarray(rgba.clip(0, 255).astype(np.uint8), "RGBA")


def main() -> int:
    if not SOURCE.is_dir():
        print(f"Missing source folder: {SOURCE}", file=sys.stderr)
        return 1
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)  # everything in it is made here
    total = count = 0

    def put(image: Image.Image, name: str, quality: int = 86) -> None:
        nonlocal total, count
        total += save(image, name, quality)
        count += 1

    for name, (src, size) in SINGLES.items():
        picture = clean(load(src))
        put(shrink(picture.crop(drawn_box(picture)), size), name)

    for group, size in GROUPS:
        pictures = {name: clean(load(src)) for name, src in group.items()}
        boxes = [drawn_box(p) for p in pictures.values()]
        union = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        for name, picture in pictures.items():
            put(shrink(picture.crop(union), size), name)

    # the fry baskets, on one crop; the golden one is made from the raw one
    raw = clean(load(f"{EQUIPMENT}/station_fry_basket_raw.png"))
    baskets = {
        "burger/basket-raw": raw,
        "burger/basket-golden": golden_from_raw(raw),
        "burger/basket-burnt": clean(load(f"{EQUIPMENT}/station_fry_basket_burnt.png")),
    }
    boxes = [drawn_box(p) for p in baskets.values()]
    union = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    for name, picture in baskets.items():
        put(shrink(picture.crop(union), 220), name)

    for layer in LAYERS:
        picture = load(f"{BURGER}/ingredients/layer_{layer}.png")
        assert picture.size == (512, 512), f"layer_{layer}: expected 512 x 512"
        put(shrink(picture.crop((56, 56, 456, 456)), LAYER_SIZE), f"burger/layer-{LAYER_NAMES.get(layer, layer)}", 88)

    dispenser = clean(load(f"{EQUIPMENT}/station_drink_dispenser.png"))
    for name, (x0, y0, x1, y1) in TAPS.items():
        w, h = dispenser.size
        put(shrink(dispenser.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))), 200), name)

    for person, (source, crop, neutral) in PEOPLE.items():
        for mood in MOODS:
            file = neutral if mood == "neutral" else mood
            picture = clean(load(f"{SHARED}/customers/customer_{source}_{file}.png"))
            if crop:
                w, h = picture.size
                picture = picture.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
                picture = picture.resize((PERSON_BOX, PERSON_BOX), Image.LANCZOS)
            # the four moods keep one canvas and one scale, so the face never jumps when the mood changes
            put(shrink(picture, PERSON_BOX), f"people/{person}-{mood}", 84)

    for name, (src, size) in BACKDROPS.items():
        put(Image.open(SOURCE / src).convert("RGB").resize(size, Image.LANCZOS), name, 78)

    print(f"{count} pictures, {total / 1024:.0f} KB in {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
