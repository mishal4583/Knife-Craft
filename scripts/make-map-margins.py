#!/usr/bin/env python
"""
MAP MARGINS (developer 2026-11-24: "the both sides of the restaurant map are not filled in properly, why is the garden extended: fill it properly in all 6 kitchen maps").

The wide maps are 16:9 pictures (1920 x 1080). A window that is not 16:9 has margins beside (or above and below) the picture. They used to be made by repeating a thin MIRRORED strip of the
picture's edge (MapEdgeFill), which showed as a kaleidoscope and even copied pieces of the building wall. This script paints the margins ONCE, offline, as new garden:

  * it is TEXTURE SYNTHESIS (patch quilting) from the picture's own OUTDOOR material only (patches made wholly of leaves, flowers and cobbles, found anywhere in the picture; never wall, wood,
    lamp light or the inside of a room), so the colours, the flowers, the cobbles and the lighting are the picture's own;
  * every new patch is chosen to continue what is already there (lowest difference over its overlap) and is used sparingly, so nothing repeats in a visible pattern;
  * the picture itself is never changed: only the ring around it is made.

It writes, per map, four small pictures beside the maps: public/landscape-art/true/margins/<name>-{left,right,top,bottom}.webp. MapEdgeFill draws them around the stage.
  left / right : MX wide, 1080 tall          top / bottom : (1920 + 2 * MX) wide, MY tall   (they include the corners)
Deterministic (a fixed seed): running it again gives the same pictures.

    python scripts/make-map-margins.py                 all seven maps (the six kitchens and the Second Floor)
    python scripts/make-map-margins.py grand           one map
    python scripts/make-map-margins.py grand --preview  also writes a preview sheet to the scratch folder given by --out
"""
import sys, os, argparse
import numpy as np
import cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "landscape-art", "true")
OUT = os.path.join(SRC, "margins")
NAMES = ["humble", "growing", "established", "neighborhood-cafe", "flourishing-cafe", "grand", "second-floor"]
W0, H0 = 1920, 1080
MX, MY = 360, 220  # margin sizes in picture pixels: covers windows from about 1.26:1 to 2.44:1
P, OV = 28, 8  # patch size and overlap
LUSH_D, LUSH_W = 34.0, 14000.0  # the hedge-and-flower border is kept this far from the picture (source px), and how strongly


def outdoor_mask(img):
    """Pixels that are plainly OUTDOOR material: leaves, flowers, cobbles. Never wall, wood, lamp light or anything inside a room."""
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0].astype(np.int32), hsv[..., 1].astype(np.int32), hsv[..., 2].astype(np.int32)
    leaves = (h >= 24) & (h <= 90) & (s >= 55) & (v >= 50)
    flowers = (h >= 150) & (s >= 70) & (v >= 100)  # pinks and magentas
    stone = (((h <= 20) | (h >= 172) | (s <= 45)) & (s >= 12) & (s <= 128) & (v >= 110) & (v <= 225))  # cobbles, pink-beige or grey (wall and wood are far more saturated)
    white = (s <= 60) & (v > 190)  # white blossom
    return leaves | flowers | stone | white


GW, TOPB, BOTB = 40, 30, 46  # the outdoor bands searched: the side strips, the hedge row above the building, the courtyard row below it


def candidates(img, rng, limit=22000):
    """P x P patches of outdoor material, taken only from the outdoor bands (side strips, top hedge row, bottom courtyard row) and only where they are made of leaves, flowers and cobbles:
    a patch with any wall, wood, lamp or room in it is dropped. Flattened to float32 with their saturation (how lush they are)."""
    H, W = img.shape[:2]
    mask = outdoor_mask(img).astype(np.float32)
    integral = cv2.integral(mask)
    band = np.zeros((H, W), bool)
    band[:, :GW] = True
    band[:, W - GW :] = True
    band[:TOPB, :] = True
    band[H - BOTB :, :] = True
    band[H - BOTB :, 760:1160] = False  # the entrance
    stride = 2
    ys, xs = np.meshgrid(np.arange(0, H - P + 1, stride), np.arange(0, W - P + 1, stride), indexing="ij")
    ys, xs = ys.ravel(), xs.ravel()
    cover = (integral[ys + P, xs + P] - integral[ys, xs + P] - integral[ys + P, xs] + integral[ys, xs]) / float(P * P)
    inband = band[ys, xs] & band[ys + P - 1, xs + P - 1] & band[ys, xs + P - 1] & band[ys + P - 1, xs]
    keep = (cover >= 0.93) & inband
    ys, xs = ys[keep], xs[keep]
    if len(ys) > limit:
        pick = rng.choice(len(ys), limit, replace=False)
        ys, xs = ys[pick], xs[pick]
    pos = np.stack([ys, xs], axis=1).astype(np.int32)
    if len(pos) == 0:
        return pos, np.zeros((0, P * P * 3), np.float32), np.zeros(0, np.float32)
    stack = np.stack([img[y : y + P, x : x + P] for y, x in pos]).astype(np.float32)
    mx, mn = stack.max(axis=3), stack.min(axis=3)
    sat = ((mx - mn) / np.maximum(mx, 1.0)).mean(axis=(1, 2))
    return pos, stack.reshape(len(pos), -1), sat.astype(np.float32)


