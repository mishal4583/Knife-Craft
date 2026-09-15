/**
 * CAFE_DEFINITIONS — the authoritative café milestone roadmap (Phase 10A),
 * data only. Sourced from the project roadmap's explicit Level 1–100 café
 * expansion milestones. No visuals, no assets — see this module's own
 * doc header in cafeTypes.ts for why.
 */
import type { CafeMilestoneDefinition } from "./cafeTypes";

export const CAFE_MILESTONES: CafeMilestoneDefinition[] = [
  {
    id: "humble-kitchen",
    levelRequired: 1,
    title: "Humble Kitchen",
    description: "Where every chef starts — a cutting station and the basics.",
    unlocks: [
      { id: "cutting_station", type: "cutting_station", name: "Cutting Station" },
      { id: "basic_kitchen", type: "basic_kitchen", name: "Basic Kitchen" },
    ],
  },
  {
    id: "growing-kitchen",
    levelRequired: 10,
    title: "Growing Kitchen",
    description: "The kitchen starts to feel lived-in.",
    unlocks: [{ id: "plants", type: "plants", name: "Plants" }],
  },
  {
    id: "morning-cafe",
    levelRequired: 20,
    title: "Morning Café",
    description: "A coffee station joins the counter.",
    unlocks: [{ id: "coffee_station", type: "coffee_station", name: "Coffee Station" }],
  },
  {
    id: "working-kitchen",
    levelRequired: 30,
    title: "Working Kitchen",
    description: "A real cooking station, beyond just the board.",
    unlocks: [{ id: "cooking_station", type: "cooking_station", name: "Cooking Station" }],
  },
  {
    id: "bakery-corner",
    levelRequired: 40,
    title: "Bakery Corner",
    description: "A dedicated corner for bread and pastry work.",
    unlocks: [{ id: "bakery", type: "bakery", name: "Bakery" }],
  },
  {
    id: "neighborhood-cafe",
    levelRequired: 50,
    title: "Neighborhood Café",
    description: "Seating for the first customers.",
    unlocks: [{ id: "customer_seating", type: "customer_seating", name: "Customer Seating" }],
  },
  {
    id: "garden-cafe",
    levelRequired: 60,
    title: "Garden Café",
    description: "A garden extends the café outward.",
    unlocks: [{ id: "garden", type: "garden", name: "Garden" }],
  },
  {
    id: "pasta-kitchen",
    levelRequired: 70,
    title: "Pasta Kitchen",
    description: "A pasta station for a growing menu.",
    unlocks: [{ id: "pasta_station", type: "pasta_station", name: "Pasta Station" }],
  },
  {
    id: "drinks-counter",
    levelRequired: 80,
    title: "Drinks Counter",
    description: "A counter dedicated to drinks service.",
    unlocks: [{ id: "drinks_counter", type: "drinks_counter", name: "Drinks Counter" }],
  },
  {
    id: "fine-dining",
    levelRequired: 90,
    title: "Fine Dining",
    description: "The café steps up to fine dining.",
    unlocks: [{ id: "fine_dining", type: "fine_dining", name: "Fine Dining" }],
  },
  {
    id: "grand-cafe",
    levelRequired: 100,
    title: "Grand Café",
    description: "The full café, realized.",
    unlocks: [{ id: "grand_cafe", type: "grand_cafe", name: "Grand Café" }],
  },
  // Progression pass — Chapter 11 "Protein Kitchen" (101-110) and Chapter
  // 12 "Grand Service" (111-120) each get their own milestone, the same
  // way every earlier 10-level chapter already does. Level 100's "Grand
  // Café" stays the FIRST major restaurant arc's own capstone (untouched,
  // still gates the story FINALE at count 100 — see StoryManager/
  // storyDefinitions) — these two are what comes after it, not a
  // replacement for it.
  {
    id: "protein-kitchen",
    levelRequired: 110,
    title: "Protein Kitchen",
    description: "A dedicated station for chicken, steak and salmon joins the café.",
    unlocks: [{ id: "protein_station", type: "protein_station", name: "Protein Station" }],
  },
  {
    id: "grand-service",
    levelRequired: 120,
    title: "Grand Service",
    description: "Every station, every technique, one full night of service.",
    unlocks: [{ id: "grand_service", type: "grand_service", name: "Grand Service" }],
  },
];
