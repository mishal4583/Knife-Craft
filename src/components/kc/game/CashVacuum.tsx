import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AudioManager } from "@/game/AudioManager";
import { formatUsd } from "@/game/money";
import { CASH, cashPieces, cashRemaining } from "@/game/cashBurst";

/**
 * CASH_VACUUM — Phase 2 (B2–B5): the customer's payment as bills and coins
 * on the counter, swept into the wallet with a finger or the mouse.
 *
 * Purely presentation over a payment App has ALREADY credited and
 * recorded (see cashBurst.ts): it never credits, records or saves. It tells
 * its parent how much is still on the counter (`onRemaining`), and the
 * parent shows the wallet as `credits − remaining` — so the counter can
 * only ever roll toward the real balance, and lands on it exactly once the
 * last piece is in (or straight away, if the player just moves on).
 *
 * One broad swipe picks up every piece it passes near (CASH.HIT_RADIUS_PX
 * past the piece's own edge); more swipes get the rest. Each piece is
 * collected at most once — every path (swipe, auto-collect, both at once)
 * goes through the same guarded `collect`. The tray owns its pointer
 * (pointer capture, `touch-action: none`) and sits on the order card, over
 * a finished dish, so a sweep here can never reach the cutting board.
 */
export function CashVacuum({
  payCents,
  tipCents,
  walletRef,
  reducedMotion,
  auto,
  onRemaining,
  variant = "counter",
  onDone,
}: {
  payCents: number;
  tipCents: number;
  /** Where collected pieces fly to — the wallet counter. */
  walletRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  /** Collect by itself (the session option, or Reduced Motion) — the parent owns the toggle. */
  auto: boolean;
  onRemaining: (cents: number) => void;
  /**
   * "table" (developer 2026-10-26: "the cash near their dining table … collect it like idle
   * games"): the same pieces lying loose on the customer's table, no tray box, no line after.
   */
  variant?: "counter" | "table";
  /** Called once, when the last piece is in. */
  onDone?: () => void;
}) {
  const pieces = useMemo(() => cashPieces(payCents, tipCents), [payCents, tipCents]);
  const total = payCents + tipCents;
  const els = useRef<(HTMLSpanElement | null)[]>([]);
  const collected = useRef<boolean[]>(pieces.map(() => false));
  const trayRef = useRef<HTMLDivElement | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [done, setDone] = useState(pieces.length === 0);
  const [touched, setTouched] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (done) doneRef.current?.();
  }, [done]);

  // The burst: pieces pop out of the middle of the tray to where they land.
  useEffect(() => {
    if (reducedMotion) return;
    const tray = trayRef.current?.getBoundingClientRect();
    pieces.forEach((p, i) => {
      const el = els.current[i];
      if (!el || !tray) return;
      const dx = ((50 - p.x) / 100) * tray.width;
      const dy = ((50 - p.y) / 100) * tray.height;
      el.animate(
        [
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg) scale(0.3)`,
            opacity: 0,
          },
          { transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(1)`, opacity: 1 },
        ],
        { duration: 420, delay: i * 35, easing: "cubic-bezier(.2,1.4,.4,1)", fill: "backwards" },
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one burst per payment
  }, []);

  function collect(i: number) {
    if (collected.current[i]) return;
    collected.current[i] = true;
    const remaining = cashRemaining(pieces, collected.current);
    onRemaining(remaining);
    AudioManager.playSfx("coin");
    const el = els.current[i];
    const target = walletRef.current?.getBoundingClientRect();
    if (el) {
      if (reducedMotion || !target) {
        el.style.visibility = "hidden";
      } else {
        const r = el.getBoundingClientRect();
        const dx = target.left + target.height * 0.6 - (r.left + r.width / 2);
        const dy = target.top + target.height / 2 - (r.top + r.height / 2);
        const p = pieces[i]!;
        const flight = el.animate(
          [
            { transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(1)`, opacity: 1 },
            {
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${p.rot}deg) scale(0.35)`,
              opacity: 0.15,
            },
          ],
          { duration: CASH.FLY_MS, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" },
        );
        flight.onfinish = () => {
          el.style.visibility = "hidden";
        };
      }
    }
    if (collected.current.every(Boolean)) setDone(true);
  }

  /** Every piece within reach of the segment a→b (one pointer move). */
  function sweep(a: { x: number; y: number }, b: { x: number; y: number }) {
    pieces.forEach((_, i) => {
      if (collected.current[i]) return;
      const el = els.current[i];
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - a.x) * vx + (cy - a.y) * vy) / len2)) : 0;
      const d = Math.hypot(cx - (a.x + t * vx), cy - (a.y + t * vy));
      if (d <= CASH.HIT_RADIUS_PX + Math.max(r.width, r.height) / 2) collect(i);
    });
  }

  // Auto-collect (the session option, or Reduced Motion): the same `collect`, one piece at a time.
  useEffect(() => {
    if (!auto || done) return;
    let timer = 0;
    const next = () => {
      const i = collected.current.findIndex((c) => !c);
      if (i < 0) return;
      collect(i);
      timer = window.setTimeout(next, reducedMotion ? 0 : CASH.AUTO_STEP_MS);
    };
    timer = window.setTimeout(next, reducedMotion ? 0 : CASH.AUTO_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- collect reads refs only
  }, [auto, done]);

  if (done) {
    if (variant === "table") return null;
    return (
      <p
        className="mt-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-olive"
        data-testid="cash-collected"
      >
        ✓ Collected {formatUsd(total)}
      </p>
    );
  }

  return (
    <div className={variant === "table" ? "" : "mt-2"}>
      <div
        ref={trayRef}
        className={
          variant === "table"
            ? "relative h-[64px] w-[132px] touch-none select-none"
            : "relative h-[68px] w-full touch-none select-none overflow-hidden rounded-[14px] border border-walnut/15 bg-walnut/[0.07] shadow-inner"
        }
        data-testid="cash-tray"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = { x: e.clientX, y: e.clientY };
          setTouched(true);
          sweep(last.current, last.current);
        }}
        onPointerMove={(e) => {
          if (!last.current) return;
          const now = { x: e.clientX, y: e.clientY };
          sweep(last.current, now);
          last.current = now;
        }}
        onPointerUp={() => {
          last.current = null;
        }}
        onPointerCancel={() => {
          last.current = null;
        }}
        onLostPointerCapture={() => {
          last.current = null;
        }}
      >
        {pieces.map((p, i) => (
          <span
            key={p.id}
            ref={(el) => {
              els.current[i] = el;
            }}
            data-cash-piece=""
            data-cents={p.cents}
            data-tip={p.tip ? "1" : undefined}
            aria-hidden="true"
            className={
              p.kind === "coin"
                ? "pointer-events-none absolute h-[22px] w-[22px] rounded-full border border-[#9a7a2a] bg-[radial-gradient(circle_at_35%_35%,#f6dc8a,#c9a13e)] shadow-[0_1px_2px_rgba(62,40,25,0.35)]"
                : p.tip
                  ? "pointer-events-none absolute h-[22px] w-[40px] rounded-[4px] border border-[#a8862c] bg-[linear-gradient(135deg,#f3d77a,#d9b048)] shadow-[0_1px_3px_rgba(62,40,25,0.35)]"
                  : "pointer-events-none absolute h-[22px] w-[40px] rounded-[4px] border border-[#5d7d44] bg-[linear-gradient(135deg,#a9c98a,#7fa262)] shadow-[0_1px_3px_rgba(62,40,25,0.35)]"
            }
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
            }}
          />
        ))}
        {!touched && !auto ? (
          // On a small ivory backing: the pieces spread over the whole tray, and
          // bare text over a bill was hard to read at 320 px.
          <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ivory/85 px-2 font-hand text-[13px] leading-tight text-walnut/75 shadow-soft">
            swipe to collect
          </span>
        ) : null}
      </div>
    </div>
  );
}
