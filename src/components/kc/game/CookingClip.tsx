/**
 * COOKING CLIP — the short painted-kitchen film of the chef cooking the
 * dish (3.75 s, portrait 540×960), shown after every preparation: once the
 * chef's hands have carried the plate away (RECIPE_COMPLETED) and before
 * the Knife Report.
 *
 * - Mounted as soon as plating starts (`playing` false: invisible, only
 *   buffering), so it is ready when the hands leave. Bundled locally
 *   (WebM VP9 first, H.264 MP4 fallback) — no network request.
 * - Skippable: the SKIP › control or a tap anywhere (after a 300 ms guard,
 *   so the tap that fast-forwarded the plating doesn't also skip the film).
 * - Pause-aware (PauseManager: the in-game pause and the platform's), and
 *   its sound follows the game's own rule (AudioManager.soundAllowed).
 * - Never blocks the game: an unplayable/erroring/stalled video, or a
 *   player who prefers reduced motion, goes straight on. `onDone` fires once.
 */
import { useEffect, useRef, useState } from "react";
import { AudioManager } from "@/game/AudioManager";
import { PauseManager } from "@/game/PauseManager";
import clipWebm from "@/assets/video/chef-cooking.webm";
import clipMp4 from "@/assets/video/chef-cooking.mp4";
import clipPoster from "@/assets/video/chef-cooking-poster.webp";

/** Taps sooner than this after the film appears are ignored (carry-over from the plating skip). */
const TAP_GUARD_MS = 300;
/** If the film hasn't started this long after it should play (and the game isn't paused), move on. */
const START_TIMEOUT_MS = 2500;
/** Hard ceiling of unpaused play time — the clip is 3.75 s. */
const MAX_PLAY_MS = 7000;

export function CookingClip({ playing, onDone }: { playing: boolean; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const shownAt = useRef(0);
  const [started, setStarted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    videoRef.current?.pause();
    onDone();
  };

  useEffect(() => {
    if (!playing) return;
    shownAt.current = performance.now();
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const video = videoRef.current;
    if (reduced || !video) {
      finish();
      return;
    }

    const tryPlay = () => {
      if (doneRef.current || PauseManager.isPaused()) return;
      if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) return finish();
      video.muted = !AudioManager.soundAllowed;
      video.play().catch(() => {
        // Autoplay with sound refused: try once more silently, else move on.
        if (video.muted) return finish();
        video.muted = true;
        video.play().catch(() => finish());
      });
    };

    // Watchdogs count unpaused time only.
    let waited = 0;
    let played = 0;
    let last = performance.now();
    const tick = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (PauseManager.isPaused()) return;
      if (video.currentTime > 0 && !video.paused) played += dt;
      else if (video.currentTime === 0) waited += dt;
      if (waited > START_TIMEOUT_MS || played > MAX_PLAY_MS) finish();
    }, 200);

    const unsubscribe = PauseManager.subscribe((paused) => {
      if (doneRef.current) return;
      if (paused) video.pause();
      else tryPlay();
    });
    tryPlay();

    return () => {
      window.clearInterval(tick);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when the film is due; finish/onDone are stable for this run
  }, [playing]);

  return (
    <div
      role="dialog"
      aria-label="The chef cooks your dish"
      aria-hidden={!playing}
      data-testid="cooking-clip"
      onClick={() => {
        if (playing && performance.now() - shownAt.current >= TAP_GUARD_MS) finish();
      }}
      className={
        "absolute inset-0 z-[35] bg-walnut-dark transition-opacity duration-300 " +
        (playing && !leaving ? "opacity-100" : "pointer-events-none opacity-0")
      }
    >
      <video
        ref={videoRef}
        playsInline
        muted
        preload="auto"
        poster={clipPoster}
        disablePictureInPicture
        onPlaying={() => setStarted(true)}
        onEnded={finish}
        onError={() => {
          if (playing) finish();
        }}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={clipWebm} type="video/webm" />
        <source
          src={clipMp4}
          type="video/mp4"
          // The last <source> failing is reported here, not on <video>.
          onError={() => {
            if (playing) finish();
          }}
        />
      </video>
      {playing && !leaving ? (
        <button
          type="button"
          aria-label="Skip cooking"
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
          className="absolute right-1 top-1 z-10 flex h-[52px] min-w-[52px] items-center justify-center px-2"
        >
          <span className="rounded-full bg-black/30 px-3 py-1.5 font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#fff6e6]/90">
            Skip <span aria-hidden>›</span>
          </span>
        </button>
      ) : null}
      {playing && !started ? <span className="sr-only">Cooking…</span> : null}
    </div>
  );
}
