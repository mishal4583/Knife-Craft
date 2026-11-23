import { useEffect, useState } from "react";
import { dailyKeyFor } from "@/game/daily/DailyOrderManager";

/**
 * The device-local day ("YYYY-MM-DD"), kept current while a screen is open: re-read every 30 s and when the window regains focus, so a card turns over at
 * midnight without a reload. Nothing is stored. No Page Visibility API (CLAUDE.md section 9, preflight): the timer catches a resume within 30 s.
 */
export function useToday(): string {
  const [day, setDay] = useState(() => dailyKeyFor(new Date()));
  useEffect(() => {
    const check = () => setDay(dailyKeyFor(new Date()));
    const t = window.setInterval(check, 30_000);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", check);
    };
  }, []);
  return day;
}
