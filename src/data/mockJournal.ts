import type { Achievement, Customer, JournalData, Milestone } from "@/types/game";

export const mockAchievements: Achievement[] = [
  { id: "first-slice", name: "First Slice", desc: "Cut your very first tomato", done: true },
  { id: "steady-hand", name: "Steady Hand", desc: "Five perfect cuts in a row", done: true },
  {
    id: "morning-regular",
    name: "Morning Regular",
    desc: "Prep on seven different days",
    done: true,
  },
  { id: "board-collector", name: "Board Collector", desc: "Own five cutting boards", done: false },
  { id: "quiet-mastery", name: "Quiet Mastery", desc: "Score 100% on any prep", done: false },
];

export const mockCustomers: Customer[] = [
  {
    id: "regular",
    name: "Morning Regular",
    line: "Same as usual.",
    favorite: "Garden Salad",
    visits: 7,
    glyph: "☕",
  },
  {
    id: "florist",
    name: "The Florist",
    line: "Something green today.",
    favorite: "Herb Focaccia",
    visits: 4,
    glyph: "💐",
  },
  {
    id: "student",
    name: "Quiet Student",
    line: "Whatever's easiest.",
    favorite: "Morning Toast Board",
    visits: 5,
    glyph: "📚",
  },
  {
    id: "baker",
    name: "Baker Next Door",
    line: "I brought you flour.",
    favorite: "Stone Fruit Tart",
    visits: 2,
    glyph: "🥐",
  },
];

export const mockMilestones: Milestone[] = [
  { label: "Tomato Slicing", done: true },
  { label: "Basic Dicing", done: true },
  { label: "Garden Salad", done: true },
  { label: "Chiffonade", done: true },
  { label: "Julienne", done: false, requirement: "Level 8" },
  { label: "Nakiri Mastery", done: false, requirement: "Level 10" },
  { label: "Walnut Board", done: false, requirement: "Level 11" },
  { label: "Sushi Chapter", done: false, requirement: "Level 15" },
];

export const mockJournal: JournalData = {
  bestPreparations: [
    { name: "Garden Salad", score: 96 },
    { name: "Morning Toast Board", score: 88 },
    { name: "Stone Fruit Tart", score: 81 },
    { name: "Summer Ratatouille", score: 74 },
  ],
  signatureCuts: [
    { name: "Rounds", count: 214 },
    { name: "Half-Moons", count: 138 },
    { name: "Chiffonade", count: 62 },
    { name: "Fine Dice", count: 27 },
  ],
  achievements: mockAchievements,
  customers: mockCustomers,
  memories: [
    { date: "Day 1", text: "Cut my first tomato. The board still smelled new." },
    { date: "Day 4", text: "The morning regular said the salad looked lovely." },
    { date: "Day 7", text: "Bought a walnut board. It felt like a small ceremony." },
  ],
};
