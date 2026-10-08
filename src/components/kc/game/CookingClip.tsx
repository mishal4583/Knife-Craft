/**
 * COOKING CLIP — the short painted-kitchen film of the chef finishing the
 * dish (portrait 540×960), shown after every preparation — the fruit-cup
 * film (3.84 s) for fruit dishes, the salad film (2.97 s) for salads, the
 * curry-pot film (3.67 s) for curries and pot dishes, the bread film
 * (4.0 s) for bread dishes, the chef-cooking
 * film (3.75 s) for other cooked dishes and the plating film
 * (3.84 s) for dishes that are only cut and plated: once the
 * chef's hands have carried the plate away (RECIPE_COMPLETED) and before
 * the Knife Report.
 *
 * - Mounted as soon as plating starts (`playing` false: invisible, only
 *   buffering), so it is ready when the hands leave. Bundled locally
 *   (WebM VP9 first, H.264 MP4 fallback) — no network request.
 * - Skippable: the SKIP › control (bottom-right, over the painted-out
 *   watermark) or a tap anywhere (after an 800 ms guard, so a stray tap
 *   left over from the cutting or the plating doesn't also skip the film).
 * - Pause-aware (PauseManager: the in-game pause and the platform's), and
 *   its sound follows the game's own rule (AudioManager.soundAllowed).
 * - Never blocks the game: an unplayable/erroring/stalled video, or a
 *   player who prefers reduced motion, goes straight on. `onDone` fires once.
 */
import { useEffect, useRef, useState } from "react";
import { AudioManager } from "@/game/AudioManager";
import { PauseManager } from "@/game/PauseManager";
import type { DishKind } from "@/game/recipes/dishKind";
import cookingWebm from "@/assets/video/chef-cooking.webm";
import cookingMp4 from "@/assets/video/chef-cooking.mp4";
import cookingPoster from "@/assets/video/chef-cooking-poster.webp";
import saladWebm from "@/assets/video/chef-salad.webm";
import saladMp4 from "@/assets/video/chef-salad.mp4";
import saladPoster from "@/assets/video/chef-salad-poster.webp";
import fruitWebm from "@/assets/video/chef-fruit.webm";
import fruitMp4 from "@/assets/video/chef-fruit.mp4";
import fruitPoster from "@/assets/video/chef-fruit-poster.webp";
import platingWebm from "@/assets/video/chef-plating.webm";
import platingMp4 from "@/assets/video/chef-plating.mp4";
import platingPoster from "@/assets/video/chef-plating-poster.webp";
import curryWebm from "@/assets/video/chef-curry.webm";
import curryMp4 from "@/assets/video/chef-curry.mp4";
import curryPoster from "@/assets/video/chef-curry-poster.webp";
import breadWebm from "@/assets/video/chef-bread.webm";
import breadMp4 from "@/assets/video/chef-bread.mp4";
import breadPoster from "@/assets/video/chef-bread-poster.webp";

/** One film per kind of dish (dishKindFor): fruit cups with a honey drizzle, the chef tossing a salad, stirring a curry pot, topping bruschetta, cooking at the stove, or plating cut vegetables. */
const CLIPS: Record<DishKind, { webm: string; mp4: string; poster: string }> = {
  fruit: { webm: fruitWebm, mp4: fruitMp4, poster: fruitPoster },
  salad: { webm: saladWebm, mp4: saladMp4, poster: saladPoster },
  curry: { webm: curryWebm, mp4: curryMp4, poster: curryPoster },
  bread: { webm: breadWebm, mp4: breadMp4, poster: breadPoster },
  cooked: { webm: cookingWebm, mp4: cookingMp4, poster: cookingPoster },
  plated: { webm: platingWebm, mp4: platingMp4, poster: platingPoster },
};

/** Taps sooner than this after the film appears are ignored (carry-over taps from the cutting or the plating skip). */
const TAP_GUARD_MS = 800;
/** If the film hasn't started this long after it should play (and the game isn't paused), move on. */
const START_TIMEOUT_MS = 2500;
/** Hard ceiling of unpaused play time — the clips run 2.97–3.84 s. */
const MAX_PLAY_MS = 7000;
/**
 * Where the source films' AI watermark sat (the same spot in all five) (its centre, as a fraction of the
 * 9:16 frame, which the game frame matches exactly): painted out of the
 * encoded files with ffmpeg `delogo`, and covered by the SKIP control.
 */
const WATERMARK_X = 600 / 720;
const WATERMARK_Y = 1160 / 1280;

export function CookingClip({
  playing,
  kind,
  onDone,
}: {
  playing: boolean;
  kind: DishKind;
  onDone: () => void;
}) {
  const clip = CLIPS[kind];
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
      data-kind={kind}
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
        poster={clip.poster}
        disablePictureInPicture
        onPlaying={() => setStarted(true)}
        onEnded={finish}
        onError={() => {
          if (playing) finish();
        }}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={clip.webm} type="video/webm" />
        <source
          src={clip.mp4}
          type="video/mp4"
          // The last <source> failing is reported here, not on <video>.
          onError={() => {
            if (playing) finish();
          }}
        />
      </video>
      {playing ? (
        // Sits exactly over the corner where the source film carried an AI
        // watermark (painted out of the files too, see WATERMARK_*), and
        // stays through the fade-out so that corner is never bare.
        <button
          type="button"
          aria-label="Skip cooking"
          disabled={leaving}
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
          style={{ left: `${WATERMARK_X * 100}%`, top: `${WATERMARK_Y * 100}%` }}
          className="absolute z-10 flex h-[52px] min-w-[84px] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        >
          <span className="flex h-[38px] items-center rounded-full bg-walnut-dark/60 px-4 font-ui text-[13px] font-extrabold uppercase tracking-[0.16em] text-[#fff6e6] shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-md">
            Skip <span aria-hidden>&nbsp;›</span>
          </span>
        </button>
      ) : null}
      {playing && !started ? <span className="sr-only">Cooking…</span> : null}
    </div>
  );
}
