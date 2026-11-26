"""Dessert Run's 50 desserts, straight from the developer's reference sheets (developer 2026-11-26: "refer these images in order and fix the desserts properly, one by one, proper and clean,
realistic and exactly like in the reference").

Each dessert is shown as the reference picture itself, cut into the game's 28 x 28 cubes: a cube shows its own square of the picture, so the picture is exact and the game is unchanged (waiters
still fetch one colour of cube at a time). For each of the 50 this script writes
  - public/business/dessertrun/desserts/<id>.webp : the dessert cut from its plate, cleaned, sharpened, placed on the 28-cube board (448 x 448, 16 px a cube, transparent around it)
  - its block in src/game/business/dessertLadderArt.ts : which cubes are the dessert, which colour group (what a waiter fetches) each cube belongs to, a flat tone per cube (the fallback if the
    picture cannot load, and the colour of the waiters and the flying cubes) and the board behind it.

Run: python scripts/make-dessert-art.py [ids|levels|ranges ...] [--sheet out.png]     (no ids = all 50)
then: npx prettier --end-of-line auto --write src/game/business/dessertLadderArt.ts
A changed picture needs its plates re-rated: npx tsx scripts/make-dessert-seeds.mts --pool=<dir> --key=<id> --candidates=250, then without --key (see that script).

The references: docs/planning/reference/dessert-run/levels-01-15.png, -16-30, -31-45, -46-50 (2172 x 724, every dessert on a blue-rimmed plate under its level tag).
"""
import json
import math
import re
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "docs" / "planning" / "reference" / "dessert-run"
OUT_IMG = ROOT / "public" / "business" / "dessertrun" / "desserts"
OUT_TS = ROOT / "src" / "game" / "business" / "dessertLadderArt.ts"
GRID = 28
CUBE = 16  # picture pixels per cube
WELL = 175 / 13.5  # the plate's round well, in cubes (dessertGallery.ts WELL_CELLS)
DARK_L = 17  # Lab lightness under which a pixel is the picture's dark outline

LIST = [
    ("cookie", "Biscuit"), ("candy", "Candy"), ("jelly", "Jelly"), ("donut", "Simple Donut"), ("macaron", "Macaron"), ("cupcake", "Cupcake"), ("pancakes", "Pancake"), ("cone", "Ice Cream"), ("cakeslice", "Cake Slice"), ("lollipop", "Lollipop"),
    ("eclair", "Eclair"), ("pudding", "Pudding"), ("mousse", "Mousse"), ("cheesecake", "Cheesecake"), ("tart", "Tart"), ("swissroll", "Swiss Roll"), ("millefeuille", "Mille-Feuille"), ("brownie", "Brownie"), ("croissant", "Croissant"), ("muffin", "Muffin"),
    ("tiramisu", "Tiramisu"), ("shortcake", "Strawberry Shortcake"), ("operacake", "Opera Cake"), ("bakedalaska", "Baked Alaska"), ("croquembouche", "Croquembouche"), ("bettycake", "Betty Cake"), ("parfait", "Fruit Parfait"), ("pie", "Pie"), ("churros", "Churros"), ("waffle", "Waffle"),
    ("sundae", "Sundae"), ("moltencake", "Molten Cake"), ("pavlova", "Pavlova"), ("bananasplit", "Banana Split"), ("creampuff", "Cream Puff"), ("fruitlayercake", "Fruit Layer Cake"), ("matchaRoll", "Matcha Roll"), ("redvelvet", "Red Velvet Cake"), ("lemontart", "Lemon Tart"), ("chocolatelava", "Chocolate Lava"),
    ("raspberrymousse", "Raspberry Mousse"), ("mintchoc", "Mint Chocolate Cake"), ("mangomousse", "Mango Mousse Cake"), ("blackforest", "Black Forest Cake"), ("fraisier", "Fraisier"), ("sachertorte", "Sachertorte"), ("montblanc", "Mont Blanc"), ("fruitgateau", "Fruit Gateau"), ("chocolatedome", "Chocolate Dome"), ("granddessert", "Grand Dessert"),
]
IDS = [i for i, _ in LIST]

