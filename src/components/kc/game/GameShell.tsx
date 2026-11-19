import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LayoutContext, fitLayout } from "./layoutMode";

// The logical design canvas every screen/Phaser scene in this project is
// authored against (see PreparationScene.ts, GameBridge.ts) — unchanged
// by this file. This pass only makes the OUTER PRESENTATION responsive;
// it never touches this logical resolution or any gameplay coordinate.
const LOGICAL_W = 540;
const LOGICAL_H = 960;

/**
 * The window's own size, measured on the ACTUAL available box with a `ResizeObserver` (not raw `window.innerWidth/innerHeight`), plus the layout `fitLayout`
 * gives it (layoutMode.ts): the same box is filled edge to edge at every shape, the UI laid out at `lw` x `lh` and scaled by `scale`.
 *
 * `ResizeObserver` (not `window.resize` alone) is the detection mechanism: it fires on any change to the observed element's own rendered box, including
 * layout-driven changes some hosts don't emit a `resize` event for (e.g. certain fullscreen transitions — the YouTube Playables reference's own §7.2 lesson).
 * `window.resize`/`orientationchange` listeners are kept too, as a zero-cost belt-and-suspenders — no polling timer, no second loop.
 *
 * Starts at the full logical size (a safe, always-non-zero default) so nothing ever computes a 0x0 box before the first measurement — the YouTube
 * zero-viewport WebView case. `useLayoutEffect` (not `useEffect`) so the very first real measurement happens before paint, avoiding a one-frame flash at the
 * wrong size.
 */
function useFillFit(logicalW: number, logicalH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: logicalW, height: logicalH });
  const fit = fitLayout(box.width, box.height);
  const landscape = fit.landscape;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (w: number, h: number) => {
      // A transient collapsed box (route swap, host mid-transition) — never let this compute a 0-sized game frame; keep the last good size and wait for
      // the next real measurement, exactly like GameBridge's own `scale.min` floor does one layer down for the Phaser canvas itself.
      if (w <= 0 || h <= 0) return;
      setBox((old) => (old.width === w && old.height === h ? old : { width: w, height: h }));
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

  // Landscape styles key off <html data-orient> (Tailwind `land:`), so portals see it too.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (landscape) root.dataset["orient"] = "landscape";
    else delete root.dataset["orient"];
  }, [landscape]);

  return { ref, box, fit };
}

/**
 * Responsive playable container (developer 2026-11-19: it fills the window at every size and aspect ratio, never framed, never with empty bars: see
 * `fitLayout`). The whole window is the game; a screen that is laid out smaller or larger than the window is scaled uniformly (never stretched in X or Y
 * alone, never cropped).
 */
export function GameShell({ children }: { children: ReactNode; aside?: ReactNode }) {
  const { ref, box, fit } = useFillFit(LOGICAL_W, LOGICAL_H);
  const scaled = Math.abs(fit.scale - 1) > 0.001;
  const contentStyle = scaled
    ? { width: fit.lw, height: fit.lh, transform: `scale(${fit.scale})` }
    : { width: "100%", height: "100%" };
  return (
    <LayoutContext.Provider value={fit.landscape ? "landscape" : "portrait"}>
      <div
        className="fixed inset-0 overflow-hidden bg-[#231710]"
        // Playgama checklist: a long press (or right click) in the game never opens the
        // browser's menu; text fields keep theirs (paste).
        onContextMenu={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("input, textarea")) return;
          e.preventDefault();
        }}
        onDragStart={(e) => {
          if ((e.target as HTMLElement).tagName === "IMG") e.preventDefault();
        }}
      >
        {/* The measuring box: the whole window (net of the notch's safe areas). The game fills it edge to edge. */}
        <div
          ref={ref}
          className="absolute inset-0 overflow-hidden pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]"
        >
          <div className="relative h-full w-full overflow-hidden">
            {/* ONE wrapper at every size: switching between "children" and a wrapped tree when a resize or rotation crossed a layout boundary
              changed the element tree, so React remounted the whole game (the cutting scene, the order, a served order's result panel).
              Now a resize only changes this wrapper's size and scale. */}
            <div
              data-game-content
              data-orient={fit.landscape ? "landscape" : "portrait"}
              className="absolute left-0 top-0 origin-top-left"
              style={contentStyle}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </LayoutContext.Provider>
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
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-1 land:pb-6">
      {children}
    </div>
  );
}
