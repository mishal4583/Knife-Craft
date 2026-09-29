/**
 * AUDIO_MANAGER — tiny Web Audio synthesis, no bundled audio files.
 *
 * Respects the platform's audio state (Bridge `platform.isAudioEnabled` /
 * AUDIO_STATE_CHANGED, via PlayablesSDK `isAudioEnabled` / `onAudioEnabledChange`) —
 * it never assumes browser audio state on its own. The Settings screen's
 * Sound toggle feeds `setUserSoundEnabled`; both gates must be open for
 * anything to actually play.
 */
import { isAdActive, isAudioEnabled, onAudioEnabledChange } from "./PlayablesSDK";
import { PauseManager } from "./PauseManager";
import { INGREDIENTS, PLATING, type IngredientId } from "./definitions";

type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private platformEnabled = true;
  private userSoundEnabled = true;
  private initialized = false;

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.platformEnabled = isAudioEnabled();
    onAudioEnabledChange((enabled) => {
      this.platformEnabled = enabled;
    });
  }

  setUserSoundEnabled(enabled: boolean): void {
    this.userSoundEnabled = enabled;
  }

  /** Whether sound may play right now (platform audio, the Sound setting, not paused, no ad). Media elements outside Web Audio — the cooking clip — follow the same rule. */
  get soundAllowed(): boolean {
    return this.enabled;
  }

  private get enabled(): boolean {
    this.init();
    // The platform's audio state AND the player's Sound toggle must both allow
    // it, and nothing plays while the game is paused (in-game or by the
    // platform) or while a platform ad is on screen.
    return (
      this.platformEnabled && this.userSoundEnabled && !PauseManager.isPaused() && !isAdActive()
    );
  }

  private ensureContext(): AudioContext | null {
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return null;
    if (!this.ctx) this.ctx = new Ctor();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** One shared raw-noise buffer, reused as the source for every noise-based voice below (knifecraft.html's `noise()`). */
  private sharedNoise: AudioBuffer | null = null;
  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    if (!this.sharedNoise) {
      const length = Math.max(1, Math.floor(ctx.sampleRate * 0.6));
      this.sharedNoise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.sharedNoise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.sharedNoise;
    return src;
  }

  /** ±3% pitch/gain jitter so repeated cuts never sound cloned (knifecraft.html AUDIO_JITTER). */
  private jitter(): number {
    return 1 + (Math.random() * 2 - 1) * 0.03;
  }

  /**
   * The active ingredient's cutting sound — ported three-voice synthesis
   * from the Phase 1 reference (knifecraft.html sliceCut(), driven by
   * whichever CONFIG.INGREDIENTS.<id>.audio profile is active): a
   * bandpass noise transient (the break), a filtered noise swell over the
   * cut's duration (the body), and a pitch-dropping sine at the board
   * contact (the thunk). `vel` is 0..1 stroke speed; `durMs` is the
   * reveal duration this cut is playing out over.
   *
   * `pitchMult`/`gainMult` (Phase 8, default 1) are the EQUIPPED KNIFE's
   * own subtle audio identity (KnifeAudioProfile) — layered ON TOP of the
   * ingredient's own profile (`A` below), never replacing it: think
   * "ingredient sound x knife sound", not a second competing voice. Kept
   * close to 1.0 by every knife definition so the difference stays subtle.
   */
  playIngredientSlice(
    ingredientId: IngredientId,
    vel: number,
    durMs: number,
    pitchMult = 1,
    gainMult = 1,
  ): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const A = INGREDIENTS[ingredientId].audio;
    const v = Math.max(0, Math.min(1, vel));
    const t0 = ctx.currentTime;

    {
      // the break: skin, snap or crack — brighter and sharper when fast
      const src = this.noiseSource(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value =
        (A.filterMin + (A.filterMax - A.filterMin) * v) * this.jitter() * pitchMult;
      bp.Q.value = A.transQ;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(
        (A.transPeak + A.transVel * v) * this.jitter() * gainMult,
        t0 + (v > 0.5 ? A.atkFast : A.atkSlow),
      );
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + A.transDecay);
      src.connect(bp).connect(g).connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + A.transDecay + 0.02);
    }
    {
      // the body: a swell over the cut — lowpass reads wet, the tail carries the moisture
      const tail = (A.tailMs * (1.5 - A.tailVel * v)) / 1000;
      const dur = durMs / 1000 + tail;
      const src = this.noiseSource(ctx);
      const f = ctx.createBiquadFilter();
      f.type = A.glideType;
      f.frequency.value = (A.glideMin + A.glideSpan * v) * this.jitter() * pitchMult;
      f.Q.value = A.glideQ;
      const g = ctx.createGain();
      const peak = (A.glidePeak + A.glideVel * (1 - v)) * this.jitter() * gainMult;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
      g.gain.setValueAtTime(peak, t0 + Math.max(0.02, (durMs / 1000) * 0.7));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }
    {
      // board contact at reveal completion: pitch + volume by impact speed
      const tb = t0 + durMs / 1000;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(A.thunkHz * this.jitter() * (0.92 + 0.16 * v) * pitchMult, tb);
      o.frequency.exponentialRampToValueAtTime(A.thunkDrop * pitchMult, tb + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(A.thunkGain * (0.45 + A.thunkVel * v) * this.jitter() * gainMult, tb);
      g.gain.exponentialRampToValueAtTime(0.001, tb + 0.09);
      o.connect(g).connect(ctx.destination);
      o.start(tb);
      o.stop(tb + 0.1);
    }
  }

  /**
   * Ported from knifecraft.html Audio.plateSettle(): a soft ceramic
   * contact pitched up a pentatonic ladder, so several pieces landing on
   * the plate read as a musical phrase rather than a clatter.
   * `index` is the piece's position in the plating order (0-based).
   */
  playPlateChime(index: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const gain = 0.15; // knifecraft.html CONFIG.plating.PLATE_CHIME_GAIN
    const ladder = PLATING.CHIME_LADDER;
    const freq = ladder[Math.min(index, ladder.length - 1)]! * this.jitter();

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq * 1.4;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(bp).connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);

    // the ceramic itself: a whisper of contact under the note
    const src = this.noiseSource(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(ng).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.06);
  }

  /** Warm two-note chime — recipe / order complete. */
  playChime(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = now + i * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.42);
    }
  }
}

/** Single shared instance — import this, never instantiate the class yourself. */
export const AudioManager = new AudioManagerImpl();
