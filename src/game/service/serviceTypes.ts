/**
 * SERVICE_TYPES — service profiles (brief §25). A level's `serviceProfile`
 * says how many customers/how much batching-branching-allocation are in
 * play; it never itself performs validation (RecipeValidator.ts does)
 * or generation (OrderGenerator.ts does) — this module is pure data.
 */
export type ServiceProfileId =
  | "EARLY_PREP"
  | "BASIC_SERVICE"
  | "BATCH_SERVICE"
  | "BRANCH_SERVICE"
  | "BISTRO_SERVICE"
  | "GRAND_SERVICE";

export type ServiceProfileDefinition = {
  id: ServiceProfileId;
  /** [min, max] concurrent customers this profile puts on the board. */
  customerRange: [number, number];
  batchingEnabled: boolean;
  branchingEnabled: boolean;
  allocationEnabled: boolean;
  /** Can more than one distinct recipe be active on the board at once? */
  multiRecipe: boolean;
};

export const SERVICE_PROFILES: Record<ServiceProfileId, ServiceProfileDefinition> = {
  EARLY_PREP: {
    id: "EARLY_PREP",
    customerRange: [1, 1],
    batchingEnabled: false,
    branchingEnabled: false,
    allocationEnabled: false,
    multiRecipe: false,
  },
  BASIC_SERVICE: {
    id: "BASIC_SERVICE",
    customerRange: [1, 2],
    batchingEnabled: false,
    branchingEnabled: false,
    allocationEnabled: false,
    multiRecipe: false,
  },
  BATCH_SERVICE: {
    id: "BATCH_SERVICE",
    customerRange: [2, 2],
    batchingEnabled: true,
    branchingEnabled: false,
    allocationEnabled: false,
    multiRecipe: true,
  },
  BRANCH_SERVICE: {
    id: "BRANCH_SERVICE",
    customerRange: [2, 3],
    batchingEnabled: true,
    branchingEnabled: true,
    allocationEnabled: true,
    multiRecipe: true,
  },
  BISTRO_SERVICE: {
    id: "BISTRO_SERVICE",
    customerRange: [3, 3],
    batchingEnabled: true,
    branchingEnabled: true,
    allocationEnabled: true,
    multiRecipe: true,
  },
  GRAND_SERVICE: {
    id: "GRAND_SERVICE",
    customerRange: [3, 4],
    batchingEnabled: true,
    branchingEnabled: true,
    allocationEnabled: true,
    multiRecipe: true,
  },
};
