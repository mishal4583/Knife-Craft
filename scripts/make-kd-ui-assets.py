"""
Kitchen Dispatch's second look (developer 2026-11-17): the four booster buttons are cut out of the developer's mockup
(Crate Dispatch/CD-reference-mockup-55.png, local and gitignored, like the other CD-* pictures) and the mascot is Paige's
own cutout (public/business/assistant/cutout-explain.webp) cropped to the bust.
Output: public/business/cratedispatch/booster-<freeze|rocket|hammer|undo>.webp and mascot.webp.
Run from the repo root: python scripts/make-kd-ui-assets.py
"""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

OUT = "public/business/cratedispatch/"
mock = Image.open("Crate Dispatch/CD-reference-mockup-55.png").convert("RGBA")
BOXES = {
    "freeze": (105, 1335, 285, 1475),
    "rocket": (295, 1335, 475, 1475),
    "hammer": (488, 1335, 668, 1475),
    "undo": (678, 1335, 858, 1475),
}
SS = 4
for name, box in BOXES.items():
    c = mock.crop(box)
    a = np.array(c).astype(int)
    r, bl = a[..., 0], a[..., 2]
    blue = (bl > r + 40) & (bl > 110)
    lab, n = ndi.label(blue)
    sizes = ndi.sum(blue, lab, range(1, n + 1))
    blue = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z > 150])
    filled = ndi.binary_fill_holes(blue)
    ys, xs = np.where(filled)
    h, w = filled.shape
    x0 = xs.min()
    y1 = ys.max()
    x1 = xs[ys > (ys.min() + ys.max()) / 2].max()  # the count badge sits at the top right: read the right edge lower down
    y0 = ys[xs < (xs.min() + xs.max()) / 2].min()
    ring = 9  # the gold rim around the blue
    X0, Y0, X1, Y1 = x0 - ring, y0 - ring, x1 + ring, y1 + ring
    m = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        (X0 * SS, Y0 * SS, X1 * SS, Y1 * SS), radius=(Y1 - Y0) * 0.30 * SS, fill=255
    )
    c.putalpha(m.resize((w, h), Image.LANCZOS))
    c = c.crop((max(0, int(X0) - 1), max(0, int(Y0) - 1), min(w, int(X1) + 2), min(h, int(Y1) + 2)))
    c = c.resize((148, 124), Image.LANCZOS)  # the four are the same size
    c.save(OUT + f"booster-{name}.webp", quality=90)

p = Image.open("public/business/assistant/cutout-explain.webp").convert("RGBA")
p = p.crop((0, 0, p.width, int(p.height * 0.62))).resize((360, int(360 * p.height * 0.62 / p.width)), Image.LANCZOS)
p.save(OUT + "mascot.webp", quality=88)
print("kitchen dispatch ui art built")
