/**
 * iOS Safari keeps a scroller's scrollable area from its last layout: when a list inside it grows or shrinks, the
 * finger can stop scrolling until something else changes the height (developer 2026-11-06, Market Plan ahead). Taking
 * `overflow` off and back on for one layout rebuilds the area; the position is kept, inside the new height.
 */
export function closestScroller(from: HTMLElement | null): HTMLElement | null {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement)
    if (/auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
  return null;
}

export function repairScroller(from: HTMLElement | null) {
  const scroller = closestScroller(from);
  if (!scroller) return;
  const top = scroller.scrollTop;
  scroller.style.overflowY = "hidden";
  void scroller.offsetHeight;
  scroller.style.overflowY = "";
  scroller.scrollTop = Math.min(top, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
  scroller.dataset["scrollRepairs"] = String(Number(scroller.dataset["scrollRepairs"] ?? 0) + 1);
}
