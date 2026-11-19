# Audio credits and licences

The game's sound is **recorded audio**, not sound made in code (Playgama requirement 3.3.2, developer 2026-11-19). Every source below is **CC0** (Creative Commons
Zero, a public-domain dedication): free for any use, commercial included, with no attribution required. The credits are kept anyway. Each licence was read on
the source's own page on 2026-11-19, and read again on all nine pages (author and licence field) in a browser on 2026-11-19 after the audit: all CC0.

`scripts/fetch-audio-sources.py` downloads the originals into `scripts/.audio-src/` (git-ignored); `scripts/make-audio-assets.py` cuts, levels and encodes them
into `public/audio/*.mp3` and writes `src/game/audio/audioFiles.ts`. Nothing is played from anywhere but the game's own folder.

## Music (four moods, each a seamless loop)

| Mood    | File                | Source           | Author           | Licence page                               |
| ------- | ------------------- | ---------------- | ---------------- | ------------------------------------------ |
| loading | `music-loading.mp3` | Morning Sky      | Centurion_of_war | https://opengameart.org/node/179462        |
| kitchen | `music-kitchen.mp3` | Etirwer (looped) | Kistol           | https://opengameart.org/content/etirwer    |
| cutting | `music-cutting.mp3` | JRPG Piano       | Joth             | https://opengameart.org/content/jrpg-piano |
| night   | `music-night.mp3`   | Sunset Plains    | Yoiyami          | https://opengameart.org/node/182253        |

Each was cut to its loop length, its end crossfaded into the material before its start, and levelled to the same loudness.

## Sound effects

| What the game uses                                                                                                             | Source                 | Author                                                            | Licence page                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Knife cuts (`slice1-3`), peeling (`peel1-5`)                                                                                   | cut & peel a pumpkin   | TinyWorlds                                                     | https://opengameart.org/content/cut-peel-a-pumpkin               |
| Chimes, glass pings, taps, drops, clicks, error thud, switch, scrapes, pluck (the tonal ones are the game's recorded "voices") | Interface Sounds 1.0   | Kenney (www.kenney.nl)                                            | https://kenney.nl/assets/interface-sounds (CC0 text in the pack) |
| Coins, bubble, cloth wipes, knock, blade ring, story sting                                                                     | RPG Sound Pack         | artisticdude                                                      | https://opengameart.org/content/rpg-sound-pack                   |
| Washing beds (`wash-scrub`, `wash-rinse`)                                                                                      | 6 Short water splashes | ezwa (cut by qubodup, from pdsounds.org public-domain recordings) | https://opengameart.org/content/6-short-water-splashes           |
| Car horn (`horn`)                                                                                                              | Bicycle Horn           | AntumDeluge                                                     | https://opengameart.org/content/bicycle-horn                     |

## How the game uses them

- A tonal recording (chime, chime2, bell, glass) is a **voice**: its real pitch is measured when the files are built (`rootHz` in `audioFiles.ts`), and the game plays
  it at the note it wants by changing its playback rate, like a sampler. Level-complete, sparkle, tip, fever, combo, plate chime and the others are notes played from
  these voices.
- Nothing in the code makes a sound: no oscillator, no generated noise, no reverb (`audio-qa` Y1).
- The earlier score, written note by note in code (`music/relaxComposer.ts`), is deleted.