def extend(canvas, known, fixed, cands, dist_to_picture, rng, order):
    """Grows `canvas` over the unknown pixels of `region` (y0, y1, x0, x1) tile by tile; `known` and `fixed` are updated. `order` lists tile corners (y, x)."""
    pos, C, sat = cands
    C2 = C * C
    sat_ref = float(np.percentile(sat, 70))
    sat_cobble = float(np.percentile(sat, 25))
    used = np.zeros(len(C), dtype=np.float32)
    for ty, tx in order:
        win_k = known[ty : ty + P, tx : tx + P]
        if win_k.all():
            continue
        t = canvas[ty : ty + P, tx : tx + P].astype(np.float32)
        m = np.repeat(win_k.astype(np.float32)[:, :, None], 3, axis=2).reshape(-1)
        tf = t.reshape(-1)
        n_known = float(m.sum())
        if n_known == 0:
            idx = int(rng.integers(len(C)))
        else:
            # masked SSD of every candidate against what is already known in this window
            err = C2 @ m - 2.0 * (C @ (m * tf)) + float((m * tf * tf).sum())
            # near the picture the garden stays lush (the picture's own edge is flowers and hedge), farther out it may thin to cobbles
            d = dist_to_picture(ty + P / 2, tx + P / 2)
            lush = max(0.0, 1.0 - d / LUSH_D)
            far = min(1.0, max(0.0, (d - LUSH_D) / 40.0))  # beyond the border the ground is cobbles: no stray flowers
            err = (
                err / n_known
                + used * 40.0  # a candidate already used is dearer: nothing repeats
                + lush * LUSH_W * np.maximum(0.0, sat_ref - sat)
                + far * LUSH_W * np.maximum(0.0, sat - sat_cobble)
            )
            k = 12
            best = np.argpartition(err, k)[:k]
            lo = err[best].min()
            ok = best[err[best] <= lo * 1.18 + 4.0]
            idx = int(rng.choice(ok))
        used[idx] += 1.0
        patch = C[idx].reshape(P, P, 3)
        # blend: pixels not yet known take the patch; known SYNTHESISED pixels near the unknown take a ramp of it (never the original picture)
        dist = cv2.distanceTransform(win_k.astype(np.uint8), cv2.DIST_L2, 3)  # for known pixels: distance to the nearest unknown pixel
        ramp = np.clip(1.0 - dist / float(OV), 0.0, 1.0)
        ramp[~win_k] = 1.0
        ramp[fixed[ty : ty + P, tx : tx + P]] = 0.0
        ramp = (ramp * ramp * (3 - 2 * ramp))[:, :, None]
        canvas[ty : ty + P, tx : tx + P] = (t * (1.0 - ramp) + patch * ramp).astype(np.float32)
        known[ty : ty + P, tx : tx + P] = True


