/**
 * BOARD_DEFINITIONS — the single authoritative board catalog (Phase 9),
 * mirroring src/game/knives/knifeDefinitions.ts. The Workshop/Boards UI
 * and PreparationScene both read from this one catalog. Prices/unlock
 * levels are initial economy values, kept as plain data so they can be
 * retuned later without touching any consuming code.
 */
import type { BoardDefinition } from "./boardTypes";

export const DEFAULT_BOARD_ID = "walnut" as const;

export const BOARD_CATALOG: BoardDefinition[] = [
  {
    id: "walnut",
    name: "Walnut Board",
    tagline: "The one you started on",
    description: "Classic walnut preparation board — warm, dependable, and always on the counter.",
    material: "Walnut wood",
    price: 0,
    unlockLevel: 1,
    visual: {
      tone: ["#8A5B36", "#6B4226", "#4B2D19"],
      pattern: "grain",
    },
  },
  {
    id: "maple",
    name: "Maple Board",
    tagline: "Pale and forgiving",
    description: "Light natural maple with a fine, even grain — a bright, airy counter presence.",
    material: "Maple wood",
    price: 300,
    unlockLevel: 10,
    visual: {
      tone: ["#E5C99A", "#D3B080", "#B99263"],
      pattern: "grain",
    },
  },
  {
    id: "herb",
    name: "Herb Garden Board",
    tagline: "A little green on the counter",
    description:
      "Warm wood with a soft sage inset, like a windowsill herb box built into the board.",
    material: "Wood with sage inset",
    price: 500,
    unlockLevel: 20,
    visual: {
      tone: ["#C7B285", "#A78E5C", "#7A6540"],
      pattern: "herb",
      accent: "#7FA06D",
    },
  },
  {
    id: "marble",
    name: "Marble Board",
    tagline: "Cool under the palm",
    description:
      "Pale Carrara marble with subtle natural veining — cool, quiet, and a little formal.",
    material: "Carrara marble",
    price: 750,
    unlockLevel: 30,
    visual: {
      tone: ["#F2EDE4", "#DCD5C8", "#BDB4A4"],
      pattern: "marble",
    },
  },
  {
    id: "darkoak",
    name: "Dark Oak Board",
    tagline: "Confident and deep",
    description: "Deep dark oak with heavy, pronounced grain — a serious, substantial presence.",
    material: "Dark oak wood",
    price: 1000,
    unlockLevel: 40,
    visual: {
      tone: ["#5C4326", "#402C17", "#28190C"],
      pattern: "grain",
    },
  },
  {
    id: "copper",
    name: "Chef's Copper Board",
    tagline: "The signature counter",
    description:
      "Warm show wood trimmed in polished copper — the reward for a well-stocked kitchen.",
    material: "Wood with copper trim",
    price: 1500,
    unlockLevel: 50,
    visual: {
      tone: ["#C6813F", "#A05F27", "#6B3B16"],
      pattern: "copper",
      accent: "#E0AA5C",
    },
  },
  {
    // Progression pass — Level 106's "STEAK PREPARATION" milestone
    // reward, matching the suggested "Butcher Board" reward exactly. New
    // data on the SAME procedural tone/pattern system every board above
    // already uses (no image assets).
    id: "butcherblock",
    name: "Butcher's Block",
    tagline: "Built for protein",
    description:
      "A thick, heavy-duty block built for steak and poultry work — deep enough to take a cleaver's full weight without a second thought.",
    material: "End-grain hardwood block",
    price: 1800,
    unlockLevel: 106,
    visual: {
      tone: ["#7A4A2E", "#5A331D", "#3A2010"],
      pattern: "grain",
    },
  },
  {
    // Progression pass — Level 109's "SALMON INTRODUCTION" milestone
    // reward, matching the suggested "Seafood Board" exactly.
    id: "seafoodslate",
    name: "Seafood Slate Board",
    tagline: "Cool stone for the catch",
    description:
      "Dark slate with a faint blue-grey sheen — cool underhand, built for fish and shellfish prep.",
    material: "Slate",
    price: 2000,
    unlockLevel: 109,
    visual: {
      tone: ["#5C6B72", "#404E54", "#28333A"],
      pattern: "marble",
    },
  },
];

export function findBoard(id: string): BoardDefinition | undefined {
  return BOARD_CATALOG.find((b) => b.id === id);
}

export function boardOrDefault(id: string): BoardDefinition {
  return findBoard(id) ?? BOARD_CATALOG[0]!;
}
