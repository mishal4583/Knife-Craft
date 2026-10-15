/**
 * AUDIO QA — the synthesized sound (finishing plan W3, developer 2026-10-12).
 * AudioManager.ts, run against a fake Web Audio context.
 *
 *  S  Every named effect exists and plays through the effects bus; a gap
 *     guard stops a burst of one name.
 *  G  Gating: nothing plays before the platform allows it, while paused (the
 *     platform's pause covers a hidden page — preflight forbids our own Page
 *     Visibility use), during an ad or with Sound off; music never starts
 *     before a user gesture or with Music off.
 *  M  Music: one loop only, however often the mood changes; it stops when it
 *     must; node creation per bar is bounded (nothing accumulates when quiet);
 *     its choices are seeded.
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
    return node({ buffer: null });
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
}
const g = globalThis as unknown as Record<string, unknown>;
g.window = {
  AudioContext: FakeCtx,
  addEventListener: (t: string, fn: () => void) => (listeners[t] = fn),
  removeEventListener: () => {},
};
const doc = { hidden: false, addEventListener: (t: string, fn: () => void) => (listeners[t] = fn) };
g.document = doc;

const { AudioManager, SFX } = await import("../src/game/AudioManager.ts");
const { PauseManager } = await import("../src/game/PauseManager.ts");
const am = AudioManager as unknown as {
  ctx: FakeCtx | null;
  musicTimer: unknown;
  scheduleMusic(): void;
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
  assert(
    names.join() === "tap,coin,till,bell,plate,delivery,lightsOff,squeak,levelComplete,story" &&
      names.every((n) => SFX[n].length > 0 && SFX[n].every((x) => x.gain > 0 && x.gain <= 0.1)),
    "S1: ten named effects, each short and quiet (gain ≤ 0.1)",
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
  const beforeGesture = false;
  const afterGesture = AudioManager.musicPlaying;
  AudioManager.setUserMusicEnabled(false);
  const musicOff = AudioManager.musicPlaying;
  AudioManager.setUserMusicEnabled(true);
  assert(
    !beforeGesture && afterGesture && !musicOff && AudioManager.musicPlaying,
    "G2: music never starts before a user gesture; the Music toggle stops and restarts it",
  );
  PauseManager.pause();
  const pausedMusic = AudioManager.musicPlaying;
  PauseManager.resume();
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
  for (const m of ["cutting", "kitchen", "night", "kitchen", "cutting"] as const)
    AudioManager.setMusicMood(m);
  assert(
    AudioManager.musicLoopsStarted === loops && AudioManager.musicPlaying,
    "M1: mood changes reuse the one running loop (never a second)",
  );
  AudioManager.setMusicMood("kitchen");
  const ctx = am.ctx!;
  const n0 = created;
  for (let i = 0; i < 40; i++) {
    ctx.currentTime += 0.2;
    am.scheduleMusic();
  }
  const perSecond = (created - n0) / 8;
  AudioManager.setMusicMood("off");
  const n1 = created;
  for (let i = 0; i < 40; i++) {
    ctx.currentTime += 0.2;
    am.scheduleMusic();
  }
  assert(
    perSecond > 0 && perSecond < 60 && created === n1 && !AudioManager.musicPlaying,
    "M2: a bounded number of short-lived nodes per second while playing; none at all when off",
    { perSecond },
  );
  const src = read("src/game/AudioManager.ts");
  const music = src.slice(src.indexOf("private playBar"), src.indexOf("private init"));
  assert(
    !/Math\.random/.test(music) && /seededRand\(20261012\)/.test(src),
    "M3: the music's choices are seeded (no Math.random in the score)",
  );
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

AudioManager.setMusicMood("off");
console.log(failures ? `\nAUDIO QA: ${failures} FAILURE(S)` : "\nAUDIO QA: ALL PASS");
process.exit(failures ? 1 : 0);
