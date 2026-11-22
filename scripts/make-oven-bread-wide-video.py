"""
Builds the LANDSCAPE oven film (src/assets/video/oven-bread-wide.{mp4,webm} + oven-bread-wide-poster.webp) from the two clips the developer generated with Gemini
(developer 2026-11-23: "take necessary frames from these videos because Gemini is not properly generating it, and integrate the oven game properly").
Run: python scripts/make-oven-bread-wide-video.py   (needs ffmpeg on the PATH, numpy and opencv-python)

Why two clips and not one: Gemini never made the loaf bake. The clip `gemini_generated_video_9c596a30.mp4` keeps the loaf PALE for all 8 s, the clip
`gemini_generated_video_c5eadabb.mp4` has it already DARK from the start. But both were made from the same shot (same camera push-in, same flames, same tray: the
two clips differ only in the loaf, pixel for pixel), so the baking is composed here, the way the portrait film's was (scripts/make-oven-bread-video.py):
  - the PALE clip is the picture; the places where the two clips differ strongly (the loaf; a few thin flame edges) are found per frame, only the largest blob is kept
    (the loaf), filled, grown a little and feathered;
  - inside that mask the DARK clip is mixed in over the bake (`WEIGHT`: pale, then golden at 60-68 % = the golden window of ovenStep.ts, deep brown, then
    burnt, darker and smoky at the end); the flames, the oven and the tray are always the pale clip's, so nothing ghosts;
  - timeline = the oven step's: PLACE_S (1.5 s: the loaf carried in on the peel) then BAKE_S (6.5 s: the close-up in front of the fire, source 2.2-8.0 s slowed a
    little), 8.0 s in all, silent (the oven has no sound), 1280 x 720 (the source is 640 x 360: a Lanczos upscale with a light sharpen, no new detail);
  - Gemini's sparkle (bottom right, about (580, 300) of 640 x 360) is painted out of both clips first (ffmpeg `delogo`).
The timings mirror OVEN.PLACE_MS (1500) and OVEN.BAKE_MS (6500) in src/game/cooking/ovenStep.ts.
Env: OVEN_PALE, OVEN_DARK (the two source files), WIDE_OUT (the output folder), OVEN_DEBUG=<folder> (saves a contact sheet and masks).
"""
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAND = os.path.join(ROOT, "Cooking Video Landscape")
PALE = os.environ.get("OVEN_PALE", os.path.join(HAND, "gemini_generated_video_9c596a30.mp4"))
DARK = os.environ.get("OVEN_DARK", os.path.join(HAND, "gemini_generated_video_c5eadabb.mp4"))
OUT = os.environ.get("WIDE_OUT", os.path.join(ROOT, "src", "assets", "video"))
DEBUG = os.environ.get("OVEN_DEBUG")
FPS = 24
PLACE_S, BAKE_S = 1.5, 6.5
PLACE_FROM = 0.7  # source seconds: the loaf on the peel, going in (1.5 s at normal speed)
BAKE_FROM, BAKE_TO = 2.2, 8.0  # source seconds: the loaf on the tray, the camera pushing in, then the close-up
W, H = 1280, 720
DELOGO = "delogo=x=564:y=284:w=34:h=34"

# Weight of the DARK clip inside the loaf over the bake progress d (0..1); the golden window is 0.60-0.68, burnt from 0.88 (ovenStep.ts).
WEIGHT = [(0.0, 0.0), (0.12, 0.05), (0.40, 0.30), (0.64, 0.58), (0.80, 0.86), (0.88, 1.0), (1.0, 1.0)]
# Extra darkening of the loaf after BURNT_FROM: (d, factor on brightness, factor on saturation)
BURNT = [(0.88, 1.0, 1.0), (1.0, 0.62, 0.7)]


def interp(points, x):
    xs = [p[0] for p in points]
    return [float(np.interp(x, xs, [p[i] for p in points])) for i in range(1, len(points[0]))]


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:])
        sys.exit(1)


def load(path, tmp, name):
    """Decode a source with the sparkle painted out into a list of BGR frames (640 x 360)."""
    clean = os.path.join(tmp, name + ".mkv")
    run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", DELOGO, "-an", "-c:v", "libx264", "-crf", "0", clean])
    cap = cv2.VideoCapture(clean)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    cap.release()
    return frames


def at(frames, t):
    """The frame at source time t (seconds), the two neighbours blended."""
    x = min(max(t * FPS, 0), len(frames) - 1.001)
    i = int(x)
    a = x - i
    if a < 0.02:
        return frames[i].astype(np.float32)
    return frames[i].astype(np.float32) * (1 - a) + frames[i + 1].astype(np.float32) * a


