"""
Builds the LANDSCAPE cooking films (src/assets/video/chef-<kind>-wide.{mp4,webm} + chef-<kind>-wide-poster.webp) from the clips the developer generated with Gemini
(developer 2026-11-21: the portrait films look wrong in a landscape window). Run: python scripts/make-wide-cooking-videos.py   (needs ffmpeg on the PATH; Pillow not needed)

Sources (git-ignored, in the developer's hand-off folder): Cooking Video Landscape/<NN-name>/generated/<NN-name>_landscape.mp4, 1280 x 720, 24 fps, with sound.
Each source gets: the part we keep (and a speed-up when the generated clip is longer than the film should be), the Gemini sparkle watermark painted out (`delogo`, bottom
right, about x 1160 y 595 of the 1280 x 720 frame), NO downscale (developer 2026-11-22: "the chefs cooking videos quality is very low": the first build scaled to 1024 x 576 at CRF 29 / 36, about 0.6 Mbps, and
looked soft and blocky; now the source's own 1280 x 720 at CRF 21 / 28, about 2 Mbps), MP4 (H.264 + AAC) and WebM (VP9 + Opus), and a poster frame.
A kind with no file yet is skipped: the game keeps playing its portrait film for it (CookingClip.tsx WIDE_CLIPS).
Env: WIDE_SRC (the hand-off folder), WIDE_OUT (the output folder): for tests.
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("WIDE_SRC", os.path.join(ROOT, "Cooking Video Landscape"))
OUT = os.environ.get("WIDE_OUT", os.path.join(ROOT, "src", "assets", "video"))
W, H = 1280, 720
# The sparkle: centre about (1160, 595) in the 1280 x 720 frame, about 50 px wide: a 64 px box round it.
DELOGO = "delogo=x=1128:y=563:w=64:h=64"

# kind -> (hand-off sub-folder / file stem, keep from (s), keep for (s), speed). The fruit clip came out 10 s long; the film should be about 4 s: its last 6.3 s (the mint
# on the glass, then the honey) at 1.5x = 4.2 s. The salad clip is 3.0 s and stays whole. The curry clip is 10 s: from 2.0 s (the stir, then the chef pulling back over the
# pot) at 1.5x = 5.3 s. The bread clip (5.8 s) and the cooking clip (3.9 s) stay whole. The plating clip is 13.8 s (tomatoes, the chef, the plate, the herbs, the finished plate):
# its last 7.3 s (the plate arriving, the herbs, the finished plate) at 1.4x = 5.2 s. The game never waits longer than 7 s (CookingClip MAX_PLAY_MS).
KINDS = {
    "fruit": ("01-chef-fruit", 3.6, 6.3, 1.5),
    "salad": ("02-chef-salad", 0.0, 3.0, 1.0),
    "curry": ("03-chef-curry", 2.0, 8.0, 1.5),
    "bread": ("04-chef-bread", 0.0, None, 1.0),
    "cooked": ("05-chef-cooking", 0.0, None, 1.0),
    "plated": ("06-chef-plating", 6.5, 7.3, 1.4),
}
FILE_OF = {"fruit": "chef-fruit", "salad": "chef-salad", "curry": "chef-curry", "bread": "chef-bread", "cooked": "chef-cooking", "plated": "chef-plating"}


def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:])
        sys.exit(1)


made = []
skipped = []
os.makedirs(OUT, exist_ok=True)
for kind, (folder, start, length, speed) in KINDS.items():
    src = os.path.join(SRC, folder, "generated", f"{folder}_landscape.mp4")
    if not os.path.exists(src):
        skipped.append(kind)
        continue
    stem = os.path.join(OUT, f"{FILE_OF[kind]}-wide")
    seek = ["-ss", str(start)] + (["-t", str(length)] if length else [])
    vf = f"{DELOGO},setpts=PTS/{speed},format=yuv420p"
    af = f"atempo={speed}" if speed != 1.0 else "anull"
    run(["ffmpeg", "-v", "error", "-y", *seek, "-i", src, "-vf", vf, "-af", af, "-c:v", "libx264", "-crf", "21", "-preset", "slow",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", stem + ".mp4"])
    run(["ffmpeg", "-v", "error", "-y", *seek, "-i", src, "-vf", vf, "-af", af, "-c:v", "libvpx-vp9", "-crf", "28", "-b:v", "0", "-row-mt", "1",
         "-c:a", "libopus", "-b:a", "64k", stem + ".webm"])
    run(["ffmpeg", "-v", "error", "-y", *seek, "-i", src, "-vf", vf, "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", stem + "-poster.webp"])
    sizes = [os.path.getsize(stem + e) // 1024 for e in (".mp4", ".webm", "-poster.webp")]
    made.append(f"{kind} (mp4 {sizes[0]} KB, webm {sizes[1]} KB, poster {sizes[2]} KB)")

print("landscape films:", ", ".join(made) or "none", "| not delivered yet:", ", ".join(skipped) or "none")
