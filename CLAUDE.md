# KNIFECRAFT — CLAUDE PROJECT INSTRUCTIONS

## PROJECT

Project name: KnifeCraft

Project path:

D:\WORKS\GAMES\Knife Craft

Technology:

- React 19
- Vite
- TypeScript
- Phaser 3

KnifeCraft is an existing production game.

This is NOT a new project.

Do not rewrite the game architecture.

Do not create a second game engine.

Do not create duplicate gameplay systems.

Before making changes, inspect the existing repository and understand the current architecture.

---

# 1. REQUIRED DOCUMENTS

Before implementing Economy V3, read:

docs/ECONOMY_V3_MASTER_SPEC.md

and:

docs/ECONOMY_V3_EXECUTION_PROTOCOL.md

The Word document:

docs/ECONOMY_V3_MASTER_SPEC.docx

is the human-readable copy of the same master specification.

The Markdown specification is the machine-facing source for repository execution.

If the Word and Markdown documents ever differ, use the Markdown version for execution and report the discrepancy.

---

# 2. EXISTING CORE ARCHITECTURE

Preserve and reuse the existing:

- React application
- Phaser 3
- GameBridge
- PreparationScene
- events.ts
- SaveManager
- Ingredient registry
- Recipe system
- RecipeComponent
- OrganizationManager
- PreparedOutput
- RecipeValidator
- OrderGenerator
- CustomerOrderManager
- ServiceManager
- EconomySettlement
- EconomyLedger
- existing equipment systems
- existing staff systems
- existing supplier systems
- existing campaign systems
- existing UI primitives
- existing routing/navigation

Do not replace these systems simply to implement Economy V3.

---

# 3. ECONOMY V2 IS FROZEN

Economy V2 has already been implemented and validated.

Do not intentionally change Economy V2.

Locked Campaign baseline:

Revenue:

165,140

Completion Rewards:

330,691

COGS:

37,620

Quality Bonus:

3,315

Honest Chef Net:

461,526

Any unexplained change to these values is a regression.

If Economy V3 requires a compatibility change, investigate it carefully and document it.

Do not simply change expected test values.

---

# 4. ECONOMY V3 ARCHITECTURE

Economy V3 is a separate Business Simulation layer.

It must use:

SaveData.business

The current structure is:

SaveData
└── business: BusinessState
├── calendar
│ └── businessDay
│
└── inventory
└── ingredientId → InventoryEntry

Future V3 systems must extend BusinessState.

Do NOT create:

- another top-level SaveData field for each V3 system
- another save file
- another wallet
- another ledger
- another ingredient registry
- another recipe registry
- another preparation engine
- another event bus

---

# 5. COMPLETED V3 PHASES

These are already complete:

V3-1 — Business Calendar

V3-2 — Business Inventory

Do not redo these phases.

Preserve their behavior.

The next incomplete phase is currently:

V3-3 — Refrigerator / Storage

However, always inspect the repository and current phase status before assuming the next phase.

---

# 6. V3 PHASE ORDER

The required order is:

V3-1 — Business Calendar
V3-2 — Business Inventory
V3-3 — Refrigerator / Storage
V3-4 — Perishability
V3-5 — Menu Pricing
V3-6 — Popularity + Demand
V3-7 — Supplier Contracts
V3-8 — Supplier Events
V3-9 — Staff Expansion
V3-10 — Equipment Condition
V3-11 — Maintenance + Breakdowns
V3-12 — Inspections
V3-13 — Inspection Fines
V3-14 — Business Revenue & Service + Real-World Business Model
V3-15 — Business P&L + Final Balancing
V3-16 — Final Economy V3 Audit / Ship Readiness

V3-14 was added after V3-13: the master specification's own Business Day
Flow (docs/ECONOMY_V3_MASTER_SPEC.md §19) has always described a Business
Mode revenue path (Open Restaurant -> Customers Generate Orders -> Existing
Preparation System -> Existing Quality System -> Serve -> Consume Business
Inventory -> Revenue/Settlement), but the original 14-phase sequence never
assigned a phase to build it — every phase from V3-6 onward deferred it as a
forward hook with no real caller. An economic audit confirmed zero
revenue-generating code exists anywhere in Business Mode. V3-14 closes that
gap (and recalibrates Business Mode's prototype prices to real-world USD
benchmarks) before V3-15's own P&L can mean anything. V3-16 is the final
ship-readiness audit, previously folded into "after V3-14" language in this
file and in the master spec — now its own explicit phase.

V3-16 is the final Economy V3 phase. Do not create a V3-17.

Never skip a dependency.

---

# 7. PHASE EXECUTION RULE

For every phase:

1. Inspect the current repository.
2. Read the corresponding phase specification.
3. Inspect related existing systems.
4. Implement the phase.
5. Create or update focused QA.
6. Run focused QA.
7. Run TypeScript.
8. Run ESLint.
9. Run build.
10. Run preflight.
11. Run relevant Economy V2 regression.
12. Run relevant non-economy regression.
13. Perform browser verification when required.
14. Check for console errors.
15. Verify SaveData migration.
16. Verify Campaign independence.
17. Verify ledger integrity.
18. Verify no negative cash/inventory.
19. Verify determinism.
20. Only after all gates pass, mark the phase complete.
21. Continue automatically to the next phase.

