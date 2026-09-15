/**
 * CUISINE_TYPES — the 9 core cuisine families (restaurant-service brief
 * §15/§16). A cuisine is an IDENTITY layer, not a gameplay engine of its
 * own: it never adds a technique, never changes how a cut is evaluated,
 * and never gates content by itself (campaign levels/chapters still do
 * that). What it gives a recipe is presentation — which techniques read
 * as "this cuisine's signature", which ingredients it draws on, and the
 * chef/plating voice a recipe speaks in.
 *
 * Exactly 9 ids, matching §15 verbatim. Do not add a 10th — §15/§21 of
 * Chapters 18-25 are explicit that later chapters REUSE these families
 * rather than inventing new ones.
 */
import type { TechniqueId, IngredientId } from "../definitions";

export type CuisineId =
  | "italian"
  | "french"
  | "indian"
  | "mediterranean"
  | "mexican"
  | "japanese"
  | "chinese"
  | "thai"
  | "korean";

export type CuisineDefinition = {
  id: CuisineId;
  name: string;
  /** §16 — techniques characteristic of this cuisine. Not exclusive: every technique still works everywhere it already does. */
  signatureTechniques: TechniqueId[];
  /** §16 — a representative sample of ingredients this cuisine leans on. Not exclusive or exhaustive; any unlocked ingredient can still appear in any recipe the design calls for. */
  coreIngredients: IngredientId[];
  /** One line capturing the identity/plating/service feel (§16) — chef flavor text only, never read by gameplay logic. */
  identity: string;
  /** First chapter (1-25) where this cuisine's arc begins in the 250-level campaign (§17). */
  chapterStart: number;
};
