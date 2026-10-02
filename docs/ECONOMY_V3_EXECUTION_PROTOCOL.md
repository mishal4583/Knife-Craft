# KNIFECRAFT ECONOMY V3 — EXECUTION PROTOCOL

Version: 1.0

This document defines how Claude must execute the Economy V3 Business Simulation implementation.

The master technical requirements are in:

docs/ECONOMY_V3_MASTER_SPEC.md

The repository-level instructions are in:

CLAUDE.md

---

# 1. PRIMARY OBJECTIVE

Implement Economy V3 as a sequential, QA-gated Business Simulation layer on top of the existing KnifeCraft production architecture.

Current completed phases:

- V3-1 Business Calendar
- V3-2 Business Inventory

Current expected next phase:

- V3-3 Refrigerator / Storage

The implementation must continue until:

- V3-16 is complete (the final Economy V3 phase — see
  ECONOMY_V3_MASTER_SPEC.md §16-18 for why V3-14/15/16 replaced the original
  single V3-14 "Business P&L + Final Balancing" phase: the master spec
  always described a Business Mode revenue flow, but no phase in the
  original 14-phase sequence was ever assigned to build it)
- final QA is complete
- final audit is complete
- final report is generated

After V3-16: Economy V3's phase sequence is closed and is never extended
with a "V3-17". A later, separately authorized change to the shipped
Business Mode gets its own section in the master spec, with its scope,
data, accounting and gates, and runs every gate the master spec requires.
The first is §25 Business Supplies (smallwares, tableware, takeaway
packaging). It does not reopen or renumber any V3 phase.

---

# 2. EXECUTION MODEL

Use this state machine:

PHASE DISCOVERY
↓
REPOSITORY INSPECTION
↓
IMPLEMENTATION
↓
FOCUSED QA
↓
TYPECHECK
↓
LINT
↓
BUILD
↓
PREFLIGHT
↓
REGRESSION
↓
BROWSER QA
↓
AUDIT
↓
PASS?
┌───┴───┐
YES NO
↓ ↓
NEXT STOP
PHASE + FIX
↓
RETEST

Do not advance if a critical gate fails.

---

# 3. PHASE DISCOVERY

At the beginning:

1. Inspect the repository.
2. Inspect current BusinessState.
3. Inspect V3 source files.
4. Inspect V3 QA scripts.
5. Determine which phases actually exist.
6. Compare implementation against the master specification.
7. Identify the first genuinely incomplete phase.

Do not assume a phase is complete merely because a file with a similar name exists.

Evidence of completion should include:

- implementation
- QA
- regression
- persistence
- required browser verification

---

# 4. BEFORE CODING

For every phase:

Read:

1. phase section in ECONOMY_V3_MASTER_SPEC.md
2. relevant existing source files
3. relevant existing tests
4. SaveManager
5. related economy systems
6. related UI
7. relevant event definitions

Build a small internal dependency map.

Do not start by writing large amounts of code.

---

# 5. IMPLEMENTATION RULE

Implement the smallest architecture that fully satisfies the phase.

Prefer:

- existing systems
- existing abstractions
- existing managers
- existing definitions
- existing UI components
- existing persistence

Avoid unnecessary refactoring.

Do not rewrite working code simply because a new implementation could be "cleaner."

---

# 6. BUSINESSSTATE RULE

All future V3 data belongs under:

SaveData.business

Do not add:

SaveData.refrigerator
SaveData.menu
SaveData.popularity
SaveData.staff
SaveData.inspection

etc.

Instead:

SaveData.business.refrigerator
SaveData.business.menu
SaveData.business.popularity
SaveData.business.staff
SaveData.business.inspection

Use the exact project types established during implementation.

---

# 7. WALLET RULE

There is only one wallet.

Use the existing credits field.

Never create:

businessCredits
restaurantCash
businessWallet
cashBalance

as a second wallet.

Business transactions must use the existing wallet.

---

# 8. LEDGER RULE

There is only one ledger.

Use:

SaveData.economyLedger

If a new transaction category is needed:

1. Add it to the existing ledger type system.
2. Add its display label.
3. Add it to the appropriate income/expense category set.
4. Test it.

Never create:

businessLedger

restaurantLedger

dailyLedger

or another financial history.

---

# 9. ATOMIC TRANSACTION RULE

Any transaction involving:

wallet
inventory
equipment
staff
contracts
fines

must be atomic.

Example:

If a purchase fails:

Before:

- credits = 100
- inventory = 5

After:

- credits = 100
- inventory = 5

No ledger entry.

No partial state.

---

# 10. DETERMINISM RULE

Search new business code for:

Math.random

Do not use it for economic behavior.

Any event requiring variation must use a deterministic mechanism.

The same saved state and same action should produce the same result.

---

# 11. CAMPAIGN PROTECTION

After every phase, verify:

- Campaign levels still load.
- Campaign preparation still works.
- Campaign settlement still works.
- Campaign replay remains protected.
- Campaign recipe pay remains unchanged.
- Campaign COGS remains unchanged.
- Campaign credits remain independent of Business Inventory.
- Campaign does not require Business Mode assets.

---

# 12. TESTING ORDER

For each phase:

## A. Focused QA

Run the phase-specific script.

Example:

```text
npx tsx scripts/refrigerator-storage-qa.mts
```
