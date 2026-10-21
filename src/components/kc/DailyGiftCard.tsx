import { useEffect, useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import {
  dailyGiftAmount,
  dailyGiftDue,
  dailyGiftTakenToday,
  AD_BONUSES_FROM_LEVEL,
} from "@/game/ads/adBonuses";
import { GIFT_STREAK, giftStreakState } from "@/game/daily/giftStreak";
import { dailyKeyFor } from "@/game/daily/DailyOrderManager";
import { formatUsd } from "@/game/money";
import { cn } from "@/lib/utils";

/**
 * The device-local day, kept current while the screen is open: re-read every
 * 30 s and whenever the page comes back (resume, tab switch), so the card
 * turns over at midnight without a reload. Nothing is stored.
 */
function useToday(): string {
  const [day, setDay] = useState(() => dailyKeyFor(new Date()));
  useEffect(() => {
    const check = () => setDay(dailyKeyFor(new Date()));
    const t = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  return day;
}

/**
 * DAILY_GIFT_CARD — Phase 5 (B3/B4/B11, developer 2026-10-21): the daily
 * gift, always visible on the Kitchen screen. It shows whether today's gift
 * is ready (and how much) or already taken, and the gift streak's week —
 * seven days, the Day 3 ($100) and Day 7 ($300) rewards marked. Tapping a
 * ready gift opens the SAME gift sheet the game already had (App's
 * openDailyGift → AdBonusSheet), so there is still exactly one place a gift
 * is taken. The streak counts days in a row the gift was taken
 * (daily/giftStreak.ts); after a missed day it says a new streak starts —
 * nothing earned is lost. Hidden before the gift exists (Level 3).
 */
export function DailyGiftCard({
  save,
  levelNumber,
  onOpen,
}: {
  save: SaveData;
  levelNumber: number;
  onOpen: () => void;
}) {
  const today = useToday();
  if (levelNumber < AD_BONUSES_FROM_LEVEL) return null;
  const now = new Date();
  // `today` re-renders the card when the day turns; the reads use the same moment.
  void today;
  const due = dailyGiftDue(save, levelNumber, now);
  const taken = dailyGiftTakenToday(save, now);
  const s = giftStreakState(save, now);
  const rewardToday = !taken ? GIFT_STREAK.REWARDS[s.todayDay] : undefined;
  const ready = due > 0;

  return (
    <button
      type="button"
      onClick={ready ? onOpen : undefined}
      aria-disabled={!ready}
      data-testid="kitchen-gift"
      data-state={ready ? "ready" : "taken"}
      data-day={s.todayDay}
      data-done={s.done}
      className={cn(
        "w-[168px] max-w-full rounded-[16px] border px-2.5 py-2 text-left shadow-soft backdrop-blur-sm",
        ready
          ? "press border-gold/70 bg-walnut-dark/70 ring-1 ring-gold/40"
          : "cursor-default border-ivory/20 bg-walnut-dark/55",
      )}
    >
      <span className="block font-ui text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold">
        🎁 Daily gift
      </span>
      <span
        className={cn(
          "block truncate font-ui text-[13px] font-extrabold leading-tight",
          ready ? "text-ivory" : "text-ivory/65",
        )}
        data-testid="kitchen-gift-status"
      >
        {ready
          ? `${formatUsd(due)} · Take ›`
          : taken
            ? "✓ Taken today"
            : formatUsd(dailyGiftAmount(levelNumber))}
      </span>
      {/* The streak's week: days done, today, and the two rewards. */}
      <span className="mt-1.5 flex items-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: GIFT_STREAK.CYCLE }, (_, i) => {
          const day = i + 1;
          const done = day <= s.done;
          const isToday = day === s.todayDay && !taken;
          const reward = GIFT_STREAK.REWARDS[day];
          return (
            <span
              key={day}
              data-gift-day={day}
              data-gift-done={done}
              className={cn(
                "grid h-[18px] flex-1 place-items-center rounded-[6px] font-ui text-[9.5px] font-extrabold",
                done
                  ? "bg-gold text-walnut-dark"
                  : isToday
                    ? "border border-dashed border-gold/80 text-gold"
                    : "bg-ivory/15 text-ivory/55",
              )}
            >
              {reward ? (day === 7 ? "★" : "$") : day}
            </span>
          );
        })}
      </span>
      <span
        className="mt-1 block font-ui text-[10.5px] font-bold leading-tight text-ivory/80"
        data-testid="kitchen-gift-line"
      >
        {s.restarted
          ? "Welcome back! A new streak starts today."
          : !taken
            ? rewardToday
              ? `Day ${s.todayDay} today: +${formatUsd(rewardToday)}`
              : s.next
                ? `Day ${s.todayDay} today · Day ${s.next.day}: +${formatUsd(s.next.amount)}`
                : `Day ${s.todayDay} today`
            : s.next
              ? `Day ${s.done}/7 · Day ${s.next.day}: +${formatUsd(s.next.amount)}`
              : "Week complete! A new week starts tomorrow."}
      </span>
    </button>
  );
}
