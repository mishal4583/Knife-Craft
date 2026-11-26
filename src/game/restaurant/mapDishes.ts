/**
 * THE REAL DISH IN THE WAITER'S HANDS (developer 2026-11-26: "let the waiter staffs deliver real dish with dish image that we have and properly place it in their hands").
 * The map's people used to carry an emoji (a bubble over a guest's head, nothing on a waiter). Now a "pick" stop of a route carries a `dish` token, and the view draws that dish's own
 * painted plate (`public/dishes/<recipe id>.webp`, the same pictures as the Kitchen's card) on the waiter's tray or in the guest's bubble:
 *  - `dish:<recipe id>` on the first floor: a dish from the active menu that has a picture (`mapDishIds`), given out to the pick stops in turn (`withDishes`);
 *  - an emoji on the Second Floor: the station's own food (pizza, coffee, a drink, a burger, ice cream, fries) as the painted icon of `public/icons/`.
 * Pure and deterministic (no random); it only decides what is drawn. Never touches the save, the stock or the money.
 */
import type { SaveData } from "../SaveManager";
import { dishArtUrl } from "../dishArt";
import { DISH_ART_IDS } from "../dishArtFiles";
import { activeMenuRecipes, restaurantLevelOf } from "./restaurantMenu";
import type { FloorActor } from "./floorLife";

export const DISH_TOKEN = "dish:";

/** The dishes the map's waiters and guests carry: the menu's dishes that have a painted picture (the `max` newest), else the ones the player has cooked, else none. */
export function mapDishIds(save: SaveData, max = 6): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (DISH_ART_IDS.has(id) && !out.includes(id) && out.length < max) out.push(id);
  };
  // the menu's recipes (a dish's picture is named by its recipe id), the newest unlocked first: those are what the guests are being served
  for (const r of activeMenuRecipes(
    save.business.menuActivation,
    restaurantLevelOf(save.levelProgress),
  ).reverse())
    add(r.id);
  if (out.length === 0)
    for (const [id, p] of Object.entries(save.recipeProgress ?? {})) if (p.done) add(id);
  return out;
}

/**
 * The cast with a dish on every "pick" stop that has none: the first floor's Server and guests carry the menu's dishes in turn (a different one on each trip, a different one for each
 * person). With no dish to give the cast is returned as it is.
 */
export function withDishes(cast: readonly FloorActor[], ids: readonly string[]): FloorActor[] {
  if (ids.length === 0) return [...cast];
  let n = 0;
  return cast.map((a) =>
    a.stops.some((s) => s.pose === "pick" && !s.dish)
      ? {
          ...a,
          stops: a.stops.map((s) =>
            s.pose === "pick" && !s.dish
              ? { ...s, dish: `${DISH_TOKEN}${ids[n++ % ids.length]}` }
              : s,
          ),
        }
      : a,
  );
}

/** The Second Floor's foods as painted icons (public/icons). */
const STATION_ICONS: Readonly<Record<string, string>> = {
  "☕": "coffee",
  "🥤": "cup-straw",
  "🍕": "pizza",
  "🍔": "burger",
  "🍦": "ice-cream",
  "🍟": "fries",
};

/** The picture a dish token is drawn as, or null (the emoji or nothing then). */
export function plateUrl(token: string | undefined): string | null {
  if (!token) return null;
  if (token.startsWith(DISH_TOKEN)) return dishArtUrl(token.slice(DISH_TOKEN.length));
  const icon = STATION_ICONS[token];
  return icon ? `${import.meta.env?.BASE_URL ?? "/"}icons/${icon}.webp` : null;
}
