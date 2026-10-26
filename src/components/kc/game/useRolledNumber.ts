import { useEffect, useRef, useState } from "react";
import { CASH } from "@/game/cashBurst";

/**
 * Phase 2 (B4) — `target` shown as a short roll from its previous value
 * (CASH.COUNTER_MS), immediate with Reduced Motion. Display only: it
 * always ends on `target`, whatever interrupts it.
 */
export function useRolledNumber(target: number, reduced: boolean): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / CASH.COUNTER_MS);
      const v = Math.round(a + (target - a) * (1 - (1 - k) * (1 - k)));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return shown;
}
