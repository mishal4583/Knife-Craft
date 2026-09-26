import {
  Apple,
  ChefHat,
  CircleUserRound,
  CookingPot,
  Fish,
  Hammer,
  PackageOpen,
  Refrigerator,
  ShoppingBasket,
  Store,
  Truck,
  Utensils,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ShopCategory = "knives" | "boards" | "equipment" | "staff" | "suppliers" | "ingredients" | "blacksmith";

export type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  icon: LucideIcon;
  accent: string;
  stats: Array<[string, string]>;
};

export const categories: Array<{ id: ShopCategory; label: string; icon: LucideIcon }> = [
  { id: "knives", label: "Knives", icon: Utensils },
  { id: "boards", label: "Cutting Boards", icon: PackageOpen },
  { id: "equipment", label: "Equipment", icon: Refrigerator },
  { id: "staff", label: "Staff", icon: CircleUserRound },
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "ingredients", label: "Ingredients", icon: ShoppingBasket },
  { id: "blacksmith", label: "Blacksmith", icon: Hammer },
];

export const categoryCopy: Record<ShopCategory, { title: string; description: string }> = {
  knives: { title: "Knives", description: "Choose the perfect blade for speed, precision, and dependable prep." },
  boards: { title: "Cutting Boards", description: "A reliable surface makes every chop cleaner and every service smoother." },
  equipment: { title: "Kitchen Equipment", description: "Invest in dependable equipment that keeps your kitchen moving." },
  staff: { title: "Staff", description: "Hire talented people to improve service, cleanliness, and popularity." },
  suppliers: { title: "Suppliers", description: "Build partnerships for fresher stock, better prices, and larger orders." },
  ingredients: { title: "Fresh Ingredients", description: "Select quantities, review your basket, and stock the pantry." },
  blacksmith: { title: "Blacksmith", description: "Forge your knife. Cut faster. Cut better." },
};

