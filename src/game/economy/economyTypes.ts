/**
 * ECONOMY_TYPES — Economy V2 Phase 1 (foundation). Pure type definitions
 * for the settlement/ledger model described in the Economy V2 design
 * spec §30/§45. Deliberately NOT wired into SaveData yet (that's Phase
 * 11/"ledger persistence" — a later, separate integration step) — this
 * file exists so Phase 2+ calculators have a stable, typed shape to
 * return, and so a future persistence layer has a stable shape to save,
 * without either depending on the other prematurely.
 *
 * This module never touches organizationManager.ts/organizationTypes.ts
 * (PreparedOutput/Destination/assignedTo[]) — it is a completely
 * separate, additive concern layered on top of the existing recipePay
 * revenue result, per the design spec's own "wrap around gameplay,
 * never replace it" mandate.
 */
import type { QualityLabel } from "@/types/game";

/** Every kind of persistent money movement the design spec enumerates (§30/§45) — a superset covering phases not yet implemented, so a future phase never needs to widen this union just to add its own transaction kind retroactively. */
export type EconomyTransactionType =
  | "RECIPE_REVENUE"
  | "QUALITY_BONUS"
  | "DAILY_REWARD"
  | "ENDLESS_REVENUE"
  | "INGREDIENT_COGS"
  | "SHARPENING"
  | "KNIFE_PURCHASE"
  | "BOARD_PURCHASE"
  | "KITCHEN_INVESTMENT"
  | "OPERATING_COST";

/**
 * One line of the economic ledger (design spec §30). `amount` is signed:
 * positive for income (RECIPE_REVENUE, QUALITY_BONUS, ...), negative for
 * an expense (INGREDIENT_COGS, SHARPENING, ...) — so a plain sum of a
 * transaction list's `amount` fields IS the net cash effect, with no
 * separate sign-convention lookup needed by a future ledger UI.
 *
 * This type is NOT yet part of SaveData (see this file's own header
 * doc) — `id`/`timestamp` are here so a future persistence phase can
 * adopt this exact shape without redesigning it, not because anything
 * currently stores them.
 */
export type EconomyTransaction = {
  id: string;
  timestamp: number;
  type: EconomyTransactionType;
  /** Signed: positive = income, negative = expense. Integer currency units — see currency.ts's own doc on why floats are never used here. */
  amount: number;
  /** Opaque provenance — a recipe id, knife id, etc. Never parsed by ledger logic itself. */
  source: string;
  context?: string;
};

/**
 * The full breakdown of one recipe's economic settlement (design spec
 * §31/§34/§35) — computed by EconomySettlement.computeSettlement().
 * Every field the design spec's "settlement UI" (§34) needs to render
 * a transparent, non-double-counted breakdown is already here, so a
 * later UI phase only needs to format these fields, never recompute
 * them differently.
 *
 * Accounting identity this type guarantees (see EconomySettlement.ts
 * for the actual enforcement): `netResult === revenue - finalCOGS +
 * qualityBonus`, clamped at 0 — Yield Bonus is NOT a separate revenue
 * line (design spec §35's explicit anti-double-counting rule); it is
 * only ever visible as the reason `finalCOGS` differs from
 * `baselineCOGS * chapterMultiplier`, exposed here as `yieldSavings`
 * for display purposes only.
 */
export type SettlementResult = {
  recipeId: string;
  chapter: number;
  /** The raw 0-100 preparation score this settlement was computed from. */
  score: number;
  grade: QualityLabel;
  /** recipePay(recipe, chapter) — UNCHANGED, still the single source of base revenue (design spec §3/§6/§49). */
  revenue: number;
  /** Σ ingredient cost-weight across recipe.components, chapter-independent (mirrors recipeBase's own chapter-independence in recipePay.ts). */
  baselineCOGS: number;
  /** Grade-driven waste multiplier applied on top of baselineCOGS*chapterMultiplier — see ingredientCostRegistry.ts's WASTE_FACTOR_BY_GRADE. 1.0 = the "Honest" baseline (neither more nor less waste than assumed by baselineCOGS itself). */
  wasteFactor: number;
  /** The actual ingredient expense this settlement charges — round(baselineCOGS * chapterMultiplier(chapter) * wasteFactor). */
  finalCOGS: number;
  /** Informational only (design spec §13/§35: "not revenue"): baselineCOGS*chapterMultiplier*(1-wasteFactor) — positive when this grade wasted LESS than the Honest baseline, negative when it wasted MORE (Rustic/Learning). Never added to netResult separately; it is already reflected inside finalCOGS. */
  yieldSavings: number;
  /** Economy V2 Phase 8 — informational only, signed (mirrors `yieldSavings`'s own sign convention): positive when the selected supplier LOWERED the chapter-scaled baseline (Wholesale), negative when it RAISED it (Premium), 0 for Local Market or when unspecified. Already reflected inside `finalCOGS`, never added to netResult separately. Applied FIRST in the pipeline, before the quality waste factor and every other modifier (supplier.ts's getSupplierModifier). */
  supplierCOGSAdjustment: number;
  /** Economy V2 Phase 5 — informational only, mirrors `yieldSavings`'s own doc exactly: always >= 0, already reflected inside `finalCOGS`, never added to netResult a second time. The equipped knife's + board's combined situational COGS reduction for THIS recipe (EconomySettlement.getEquipmentModifier via equipmentSpecialization.ts) — 0 whenever equipment is neutral/unspecified, so every pre-Phase-5 caller sees this field at 0 with no other value changed. */
  equipmentCOGSSavings: number;
  /** Economy V2 Phase 6 — informational only, same shape as `equipmentCOGSSavings` but opposite direction: always >= 0, already reflected inside `finalCOGS`. The equipped knife's current dullness adding a small amount of EXTRA cost (sharpness.ts's getSharpnessModifier) — 0 at full (100) sharpness or when sharpness is unspecified, so every pre-Phase-6 caller sees this field at 0 with no other value changed. */
  sharpnessCOGSPenalty: number;
  /** Economy V2 Phase 7 — informational only, mirrors `equipmentCOGSSavings`'s own doc exactly: always >= 0, already reflected inside `finalCOGS`. The combined, already-capped COGS reduction from every OWNED staff member applicable to THIS recipe (staff.ts's getStaffModifier) — 0 with no staff owned or when unspecified, so every pre-Phase-7 caller sees this field at 0 with no other value changed. */
  staffCOGSSavings: number;
  qualityBonusRate: number;
  /** round(revenue * qualityBonusRate). */
  qualityBonus: number;
  /** max(0, revenue - finalCOGS + qualityBonus) — the hard "never negative" floor (design spec §5/§8/§39) is enforced HERE, not left to the caller. */
  netResult: number;
  /** Ledger-shaped records for this one settlement, in display/booking order (revenue first, then COGS, then quality bonus) — ready for a future ledger-persistence phase to append verbatim; not persisted by this module itself. */
  transactions: EconomyTransaction[];
};
