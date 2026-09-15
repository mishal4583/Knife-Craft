import type { Kitchen, Player, Settings } from "@/types/game";

export const mockPlayer: Player = {
  name: "Chef",
  level: 7,
  rank: "Prep Cook",
  nextRank: "Line Cook",
  nextRankLevel: 8,
  levelProgress: 64,
  credits: 1240,
  totalPreparations: 48,
  bestScore: 96,
  daysPlayed: 7,
};

export const mockKitchen: Kitchen = {
  level: 2,
  name: "Corner Café Kitchen",
  note: "Morning light, one good window.",
  nextUpgrade: "Open Shelving",
  nextUpgradeLevel: 9,
};

export const mockSettings: Settings = {
  sound: true,
  music: true,
  effects: true,
  reducedMotion: false,
};