export const products: Record<Exclude<ShopCategory, "ingredients" | "blacksmith">, Product[]> = {
  knives: [
    { id: "basic-knife", name: "Basic Knife", price: 0, description: "A reliable all-purpose knife for everyday cutting.", icon: Utensils, accent: "starter", stats: [["Cutting speed", "2/5"], ["Precision", "2/5"], ["Durability", "3/5"]] },
    { id: "chef-knife", name: "Chef Knife", price: 1200, description: "A versatile blade that handles most ingredients effortlessly.", icon: Utensils, accent: "steel", stats: [["Cutting speed", "3/5"], ["Precision", "4/5"], ["Durability", "3/5"]] },
    { id: "santoku", name: "Santoku Knife", price: 2800, description: "Clean, precise slices for vegetables, meat, and fish.", icon: Utensils, accent: "copper", stats: [["Cutting speed", "4/5"], ["Precision", "4/5"], ["Durability", "4/5"]] },
    { id: "cleaver", name: "Heavy Cleaver", price: 4000, description: "High power for bones, dense produce, and quick chopping.", icon: Utensils, accent: "iron", stats: [["Cutting speed", "4/5"], ["Precision", "3/5"], ["Durability", "5/5"]] },
  ],
  boards: [
    { id: "wood-board", name: "Wooden Board", price: 0, description: "Classic, sturdy, and gentle on every blade.", icon: PackageOpen, accent: "starter", stats: [["Knife friendly", "4/5"], ["Durability", "3/5"], ["Hygiene", "3/5"]] },
    { id: "bamboo-board", name: "Bamboo Board", price: 1200, description: "Lightweight, durable, and naturally moisture resistant.", icon: PackageOpen, accent: "honey", stats: [["Knife friendly", "4/5"], ["Durability", "4/5"], ["Hygiene", "4/5"]] },
    { id: "maple-board", name: "Maple Board", price: 2800, description: "Premium hardwood with a smooth cutting surface.", icon: PackageOpen, accent: "maple", stats: [["Knife friendly", "5/5"], ["Durability", "4/5"], ["Hygiene", "4/5"]] },
    { id: "walnut-board", name: "Walnut Board", price: 4000, description: "A rich, heavy-duty board for professional kitchens.", icon: PackageOpen, accent: "walnut", stats: [["Knife friendly", "5/5"], ["Durability", "5/5"], ["Hygiene", "4/5"]] },
  ],
  equipment: [
    { id: "basic-fridge", name: "Reach-In Fridge", price: 3500, description: "Compact cold storage for a growing kitchen.", icon: Refrigerator, accent: "steel", stats: [["Storage", "50 slots"], ["Freshness", "+20%"], ["Energy", "Low"]] },
    { id: "commercial-fridge", name: "Commercial Fridge", price: 7500, description: "More room and better cooling for busy service.", icon: Refrigerator, accent: "iron", stats: [["Storage", "100 slots"], ["Freshness", "+40%"], ["Energy", "Medium"]] },
    { id: "pro-fridge", name: "Professional Fridge", price: 12000, description: "Maximum storage and efficiency for expert kitchens.", icon: Refrigerator, accent: "steel", stats: [["Storage", "200 slots"], ["Freshness", "+70%"], ["Energy", "Medium"]] },
    { id: "range", name: "Copper Range", price: 6200, description: "Even heat and fast recovery during the dinner rush.", icon: CookingPot, accent: "copper", stats: [["Cooking speed", "+35%"], ["Capacity", "6 pans"], ["Energy", "Medium"]] },
  ],
  staff: [
    { id: "manager", name: "Manager", price: 5000, description: "Keeps service efficient and the whole team focused.", icon: CircleUserRound, accent: "copper", stats: [["Popularity", "+1"], ["Efficiency", "+15%"], ["Role", "Operations"]] },
    { id: "line-cook", name: "Line Cook", price: 3500, description: "Prepares ingredients and handles the busiest orders.", icon: CookingPot, accent: "honey", stats: [["Prep speed", "+20%"], ["Capacity", "+1 order"], ["Role", "Kitchen"]] },
    { id: "head-chef", name: "Head Chef", price: 8000, description: "Unlocks advanced recipes and improves every plate.", icon: ChefHat, accent: "starter", stats: [["Popularity", "+3"], ["Quality", "+25%"], ["Role", "Kitchen"]] },
    { id: "inspector", name: "Inspector", price: 6500, description: "Maintains standards and reduces spoilage risk.", icon: CircleUserRound, accent: "iron", stats: [["Spoilage", "-20%"], ["Hygiene", "+30%"], ["Role", "Safety"]] },
  ],
  suppliers: [
    { id: "local", name: "Local Market", price: 0, description: "Fresh produce from nearby farms with no commitment.", icon: Store, accent: "starter", stats: [["Discount", "0%"], ["Minimum", "None"], ["Term", "No lock-in"]] },
    { id: "wholesale", name: "Wholesale", price: 5000, description: "Bulk savings and reliable deliveries for growth.", icon: Truck, accent: "honey", stats: [["Discount", "10–20%"], ["Minimum", "5,000"], ["Term", "1 month"]] },
    { id: "premium", name: "Premium Supplier", price: 12000, description: "Exceptional produce and seafood for signature dishes.", icon: Store, accent: "copper", stats: [["Discount", "25–40%"], ["Minimum", "15,000"], ["Term", "3 months"]] },
  ],
};

export const ingredients: Product[] = [
  { id: "carrot", name: "Carrots", price: 120, description: "Crisp and sweet", icon: Apple, accent: "copper", stats: [["Freshness", "98%"]] },
  { id: "tomato", name: "Tomatoes", price: 100, description: "Sun-ripened", icon: Apple, accent: "starter", stats: [["Freshness", "96%"]] },
  { id: "potato", name: "Potatoes", price: 80, description: "Pantry staple", icon: Apple, accent: "honey", stats: [["Freshness", "99%"]] },
  { id: "mushroom", name: "Mushrooms", price: 200, description: "Earthy and tender", icon: Store, accent: "walnut", stats: [["Freshness", "94%"]] },
  { id: "salmon", name: "River Salmon", price: 380, description: "Delivered today", icon: Fish, accent: "copper", stats: [["Freshness", "100%"]] },
  { id: "flour", name: "Milled Flour", price: 90, description: "Fine restaurant grade", icon: Wheat, accent: "maple", stats: [["Quality", "A grade"]] },
];