---

# 8. FAILURE RULE

If a critical test fails:

STOP.

Do not continue to the next phase.

Investigate the failure.

Fix the actual implementation problem.

Run the failed test again.

Then rerun all relevant regression tests.

Only continue after the phase passes.

Do not build later systems on top of a broken earlier phase.

---

# 9. NEVER CHEAT THE TESTS

Never:

- delete a failing test
- weaken an assertion
- change expected values merely to make a test pass
- skip a regression suite without documenting why
- suppress console errors
- hide errors
- bypass the ledger
- bypass SaveManager
- bypass the existing wallet
- create fake success states
- claim browser testing occurred when it did not
- claim a simulation occurred when it did not

Existing stale tests may be documented if they are genuinely pre-existing.

Do not silently remove them.

---

# 10. BUSINESS MODE VS CAMPAIGN MODE

Campaign Mode remains the controlled 250-level progression.

Campaign must NOT require:

- Business Inventory
- Refrigerator
- Perishability
- Menu Pricing
- Supplier Contracts
- Supplier Events
- Business Staff Salaries
- Business Equipment Condition
- Business Inspections
- Business Fines
- Business Daily Operating Costs

Business Mode is where the realistic restaurant simulation exists.

Business Mode may use all of the above.

---

# 11. SINGLE SOURCE OF TRUTH

Ingredient quantities:

Existing Business Inventory.

Ingredient definitions:

Existing Ingredient Registry.

Recipes:

Existing Recipe System.

Wallet:

Existing SaveData credits/wallet.

Financial transactions:

Existing EconomyLedger.

Preparation:

Existing PreparationScene / preparation architecture.

Events:

Existing events.ts.

Do not duplicate any of these.

---

# 12. ECONOMIC SAFETY

Never allow:

credits < 0

inventory quantity < 0

storage capacity < 0

negative menu price

negative equipment condition

negative popularity

Never create debt.

Never create permanent bankruptcy.

Never create a game-ending economic soft-lock.

Every financial mutation must be traceable.

---

# 13. DETERMINISM

Economy V3 must be deterministic.

Do not use uncontrolled Math.random() for:

- prices
- supplier events
- spoilage
- popularity
- demand
- inspections
- equipment failures
- financial calculations

If a random-like event is genuinely required, use an explicit deterministic/seeded mechanism and document it.

---

# 14. LEDGER

Use:

SaveData.economyLedger

Do not create a second ledger.

Every real wallet movement must correspond to the correct ledger entry.

Failed transactions must create no financial ledger movement.

Do not create meaningless duplicate entries.

At the end of V3, financial reconciliation must satisfy:

Opening Cash +
Signed Ledger Cash Flow
=

Closing Cash

---

# 15. SAVE MIGRATION

All V3 systems must preserve old saves.

Test:

- no business field
- V3-1 save
- V3-2 save
- current V3 save
- future-compatible BusinessState

Never discard known BusinessState fields during migration.

Use the nested migration pattern already established by V3-1.

---

# 16. UI

Use existing KnifeCraft UI primitives.

Do not redesign the application.

Business Mode should eventually contain:

- Business Dashboard
- Inventory
- Refrigerator
- Menu
- Suppliers
- Staff
- Equipment
- Calendar
- Inspections
- Financial Summary

Do not create fake functionality merely to fill navigation.

---

# 17. FINAL AUDIT

After V3-16 (the final Economy V3 phase):

Perform the complete audit described in:

docs/ECONOMY_V3_MASTER_SPEC.md

The final report must include:

- all phase statuses
- architecture
- BusinessState
- Save migration
- inventory
- refrigerator
- perishability
- pricing
- popularity
- demand
- supplier contracts
- supplier events
- staff
- equipment
- maintenance
- breakdowns
- inspections
- fines
- business revenue/order/service pipeline
- real-world pricing calibration (ingredients, menu, refrigeration, staff, inspection/compliance)
- Business Dish catalog
- Kitchen Investments audit
- Shop reorganization
- P&L
- ledger
- QA
- browser verification
- simulations
- Economy V2 regression
- known issues
- remaining risks

Never claim an unperformed test passed.

---

# 18. EXECUTION COMMAND

The intended initial instruction is:

"Read CLAUDE.md, docs/ECONOMY_V3_MASTER_SPEC.md, and docs/ECONOMY_V3_EXECUTION_PROTOCOL.md.

Inspect the current KnifeCraft repository.

Determine the first incomplete Economy V3 phase.

Execute Economy V3 sequentially.

After every successful phase, automatically continue to the next phase.

If a critical test fails, stop and investigate.

After V3-16 (the final Economy V3 phase), perform the complete final audit and generate the detailed final report.

Do not claim unperformed tests were passed."
