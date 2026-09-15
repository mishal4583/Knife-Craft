/**
 * KNIFECRAFT — UI-facing type contract.
 * The UI never mutates gameplay values; it renders this shape and emits events.
 */

export type ScreenId =
  | "gameplay"
  | "kitchen"
  | "workshop"
  | "boards"
  | "recipes"
  | "recipe-detail"
  | "journey"
  | "techniques"
  | "journal"
  | "daily"
  | "decor"
  | "customers"
  | "settings";

/** Matches the Phase 1 reference's grade ladder exactly (knifecraft.html GRADE_THRESHOLDS). */
export type QualityLabel = "Masterful" | "Clean" | "Honest" | "Rustic" | "Learning";

export type Player = {
  name: string;
  level: number;
  rank: string;
  nextRank: string;
  nextRankLevel: number;
  levelProgress: number; // 0..100
  credits: number;
  totalPreparations: number;
  bestScore: number;
  daysPlayed: number;
};

export type Kitchen = {
  level: number;
  name: string;
  note: string;
  nextUpgrade: string;
  nextUpgradeLevel: number;
};

export type Ingredient = {
  id: string;
  name: string;
  glyph: string;
  technique: string;
  targetPieces: number;
};

export type Technique = {
  id: string;
  name: string;
  glyph: string;
  note: string;
  mastery: number; // 0..100
  stars: number; // 0..5
  unlocked: boolean;
  unlockRequirement?: string;
};

export type Knife = {
  id: string;
  name: string;
  tagline: string;
  traits: string[];
  stars: number;
  level: number;
  stats: { sharpness: number; weight: number; control: number };
  nextStats?: { sharpness: number; weight: number; control: number };
  upgradeCost?: number;
  owned: boolean;
  unlockRequirement?: string;
  price?: number;
  blade: string;
  handle: string;
};

export type Board = {
  id: string;
  name: string;
  material: string;
  note: string;
  owned: boolean;
  unlockRequirement?: string;
  price?: number;
  tone: [string, string, string];
};

export type Recipe = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  note: string;
  difficulty: number; // 1..5
  ingredients: string[];
  techniques: string[];
  best: number | null;
  mastery: number;
  reward: number;
  unlocked: boolean;
  unlockRequirement?: string;
  completed: boolean;
};

export type Decoration = {
  id: string;
  name: string;
  category: string;
  glyph: string;
  price: number;
  owned: boolean;
  placed: boolean;
};

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  done: boolean;
};

export type Customer = {
  id: string;
  name: string;
  line: string;
  favorite: string;
  visits: number;
  glyph: string;
};

export type Milestone = {
  label: string;
  done: boolean;
  requirement?: string;
};

export type DailyOrder = {
  day: string;
  recipeId: string;
  name: string;
  emoji: string;
  ingredients: string[];
  reward: number;
  note: string;
};

export type CutPath = { points: { x: number; y: number }[] };

/**
 * Fed by the gameplay engine; the UI only renders it. Metric names match
 * the Phase 1 reference: Evenness (gaps vs. ideal even division) and
 * Consistency (spread of the rendered gaps) are 0..100; Rhythm is a
 * bonus-only delta (e.g. +7) added to the base score, never a percentage
 * and never subtracted — see CutEvaluator.
 */
export type CutResult = {
  score: number;
  evenness: number;
  consistency: number;
  rhythmBonus: number;
  qualityLabel: QualityLabel;
  idealPath: CutPath[];
  playerPath: CutPath[];
};

export type GameplayPhase = "prep" | "cutting" | "result" | "plating" | "complete";

export type GameplayState = {
  phase: GameplayPhase;
  ingredient: Ingredient;
  technique: string;
  cutProgress: number; // pieces completed
  currentScore: number;
  currentCombo: number;
  currentCutQuality: QualityLabel | null;
  isPaused: boolean;
  lastResult: CutResult | null;
  previousBest: number;
  rewardCredits: number;
};

export type Progression = {
  milestones: Milestone[];
  techniques: Technique[];
  unlockedRecipes: string[];
  unlockedKnives: string[];
  unlockedBoards: string[];
  masteredTechniques: string[];
};

export type Inventory = {
  knives: Knife[];
  boards: Board[];
  decorations: Decoration[];
  equippedKnifeId: string;
  equippedBoardId: string;
};

export type JournalData = {
  bestPreparations: { name: string; score: number }[];
  signatureCuts: { name: string; count: number }[];
  achievements: Achievement[];
  customers: Customer[];
  memories: { date: string; text: string }[];
};

export type Settings = {
  sound: boolean;
  music: boolean;
  effects: boolean;
  reducedMotion: boolean;
};

export type GameState = {
  screen: ScreenId;
  player: Player;
  kitchen: Kitchen;
  currentOrder: DailyOrder;
  currentRecipe: Recipe;
  gameplay: GameplayState;
  progression: Progression;
  inventory: Inventory;
  journal: JournalData;
  settings: Settings;
};

/** Every callback the UI can emit. Wire these to the game engine. */
export type GameEvents = {
  onNavigate: (screen: ScreenId) => void;
  onStartPreparation: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToKitchen: () => void;
  onOpenRecipeBook: () => void;
  onOpenWorkshop: () => void;
  onOpenJournal: () => void;
  onSelectRecipe: (recipeId: string) => void;
  onSelectKnife: (knifeId: string) => void;
  onEquipKnife: (knifeId: string) => void;
  onUpgradeKnife: (knifeId: string) => void;
  onSelectBoard: (boardId: string) => void;
  onEquipBoard: (boardId: string) => void;
  onPurchaseItem: (itemId: string) => void;
  onUnlockItem: (itemId: string) => void;
  onOpenDailyOrder: () => void;
  onStartDailyOrder: () => void;
  onOpenKitchenDecor: () => void;
  onPurchaseDecoration: (itemId: string) => void;
  onSelectDecoration: (itemId: string) => void;
  onUpgradeKitchen: () => void;
  onRetryPreparation: () => void;
  onContinueAfterResult: () => void;
  onPlatingStart: () => void;
  onPlatingComplete: () => void;
  onContinue: () => void;
  onToggleSetting: (key: keyof Settings) => void;
  onResetProgress: () => void;
  /** Emitted by the placeholder cut surface — replace with engine output. */
  onCutRegistered: (result: CutResult) => void;
};
