import { mockBoards } from "./mockBoards";
import { mockDecorations } from "./mockDecor";
import { mockDailyOrder, mockIngredient } from "./mockDailyOrder";
import { mockJournal, mockMilestones } from "./mockJournal";
import { mockKnives } from "./mockKnives";
import { mockKitchen, mockPlayer, mockSettings } from "./mockPlayer";
import { mockRecipes } from "./mockRecipes";
import { mockTechniques } from "./mockTechniques";
import type { GameState } from "@/types/game";

export * from "./mockBoards";
export * from "./mockDecor";
export * from "./mockDailyOrder";
export * from "./mockJournal";
export * from "./mockKnives";
export * from "./mockPlayer";
export * from "./mockRecipes";
export * from "./mockTechniques";

/**
 * The single mock snapshot the UI renders from.
 * Replace this object with the real game state to go live.
 */
export const mockGameState: GameState = {
  screen: "gameplay",
  player: mockPlayer,
  kitchen: mockKitchen,
  currentOrder: mockDailyOrder,
  currentRecipe: mockRecipes[0]!,
  gameplay: {
    phase: "prep",
    ingredient: mockIngredient,
    technique: "Slice",
    cutProgress: 0,
    currentScore: 0,
    currentCombo: 0,
    currentCutQuality: null,
    isPaused: false,
    lastResult: null,
    previousBest: 92,
    rewardCredits: mockDailyOrder.reward,
  },
  progression: {
    milestones: mockMilestones,
    techniques: mockTechniques,
    unlockedRecipes: mockRecipes.filter((r) => r.unlocked).map((r) => r.id),
    unlockedKnives: mockKnives.filter((k) => k.owned).map((k) => k.id),
    unlockedBoards: mockBoards.filter((b) => b.owned).map((b) => b.id),
    masteredTechniques: ["slice", "half-moon"],
  },
  inventory: {
    knives: mockKnives,
    boards: mockBoards,
    decorations: mockDecorations,
    equippedKnifeId: "chef",
    equippedBoardId: "walnut",
  },
  journal: mockJournal,
  settings: mockSettings,
};