# the plates of the sheets in level order: (sheet, centre x, centre y, ring radius), fitted to each plate's blue ring
_A, _B, _C, _D = "levels-01-15", "levels-16-30", "levels-31-45", "levels-46-50"
PLATES = [
    (_A, 152, 256, 92), (_A, 367, 256, 90), (_A, 579, 256, 90), (_A, 785, 254, 88), (_A, 995, 254, 90), (_A, 1198, 256, 90), (_A, 1406, 256, 90), (_A, 1611, 256, 90), (_A, 1822, 256, 92), (_A, 2027, 258, 90),
    (_A, 625, 544, 112), (_A, 939, 546, 112), (_A, 1260, 540, 116), (_A, 1581, 544, 114), (_A, 1913, 544, 116),
    (_B, 257, 259, 110), (_B, 536, 259, 108), (_B, 811, 259, 108), (_B, 1086, 259, 110), (_B, 1364, 257, 108), (_B, 1643, 259, 108), (_B, 1922, 255, 110),
    (_B, 206, 541, 106), (_B, 461, 541, 104), (_B, 712, 541, 104), (_B, 964, 539, 104), (_B, 1212, 543, 104), (_B, 1464, 543, 106), (_B, 1716, 541, 104), (_B, 1970, 543, 106),
    (_C, 255, 261, 112), (_C, 532, 261, 112), (_C, 808, 263, 110), (_C, 1084, 263, 112), (_C, 1361, 259, 110), (_C, 1640, 261, 114), (_C, 1922, 261, 114),
    (_C, 182, 550, 106), (_C, 441, 544, 104), (_C, 695, 546, 104), (_C, 950, 546, 106), (_C, 1211, 548, 108), (_C, 1471, 548, 108), (_C, 1732, 548, 108), (_C, 1993, 550, 108),
    (_D, 299, 367, 164), (_D, 704, 365, 160), (_D, 1091, 375, 162), (_D, 1484, 373, 162), (_D, 1886, 377, 166),
]

# each sheet row's level tag (the pill with "L12" over the top of the plate): (its bottom row, its half width), and the top row of the name label under the plates, in sheet pixels
TAGS = {(_A, 0): (175, 41), (_A, 1): (458, 48), (_B, 0): (173, 50), (_B, 1): (461, 50), (_C, 0): (172, 51), (_C, 1): (463, 50), (_D, 0): (240, 74)}
LABELS = {(_A, 0): 342, (_A, 1): 631, (_B, 0): 341, (_B, 1): 632, (_C, 0): 345, (_C, 1): 632, (_D, 0): 528}

# per-dessert fixes of the cut: hole = (dx, dy) fraction of the ring radius where a see-through hole is (the donut); grow = grey fringe eaten (px); seal = outline gap closed (px);
# keep = keep every piece of at least this many px (not only the biggest); rows = (from, to) fractions of the ring radius below the centre: every row there is filled between its first and last
# pixel (a glass bowl or a thin stick whose pale inside matches the plate); peel = how many times the pale halo is peeled off the edge (default 3)
TUNING = {
    "donut": {"hole": (0.0, -0.1)},
    # with six colour groups no deal of the first two could be proven winnable
    "raspberrymousse": {"max": 4},
    "sachertorte": {"max": 4},  # thin dark layers block each other: with five or six colours almost no deal could be won
    "fruitgateau": {"max": 5},
    "lollipop": {"rows": (0.35, 1.2), "peel": 1},
    "macaron": {"grow": 3},
    "bakedalaska": {"rows": (-0.5, -0.1), "peel": 2},
    "bettycake": {"keep": 60, "rows": (-0.5, 0.55), "peel": 1},
    "parfait": {"rows": (-0.42, 1.2), "peel": 1},
    "sundae": {"rows": (0.05, 1.2), "peel": 1},
    "pavlova": {"peel": 1},
}

