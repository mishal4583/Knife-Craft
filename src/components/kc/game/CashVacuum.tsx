import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AudioManager } from "@/game/AudioManager";
import { formatUsd } from "@/game/money";
import { CASH, cashPieces, cashRemaining } from "@/game/cashBurst";

/**
 * CASH_VACUUM — Phase 2 (B2–B5): the customer's payment as bills and coins
 * on the counter, swept into the wallet with a finger or the mouse.
 *
 * Each piece is physically collected by pointer swipe. The parent applies
 * that piece's value to the wallet only after this component reports it.
 *
 * One broad swipe picks up every piece it passes near (CASH.HIT_RADIUS_PX
 * past the piece's own edge); more swipes get the rest. Each piece is
 * collected at most once. The tray owns its pointer
 * (pointer capture, `touch-action: none`) and sits on the order card, over
 * a finished dish, so a sweep here can never reach the cutting board.
 */
export function CashVacuum({
  payCents,
  tipCents,
  walletRef,
  reducedMotion,
  onPieceCollected,
  onRemaining,
  variant = "counter",
  anchors,
  onDone,
}: {
  payCents: number;
  tipCents: number;
  /** Where collected pieces fly to — the wallet counter. */
  walletRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  onRemaining: (cents: number) => void;
  /** Credit a bill/coin only after the player's swipe collects it. */
  onPieceCollected?: (cents: number, isTip: boolean) => void;
  /**
   * "table" (developer 2026-10-26: "the cash near their dining table … collect it like idle
   * games"): the same pieces lying loose on the customer's table, no tray box, no line after.
   */
  variant?: "counter" | "table";
  /**
   * Table look (developer 2026-10-26, "money piled up … on the side of the table and chairs,
   * spread across their seats"): where the bundles pile up, in % of the tray. Pieces go to the
   * piles in turn and stack upward, so each pile reads as a small stack of bills.
   */
  anchors?: readonly { x: number; y: number }[];
  /** Called once, when the last piece is in. */
  onDone?: () => void;
}) {
  const pieces = useMemo(() => cashPieces(payCents, tipCents), [payCents, tipCents]);
  const total = payCents + tipCents;
  const table = variant === "table";
  const piles = table && anchors && anchors.length > 0 ? anchors : null;
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
      const dx = piles ? 0 : ((50 - p.x) / 100) * tray.width;
      const dy = piles ? -24 : ((50 - p.y) / 100) * tray.height;
      el.animate(
        [
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg) scale(0.3)`,
            opacity: 0,
          },
          { transform: `translate(-50%, -50%) rotate(${rotOf(p.rot)}deg) scale(1)`, opacity: 1 },
        ],
        { duration: 420, delay: i * 35, easing: "cubic-bezier(.2,1.4,.4,1)", fill: "backwards" },
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one burst per payment
  }, []);

  /** A bundle in a pile lies nearly straight; a loose piece keeps its tilt. */
  const rotOf = (rot: number) => (piles ? rot / 6 : rot);

  function collect(i: number) {
    if (collected.current[i]) return;
    collected.current[i] = true;
    const remaining = cashRemaining(pieces, collected.current);
    onRemaining(remaining);
    const piece = pieces[i]!;
    onPieceCollected?.(piece.cents, piece.tip);
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
            { transform: `translate(-50%, -50%) rotate(${rotOf(p.rot)}deg) scale(1)`, opacity: 1 },
            {
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rotOf(p.rot)}deg) scale(0.35)`,
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
    <div className={table ? "absolute inset-0" : "mt-2"}>
      <div
        ref={trayRef}
        className={
          variant === "table"
            ? "absolute inset-0 touch-none select-none"
            : "relative h-[68px] w-full touch-none select-none overflow-hidden rounded-[14px] border border-walnut/15 bg-walnut/[0.07] shadow-inner"
        }
        data-testid="cash-tray"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = { x: e.clientX, y: e.clientY };
          setTouched(true);
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
              piles
                ? p.tip
                  ? "cash-bundle cash-bundle--tip pointer-events-none absolute"
                  : "cash-bundle pointer-events-none absolute"
                : p.kind === "coin"
                  ? "pointer-events-none absolute h-[22px] w-[22px] rounded-full border border-[#9a7a2a] bg-[radial-gradient(circle_at_35%_35%,#f6dc8a,#c9a13e)] shadow-[0_1px_2px_rgba(62,40,25,0.35)]"
                  : p.tip
                    ? "pointer-events-none absolute h-[22px] w-[40px] rounded-[4px] border border-[#a8862c] bg-[linear-gradient(135deg,#f3d77a,#d9b048)] shadow-[0_1px_3px_rgba(62,40,25,0.35)]"
                    : "pointer-events-none absolute h-[22px] w-[40px] rounded-[4px] border border-[#5d7d44] bg-[linear-gradient(135deg,#a9c98a,#7fa262)] shadow-[0_1px_3px_rgba(62,40,25,0.35)]"
            }
            style={
              piles
                ? pileStyle(i, p.rot, piles)
                : {
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
                  }
            }
          />
        ))}
        {piles && !touched ? <SwipeHint at={piles[0]!} /> : null}
        {!piles && !touched ? (
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

/**
 * Where piece `i` lies in a pile: piles take pieces in turn, two bundles side by side per layer,
 * each layer 6 px higher, so later pieces sit on top (they come later in the DOM).
 */
function pileStyle(i: number, rot: number, piles: readonly { x: number; y: number }[]) {
  const a = piles[i % piles.length]!;
  const k = Math.floor(i / piles.length);
  const side = k % 2 === 0 ? -9 : 9;
  const layer = Math.floor(k / 2);
  return {
    left: `calc(${a.x}% + ${side}px)`,
    top: `calc(${a.y}% - ${layer * 6}px)`,
    transform: `translate(-50%, -50%) rotate(${rot / 6}deg)`,
    zIndex: 1 + k,
  };
}

/** "Swipe to collect" by the first pile: gold chevrons, a pointing hand and a paper label. */
function SwipeHint({ at }: { at: { x: number; y: number } }) {
  return (
    <span
      className="cash-hint pointer-events-none absolute"
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      data-testid="cash-hint"
    >
      <span className="cash-hint-sparkle" />
      <span className="cash-hint-chevrons">︽</span>
      <span className="cash-hint-hand">👆</span>
      <span className="cash-hint-label">Swipe to collect</span>
    </span>
  );
}
