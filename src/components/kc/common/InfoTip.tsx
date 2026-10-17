import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AudioManager } from "@/game/AudioManager";
import { cn } from "@/lib/utils";

/**
 * INFO TIP and STAT CHIP (developer 2026-10-16: "concise the big sentences …
 * convey it with emojis … small points … if long sentences are necessary add a
 * small 'i' information symbol and only when it is clicked let the information
 * display; make the UI proper according to a game").
 *
 * `InfoTip` is a small ⓘ coin in a 48 px button that opens a paper bubble with
 * the longer explanation. One bubble is open at a time; a tap outside, Escape
 * or resizing closes it, and it follows its ⓘ when the page scrolls (closing
 * once the ⓘ is off screen). The bubble is portalled to <body> and drawn
 * at the GameShell's scale, so a scaled frame or a clipped card never cuts it.
 *
 * `StatChip` is an icon + short value pill ("⏱ $10/h") for numbers that used
 * to be written out as sentences.
 */
const OPEN_EVENT = "kc-infotip-open";
const BUBBLE_W = 260;
const GAP = 6;
const EDGE = 8;

export function InfoTip({
  children,
  label = "More info",
  className,
  tone = "copper",
}: {
  children: ReactNode;
  /** What the ⓘ explains, for screen readers ("About the Chef's Knife"). */
  label?: string;
  className?: string;
  tone?: "copper" | "light";
}) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const coin = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; scale: number; w: number } | null>(
    null,
  );

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const b = coin.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const scale = b.offsetWidth > 0 ? r.width / b.offsetWidth : 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(BUBBLE_W, (vw - EDGE * 2) / scale);
    const screenW = w * scale;
    const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - screenW / 2), vw - EDGE - screenW);
    const h = (bubble.current?.offsetHeight ?? 0) * scale;
    const below = r.bottom + GAP;
    const top = h && below + h > vh - EDGE && r.top - GAP - h > EDGE ? r.top - GAP - h : below;
    setPos({ left, top, scale, w });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) close();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btn.current?.contains(t) || bubble.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // A scroll moves the bubble with its ⓘ; it closes once the ⓘ leaves the screen.
    const onScroll = () => {
      const r = coin.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) close();
      else place();
    };
    window.addEventListener(OPEN_EVENT, onOther);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    // Second pass once the bubble's height is known (flip above when needed).
    const raf = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(OPEN_EVENT, onOther);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, id, close, place]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-infotip
        onClick={(e) => {
          e.stopPropagation();
          AudioManager.playSfx("tap");
          setOpen((o) => {
            if (!o) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
            return !o;
          });
        }}
        className={cn(
          // A 48 px touch target around a 22 px coin; the negative margin keeps
          // the line as tight as the coin alone.
          "press -m-[13px] inline-grid h-12 w-12 shrink-0 place-items-center align-middle",
          className,
        )}
      >
        <span
          ref={coin}
          aria-hidden
          className={cn(
            "grid h-[22px] w-[22px] place-items-center rounded-full border font-display text-[13px] font-black italic leading-none shadow-soft",
            tone === "copper"
              ? "border-copper/45 bg-ivory text-copper"
              : "border-ivory/50 bg-ivory/15 text-ivory",
            open && "ring-2 ring-gold/60",
          )}
        >
          i
        </span>
      </button>
      {open
        ? createPortal(
            <div
              ref={bubble}
              id={id}
              role="note"
              data-infotip-bubble
              style={{
                position: "fixed",
                left: pos?.left ?? -9999,
                top: pos?.top ?? -9999,
                width: pos?.w ?? BUBBLE_W,
                transform: `scale(${pos?.scale ?? 1})`,
                transformOrigin: "top left",
                zIndex: 90,
              }}
              className="kc-pop-in paper rounded-2xl border border-copper/30 px-3 py-2.5 font-ui text-[13px] leading-snug text-walnut-dark shadow-[0_10px_28px_rgba(43,24,10,0.28)]"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** An icon + short value pill, for numbers that used to be sentences. */
export function StatChip({
  icon,
  children,
  tone = "cream",
  className,
  title,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "cream" | "sage" | "copper" | "tomato" | "locked";
  className?: string;
  /** Short words for screen readers when the icon carries the meaning. */
  title?: string;
}) {
  const tones = {
    cream: "bg-cream/80 text-walnut-dark border-walnut/15",
    sage: "bg-sage/20 text-olive border-olive/25",
    copper: "bg-copper/12 text-copper border-copper/30",
    tomato: "bg-tomato/12 text-tomato border-tomato/30",
    locked: "bg-walnut/8 text-walnut/60 border-walnut/15",
  }[tone];
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[2px] font-ui text-[12px] font-extrabold leading-tight",
        tones,
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="text-[12.5px] leading-none">
          {icon}
        </span>
      ) : null}
      <span aria-hidden={title ? true : undefined}>{children}</span>
    </span>
  );
}

/** Short points: one icon + a few words per line, instead of a sentence. */
export function Points({
  items,
  className,
}: {
  items: readonly (readonly [icon: ReactNode, text: ReactNode])[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-0.5 font-ui text-[12.5px] leading-snug text-walnut/75", className)}>
      {items.map(([icon, text], i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span aria-hidden className="w-4 shrink-0 text-center">
            {icon}
          </span>
          <span className="min-w-0">{text}</span>
        </li>
      ))}
    </ul>
  );
}