# the boards behind the desserts (names are RUN_PALETTE tones of dessertGallery.ts): `plate` is the reference's own white-and-pale-blue checked plate
BOARDS = {
    "plate": ("#EEF5FB", "#DCEAF6", "#C6D9EC"),
    "sky": ("#8EE3FF", "#41C4F7", "#1E8EEA"),
    "mint": ("#9DF0D8", "#5ADDBB", "#2FBE9C"),
    "lilac": ("#E0D4FF", "#B79EF8", "#8F77E6"),
    "vanilla": ("#FFF7DC", "#FCE9BA", "#EDD08E"),
    "peach": ("#FFE3CF", "#FFC9A3", "#F2A272"),
    "sage": ("#E1F1D2", "#B9DC9F", "#8FC477"),
    "rose": ("#FFE0EA", "#FFBDD2", "#F08EAE"),
    "aqua": ("#CBF6F3", "#8EE3E0", "#55C8CF"),
}
OUTLINE_HEX = "#3B1E0E"


def ids_from(args):
    out = []
    for a in args:
        for part in a.split(","):
            if part == "all":
                out += IDS
            elif part.replace("-", "").isdigit() and "-" in part:
                lo, hi = (int(x) for x in part.split("-"))
                out += IDS[lo - 1 : hi]
            elif part.isdigit():
                out.append(IDS[int(part) - 1])
            else:
                out.append(part)
    return [i for n, i in enumerate(out) if i not in out[:n]]


# --------------------------------------------------------------------------------------------- colour helpers

def srgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def lab_to_hex(lab):
    lab = np.asarray(lab, dtype=np.float64)
    fy = (lab[0] + 16) / 116
    f = np.array([fy + lab[1] / 500, fy, fy - lab[2] / 200])
    xyz = np.where(f**3 > 0.008856, f**3, (f - 16 / 116) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    m = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]])
    rgb = xyz @ m.T
    rgb = np.where(rgb > 0.0031308, 1.055 * np.power(np.clip(rgb, 0, None), 1 / 2.4) - 0.055, 12.92 * rgb)
    r, g, b = np.clip(np.round(rgb * 255), 0, 255).astype(int)
    return "#%02X%02X%02X" % (r, g, b)


def hex_lab(h):
    return srgb_to_lab(np.array([int(h[k : k + 2], 16) for k in (1, 3, 5)], dtype=np.float64))


