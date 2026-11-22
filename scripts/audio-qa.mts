/**
 * AUDIO QA — the game's sound (finishing plan W3, developer 2026-10-12). RULE CHANGE (developer 2026-11-19, Playgama 3.3.2): the sound is RECORDED
 * files (public/audio, docs/AUDIO-CREDITS.md), no longer synthesized in code. AudioManager.ts, run against a fake Web Audio context and a fake fetch.
 *
 *  S  Every named effect exists and plays through the effects bus; a gap
 *     guard stops a burst of one name.
 *  G  Gating: nothing plays before the platform allows it, while paused (the
 *     platform's pause covers a hidden page — preflight forbids our own Page
 *     Visibility use), during an ad or with Sound off; music never starts
 *     before a user gesture or with Music off.
 *  M  Music: one recorded loop only, however often the mood changes; it stops when it must; the loop is one source (nothing accumulates).
 *  Y  Nothing is synthesized: no oscillator, no generated noise, no convolver in the sound code; every effect is a recording or a note played from one.
 *  W  Wiring: the existing hooks play the sounds; the Music toggle uses the
 *     existing settings.music key (no new save field).
 *
 * Run: npx tsx scripts/audio-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) =>
  fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), p), "utf8");

// ── A fake browser + Web Audio, counting every node created ──
const listeners: Record<string, () => void> = {};
let created = 0;
const param = () => ({
  value: 0,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
  linearRampToValueAtTime() {},
  cancelScheduledValues() {},
  setTargetAtTime(v: number) {
    this.value = v;
  },
});
const node = (extra: object = {}) => {
  created++;
  return { connect: (x: unknown) => x, start() {}, stop() {}, ...extra };
};
class FakeCtx {
  currentTime = 0;
  state = "running";
  sampleRate = 8000;
  destination = {};
  resume() {}
  createGain() {
    return node({ gain: param() });
  }
  createOscillator() {
    return node({ type: "sine", frequency: param() });
  }
  createBiquadFilter() {
    return node({ type: "lowpass", frequency: param(), Q: param() });
  }
  createBufferSource() {
    return node({ buffer: null, loop: false, playbackRate: param() });
  }
  // the recordings: a fetched file is decoded into a stand-in buffer
  decodeAudioData(_bytes: unknown, ok: (b: unknown) => void) {
    ok({ duration: 1 });
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
}
const g = globalThis as unknown as Record<string, unknown>;
let fetched = 0;
g.fetch = async () => {
  fetched++;
  return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
};
g.window = {
  AudioContext: FakeCtx,
  addEventListener: (t: string, fn: () => void) => (listeners[t] = fn),
  removeEventListener: () => {},
};
const doc = { hidden: false, addEventListener: (t: string, fn: () => void) => (listeners[t] = fn) };
g.document = doc;

const { AudioManager, SFX } = await import("../src/game/AudioManager.ts");
const { AUDIO_FILES } = await import("../src/game/audio/audioFiles.ts");
const { PauseManager } = await import("../src/game/PauseManager.ts");
const am = AudioManager as unknown as {
  ctx: FakeCtx | null;
  track: unknown;
};

console.log("S. Effects");
{
  // Developer 2026-10-15 (Codex audio fix): no AudioContext and no sound before
  // the player's first tap or key; music likewise waits for that gesture.
  const silentBefore = AudioManager.sfxCount;
  AudioManager.playSfx("tap");
  AudioManager.setMusicMood("kitchen");
  assert(
    AudioManager.sfxCount === silentBefore && am.ctx === null && !AudioManager.musicPlaying,
    "S0: nothing plays and no audio context exists before the first gesture",
  );
  AudioManager.setMusicMood("off");
  listeners.pointerdown?.();
  await new Promise((r) => setTimeout(r, 70));
  const names = Object.keys(SFX) as (keyof typeof SFX)[];
  const ids = names.flatMap((n) =>
    SFX[n].filter((x: { id?: string }) => x.id).map((x: { id?: string }) => x.id as string),
  );
  assert(
    // Rule changed (developer 2026-11-03): Fridge Sort added five effects (pick, place, wrong, combo, tick) after the first ten.
    // RULE CHANGE (developer 2026-11-22): the mini-games got their own 19 effects after the first sixteen (Unload the Van 7, Dessert Run 4, Sauce Station 6, round win / loss 2).
    names.join() ===
      "tap,coin,till,bell,plate,delivery,lightsOff,squeak,levelComplete,story,sortPick,sortPlace,sortWrong,sortCombo,sortTick,carHorn," +
        "crateGrab,crateSlide,crateOut,crateRocket,crateSmash,crateFreeze,crateUndo,runSend,runPick,runDrop,runServe," +
        "sauceLiquid,sauceSpice,sauceJar,sauceProduce,sauceWhisk,sauceBottle,gameWin,gameLose" &&
      names.every(
        (n) =>
          SFX[n].length > 0 &&
          SFX[n].every((x: { gain?: number }) => (x.gain ?? 1) > 0 && (x.gain ?? 1) <= 0.7),
      ) &&
      ids.every((id) => id in AUDIO_FILES),
    "S1: thirty-five named effects (sixteen, then the mini-games' nineteen, 2026-11-22), each a recording that exists in the audio list or a note played from a recorded voice, none louder than 0.7",
  );
  assert(
    fetched >=
      Object.keys(AUDIO_FILES).filter((k) => !k.startsWith("music-") && !k.startsWith("wash-"))
        .length,
    "S1b: after the first tap every effect's file is fetched once (the files are small); the music and the washing beds wait until they are wanted",
    fetched,
  );
  const before = AudioManager.sfxCount;
  for (const n of names) AudioManager.playSfx(n);
  AudioManager.playSfx("tap"); // a burst of the same name inside the gap is dropped
  assert(
    AudioManager.sfxCount === before + names.length,
    "S2: every effect plays; a burst of one name within 60 ms is dropped",
  );
}

console.log("G. Gating");
{
  const tries = () => {
    const before = AudioManager.sfxCount;
    AudioManager.playSfx("coin");
    return AudioManager.sfxCount - before;
  };
  const wait = () => new Promise((r) => setTimeout(r, 70));
  await wait();
  PauseManager.pause();
  const paused = tries();
  PauseManager.resume();
  await wait();
  AudioManager.setUserSoundEnabled(false);
  const off = tries();
  AudioManager.setUserSoundEnabled(true);
  await wait();
  const on = tries();
  assert(
    paused === 0 && off === 0 && on === 1,
    "G1: silent while paused (the platform's pause covers a hidden page) and with Sound off; plays again after",
    { paused, off, on },
  );
  // The gesture happened in S0 (music waited for it there).
  AudioManager.setMusicMood("kitchen");
  await wait(); // the loop's file is fetched and decoded first
  const beforeGesture = false;
  const afterGesture = AudioManager.musicPlaying;
  AudioManager.setUserMusicEnabled(false);
  const musicOff = AudioManager.musicPlaying;
  AudioManager.setUserMusicEnabled(true);
  await wait();
  assert(
    !beforeGesture && afterGesture && !musicOff && AudioManager.musicPlaying,
    "G2: music never starts before a user gesture; the Music toggle stops and restarts it",
  );
  PauseManager.pause();
  const pausedMusic = AudioManager.musicPlaying;
  PauseManager.resume();
  await wait();
  assert(
    !pausedMusic && AudioManager.musicPlaying,
    "G3: music stops while paused (a hidden page included) and comes back after",
  );
  const sdk = read("src/game/AudioManager.ts");
  assert(
    /!isAdActive\(\)/.test(sdk) && /this\.platformEnabled &&/.test(sdk),
    "G4: the platform's audio state and an ad on screen silence everything (shared gate)",
  );
}

console.log("M. Music");
{
  const loops = AudioManager.musicLoopsStarted;
  for (const m of ["cutting", "kitchen", "night", "kitchen", "cutting"] as const) {
    AudioManager.setMusicMood(m);
    await new Promise((r) => setTimeout(r, 30));
  }
  assert(
    AudioManager.musicLoopsStarted === loops && AudioManager.musicPlaying,
    "M1: mood changes crossfade into the new recording; the music never starts a second loop from silence",
  );
  AudioManager.setMusicMood("kitchen");
  await new Promise((r) => setTimeout(r, 30));
  const ctx = am.ctx!;
  const n0 = created;
  for (let i = 0; i < 40; i++) ctx.currentTime += 0.2;
  const whilePlaying = created - n0;
  AudioManager.setMusicMood("off");
  const n1 = created;
  for (let i = 0; i < 40; i++) ctx.currentTime += 0.2;
  assert(
    whilePlaying === 0 && created === n1 && !AudioManager.musicPlaying,
    "M2: a playing loop is one source and creates nothing more as time passes; none at all when off",
    { whilePlaying },
  );
  const tracks = ["music-loading", "music-kitchen", "music-cutting", "music-night"] as const;
  assert(
    tracks.every(
      (t) => (AUDIO_FILES[t] as { loop?: boolean }).loop === true && AUDIO_FILES[t].seconds >= 20,
    ),
    "M3: each mood is a recorded loop (at least 20 s long, marked as a loop)",
  );
}

console.log("Y. Nothing is synthesized (Playgama 3.3.2)");
{
  const sound = read("src/game/AudioManager.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(
    !/createOscillator|createConvolver|createDynamicsCompressor|createPeriodicWave|getChannelData|noiseSource|createBuffer\((?!1, 1, 22050)/.test(
      sound,
    ),
    "Y1: the sound code has no oscillator, no sample written by code (the one silent sample that opens iOS audio apart) and no reverb: it only plays recordings (gain, filter and playback-rate nodes)",
  );
  assert(
    !fs.existsSync(
      path.join(path.resolve(import.meta.dirname, ".."), "src/game/music/relaxComposer.ts"),
    ),
    "Y2: the score that was made note by note in code is gone",
  );
}

console.log("I. iPhone Safari (interrupted context, touchend unlock)");
{
  const ctx = am.ctx as unknown as FakeCtx & { resume(): Promise<void> };
  assert(
    typeof listeners.touchend === "function" && typeof listeners.click === "function",
    "I1: touchend and click also unlock audio (iOS ignores pointerdown for that)",
  );
  let resumed = 0;
  ctx.state = "interrupted";
  ctx.resume = () => {
    resumed++;
    ctx.state = "running";
    return Promise.resolve();
  };
  listeners.touchend?.();
  await new Promise((r) => setTimeout(r, 20));
  assert(
    resumed >= 1 && ctx.state === "running",
    "I2: a tap wakes a context the system left 'interrupted' (a call, a lock, a tab switch)",
    { resumed, state: ctx.state },
  );
  const before = AudioManager.sfxCount;
  AudioManager.playSfx("bell");
  assert(AudioManager.sfxCount === before + 1, "I3: sound plays again after the wake-up");
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    /AudioManager\.setMusicMood\(musicMood\)/.test(app) &&
      /AudioManager\.playSfx\(lastLedgerAmount >= 0 \? "coin" : "till"\)/.test(app) &&
      /AudioManager\.playSfx\("levelComplete"\)/.test(app) &&
      /AudioManager\.playSfx\("story"\)/.test(app) &&
      /AudioManager\.playSfx\("lightsOff"\)/.test(app) &&
      /AudioManager\.playSfx\("squeak"\)/.test(app) &&
      /AudioManager\.setUserMusicEnabled\(loaded\.settings\.music !== false\)/.test(app),
    "W1: App — music mood, coin / till on money, level complete, story, lights off, chores, the saved Music setting",
  );
  assert(
    /AudioManager\.playSfx\("bell"\)/.test(read("src/components/kc/game/Preparation.tsx")) &&
      /AudioManager\.playSfx\("tap"\)/.test(read("src/components/kc/common/primitives.tsx")) &&
      /AudioManager\.playSfx\("delivery"\)/.test(
        read("src/components/kc/restaurant/Deliveries.tsx"),
      ) &&
      /label="Music"/.test(read("src/components/kc/Journal.tsx")),
    "W2: the order bell, button taps, the delivery knock; a Music toggle in Settings",
  );
  const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
  assert(
    Object.keys(DEFAULT_SAVE.settings).sort().join() === "music,reducedMotion,sound",
    "W3: no new save field (settings keep sound, music, reducedMotion)",
    Object.keys(DEFAULT_SAVE.settings),
  );
}

// iPhone Safari (developer 2026-11-11: "no sounds in Safari mobile except the videos"). A real device is the only full test; these guard the three causes.
{
  const am = read("src/game/AudioManager.ts");
  assert(
    /"touchstart", "touchend"/.test(am) && /e\?\.type/.test(am),
    "X1: Safari: the unlock listens to touchstart AND touchend / click (iOS only starts audio from touchend / click) and knows which event it was",
  );
  assert(
    /real && this\.ctx && this\.ctx\.state !== "running"\) this\.contextResumePending = null/.test(
      am,
    ) && /if \(this\.contextResumePending === ask\) this\.contextResumePending = null/.test(am),
    "X2: Safari: a resume that never settles (asked from pointerdown) can no longer block the next real tap's resume: dropped on a real tap and after 1.2 s",
  );
  assert(
    /primeOutput/.test(am) && /createBuffer\(1, 1, 22050\)/.test(am) && /statechange/.test(am),
    "X3: Safari: a real tap plays one silent sample to open the output, and a state change to running wakes the music",
  );
}

// ── Z. The mini-games' own sounds (developer 2026-11-22: "add suitable sound effects to Unload the Van and the other mini-games") ──
console.log("Z. Mini-game sounds");
{
  const { SFX } = await import("../src/game/AudioManager.ts");
  const { AUDIO_FILES } = await import("../src/game/audio/audioFiles.ts");
  const names = [
    "crateGrab",
    "crateSlide",
    "crateOut",
    "crateRocket",
    "crateSmash",
    "crateFreeze",
    "crateUndo",
    "runSend",
    "runPick",
    "runDrop",
    "runServe",
    "sauceLiquid",
    "sauceSpice",
    "sauceJar",
    "sauceProduce",
    "sauceWhisk",
    "sauceBottle",
    "gameWin",
    "gameLose",
  ];
  const table = SFX as Record<string, readonly { id?: string; hz?: number }[]>;
  assert(
    names.every((n) => Array.isArray(table[n]) && table[n]!.length > 0),
    "Z1: every mini-game sound is in the effects table",
    names.filter((n) => !table[n]),
  );
  const ids = names.flatMap((n) => table[n]!.map((p) => p.id).filter(Boolean)) as string[];
  assert(
    ids.every((id) => id in AUDIO_FILES) &&
      !names.some((n) => table[n]!.some((p) => !p.id && !p.hz)),
    "Z2: each one is built from recordings (or notes played from recorded voices): every file it names exists in the manifest",
    ids.filter((id) => !(id in AUDIO_FILES)),
  );
  const files = ["whoosh", "clank", "door", "pop", "beads", "slide", "back", "bottle"];
  assert(
    files.every((f) =>
      fs.existsSync(
        path.join(path.resolve(import.meta.dirname, ".."), "public", "audio", `${f}.mp3`),
      ),
    ) && /sfx\("whoosh"/.test(read("scripts/make-audio-assets.py")),
    "Z3: the eight new recordings are built from the CC0 packs by scripts/make-audio-assets.py into public/audio",
  );
  const credits = read("docs/AUDIO-CREDITS.md");
  assert(
    /whoosh/.test(credits) && /clank/.test(credits) && /Unload the Van/.test(credits),
    "Z4: docs/AUDIO-CREDITS.md lists the new mini-game sounds and their CC0 sources",
  );
  const van = read("src/components/kc/inventory/KitchenDispatchGame.tsx");
  const run = read("src/components/kc/inventory/DessertRunGame.tsx");
  const park = read("src/components/kc/inventory/CarParkGame.tsx");
  const sauce = read("src/components/kc/sauce/SauceStationGame.tsx");
  const uses = (src: string, ...n: string[]) => n.every((x) => src.includes(`playSfx("${x}")`));
  assert(
    uses(
      van,
      "crateGrab",
      "crateSlide",
      "crateOut",
      "crateRocket",
      "crateSmash",
      "crateFreeze",
      "crateUndo",
      "sortTick",
      "gameWin",
      "gameLose",
    ),
    "Z5: Unload the Van sounds a crate lifted, gliding and out of its door, the rocket, the hammer, the freeze, Undo, the last ten seconds, the win and the loss",
  );
  assert(
    uses(run, "runSend", "runPick", "runDrop", "runServe", "sortWrong", "gameWin", "gameLose") &&
      /state\.phase === "won"/.test(run),
    "Z6: Dessert Run sounds a waiter sent off, a cube picked, dropped on the cart, a guest served, all spots busy, the win and the jam (read from the screen: the simulation is untouched)",
  );
  assert(
    uses(park, "gameWin", "gameLose") &&
      // RULE CHANGE (developer 2026-11-22: "while stirring add a satisfying stirring sound"): the whisk is no longer a swish per 240 ms (`sauceWhisk`) but
      // a continuous stir bed (Z11).
      ["sauceLiquid", "sauceSpice", "sauceJar", "sauceProduce", "sauceBottle"].every((n) =>
        sauce.includes(`"${n}"`),
      ),
    "Z7: Car Park has its win and loss; the Sauce Station sounds each kind of ingredient and the bottle",
  );

  // developer 2026-11-22: wiping the board and washing dishes sound like ONE soft, real wipe, not pings, bubbles, a squeak or splashes.
  const am = read("src/game/AudioManager.ts");
  const stroke = am.slice(am.indexOf("washStroke("), am.indexOf("private stopWashVoice"));
  const prep = read("src/game/scenes/PreparationScene.ts");
  const clothStep = prep.slice(
    prep.indexOf("private stepCloth"),
    prep.indexOf("private finishCleanup"),
  );
  const sink = read("src/components/kc/restaurant/WashUpSink.tsx");
  {
    // Run: a stroke of the cloth starts ONE looped voice (the bed is fetched), further strokes only steer it.
    const wipeFetches = fetched;
    AudioManager.washStroke("wipe", 0.6);
    await new Promise((r) => setTimeout(r, 30));
    AudioManager.washStroke("wipe", 0.8);
    const nodesAfter = created;
    AudioManager.washStroke("wipe", 0.4);
    assert(
      fetched > wipeFetches && created === nodesAfter,
      "Z8b: a wipe stroke fetches the cloth bed once and the next strokes make no new nodes (one continuous voice, no per-stroke sound)",
      { fetched: fetched - wipeFetches, nodes: created - nodesAfter },
    );
  }
  {
    // developer 2026-11-22 ("realistic cutting sounds ... different for different ingredients"): every ingredient has a family of recorded knife-on-board cuts.
    const { CUT_FAMILY, CUT_FILES, STROKE_FAMILIES } =
      await import("../src/game/audio/cutSounds.ts");
    const { INGREDIENTS } = await import("../src/game/definitions.ts");
    const ids = Object.keys(INGREDIENTS);
    const missing = ids.filter((id) => !(id in CUT_FAMILY));
    const filesOk = Object.values(CUT_FILES).every(
      (list) => list.length >= 2 && list.every((f) => f in AUDIO_FILES),
    );
    const families = new Set(Object.values(CUT_FAMILY));
    assert(
      missing.length === 0 &&
        filesOk &&
        families.size >= 10 &&
        "boardtap" in AUDIO_FILES &&
        CUT_FAMILY["carrot"] !== CUT_FAMILY["tomato"] &&
        CUT_FAMILY["tomato"] !== CUT_FAMILY["lettuce"] &&
        CUT_FAMILY["bread"] !== CUT_FAMILY["chicken"] &&
        STROKE_FAMILIES.has("meat") &&
        !STROKE_FAMILIES.has("crunch"),
      "Z10: every ingredient has a family of recorded knife-on-board cuts (carrot, tomato, lettuce, bread and chicken each sound different); a stroke family also taps the board",
      { missing, families: [...families] },
    );
    // run: a cut of a chopped food makes ONE sound (its own recording), a stroke through bread or meat two (the stroke and the board tap)
    await new Promise((r) => setTimeout(r, 30));
    const n0 = created;
    AudioManager.playIngredientSlice("carrot", 0.7, 90);
    const chop = created - n0;
    const n1 = created;
    AudioManager.playIngredientSlice("chicken", 0.7, 90);
    const stroke = created - n1;
    assert(
      chop > 0 && stroke > chop,
      "Z10b: a chopped food plays its one recorded cut; a stroke through meat also taps the board (the recordings are fetched at the first tap)",
      { chop, stroke },
    );
  }

  {
    // developer 2026-11-22: stirring the sauce is ONE soft recorded bed that follows the spoon or the whisk (not a swish every 240 ms).
    const sauce = read("src/components/kc/sauce/SauceStationGame.tsx");
    assert(
      (AUDIO_FILES as Record<string, { loop?: boolean }>)["wash-stir"]?.loop === true &&
        (AUDIO_FILES as Record<string, { loop?: boolean }>)["wash-whisk"]?.loop === true &&
        /washStroke\(\s*sauce\.tool === "whisk" \? "whisk" : "stir"/.test(sauce) &&
        !/playSfx\("sauceWhisk"\)/.test(sauce),
      "Z11: the Sauce Station's spoon and whisk run one looped recorded bed (wash-stir / wash-whisk) that swells with the turning speed, also for the auto spoon; the old per-240 ms swish is gone",
    );
  }
  {
    // developer 2026-11-22: every cleaning tool has its own soft recorded bed (no ping per stain either).
    const area = read("src/components/kc/business/AreaCleaningPrototype.tsx");
    const kinds = ["wipe", "scrub", "rinse", "mop", "sweep", "scrape", "brush", "glass"];
    const map = area.slice(
      area.indexOf("const TOOL_SOUND"),
      area.indexOf("const TOOL_SOUND") + 400,
    );
    assert(
      kinds.every(
        (k) => (AUDIO_FILES as Record<string, { loop?: boolean }>)[`wash-${k}`]?.loop === true,
      ) &&
        ["sponge", "cloth", "scraper", "broom", "mop", "toilet-brush", "glass-cloth"].every((t) =>
          new RegExp(`${t.includes("-") ? `"${t}"` : t}: "`).test(map),
        ) &&
        /washStroke\(\s*TOOL_SOUND\[activeTool\]/.test(area) &&
        !/playSparkle\(|playScrub\(/.test(area),
      "Z9: the sponge, cloth, scraper, broom, mop, toilet brush and glass cloth each have their own looped recorded bed that follows the hand; no ping when a stain goes",
    );
  }
  assert(
    ["wash-wipe", "wash-scrub", "wash-rinse"].every(
      (k) => (AUDIO_FILES as Record<string, { loop?: boolean }>)[k]?.loop === true,
    ) &&
      /kind: WashKind/.test(stroke) &&
      !/bubble/.test(stroke) &&
      /washStroke\(\s*"wipe"/.test(clothStep) &&
      !/playSparkle\(|playSfx\("squeak"\)|playScrub\(/.test(clothStep) &&
      !/playSparkle\(/.test(sink),
    "Z8: the board's cloth, the sponge and the rinse each run ONE looped, recorded, soft bed that follows the hand (wash-wipe / wash-scrub / wash-rinse); no ping per patch or stain, no bubble, no squeak",
  );
}

AudioManager.setMusicMood("off");
console.log(failures ? `\nAUDIO QA: ${failures} FAILURE(S)` : "\nAUDIO QA: ALL PASS");
process.exit(failures ? 1 : 0);