def synth_margin(img, cands, side, rng):
    """The left (or, mirrored, the right) margin: MX columns beside the picture, rows 0..H0."""
    H, W = img.shape[:2]
    src = img if side == "left" else img[:, ::-1]
    canvas = np.zeros((H, MX + W, 3), np.float32)
    canvas[:, MX:] = src
    known = np.zeros((H, MX + W), bool)
    known[:, MX:] = True
    fixed = known.copy()
    step = P - OV
    order = []
    xs = list(range(MX - step, -step, -step))  # growing leftwards
    xs = [max(0, x) for x in xs]
    for x in xs:
        for y in list(range(0, H - P + 1, step)) + [H - P]:
            order.append((y, x))
    # the tiles of one column are done top to bottom, the next column to its left after: keep that order
    # distance of a tile centre (canvas coords: the picture starts at x = MX) from the picture's rectangle
    extend(canvas, known, fixed, cands, lambda y, x: max(0.0, MX - x), rng, order)
    out = canvas[:, :MX]
    return out if side == "left" else out[:, ::-1]


def synth_band(ring, cands, direction, rng):
    """The top (or bottom) margin: (W0 + 2 MX) wide, MY tall, growing away from the picture; `ring` is the picture with its left and right margins attached."""
    H, W = ring.shape[:2]
    src = ring if direction == "top" else ring[::-1]
    canvas = np.zeros((MY + H, W, 3), np.float32)
    canvas[MY:] = src
    known = np.zeros((MY + H, W), bool)
    known[MY:] = True
    fixed = np.zeros_like(known)
    fixed[MY:, MX : W - MX] = True  # the picture itself is fixed; the margins already made may be blended
    step = P - OV
    order = []
    ys = [max(0, y) for y in range(MY - step, -step, -step)]
    xs = list(range(0, W - P + 1, step)) + [W - P]
    for y in ys:
        for x in xs:
            order.append((y, x))
    # the picture's rectangle inside the ring canvas: rows MY.. MY+H0, columns MX.. W-MX
    def dist(y, x):
        dy = max(0.0, MY - y)
        dx = max(0.0, MX - x, x - (W - MX))
        return float(np.hypot(dx, dy))

    extend(canvas, known, fixed, cands, dist, rng, order)
    out = canvas[:MY]
    return out if direction == "top" else out[::-1]


def crisp(arr):
    """The blending between patches softens the cobbles a little: a light unsharp mask brings back the picture's own crispness (the margins only; the picture is never touched)."""
    blur = cv2.GaussianBlur(arr, (0, 0), 1.1)
    return np.clip(arr + 0.75 * (arr - blur), 0, 255)


def save(arr, name):
    os.makedirs(OUT, exist_ok=True)
    arr = crisp(arr.astype(np.float32))
    Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=76, method=6)


def make(name, preview_dir=None):
    fname = "second-floor.webp" if name == "second-floor" else f"map-{name}.webp"
    img = np.array(Image.open(os.path.join(SRC, fname)).convert("RGB"))
    assert img.shape[:2] == (H0, W0), img.shape
    rng = np.random.default_rng(abs(hash(name)) % (2**32) if False else sum(map(ord, name)) * 7919)
    global P, OV
    # the largest patch size that still finds enough clean outdoor material in this picture (some have only a thin hedge row to sample)
    for size in (28, 24, 20, 16):
        P, OV = size, max(5, round(size * 0.3))
        cands = candidates(img, rng)
        if len(cands[0]) >= 250:
            break
    print(f"{name}: {len(cands[0])} outdoor patches of {P}px", flush=True)
    left = synth_margin(img, cands, "left", rng)
    right = synth_margin(img, cands, "right", rng)
    ring = np.concatenate([left, img.astype(np.float32), right], axis=1)
    top = synth_band(ring, cands, "top", rng)
    bottom = synth_band(ring, cands, "bottom", rng)
    save(left, f"{name}-left.webp")
    save(right, f"{name}-right.webp")
    save(top, f"{name}-top.webp")
    save(bottom, f"{name}-bottom.webp")
    if preview_dir:
        full = np.zeros((MY + H0 + MY, MX + W0 + MX, 3), np.float32)
        full[:MY] = top
        full[MY + H0 :] = bottom
        full[MY : MY + H0] = ring
        Image.fromarray(np.clip(full + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(preview_dir, f"{name}-full.png"))
    sizes = {s: os.path.getsize(os.path.join(OUT, f"{name}-{s}.webp")) // 1024 for s in ("left", "right", "top", "bottom")}
    print(f"{name}: written {sizes} KB", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--out", default=os.path.join(ROOT, "tools", "e2e", "out"))
    a = ap.parse_args()
    for n in a.names or NAMES:
        make(n, a.out if a.preview else None)
