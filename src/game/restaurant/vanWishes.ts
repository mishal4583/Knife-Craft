import type { SaveData } from "../SaveManager";
import { getLevel, isCompleted } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import { paidOrdersFor } from "../levels/paidOrders";
import { deliveriesOf } from "./deliveries";
import { restaurantDayOf } from "./restaurantDay";
import { orderRequirements, serviceStockCheck } from "./campaignStock";
import { remainingMenuGuests } from "./menuGuests";
import { activeMenuRecipes, restaurantLevelOf } from "./restaurantMenu";
import { closingSuppliesFor, orderServiceFor, serviceSuppliesCheck } from "./serviceSupplies";
import { ticketsFor } from "./serviceTickets";
import type { CargoWishes } from "../business/crateCargo";

/**
 * What the restaurant would like on Unload the Van (developer 2026-11-27: "align the ingredients in the levels with respect to the orders or purchase of items that are required in the
 * restaurant"): today's deliveries and purchases, what the next service is short of, what it uses, and what the player's dishes are made of. It only READS the save; the van never moves
 * stock or money (the Market stays the only place to buy). The cargo only changes pictures, never a board's shape.
 */
export function cargoWishes(save: SaveData): CargoWishes {
  const today = restaurantDayOf(save).day;
  const delivered = [
    ...deliveriesOf(save)
      .history.filter((record) => record.day === today)
      .flatMap((record) => record.lines.map((line) => line.id)),
    // ingredients bought at the Market today
    ...Object.entries(save.business.inventory ?? {})
      .filter(
        ([, e]) => e && e.quantity > 0 && e.purchaseDay === save.business.calendar.businessDay,
      )
      .map(([id]) => id),
  ];

  const needed: string[] = [];
  const menu: string[] = [];
  const level = getLevel(save.levelProgress.highestUnlockedLevelId);
  if (level && !isCompleted(level.id, save.levelProgress)) {
    const n = levelNumber(level.id);
    const { tickets, progress } = ticketsFor(save.levelProgress, level);
    const paid = paidOrdersFor(progress, level.id).length;
    const remaining = tickets.slice(paid);
    const stock = serviceStockCheck(save, n, remaining, { ownOrders: true });
    if (stock.applies) {
      needed.push(...stock.missingRows.map((r) => r.ingredientId));
      menu.push(...stock.rows.map((r) => r.ingredientId));
    }
    const supplies = serviceSuppliesCheck(
      save,
      n,
      remaining.map((r, i) => orderServiceFor(n, paid + i, r)),
      { recipes: remaining, guests: remainingMenuGuests(save, level).length, firstCover: paid },
    );
    if (supplies.applies) {
      needed.push(...supplies.rows.filter((r) => r.missing > 0).map((r) => r.id));
      menu.push(...supplies.rows.filter((r) => r.need > 0).map((r) => r.id));
    }
    menu.push(...closingSuppliesFor(save, n).map((r) => r.id));
  }

  const reached = restaurantLevelOf(save.levelProgress);
  const yours = activeMenuRecipes(save.business.menuActivation, reached).flatMap((recipe) =>
    orderRequirements(save, recipe, "factor", reached).map((r) => r.ingredientId),
  );
  return { delivered, needed, menu, yours };
}
