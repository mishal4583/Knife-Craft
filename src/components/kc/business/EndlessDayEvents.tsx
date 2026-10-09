import type { SaveData } from "@/game/SaveManager";
import { getBusinessDish } from "@/game/business/businessDishCatalog";
import { formatUsd } from "@/game/business/businessCurrency";
import { hasClaimedToday } from "@/game/daily/DailyOrderManager";
import {
  RESTAURANT_EVENT_RULES,
  endlessEventsActive,
  eventsForDay,
} from "@/game/restaurant/restaurantEvents";
import { Panel } from "../common/primitives";

const EVENT_EMOJI = { "dinner-rush": "🔥", "large-group": "👥", "todays-special": "⭐" } as const;

/**
 * ENDLESS_DAY_EVENTS — today's Endless Restaurant events (Dinner Rush, Large
 * Group, Today's Special), read from the same deterministic roll the day's
 * demand and order pool use (restaurantEvents.eventsForDay). Display only, on
 * the Service and Business screens — never during cutting. Renders nothing
 * outside the Endless Restaurant (campaign, the classic Business Day, the
 * release build).
 */
export function EndlessDayEvents({ save, compact = false }: { save: SaveData; compact?: boolean }) {
  if (!endlessEventsActive(save)) return null;
  const events = eventsForDay(save, save.business.calendar.businessDay);
  if (events.length === 0) return null;
  const bonusClaimed = hasClaimedToday(save.dailyOrder, new Date());
  const sharePct = Math.round(RESTAURANT_EVENT_RULES["todays-special"].bonusShare * 100);
  return (
    <div data-testid="endless-events">
      <Panel tone="cream" className="mb-3 p-3">
        <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-copper">
          Today in your restaurant
        </p>
        <ul className="mt-1 space-y-1">
          {events.map((e) => {
            const rules = RESTAURANT_EVENT_RULES[e.id];
            const dish = e.id === "todays-special" ? getBusinessDish(e.dishId) : undefined;
            return (
              <li key={e.id} data-event={e.id} className="font-ui text-[13.5px] leading-snug">
                <span className="font-extrabold text-walnut-dark">
                  {EVENT_EMOJI[e.id]} {rules.title}
                  {dish ? `: ${dish.name}` : ""}
                </span>
                {compact ? null : <span className="text-walnut/70"> — {rules.line}</span>}
                {e.id === "todays-special" ? (
                  <span className="block font-hand text-[14px] text-walnut/70">
                    {bonusClaimed
                      ? "Today's Special bonus already earned today."
                      : save.business.todaysSpecialServedDay === save.business.calendar.businessDay
                        ? `Served ✓ — at closing you earn ${sharePct}% of today's restaurant revenue, up to ${formatUsd(e.dailyBonus)}.`
                        : `Serve it today: at closing you earn ${sharePct}% of today's restaurant revenue, up to ${formatUsd(e.dailyBonus)} (once a day).`}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
