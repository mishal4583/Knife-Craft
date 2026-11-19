"""
Downloads the RECORDED AUDIO the game ships (developer 2026-11-19, Playgama 3.3.2: sound must be recorded or made with audio tools and shipped as
compressed files, never synthesized in code). Every source is CC0 (public domain dedication): no attribution is required, and the lines are still kept
in docs/AUDIO-CREDITS.md. The raw files go to scripts/.audio-src/ (git-ignored); scripts/make-audio-assets.py turns them into public/audio/*.mp3.

    python scripts/fetch-audio-sources.py
"""

import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / ".audio-src"
OGA = "https://opengameart.org/sites/default/files/"
GH = "https://github.com/Calinou/{}/archive/refs/heads/master.zip"

# (folder, file name, url, what it is, licence page)
FILES = [
    ("music", "morning_sky.ogg", OGA + "morning_2d.2_0.ogg", "Morning Sky, Centurion_of_war", "https://opengameart.org/node/179462"),
    ("music", "etirwer.ogg", OGA + "Etirwer%20%28Looped%29_0.ogg", "Etirwer (looped), Kistol", "https://opengameart.org/content/etirwer"),
    ("music", "jrpg_piano.mp3", OGA + "JRPG%20Piano.mp3", "JRPG Piano, Joth", "https://opengameart.org/content/jrpg-piano"),
    ("music", "sunset_plains.wav", OGA + "sunset_plains.wav", "Sunset Plains, Yoiyami", "https://opengameart.org/node/182253"),
    ("foley", "cut_pumpkin_01.ogg", OGA + "cut_pumpkin_01.ogg", "cut & peel a pumpkin (cuts)", "https://opengameart.org/content/cut-peel-a-pumpkin"),
    ("foley", "cut_pumpkin_02.ogg", OGA + "cut_pumpkin_02.ogg", "cut & peel a pumpkin (cuts)", "https://opengameart.org/content/cut-peel-a-pumpkin"),
    ("foley", "cut_pumpkin_03.ogg", OGA + "cut_pumpkin_03.ogg", "cut & peel a pumpkin (cuts)", "https://opengameart.org/content/cut-peel-a-pumpkin"),
    *[
        ("foley", f"peel_pumpkin_0{i}.ogg", OGA + f"peel_pumpkin_0{i}.ogg", "cut & peel a pumpkin (peels)", "https://opengameart.org/content/cut-peel-a-pumpkin")
        for i in range(1, 6)
    ],
    ("foley", "bicycle-horn-1.wav", OGA + "bicycle-horn-1.wav", "Bicycle Horn", "https://opengameart.org/content/bicycle-horn"),
]
ZIPS = [
    ("rpg", "rpg_sound_pack.zip", OGA + "rpg_sound_pack.zip", "RPG Sound Pack, artisticdude", "https://opengameart.org/content/rpg-sound-pack"),
    ("water", "ezwa-water_splash.7z", OGA + "ezwa-water_splash.7z", "6 Short water splashes, ezwa", "https://opengameart.org/content/6-short-water-splashes"),
    ("kif", "kenney-interface-sounds.zip", GH.format("kenney-interface-sounds"), "Interface Sounds 1.0, Kenney", "https://kenney.nl/assets/interface-sounds"),
]


def get(url: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print("fetch", url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())


for folder, name, url, _what, _page in FILES:
    get(url, SRC / folder / name)
for folder, name, url, _what, _page in ZIPS:
    dest = SRC / name
    get(url, dest)
    out = SRC / folder
    if not out.exists() or not any(out.iterdir()):
        out.mkdir(parents=True, exist_ok=True)
        if name.endswith(".7z"):
            import py7zr  # pip install py7zr

            py7zr.SevenZipFile(dest).extractall(out)
        else:
            zipfile.ZipFile(dest).extractall(out)
print("sources ready in", SRC)
