import { useEffect, useRef, useState } from "react";
import { formatUsd } from "@/game/money";

/** The first bag comes after this much time in the game… */
export const FLOATING_CASH_FIRST_MS = 60_000;
/** …then one every this much… */
export const FLOATING_CASH_EVERY_MS = 180_000;
/** …and each one drifts away if left alone this long. */
export const FLOATING_CASH_SHOW_MS = 15_000;
/** A tap within this time of it appearing is ignored (it never lands under a finger by surprise). */
export const FLOATING_CASH_ARM_MS = 700;

/** Session time of the next bag (memory only, not saved: a reload starts the wait again). */
let nextAt = 0;

/**
 * FLOATING CASH (ads/adBonuses.ts, kind floating_cash): a small bag of cash
 * that drifts in now and then over the Kitchen's painted shelves (mid-left,
 * clear of the ranking card, the shortcuts and Today's Order). Only on the
 * Kitchen: the map is all tappable rooms. Tapping it opens the ad-bonus sheet ("📺 Watch · +$X"); nothing
 * is paid by the tap itself. `active` is App's "nothing else on screen"
 * (no card, sheet, tutorial pointer or ad), so it never covers a choice.
 */
export function FloatingCash({
  amount,
  active,
  onOpen,
}: {
  amount: number;
  active: boolean;
  onOpen: () => void;
}) {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const shownRef = useRef<number | null>(null);
  shownRef.current = shownAt;

  useEffect(() => {
    if (nextAt === 0) nextAt = Date.now() + FLOATING_CASH_FIRST_MS;
  }, []);

  useEffect(() => {
    if (!active) {
      setShownAt(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const s = shownRef.current;
      if (s !== null) {
        if (now - s > FLOATING_CASH_SHOW_MS) {
          nextAt = now + FLOATING_CASH_EVERY_MS;
          setShownAt(null);
        }
      } else if (now >= nextAt) setShownAt(now);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [active]);

  if (shownAt === null || !active || amount <= 0) return null;
  return (
    <button
      type="button"
      data-testid="floating-cash"
      aria-label={`Found cash: watch an ad for ${formatUsd(amount)}`}
      onClick={() => {
        if (Date.now() - shownAt < FLOATING_CASH_ARM_MS) return;
        nextAt = Date.now() + FLOATING_CASH_EVERY_MS;
        setShownAt(null);
        onOpen();
      }}
      className="press anim-pop absolute left-3 top-[44%] z-30 flex min-h-12 min-w-12 flex-col items-center"
    >
      <span className="anim-breathe grid h-14 w-14 place-items-center rounded-full border-2 border-gold bg-[radial-gradient(circle_at_35%_30%,#fff6d8,#f2cf74)] text-[30px] shadow-lift">
        💰
      </span>
      <span className="-mt-2 rounded-full border border-walnut-dark/40 bg-walnut-dark/90 px-2 py-0.5 font-ui text-[12px] font-extrabold text-ivory shadow-soft">
        📺 +{formatUsd(amount)}
      </span>
    </button>
  );
}