def kmeans(x, k, w=None, seed=3, iters=50):
    w = np.ones(len(x)) if w is None else w
    rng = np.random.default_rng(seed)
    cent = [x[int(np.argmax(w))]]
    for _ in range(k - 1):
        d = np.min(((x[:, None, :] - np.array(cent)[None]) ** 2).sum(-1), axis=1) * w
        cent.append(x[rng.choice(len(x), p=d / d.sum())] if d.sum() > 0 else x[rng.integers(len(x))])
    cent = np.array(cent)
    for _ in range(iters):
        lab = np.argmin(((x[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
        new = np.array([np.average(x[lab == j], axis=0, weights=w[lab == j]) if (lab == j).any() else cent[j] for j in range(k)])
        if np.allclose(new, cent):
            break
        cent = new
    return cent, np.argmin(((x[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)


# --------------------------------------------------------------------------------------------- the cut-out

@lru_cache(maxsize=8)
def sheet(name):
    return np.array(Image.open(REF / f"{name}.png").convert("RGB")).astype(np.float64)


def cutout(n):
    """Dessert n (1 to 50): (rgb crop, mask).

    The background (the white checked well, its soft shadow, the blue ring and its hearts) is what a flood fill from the crop's rim reaches without crossing the dessert's dark outline, so whatever is
    inside the outline (white cream, glass, meringue, blueberries) is the dessert."""
    id_ = IDS[n - 1]
    o = TUNING.get(id_, {})
    name, cx, cy, r = PLATES[n - 1]
    R = int(round(r * 1.04))
    img = sheet(name)
    x0, y0 = int(cx) - R, int(cy) - R
    crop = img[y0 : y0 + 2 * R + 1, x0 : x0 + 2 * R + 1].copy()
    h, w, _ = crop.shape
    yy, xx = np.mgrid[0:h, 0:w]
    dx, dy = xx - R, yy - R
    rr = np.hypot(dx, dy)
    inside = rr <= R - 1
    lum = crop.mean(-1)
    chroma = crop.max(-1) - crop.min(-1)
    red, green, blue = crop[..., 0], crop[..., 1], crop[..., 2]
    warm = red - blue
    L = srgb_to_lab(crop)[..., 0]
    bluish = (blue - red) > 22
    dark = (L < 27) & ~(bluish & (rr > r * 0.72))
    seal = o.get("seal", 1)
    wall = ndimage.binary_dilation(dark, iterations=seal) if seal else dark
    well = (lum > 150) & (chroma < 62) & (warm < 16) & ~wall
    # the ring's royal blue leans to cyan (green above red); a purple dessert (red above green) is never the ring
    ring = ((blue - red) > 45) & ((blue - green) > 18) & (green >= red - 4) & (rr > r * 0.80) & ~wall
    hearts = (lum > 190) & (rr > r * 0.86) & ~wall
    cand = (well | ring | hearts) & inside
    lab_, _n = ndimage.label(cand)
    start = inside & ((rr > R - 8) | ((rr > r * 0.84) & (rr < r * 0.9) & (well | ring)))
    seeds = np.unique(lab_[start & cand])
    bg = np.isin(lab_, seeds[seeds > 0])
    bg |= rr > r * 1.01
    bg |= bluish & ((blue - green) > 25) & (green >= red - 4) & (rr > r * 0.84)
    # the level tag over the top of the plate, its bluish shadow, and the name label under the plate: never the dessert
    row = (name, 1 if (cy > 400 and name != _D) else 0)
    tag_bottom, tag_half = TAGS[row]
    ya, xa = yy + y0, xx + x0
    bg |= (ya <= tag_bottom) & (np.abs(xa - cx) <= tag_half)
    bg |= (ya <= tag_bottom + 15) & (blue - red > 14) & (lum > 95) & (lum < 188)
    bg |= ya >= LABELS[row]
    bg |= (ya >= LABELS[row] - 6) & (red > 165) & (blue < 150) & (lum > 100)  # the label's gold top edge
    grey = (lum > 105) & (chroma < 58) & (warm < 18) & inside & ~wall
    for _ in range(o.get("grow", 2)):
        bg = bg | (ndimage.binary_dilation(bg) & grey)
    fg = inside & ~bg
    fg = ndimage.binary_opening(fg, iterations=1)
    lab2, m = ndimage.label(fg)
    if m > 1:
        sizes = ndimage.sum(fg, lab2, range(1, m + 1))
        keep = o.get("keep", 0)
        fg = np.isin(lab2, [i + 1 for i, z in enumerate(sizes) if z >= keep]) if keep else lab2 == (1 + int(np.argmax(sizes)))
    fg = ndimage.binary_fill_holes(fg)
    if "hole" in o:
        hx, hy = int(R + o["hole"][0] * r), int(R + o["hole"][1] * r)
        hl, _m = ndimage.label(well & (lum > 165))
        # the hole is the biggest light area near the given point
        near = hl[max(hy - 14, 0) : hy + 15, max(hx - 14, 0) : hx + 15]
        ids_, counts = np.unique(near[near > 0], return_counts=True)
        if len(ids_):
            fg &= ~ndimage.binary_dilation(hl == ids_[counts.argmax()], iterations=1)
    if "rows" in o:
        a_, b_ = o["rows"]
        for y in range(h):
            if a_ * r <= y - R <= b_ * r and ya[y, 0] < LABELS[row]:
                xs_ = np.nonzero(fg[y])[0]
                if len(xs_) > 1:
                    fg[y, xs_.min() : xs_.max() + 1] = True
    # peel the pale halo off the edge: a light, colourless pixel on the very edge is plate, not dessert (the dessert's edge is its dark outline)
    # (also the soft blue-grey drop shadow under a dessert, which is not part of it)
    pale = ((lum > 150) & (chroma < 60) & (warm < 22)) | ((blue - red > 6) & (green >= red - 2) & (lum > 80) & (chroma < 72))
    for _ in range(o.get("peel", 3)):
        edge = fg & ~ndimage.binary_erosion(fg)
        fg &= ~(edge & pale)
    # the plate's soft blue-grey shadow that clings outside the outline: peeled from the edge until the edge is the dessert again
    shadow = (blue - red > 8) & (green >= red - 2) & (lum > 85) & (lum < 218) & (chroma < 86)
    for _ in range(16):
        edge = fg & ~ndimage.binary_erosion(fg)
        if not (edge & shadow).any():
            break
        fg &= ~(edge & shadow)
    # slivers of the tag's bottom edge and of the label's top edge: lines under 4 px tall in those two bands are not the dessert
    thick = ndimage.binary_opening(fg, structure=np.ones((4, 1)))
    bands = (ya <= tag_bottom + 9) | (ya >= LABELS[row] - 16)
    fg = np.where(bands, thick, fg)
    lab3, m = ndimage.label(fg)
    if m > 1:
        sizes = ndimage.sum(fg, lab3, range(1, m + 1))
        fg = np.isin(lab3, [i + 1 for i, z in enumerate(sizes) if z >= max(40 if not o.get("keep") else o["keep"], sizes.max() * 0.02)])
    return crop, fg


# --------------------------------------------------------------------------------------------- the picture

def place(crop, fg):
    """The cut-out upscaled, sharpened and placed on the 448 x 448 board picture, as large as the plate's round well allows."""
    ys, xs = np.nonzero(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = crop[y0:y1, x0:x1].astype(np.uint8)
    m = fg[y0:y1, x0:x1]
    # colours under the transparent pixels are the nearest dessert colour, so scaling cannot bleed the plate into the edge
    idx = ndimage.distance_transform_edt(~m, return_distances=False, return_indices=True)
    rgb = rgb[idx[0], idx[1]]
    alpha = np.clip((ndimage.gaussian_filter(m.astype(float), 0.55) - 0.5) * 2.4 + 0.5, 0, 1)
    big = Image.fromarray(rgb, "RGB").resize((rgb.shape[1] * 4, rgb.shape[0] * 4), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2.4, percent=85, threshold=1))
    abig = Image.fromarray((alpha * 255).astype(np.uint8), "L").resize(big.size, Image.LANCZOS)
    S = GRID * CUBE
    for tenth in range(250, 159, -2):
        T = tenth / 10
        scale = T * CUBE / max(big.size)
        w, h = max(1, round(big.width * scale)), max(1, round(big.height * scale))
        part = big.resize((w, h), Image.LANCZOS).convert("RGBA")
        part.putalpha(abig.resize((w, h), Image.LANCZOS))
        ox, oy = round((S - w) / 2), round((S - h) / 2 + 0.3 * CUBE)
        a = np.array(part)[..., 3]
        py, px = np.nonzero(a > 100)
        far = np.hypot(px + ox - S / 2, py + oy - S / 2).max()
        if far <= (WELL - 0.12) * CUBE:
            break
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    canvas.paste(part, (ox, oy), part)
    return canvas


# --------------------------------------------------------------------------------------------- the cubes

def in_well(x, y):
    return math.hypot(max(abs(x + 0.5 - GRID / 2) - 0.5, 0), max(abs(y + 0.5 - GRID / 2) - 0.5, 0)) < WELL


def band_range(level):
    """How many colour groups (what a waiter fetches, besides the outline and the board) a level of the list has."""
    return {0: (3, 4), 1: (3, 4), 2: (4, 5), 3: (5, 5), 4: (5, 6)}[(level - 1) // 10]


def cubes_of(canvas, level, cap=None):
    """(kind per cube: None board, 'outline' or the group index), (flat tone index per cube), the groups' tones (hex, light to dark) and the groups' waiter colours."""
    a = np.array(canvas).astype(np.float64)
    lab = srgb_to_lab(a[..., :3])
    alpha = a[..., 3] / 255
    kind = {}
    feats, weights, where = [], [], []
    for y in range(GRID):
        for x in range(GRID):
            blk = (slice(y * CUBE, (y + 1) * CUBE), slice(x * CUBE, (x + 1) * CUBE))
            op = alpha[blk] > 0.5
            cover = op.mean()
            if cover < 0.2 or not in_well(x, y):
                continue
            px = lab[blk][op]
            dark = (px[:, 0] < DARK_L).mean()
            if dark >= 0.52:
                kind[(x, y)] = "outline"
                continue
            light = px[px[:, 0] >= DARK_L]
            # the cube's own colour: the median of its non-outline pixels, the middle of the cube counted twice
            inner = lab[blk][3:-3, 3:-3][op[3:-3, 3:-3]]
            inner = inner[inner[:, 0] >= DARK_L] if len(inner) else inner
            colour = np.median(np.concatenate([light, inner]) if len(inner) else light, axis=0)
            # a muddy dark mix (the outline's soft edge) is outline, not a colour of its own: no waiter fetches grey-brown
            if colour[0] < 48 and math.hypot(colour[1], colour[2]) < 17:
                kind[(x, y)] = "outline"
                continue
            feats.append(colour)
            weights.append(cover)
            where.append((x, y))
    feats = np.array(feats)
    weights = np.array(weights)
    scale = np.array([0.7, 1.0, 1.0])  # hue tells groups apart better than lightness
    lo, hi = band_range(level)
    if cap:
        lo, hi = min(lo, cap), min(hi, cap)
    cent, lab_ = kmeans(feats * scale, hi + 1, weights)
    groups = [list(np.nonzero(lab_ == j)[0]) for j in range(len(cent))]
    groups = [g for g in groups if g]

    def mean(g):
        return np.average(feats[g], axis=0, weights=weights[g])

    def dist(g, h):
        return float(np.linalg.norm(mean(g) - mean(h)))

    def closest():
        pairs = [(dist(groups[i], groups[j]), i, j) for i in range(len(groups)) for j in range(i + 1, len(groups))]
        return min(pairs)

    # waiters must be told apart by their colour: join groups whose colours are close, and small ones into their nearest
    while len(groups) > 3:
        d, i, j = closest()
        small = min(range(len(groups)), key=lambda k: len(groups[k]))
        if len(groups[small]) < 7:
            other = min((k for k in range(len(groups)) if k != small), key=lambda k: dist(groups[small], groups[k]))
            groups[other] += groups[small]
            del groups[small]
        elif d < 15 or len(groups) > hi:
            groups[i] += groups[j]
            del groups[j]
        else:
            break
    while len(groups) < lo:
        best = None
        for k, g in enumerate(groups):
            if len(g) < 16:
                continue
            c2, l2 = kmeans(feats[g] * scale, 2, weights[g])
            part = [[g[t] for t in range(len(g)) if l2[t] == s] for s in (0, 1)]
            if min(len(part[0]), len(part[1])) >= 7:
                d = dist(part[0], part[1])
                if d >= 11 and (best is None or d > best[0]):
                    best = (d, k, part)
        if not best:
            break
        _, k, part = best
        groups[k] = part[0]
        groups.append(part[1])
    groups.sort(key=lambda g: -mean(g)[0])
    tones, rep, tone_of = [], [], {}
    taken = [hex_lab(OUTLINE_HEX)]
    for gi, g in enumerate(groups):
        k = min(4, max(1, len(g) // 12 + 1))
        c, l = kmeans(feats[g], k, weights[g])
        order = sorted((j for j in range(len(c)) if (l == j).any()), key=lambda j: -c[j][0])
        names = [lab_to_hex(c[j]) for j in order]
        tones.append(names)
        # the waiter's colour: of the group's tones that many cubes have, the one that stands furthest from the outline and the other waiters (then the commonest)
        counts = {j: int((l == j).sum()) for j in order}
        often = [j for j in order if counts[j] >= max(2, 0.18 * len(g))] or order
        best_j = max(often, key=lambda j: (min(min(float(np.linalg.norm(c[j] - t_)) for t_ in taken), 34.0), counts[j]))
        taken.append(c[best_j])
        rep.append(order.index(best_j))
        for t, cube in enumerate(g):
            kind[where[cube]] = gi
            tone_of[where[cube]] = order.index(l[t])
    return kind, tone_of, tones, rep


def pick_board(tones, rep, level):
    """The reference's checked plate when no waiter colour could be mistaken for it, else the pastel furthest from the dessert's colours."""
    reps = [hex_lab(t[r]) for t, r in zip(tones, rep)]

    def gap(name):
        return min(float(np.linalg.norm(hex_lab(h) - c)) for h in BOARDS[name][:2] for c in reps)

    if gap("plate") >= 20:
        return "plate"
    scored = sorted(((gap(b), b) for b in BOARDS if b != "plate"), reverse=True)
    good = [b for g, b in scored if g >= scored[0][0] - 8]
    return good[level % len(good)]


# --------------------------------------------------------------------------------------------- one dessert

def make(id_):
    n = IDS.index(id_) + 1
    crop, fg = cutout(n)
    canvas = place(crop, fg)
    kind, tone_of, tones, rep = cubes_of(canvas, n, TUNING.get(id_, {}).get("max"))
    board = pick_board(tones, rep, n)
    # cubes that are not the dessert do not show the picture: clear them (a sliver under a fifth of a cube)
    a = np.array(canvas)
    for y in range(GRID):
        for x in range(GRID):
            if (x, y) not in kind:
                a[y * CUBE : (y + 1) * CUBE, x * CUBE : (x + 1) * CUBE, 3] = 0
    canvas = Image.fromarray(a, "RGBA")
    flat = [(gi, ti) for gi, t in enumerate(tones) for ti in range(len(t))]
    index = {f: i for i, f in enumerate(flat)}
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    rows = []
    for y in range(GRID):
        row = ""
        for x in range(GRID):
            k = kind.get((x, y))
            row += "." if k is None else "#" if k == "outline" else chars[index[(k, tone_of[(x, y)])]]
        rows.append(row)
    return dict(id=id_, level=n, name=LIST[n - 1][1], board=board, tones=tones, rep=rep, rows=rows, picture=canvas)


# --------------------------------------------------------------------------------------------- the game's data

def base_hexes():
    text = (ROOT / "src" / "game" / "business" / "dessertGallery.ts").read_text(encoding="utf-8")
    block = text[text.index("export const RUN_PALETTE = {") : text.index("...LADDER_TONES")]
    return {h.upper() for h in re.findall(r'"(#[0-9A-Fa-f]{6})"', block)}


def unique_hex(h, used):
    """No two palette names share a colour (dessert-run-qa B): nudge a repeat by one step of blue."""
    r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    while h.upper() in used:
        b = b + 1 if b < 255 else b - 2
        h = "#%02X%02X%02X" % (r, g, b)
    used.add(h.upper())
    return h


def old_blocks():
    """The blocks already in the generated file, so one dessert can be rebuilt without the others."""
    if not OUT_TS.exists():
        return {}
    text = OUT_TS.read_text(encoding="utf-8")
    meta = re.search(r"// data: (\{.*\})\n", text)
    return json.loads(meta.group(1)) if meta else {}


def write_ts(blocks):
    tones, lines = {}, []
    used = base_hexes()
    for id_ in IDS:
        s = blocks[id_]
        groups_ts, rep_ts = [], []
        for gi, g in enumerate(s["tones"]):
            names = []
            for ti, h in enumerate(g):
                key = f"{id_}_{gi}{chr(97 + ti)}"
                tones[key] = unique_hex(h, used)
                names.append(key)
            groups_ts.append("[" + ", ".join(f'"{k}"' for k in names) + "]")
            rep_ts.append(f'"{names[s["rep"][gi]]}"')
        rows_ts = ",\n      ".join(json.dumps(r) for r in s["rows"])
        lines.append(
            f'  {id_}: {{\n    level: {s["level"]},\n    name: {json.dumps(s["name"])},\n    board: "{s["board"]}",\n    groups: [{", ".join(groups_ts)}],\n    reps: [{", ".join(rep_ts)}],\n    rows: [\n      {rows_ts},\n    ],\n  }},'
        )
    meta = {k: {f: blocks[k][f] for f in ("level", "name", "board", "tones", "rep", "rows")} for k in IDS}
    ts = "/** GENERATED by scripts/make-dessert-art.py from docs/planning/reference/dessert-run/ (the developer's reference sheets). Do not edit by hand: change the script and run it again. */\n"
    ts += "// data: " + json.dumps(meta, separators=(",", ":")) + "\n"
    ts += "export const LADDER_TONES = {\n" + "".join(f'  {k}: "{v}",\n' for k, v in tones.items()) + "} as const;\n\n"
    ts += "export type LadderArt = {\n  level: number;\n  name: string;\n  board: string;\n  /** Colour groups (what a waiter fetches), each 1 to 4 flat tones (keys of LADDER_TONES), light to dark. */\n  groups: readonly (readonly (keyof typeof LADDER_TONES)[])[];\n  /** Each group's waiter colour (the tone most of its cubes have). */\n  reps: readonly (keyof typeof LADDER_TONES)[];\n  /** 28 rows of 28 characters: `.` board, `#` a cube of the picture's dark outline, else the index (0-9, a-z) into the groups' tones in order. */\n  rows: readonly string[];\n};\n\n"
    ts += "export const LADDER_ART: Record<string, LadderArt> = {\n" + "\n".join(lines) + "\n};\n"
    OUT_TS.write_text(ts, encoding="utf-8")


def preview(made, path):
    """A sheet: the reference's own plate beside the picture on its board (as the game shows it)."""
    tiles = []
    for s in made:
        n = s["level"]
        name, cx, cy, r = PLATES[n - 1]
        half = r * 1.08
        ref = Image.fromarray(sheet(name).astype(np.uint8)).crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((GRID * CUBE, GRID * CUBE), Image.LANCZOS)
        S = GRID * CUBE
        mine = Image.new("RGB", (S, S), (58, 44, 38))
        d = ImageDraw.Draw(mine)
        tones = BOARDS[s["board"]]
        for y in range(GRID):
            for x in range(GRID):
                if in_well(x, y):
                    d.rectangle([x * CUBE, y * CUBE, x * CUBE + CUBE - 1, y * CUBE + CUBE - 1], fill=tones[((x >> 1) + (y >> 1)) % 2])
        mine.paste(s["picture"], (0, 0), s["picture"])
        t = Image.new("RGB", (S * 2 + 8, S + 20), (36, 28, 24))
        ImageDraw.Draw(t).text((4, 4), f"L{n} {s['name']}  [{len(s['tones'])} colours, {s['board']}]", fill=(255, 255, 255))
        t.paste(ref, (0, 20))
        t.paste(mine, (S + 8, 20))
        tiles.append(t)
    cols = 2
    rows = (len(tiles) + cols - 1) // cols
    w, h = tiles[0].size
    out = Image.new("RGB", (cols * (w + 12), rows * (h + 10)), (20, 16, 14))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * (w + 12), (i // cols) * (h + 10)))
    out.resize((out.width * 3 // 4, out.height * 3 // 4), Image.LANCZOS).save(path)


def main():
    args = sys.argv[1:]
    sheet_path = None
    if "--sheet" in args:
        i = args.index("--sheet")
        sheet_path = args[i + 1]
        del args[i : i + 2]
    ids = ids_from(args) if args else IDS
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    blocks = old_blocks()
    made = []
    for id_ in ids:
        s = make(id_)
        s["picture"].save(OUT_IMG / f"{id_}.webp", "WEBP", quality=86, alpha_quality=92, method=6)
        blocks[id_] = {k: v for k, v in s.items() if k != "picture"}
        made.append(s)
    missing = [i for i in IDS if i not in blocks]
    if missing:
        print("not yet built:", ", ".join(missing))
    else:
        write_ts(blocks)
    total = sum(p.stat().st_size for p in OUT_IMG.glob("*.webp"))
    print(f"built {len(ids)} desserts; {len(list(OUT_IMG.glob('*.webp')))} pictures, {total // 1024} KB")
    if sheet_path:
        preview(made, sheet_path)
        print("sheet", sheet_path)


if __name__ == "__main__":
    main()
