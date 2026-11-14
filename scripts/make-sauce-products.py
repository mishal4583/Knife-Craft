"""
Builds the Sauce Station's PRODUCT pictures: one painted object per pantry item, standing on the counter (developer 2026-11-13: "a jar with a
mayonnaise label sitting on the desk, not just buttons").

Run:  python scripts/make-sauce-products.py        (needs Pillow and numpy; use `python`, not the MSYS `python3`)

Input (LOCAL ONLY, gitignored): Sauce Product Assets/<id>.png, one per pantry item (the ids are in src/game/business/sauceStation.ts PANTRY, e.g.
  mayo.png, olive-oil.png, salt.png, tomato.png), ANY size, transparent background, ONE object, the base of the object at the bottom.
Output (committed, small WebP): public/business/sauce/products/<id>.webp, 192 x 192, the object trimmed and scaled by ITS HEIGHT CLASS so a tall
bottle is taller than a jar (see HEIGHT_OF), standing on the bottom edge and centred.

The game uses a product's picture when its file exists (SauceStationGame PantryTile) and the small picture from the old sheets when it does not,
so the products can be delivered a few at a time.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "Sauce Product Assets")
OUT = os.path.join(ROOT, "public", "business", "sauce", "products")
SIZE = 192
# Share of the 192 px canvas each kind of object stands tall (so a bottle towers over a spice bowl, as on a real counter).
HEIGHT_OF = {"bottle": 0.98, "carton": 0.98, "jar": 0.86, "bowl": 0.76, "heap": 0.76, "cube": 0.6}
KIND = {
    **{i: "bottle" for i in ["olive-oil", "veg-oil", "sesame-oil", "white-vinegar", "wine-vinegar", "soy", "chilli-sauce"]},
    **{i: "carton" for i in ["water", "stock", "milk", "cream", "coconut-milk", "passata"]},
    **{i: "jar" for i in ["yogurt", "honey", "mayo", "mustard", "tahini", "peanut-butter"]},
    **{i: "bowl" for i in ["salt", "pepper", "paprika", "turmeric", "cumin", "curry-powder", "chilli-flakes", "sugar"]},
    "stock-cube": "cube",
}
MAX_KB = 40


def main() -> int:
    if not os.path.isdir(SRC):
        print(f"No source folder: {SRC}")
        return 1
    os.makedirs(OUT, exist_ok=True)
    built = 0
    for name in sorted(os.listdir(SRC)):
        if not name.lower().endswith(".png"):
            continue
        pid = name[:-4]
        im = Image.open(os.path.join(SRC, name)).convert("RGBA")
        a = np.array(im)
        if a[..., 3].min() > 0:
            print(f"SKIPPED {pid}: no transparent background")
            continue
        a[a[..., 3] < 24] = 0
        im = Image.fromarray(a)
        box = im.getbbox()
        if not box:
            print(f"SKIPPED {pid}: empty")
            continue
        im = im.crop(box)
        target_h = round(SIZE * HEIGHT_OF.get(KIND.get(pid, "heap"), 0.76))
        s = min(target_h / im.height, (SIZE * 0.96) / im.width)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.paste(im, ((SIZE - im.width) // 2, SIZE - im.height - 2), im)
        out = os.path.join(OUT, f"{pid}.webp")
        q = 86
        canvas.save(out, "WEBP", quality=q, method=6)
        while os.path.getsize(out) > MAX_KB * 1024 and q > 60:
            q -= 6
            canvas.save(out, "WEBP", quality=q, method=6)
        built += 1
    print(f"Built {built} product picture(s) into {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
