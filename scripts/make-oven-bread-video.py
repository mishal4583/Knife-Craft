"""
Builds the oven step's bread film (src/assets/video/oven-bread.{mp4,webm} + poster) from the developer's source clip Bread.mp4 (root, 720x1280,
10 s, AI-generated). Run: python scripts/make-oven-bread-video.py   (needs ffmpeg on the PATH)

What it does (developer 2026-11-03: "show the bread baking: raw at first, gradually cooking, then perfect golden brown, at the end burnt; reduce the
size and the length, take only the important frames, cover the AI logo, no skip button"):
  - crops the source to 720x900 starting at y=160: the sparkle logo (bottom-right, y ~ 1140-1185) falls OUTSIDE the crop, so it is gone, not hidden;
  - keeps source 1.0-4.0 s (the bread carried to the oven and the camera pushing in) at 2x speed = 1.5 s: the "placing" part of the oven step;
  - keeps source 4.95-10.0 s (the close-up in front of the fire, after the source's own dissolve between two takes) stretched to 6.5 s: the baking part;
  - the source bread only ever reaches a light crust, so the bake part is colour-graded over time INSIDE an ellipse around the loaf only (flames stay
    untouched): pale and raw at the start, golden at 60-68 % (the golden window of ovenStep.ts), deep brown, then burnt (darker, smoky) at the end;
  - scales to 360x450, drops the audio, writes MP4 (H.264) and WebM (VP9) and a poster frame.
The timings here mirror OVEN.PLACE_MS (1500) and OVEN.BAKE_MS (6500) in src/game/cooking/ovenStep.ts.
"""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Bread.mp4")
OUT = os.path.join(ROOT, "src", "assets", "video")
INTRO_S = 1.5
BAKE_S = 6.5
# The source dissolves between two takes of the loaf at 4.5-4.9 s (a ghost, two loaves): the bake starts after it, at the second take.
BAKE_FROM = 4.95

# Grading keyframes over the bake (p = 0..1): (p, brightness, saturation, contrast, gamma_r, gamma_g, gamma_b).
# ffmpeg's eq gamma brightens a channel when it is above 1 (out = in ** (1 / gamma)), so a golden-brown look LOWERS gamma_g and gamma_b.
KEYS = [
    (0.00, 0.07, 0.62, 0.95, 1.00, 1.00, 1.06),  # raw, pale dough
    (0.35, 0.03, 0.88, 1.00, 1.00, 0.97, 0.90),  # warming up
    (0.60, 0.00, 1.10, 1.05, 1.02, 0.90, 0.74),  # golden window starts
    (0.68, -0.02, 1.15, 1.08, 1.02, 0.86, 0.66),  # golden window ends (the perfect brown)
    (0.82, -0.10, 0.95, 1.10, 0.92, 0.78, 0.62),  # deep brown
    (1.00, -0.28, 0.40, 1.20, 0.78, 0.68, 0.60),  # burnt: charcoal brown
]


def lerp_expr(idx: int) -> str:
    """Piecewise-linear ffmpeg expression of the keyframe column `idx` over p = t / BAKE_S."""
    p = f"(t/{BAKE_S})"
    parts = []
    for (a, b) in zip(KEYS, KEYS[1:]):
        p0, v0, v1, p1 = a[0], a[idx], b[idx], b[0]
        parts.append((p1, f"({v0}+({v1}-({v0}))*({p}-{p0})/({p1}-{p0}))"))
    expr = f"{KEYS[-1][idx]}"
    for p1, seg in reversed(parts):
        expr = f"if(lt({p},{p1}),{seg},{expr})"
    return expr


def filter_graph() -> str:
    eq = (
        f"eq=brightness='{lerp_expr(1)}':saturation='{lerp_expr(2)}':contrast='{lerp_expr(3)}'"
        f":gamma_r='{lerp_expr(4)}':gamma_g='{lerp_expr(5)}':gamma_b='{lerp_expr(6)}':eval=frame"
    )
    # An ellipse around the loaf (crop coordinates), soft at the edge: 1 inside, 0 outside.
    mask = (
        "color=c=black:s=720x900:r=24,format=gray,"
        "geq=lum='255*clip((1.10-hypot((X-372)/372,(Y-655)/215))/0.20,0,1)',format=gbrp"
    )
    return (
        f"[0:v]split=2[ia][ib];"
        # the way in
        f"[ia]trim=1.0:4.0,setpts=(PTS-STARTPTS)/2,crop=720:900:0:160,fps=24,format=gbrp[intro];"
        # the bake: stretched, then graded inside the mask only
        f"[ib]trim={BAKE_FROM}:10.0,setpts=(PTS-STARTPTS)*{BAKE_S / (10.0 - BAKE_FROM)},crop=720:900:0:160,fps=24,format=gbrp,split=2[base][tograde];"
        f"[tograde]{eq}[graded];"
        f"{mask}[mask];"
        f"[base][graded][mask]maskedmerge,tpad=stop_mode=clone:stop_duration=0.5,trim=0:{BAKE_S}[bake];"
        f"[intro][bake]concat=n=2:v=1:a=0,scale=360:450:flags=lanczos,format=yuv420p[out]"
    )


def run(cmd):
    print(" ".join(cmd[:6]), "...")
    subprocess.run(cmd, check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    graph = os.path.join(os.environ.get("TEMP", "/tmp"), "oven-bread-filter.txt")
    with open(graph, "w", encoding="utf-8") as f:
        f.write(filter_graph())
    base = ["ffmpeg", "-v", "error", "-y", "-i", SRC, "-filter_complex_script", graph, "-map", "[out]", "-an"]
    run(base + ["-c:v", "libx264", "-preset", "veryslow", "-crf", "30", "-movflags", "+faststart", "-pix_fmt", "yuv420p", os.path.join(OUT, "oven-bread.mp4")])
    run(base + ["-c:v", "libvpx-vp9", "-crf", "46", "-b:v", "0", "-row-mt", "1", os.path.join(OUT, "oven-bread.webm")])
    run(
        ["ffmpeg", "-v", "error", "-y", "-i", os.path.join(OUT, "oven-bread.mp4"), "-ss", "0.2", "-frames:v", "1", "-c:v", "libwebp", "-quality", "70",
         os.path.join(OUT, "oven-bread-poster.webp")]
    )
    for n in ("oven-bread.mp4", "oven-bread.webm", "oven-bread-poster.webp"):
        print(n, os.path.getsize(os.path.join(OUT, n)), "bytes")


if __name__ == "__main__":
    sys.exit(main())