def loaf_mask(p, q):
    """1 inside the loaf: where the two clips differ strongly, the biggest blob only, filled, grown and feathered."""
    d = np.abs(p - q).max(axis=2)
    d = cv2.GaussianBlur(d, (0, 0), 2.0)
    binary = (d > 22).astype(np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if n <= 1:
        return np.zeros(binary.shape, np.float32)
    big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    blob = (lab == big).astype(np.uint8)
    # fill holes
    inv = 255 - blob * 255
    flood = inv.copy()
    cv2.floodFill(flood, np.zeros((blob.shape[0] + 2, blob.shape[1] + 2), np.uint8), (0, 0), 0)
    blob = np.maximum(blob, (flood > 0).astype(np.uint8))
    blob = cv2.dilate(blob, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    return cv2.GaussianBlur(blob.astype(np.float32), (0, 0), 2.2)


def main():
    for f in (PALE, DARK):
        if not os.path.exists(f):
            print("missing source:", f)
            sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    if DEBUG:
        os.makedirs(DEBUG, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        pale = load(PALE, tmp, "pale")
        dark = load(DARK, tmp, "dark")
        n_place, n_bake = round(PLACE_S * FPS), round(BAKE_S * FPS)
        raw = os.path.join(tmp, "film.mkv")
        enc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
             "-c:v", "libx264", "-crf", "0", "-preset", "veryfast", raw],
            stdin=subprocess.PIPE,
        )
        sheet = []

        def emit(img, tag=None):
            big = cv2.resize(np.clip(img, 0, 255).astype(np.uint8), (W, H), interpolation=cv2.INTER_LANCZOS4)
            blur = cv2.GaussianBlur(big, (0, 0), 1.2)
            big = cv2.addWeighted(big, 1.35, blur, -0.35, 0)  # a light unsharp
            enc.stdin.write(big.tobytes())
            if DEBUG and tag is not None:
                sheet.append((tag, big))

        for k in range(n_place):
            emit(at(pale, PLACE_FROM + k / FPS), k if k % 12 == 0 else None)
        for k in range(n_bake):
            d = k / (n_bake - 1)
            t = BAKE_FROM + (BAKE_TO - BAKE_FROM) * d
            p, q = at(pale, t), at(dark, t)
            m = loaf_mask(p, q)[..., None]
            (w,) = interp(WEIGHT, d)
            loaf = p * (1 - w) + q * w
            # the mix of a pale and a dark crust comes out a little grey: warm it toward golden brown around the golden window
            warm = float(smooth(d, 0.25, 0.55) * (1 - smooth(d, 0.80, 0.95)))
            loaf = loaf * np.array([1 - 0.16 * warm, 1 - 0.04 * warm, 1 + 0.04 * warm], np.float32)
            if d > BURNT[0][0]:
                bright, sat = interp(BURNT, d)
                g = cv2.cvtColor(np.clip(loaf, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)[..., None]
                loaf = (g + (loaf - g) * sat) * bright
            emit(p * (1 - m) + loaf * m, n_place + k if k % 26 == 0 or k == n_bake - 1 else None)
            if DEBUG and k % 26 == 0:
                cv2.imwrite(os.path.join(DEBUG, f"mask_{k:03d}.png"), (m[..., 0] * 255).astype(np.uint8))
        enc.stdin.close()
        enc.wait()
        if DEBUG:
            os.makedirs(DEBUG, exist_ok=True)
            tiles = [cv2.resize(img, (480, 270)) for _, img in sheet]
            while len(tiles) % 4:
                tiles.append(np.zeros_like(tiles[0]))
            rows = [np.hstack(tiles[i : i + 4]) for i in range(0, len(tiles), 4)]
            cv2.imwrite(os.path.join(DEBUG, "sheet.png"), np.vstack(rows))
        stem = os.path.join(OUT, "oven-bread-wide")
        run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-vf", "format=yuv420p", "-an", "-c:v", "libx264", "-crf", "24", "-preset", "slow",
             "-movflags", "+faststart", stem + ".mp4"])
        run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-vf", "format=yuv420p", "-an", "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1",
             stem + ".webm"])
        run(["ffmpeg", "-v", "error", "-y", "-ss", "1.6", "-i", raw, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", stem + "-poster.webp"])
    sizes = [os.path.getsize(stem + e) // 1024 for e in (".mp4", ".webm", "-poster.webp")]
    print(f"oven film: mp4 {sizes[0]} KB, webm {sizes[1]} KB, poster {sizes[2]} KB")


if __name__ == "__main__":
    main()
