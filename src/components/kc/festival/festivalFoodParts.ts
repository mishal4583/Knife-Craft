/** Which pictures a festival's food uses (the drawing itself is FestivalFood.tsx). */
import type { FestivalMenu } from "@/game/festival/menus";
import type { FoodId } from "@/game/festival/types";
import { STATION_ART, TAP_ART } from "./festivalArt";

/** What a festival is known by: its base with its first things on (the sign, the chalkboard). */
export const signatureParts = (menu: FestivalMenu): FoodId[] => [
  menu.base.id,
  ...menu.layers.filter((id) =>
    [menu.mains[0].id, menu.toppings[0].id, menu.toppings[1].id].includes(id),
  ),
];

/** The machine a drink without its own picture uses, by its place: two taps, then the blender. */
const MACHINE_AT: readonly (string | undefined)[] = [
  TAP_ART["cola"],
  TAP_ART["lemonade"],
  undefined,
];
/** The machine's picture for a drink at a place (a painted drink keeps its own). */
export const machinePicture = (drink: FoodId, place: number): string =>
  TAP_ART[drink] ?? (drink === "milkshake" ? undefined : MACHINE_AT[place]) ?? STATION_ART.blender;
