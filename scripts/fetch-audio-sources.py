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
    # Knife-and-ingredient recordings (developer 2026-11-22: realistic cutting sounds, one family per kind of ingredient): Freesound CC0 uploads, the site's own
    # high-quality preview files (a download needs a login; the preview is the public file), each page read for its CC0 licence on 2026-11-22.
    ("cuts", "163275.mp3", "https://cdn.freesound.org/previews/163/163275_71257-hq.mp3", "Cutting Zucchini, qubodup (Freesound, CC0)", "https://freesound.org/people/qubodup/sounds/163275/"),
    ("cuts", "764468.mp3", "https://cdn.freesound.org/previews/764/764468_15688439-hq.mp3", "Cutting Cucumber, CarikaDarvall (Freesound, CC0)", "https://freesound.org/people/CarikaDarvall/sounds/764468/"),
    ("cuts", "755233.mp3", "https://cdn.freesound.org/previews/755/755233_15607324-hq.mp3", "cutting apple with knife, OutbreakProtocol (Freesound, CC0)", "https://freesound.org/people/OutbreakProtocol/sounds/755233/"),
    ("cuts", "755234.mp3", "https://cdn.freesound.org/previews/755/755234_15607324-hq.mp3", "cutting apple with knife (2), OutbreakProtocol (Freesound, CC0)", "https://freesound.org/people/OutbreakProtocol/sounds/755234/"),
    ("cuts", "87508.mp3", "https://cdn.freesound.org/previews/87/87508_71257-hq.mp3", "Cutting Tomato.flac, qubodup (Freesound, CC0)", "https://freesound.org/people/qubodup/sounds/87508/"),
    ("cuts", "812387.mp3", "https://cdn.freesound.org/previews/812/812387_3755886-hq.mp3", "cutting tomato, frodeims (Freesound, CC0)", "https://freesound.org/people/frodeims/sounds/812387/"),
    ("cuts", "760374.mp3", "https://cdn.freesound.org/previews/760/760374_11666191-hq.mp3", "Chopping Lettuce on a Cutting Board, Colonnades (Freesound, CC0)", "https://freesound.org/people/Colonnades/sounds/760374/"),
    ("cuts", "125521.mp3", "https://cdn.freesound.org/previews/125/125521_2273305-hq.mp3", "chopping-lettuce.wav, krissyeliot (Freesound, CC0)", "https://freesound.org/people/krissyeliot/sounds/125521/"),
    ("cuts", "718595.mp3", "https://cdn.freesound.org/previews/718/718595_11826169-hq.mp3", "Garlic Cut, Single, lexjharold (Freesound, CC0)", "https://freesound.org/people/lexjharold/sounds/718595/"),
    ("cuts", "766124.mp3", "https://cdn.freesound.org/previews/766/766124_16546121-hq.mp3", "FOODCook-Onion Chopping_CRB_OwSfx, Christiaan_Bot00+ (Freesound, CC0)", "https://freesound.org/people/Christiaan_Bot00+/sounds/766124/"),
    ("cuts", "826735.mp3", "https://cdn.freesound.org/previews/826/826735_14170171-hq.mp3", "FOODCook_onion chop two_MPA_FCS2, miguelperezang (Freesound, CC0)", "https://freesound.org/people/miguelperezang/sounds/826735/"),
    ("cuts", "87506.mp3", "https://cdn.freesound.org/previews/87/87506_71257-hq.mp3", "cuttingBread.flac, qubodup (Freesound, CC0)", "https://freesound.org/people/qubodup/sounds/87506/"),
    ("cuts", "487030.mp3", "https://cdn.freesound.org/previews/487/487030_4969501-hq.mp3", "Bread Knife Cutting Sourdough Bread, RobertWedderburn (Freesound, CC0)", "https://freesound.org/people/RobertWedderburn/sounds/487030/"),
    ("cuts", "752214.mp3", "https://cdn.freesound.org/previews/752/752214_71257-hq.mp3", "Cutting Ripe Watermelon, qubodup (Freesound, CC0)", "https://freesound.org/people/qubodup/sounds/752214/"),
    ("cuts", "703058.mp3", "https://cdn.freesound.org/previews/703/703058_9616576-hq.mp3", "Cutting Lemon Or Orange, IENBA (Freesound, CC0)", "https://freesound.org/people/IENBA/sounds/703058/"),
    ("cuts", "828969.mp3", "https://cdn.freesound.org/previews/828/828969_14003208-hq.mp3", "A real chef cuts mushrooms into thin slice, MisterJohnson69 (Freesound, CC0)", "https://freesound.org/people/MisterJohnson69/sounds/828969/"),
    ("cuts", "360795.mp3", "https://cdn.freesound.org/previews/360/360795_6606253-hq.mp3", "snijden_champignons_1.wav, dutchlady (Freesound, CC0)", "https://freesound.org/people/dutchlady/sounds/360795/"),
    ("cuts", "87507.mp3", "https://cdn.freesound.org/previews/87/87507_71257-hq.mp3", "cuttingMozarella.flac, qubodup (Freesound, CC0)", "https://freesound.org/people/qubodup/sounds/87507/"),
    ("cuts", "593682.mp3", "https://cdn.freesound.org/previews/593/593682_10763995-hq.mp3", "CUTTING MEAT WITH DULL KNIFE, levypeck (Freesound, CC0)", "https://freesound.org/people/levypeck/sounds/593682/"),
    ("cuts", "847873.mp3", "https://cdn.freesound.org/previews/847/847873_12637308-hq.mp3", "Kitchen Cutting Board 01, bernhoftbret (Freesound, CC0)", "https://freesound.org/people/bernhoftbret/sounds/847873/"),
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
