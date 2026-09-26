import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// The logical design canvas every screen/Phaser scene in this project is
// authored against (see PreparationScene.ts, GameBridge.ts) — unchanged
// by this file. This pass only makes the OUTER PRESENTATION responsive;
// it never touches this logical resolution or any gameplay coordinate.
const LOGICAL_W = 540;
const LOGICAL_H = 960;

/**
 * The narrowest width the UI is laid out for (the smallest phone it is
 * tested at). When the fitted frame is narrower — a phone rotated to
 * landscape, YouTube's rotate control, a small embed — the UI is laid out
 * at this width and the whole frame is scaled down to fit, so it shrinks
 * uniformly instead of clipping or squashing. Phaser's input reads the
 * canvas's on-screen box, so cutting stays accurate under the scale.
 */
const MIN_LAYOUT_W = 320;

/**
 * Contain-fit sizing — the same `scale = min(availW/W, availH/H)`
 * computation the YouTube Playables reference's own resize() example
 * uses, driven by `ResizeObserver` on the ACTUAL available box rather
 * than raw `window.innerWidth/innerHeight`.
 *
 * Why not the previous CSS `aspect-ratio` + `calc(100vw...)` approach:
 * that computed the box's height from the FULL viewport width, with no
 * way to account for GameShell's own `aside` panel (shown ≥768px) and
 * its flex gap sitting in the same row — at those widths the CSS-implied
 * box could exceed the space actually left after `aside`, and the outer
 * `overflow-hidden` wrapper would clip it. Measuring the real available
 * box (a `flex-1` sibling of `aside` — flexbox has already correctly
 * subtracted `aside`'s width/gap for us) removes that ambiguity entirely
 * and generalizes correctly to every aspect ratio, not just portrait.
 *
 * `ResizeObserver` (not `window.resize` alone) is the detection
 * mechanism: it fires on any change to the observed element's own
 * rendered box, including layout-driven changes some hosts don't emit a
 * `resize` event for (e.g. certain fullscreen transitions — the
 * reference's own §7.2 lesson). `window.resize`/`orientationchange`
 * listeners are kept too, as a zero-cost belt-and-suspenders — no
 * polling timer, no second loop.
 *
 * Starts at the full logical size (a safe, always-non-zero default) so
 * nothing ever computes a 0x0 box before the first measurement — the
 * YouTube zero-viewport WebView case. `useLayoutEffect` (not
 * `useEffect`) so the very first real measurement happens before paint,
 * avoiding a one-frame flash at the wrong size.
 */
function useContainFit(logicalW: number, logicalH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: logicalW, height: logicalH });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (w: number, h: number) => {
      // A transient collapsed box (route swap, host mid-transition) —
      // never let this compute a 0-sized game frame; keep the last good
      // size and wait for the next real measurement, exactly like
      // GameBridge's own `scale.min` floor does one layer down for the
      // Phaser canvas itself.
      if (w <= 0 || h <= 0) return;
      const scale = Math.min(w / logicalW, h / logicalH);
      setSize({ width: logicalW * scale, height: logicalH * scale });
    };

    measure(el.clientWidth, el.clientHeight);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      measure(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);

    const onWindowResize = () => measure(el.clientWidth, el.clientHeight);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onWindowResize);
    };
  }, [logicalW, logicalH]);

  return { ref, size };
}

/**
 * Responsive playable container.
 *
 * Keeps the 540x960 logical composition's ASPECT RATIO intact (never
 * stretched independently in X/Y) while letting its on-screen SIZE
 * genuinely respond to the real available viewport at every aspect
 * ratio the Playables spec requires (9:32 through 32:9 and everything
 * between) — the largest box of that ratio that fits, centered, with
 * symmetric pillarbox (portrait-in-wide) or letterbox (wide-in-tall)
 * space around it, never cropped, never distorted. See useContainFit's
 * own doc for the sizing mechanism.
 */
export function GameShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const { ref, size } = useContainFit(LOGICAL_W, LOGICAL_H);
  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#3E2819,#231710_70%)]">
      {/* Phone-sized screens get the game edge to edge (no margin, border or
          rounded corners); the framed "device" look is only for wider screens. */}
      <div className="flex h-full w-full items-center justify-center gap-6 p-0 sm:p-4">
        {aside}
        {/* The measuring box — its own rendered size (via ResizeObserver
            above) IS "the space actually available to the game", already
            net of `aside`'s width and this row's gap/padding, courtesy of
            ordinary flex layout. Never sized/styled itself beyond that;
            the visible phone-frame lives entirely on the fixed-size child
            below, centered inside it. */}
        <div
          ref={ref}
          className="flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center"
        >
          <div
            className="relative overflow-hidden sm:rounded-[clamp(0px,4vmin,34px)] sm:border-[3px] sm:border-[#241811] sm:shadow-[0_40px_80px_rgba(0,0,0,0.55)]"
            style={{ width: size.width, height: size.height }}
          >
            {size.width >= MIN_LAYOUT_W ? (
              children
            ) : (
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: MIN_LAYOUT_W,
                  height: (size.height * MIN_LAYOUT_W) / size.width,
                  transform: `scale(${size.width / MIN_LAYOUT_W})`,
                }}
              >
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-bleed layer inside the shell — every screen uses this. */
export function ScreenContainer({
  children,
  tone = "cream",
}: {
  children: ReactNode;
  tone?: "cream" | "paper" | "wood";
}) {
  const bg = {
    cream: "bg-[linear-gradient(180deg,var(--color-ivory),var(--color-cream))]",
    paper: "paper",
    wood: "wood",
  }[tone];
  return (
    <section className={`anim-up absolute inset-0 flex h-full w-full flex-col ${bg}`}>
      {children}
    </section>
  );
}

/** Scrollable body region — the shell itself never scrolls. */
export function ScreenBody({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-1">{children}</div>
  );
}
