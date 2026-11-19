/**
 * MUSIC AND SOUND-FILE QA.
 * Developer 2026-11-08: "add music while loading the game and add background music, soothing or relaxing ... and make sure we don't face any copyright issue".
 * RULE CHANGE (developer 2026-11-19, Playgama 3.3.2): that score was made in code; Playgama does not accept sound synthesized in code, so the game now ships
 * RECORDED, CC0 audio (public/audio). The copyright promise is kept the other way: every file comes from a CC0 source that is named in docs/AUDIO-CREDITS.md.
 *   C  the files: the list in audioFiles.ts and the folder agree, every file is a real mp3, the sizes are bounded, the music tracks are loops, and
 *      every source is credited with its licence page; the sound code plays only files from the game's own folder
 *   L  loading: the loading mood exists and plays before the save is there; the loading screen says "tap for music" until the first tap
 * (The earlier P section, which checked the generated piece note by note, is gone with the generator.)
 * Run: npx tsx scripts/music-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { AUDIO_FILES } from "../src/game/audio/audioFiles.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail).slice(0, 300));
  }
}

console.log("C. The recorded files");
{
  const dir = path.join(ROOT, "public/audio");
  const onDisk = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mp3"))
    .sort();
  const listed = Object.values(AUDIO_FILES)
    .map((v) => path.basename(v.file))
    .sort();
  assert(
    JSON.stringify(onDisk) === JSON.stringify(listed) && onDisk.length >= 30,
    "C1: the audio list (src/game/audio/audioFiles.ts) and public/audio hold the same files",
    { onDisk: onDisk.length, listed: listed.length },
  );
  const bad: string[] = [];
  let total = 0;
  for (const f of onDisk) {
    const b = fs.readFileSync(path.join(dir, f));
    total += b.length;
    // an mp3 starts with an ID3 tag or a frame sync (0xFF 0xE0+)
    const real =
      (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) ||
      (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0);
    const music = f.startsWith("music-");
    if (!real) bad.push(`${f}: not an mp3`);
    if (!music && b.length > 40 * 1024) bad.push(`${f}: an effect over 40 KB`);
    if (music && (b.length < 150 * 1024 || b.length > 1800 * 1024))
      bad.push(`${f}: a track outside 150 KB - 1.8 MB`);
  }
  assert(
    bad.length === 0 && total < 6 * 1024 * 1024,
    `C2: every file is a real mp3, effects are small, tracks are bounded; ${(total / 1024 / 1024).toFixed(1)} MB in all (limit 6 MB; YouTube's initial bundle is 30 MB and these load after the first tap)`,
    bad,
  );
  const tracks = ["music-loading", "music-kitchen", "music-cutting", "music-night"] as const;
  assert(
    tracks.every(
      (t) => (AUDIO_FILES[t] as { loop?: boolean }).loop === true && AUDIO_FILES[t].seconds >= 20,
    ),
    "C3: the four moods are loops of at least 20 s",
  );
  const credits = read("docs/AUDIO-CREDITS.md");
  const fetchScript = read("scripts/fetch-audio-sources.py");
  const pages = [
    ...fetchScript.matchAll(/"(https:\/\/(?:opengameart\.org|kenney\.nl)\/[^"]+)"\)/g),
  ].map((m) => m[1]!);
  const missing = [...new Set(pages)].filter((p) => !credits.includes(p));
  assert(
    pages.length >= 8 && missing.length === 0 && /CC0/.test(credits),
    "C4: every source the files come from is credited with its licence page, and the licence is CC0",
    missing,
  );
  const sound = read("src/game/AudioManager.ts");
  assert(
    !/https?:\/\//.test(sound.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")) &&
      /baseUrl\(\)/.test(sound),
    "C5: the sound code fetches only files from the game's own folder (the preflight's no-outside-call rule)",
  );
  assert(
    !fs.existsSync(path.join(ROOT, "src/game/music/relaxComposer.ts")),
    "C6: the score that was made note by note in code is gone (Playgama 3.3.2)",
  );
}

console.log("L. Loading music");
{
  const am = read("src/game/AudioManager.ts");
  const app = read("src/App.tsx");
  assert(
    /loading: "music-loading"/.test(am) && /loading: /.test(am),
    "L1: the loading mood exists with its own recording and level",
  );
  assert(
    /!save\s*\?\s*"loading"/.test(app),
    "L2: App asks for the loading music while the save is not there yet",
  );
  assert(
    /userActivation\?\.hasBeenActive/.test(am) && /get unlocked\(\)/.test(am),
    "L3: if the page has already had a tap the loading music starts at once; otherwise at the first tap (never before: no autoplay warning)",
  );
  assert(
    /data-testid="loading-music-hint"/.test(app) && /tap for music/.test(app),
    "L4: until the first tap the loading screen says 'tap for music'",
  );
}

console.log(failures ? `\nMUSIC QA: ${failures} FAILURE(S)` : "\nMUSIC QA: ALL PASS");
process.exit(failures ? 1 : 0);
