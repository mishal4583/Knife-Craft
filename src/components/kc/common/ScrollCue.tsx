import { useEffect, useRef, useState } from "react";

/** How close to an end (px) counts as being there. */
const EDGE_PX = 24;

/**
 * A screen's scroll cue (developer 2026-10-18: "there isn't even an arrow to
 * show scroll up or down"). The screens hide their scrollbars, so a list
 * longer than the screen says so: "▾ More" while there is more below (a tap
 * moves down most of a screen), "▴ Top" once the player is well down and at
 * the end. It sits just above the bottom bar and finds the screen's own
 * scroll area (its tallest vertical scroll area), so every screen with the
 * bottom bar gets it. Nothing shows when the content fits.
 */
export function ScrollCue({ hidden = false }: { hidden?: boolean }) {
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [state, setState] = useState<"more" | "top" | null>(null);
  const scroller = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const host = anchor.current?.closest("nav")?.parentElement;
    if (!host) return;
    // The screen's main list: its tallest vertical scroll area (the Order Board's sits a level
    // deeper than most), never one inside the bottom bar.
    const find = () =>
      ([...host.querySelectorAll(".overflow-y-auto, .overflow-auto")] as HTMLElement[])
        .filter((el) => !el.closest("nav"))
        .sort((x, y) => y.clientHeight - x.clientHeight)[0] ?? null;
    let el = find();
    scroller.current = el;
    const update = () => {
      if (!el || !el.isConnected) {
        el = find();
        scroller.current = el;
      }
      if (!el || el.scrollHeight - el.clientHeight <= EDGE_PX) return setState(null);
      const below = el.scrollHeight - el.clientHeight - el.scrollTop;
      if (below > EDGE_PX) return setState("more");
      setState(el.scrollTop > el.clientHeight ? "top" : null);
    };
    update();
    el?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Content that loads or unfolds later changes the height without a scroll.
    const observer = new MutationObserver(update);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    return () => {
      el?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  const tap = () => {
    const el = scroller.current;
    if (!el) return;
    if (state === "top") el.scrollTo({ top: 0, behavior: "smooth" });
    else el.scrollBy({ top: el.clientHeight * 0.8, behavior: "smooth" });
  };

  return (
    <span ref={anchor} className="contents">
      {state && !hidden ? (
        <button
          type="button"
          onClick={tap}
          data-testid="scroll-cue"
          data-scroll-cue={state}
          aria-label={state === "more" ? "Scroll down: more below" : "Back to the top"}
          className="press anim-up absolute bottom-full right-3 mb-2 flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-full border border-walnut-dark/40 bg-walnut-dark/85 px-3 font-ui text-[12.5px] font-extrabold text-ivory shadow-lift backdrop-blur-sm"
        >
          <span aria-hidden className="text-[15px] leading-none">
            {state === "more" ? "▾" : "▴"}
          </span>
          {state === "more" ? "More" : "Top"}
        </button>
      ) : null}
    </span>
  );
}
