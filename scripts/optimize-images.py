"""
Shrinks the game's WebP pictures (public/ and src/assets/) without visible loss (developer 2026-11-18: "reduce all the game assets size to the
maximum, without ruining the quality").

    python scripts/optimize-images.py            # dry run: prints what would be saved, writes nothing
    python scripts/optimize-images.py --apply    # rewrites the files that shrink

How: for every file it re-encodes at lower lossy WebP quality (method 6) and keeps the SMALLEST result that is still visually the same picture:
  - SSIM of the colour (over mid-grey, so a transparent edge counts) against the file as it is now must stay >= MIN_SSIM,
  - the worst 1 % of the picture (edges, text, faces) must stay >= MIN_WORST,
  - for a cut-out, the alpha channel's own SSIM must stay >= MIN_ALPHA and no pixel's alpha may move by more than MAX_ALPHA_STEP.
A file that does not shrink by at least MIN_GAIN stays exactly as it is. Nothing is ever resized or made lossless-to-lossy by hand: dimensions are
the build scripts' business (scripts/make-*.py); this only picks the cheapest quality for the pixels that are already there.
The result is deterministic, so a second run finds nothing more to save.
"""

import io
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

cv2.setNumThreads(1)  # one thread per worker process: the pool already uses every core

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = [ROOT / "public", ROOT / "src" / "assets"]

MIN_SSIM = 0.990
MIN_WORST = 0.950
MIN_ALPHA = 0.995
MAX_ALPHA_STEP = 40
MIN_GAIN = 0.04  # keep a file only if it gets at least 4 % smaller
MIN_BYTES = 600  # ...and at least this many bytes


def ssim_map(a, b):
    """Mean-SSIM map of two float32 images (H, W) or (H, W, C), Gaussian 11x11 window, range 0..255."""
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    blur = lambda x: cv2.GaussianBlur(x, (11, 11), 1.5)
    mu_a, mu_b = blur(a), blur(b)
    var_a = blur(a * a) - mu_a * mu_a
    var_b = blur(b * b) - mu_b * mu_b
    cov = blur(a * b) - mu_a * mu_b
    m = ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a**2 + mu_b**2 + c1) * (var_a + var_b + c2))
    return m.mean(axis=2) if m.ndim == 3 else m


def encode(im, quality, alpha_quality, method=4):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=method, alpha_quality=alpha_quality)
    return buf.getvalue()


def flat(rgba):
    """Colour over mid-grey as float32 (so what shows through a soft edge is judged too)."""
    f = rgba.astype(np.float32)
    a = f[..., 3:4] / 255.0
    return f[..., :3] * a + 128.0 * (1.0 - a)


def judge(ref_flat, ref_alpha, data, has_alpha):
    got = np.asarray(Image.open(io.BytesIO(data)).convert("RGBA"))
    g = flat(got)
    m = ssim_map(ref_flat, g)
    ok = float(m.mean()) >= MIN_SSIM and float(np.percentile(m, 1)) >= MIN_WORST
    if ok and has_alpha:
        ga = got[..., 3].astype(np.float32)
        ok = (
            float(ssim_map(ref_alpha, ga).mean()) >= MIN_ALPHA
            and float(np.abs(ref_alpha - ga).max()) <= MAX_ALPHA_STEP
        )
    return ok


def best_for(path_str):
    path = Path(path_str)
    raw = path.read_bytes()
    im = Image.open(io.BytesIO(raw))
    im.load()
    rgba = np.asarray(im.convert("RGBA"))
    alpha = rgba[..., 3]
    has_alpha = bool((alpha < 255).any())
    ref_flat = flat(rgba)
    ref_alpha = alpha.astype(np.float32)
    src = im.convert("RGBA") if has_alpha else im.convert("RGB")

    best = (len(raw), None, None)
    for aq in ([100, 80, 60] if has_alpha else [100]):
        lo, hi, found = 40, 94, None
        while lo <= hi:  # the smallest quality that still passes; the search uses the fast method 4 (size only falls as quality falls)
            q = (lo + hi) // 2
            data = encode(src, q, aq)
            if judge(ref_flat, ref_alpha, data, has_alpha):
                found = q
                hi = q - 1
            else:
                lo = q + 1
        if found is None:
            if aq < 100:
                break  # a softer alpha already fails at every colour quality: the coarser ones will too
            continue
        # the real encode (method 6, a little smaller at the same quality), checked again; up a step at a time if it somehow fails
        # (with a lossless alpha, method 6 takes ~10 s a picture for a few percent, so those keep the method-4 result that was already checked)
        for q in range(found, min(found + 8, 95)):
            data = encode(src, q, aq, method=6 if aq < 100 else 4)
            if judge(ref_flat, ref_alpha, data, has_alpha):
                if len(data) < best[0]:
                    best = (len(data), (q, aq), data)
                break
    size, settings, data = best
    gain = 1 - size / len(raw)
    if data is None or gain < MIN_GAIN or len(raw) - size < MIN_BYTES:
        return (path_str, len(raw), len(raw), None, None)
    return (path_str, len(raw), size, settings, data)


def safe_best_for(path_str):
    try:
        return best_for(path_str)
    except Exception as error:  # one odd file must never stop the run: it is left as it is
        size = Path(path_str).stat().st_size
        print(f"  skipped {path_str}: {error}", flush=True)
        return (path_str, size, size, None, None)


def main():
    apply = "--apply" in sys.argv
    files = sorted(str(p) for f in FOLDERS for p in f.rglob("*.webp"))
    before = after = changed = 0
    rows = []
    done = 0
    with ProcessPoolExecutor() as ex:
        for path, old, new, settings, data in ex.map(safe_best_for, files, chunksize=2):
            done += 1
            if done % 50 == 0:
                print(f"  ...{done}/{len(files)}", flush=True)
            before += old
            after += new
            if data is not None:
                changed += 1
                rows.append((old - new, path, old, new, settings))
                if apply:
                    Path(path).write_bytes(data)
    rows.sort(reverse=True)
    for saved, path, old, new, settings in rows[:25]:
        print(f"{saved / 1024:7.1f} KB saved  {old / 1024:7.1f} -> {new / 1024:7.1f} KB  q={settings[0]} a={settings[1]}  {Path(path).relative_to(ROOT)}")
    print(
        f"\n{len(files)} files, {changed} {'rewritten' if apply else 'would shrink'}: "
        f"{before / 1e6:.2f} MB -> {after / 1e6:.2f} MB  (saves {(before - after) / 1e6:.2f} MB, {100 * (before - after) / before:.1f} %)"
    )
    if not apply:
        print("dry run: nothing written (use --apply)")


if __name__ == "__main__":
    main()
