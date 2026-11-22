"""
Builds the WIDE loading screen picture (public/loading/wide.webp) from the developer's Codex image (developer 2026-11-22: "use this image as the loading screen").

Source (git-ignored): Landscape Backdrops Assets/loading-screen-landscape-v2.png, 1920 x 1080: the whole scene (chef, title plaque, kitchen) with a baked progress bar
that is part-full (green up to about 65 %) and a "LOADING..." plaque. A baked fill can never show real progress, so the green fill is painted out: every pixel of the
bar's track that is green (plus a 2 px fringe) takes the colour the EMPTY track has on the same row (sampled at the right, unfilled end). The page then draws the
real, growing green fill over that empty track (index.html .bs-wfill, positioned by the numbers below, as shares of the picture).

Output: public/loading/wide.webp (1920 x 1080), and prints the track box as shares for index.html.
Env: LOADING_WIDE_SRC, LOADING_WIDE_OUT: for tests.
Run:  python scripts/make-loading-wide.py   (needs Pillow, numpy)
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("LOADING_WIDE_SRC", os.path.join(ROOT, "Landscape Backdrops Assets", "loading-screen-landscape-v2.png"))
OUT = os.environ.get("LOADING_WIDE_OUT", os.path.join(ROOT, "public", "loading", "wide.webp"))

# The bar's track (inside the gold rim), in source pixels: found by measuring the picture.
TRACK_X0, TRACK_X1 = 537, 1383
TRACK_Y0, TRACK_Y1 = 949, 990
# Where the unfilled (empty) end of the track is, to sample the row colours from.
SAMPLE_X0, SAMPLE_X1 = 1150, 1350

im = Image.open(SRC).convert("RGB")
if im.size != (1920, 1080):
    print("PROBLEM: the source is", im.size, "expected (1920, 1080)")
    sys.exit(1)
a = np.asarray(im).astype(int).copy()

# Everything inside the track from its left end to the end of the baked fill (plus a margin) is fill, its gloss and its shadow: replace it by the empty track's
# colour on the same row (the empty end to the right is a plain vertical gradient). The gold rim lies outside these rows and stays.
FILL_X0, FILL_X1 = 537, 1102
FILL_Y0, FILL_Y1 = 951, 989
RADIUS = (FILL_Y1 - FILL_Y0) / 2
CAP_CX, CAP_CY = FILL_X0 + RADIUS, (FILL_Y0 + FILL_Y1) / 2  # the track's left end is a half circle
painted = 0
for y in range(FILL_Y0, FILL_Y1 + 1):
    ref = a[y, SAMPLE_X0:SAMPLE_X1].mean(axis=0)
    for x in range(FILL_X0, FILL_X1):
        if x < CAP_CX and (x - CAP_CX) ** 2 + (y - CAP_CY) ** 2 > RADIUS**2:
            continue  # outside the rounded left end: the rim's own pixels stay
        a[y, x] = ref
        painted += 1

out = Image.fromarray(a.astype("uint8"))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.save(OUT, "WEBP", quality=80, method=6)
kb = os.path.getsize(OUT) / 1024
print(f"{painted} fill pixels painted out; {os.path.basename(OUT)}: {kb:.0f} KB")
print(
    "track as shares of the picture: left %.2f%% top %.2f%% width %.2f%% height %.2f%%"
    % (TRACK_X0 / 19.2, TRACK_Y0 / 10.8, (TRACK_X1 - TRACK_X0) / 19.2, (TRACK_Y1 - TRACK_Y0) / 10.8)
)
