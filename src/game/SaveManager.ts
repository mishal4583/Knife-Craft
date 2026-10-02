/**
 * SAVE_MANAGER — the only place that touches persistence.
 *
 * Nothing else in the codebase should call `localStorage` or the
 * `ytgame.game.*Data` methods directly. Running inside YouTube Playables
 * uses the platform's cloud save; everywhere else falls back to
 * localStorage. Both paths go through the same small, versioned JSON
 * shape so a save written on one can still be read after a platform
 * switch (e.g. testing locally, then re-testing inside YouTube).
 */
import { migrateBusinessSuppliesState } from "./business/businessSupplies";
import { migrateEconomy } from "./progression/economyMigration";
import {
  DEFAULT_ECONOMY_STATE,
  LEGACY_ECONOMY_STATE,
  type EconomyState,
} from "./economy/economyState";
import { loadCloudSave, platformReady, saveCloudSave } from "./PlayablesSDK";
import { DEFAULT_LEVEL_PROGRESS, type LevelProgress } from "./levels/LevelManager";
import { DEFAULT_SUPPLIER_ID } from "./economy/supplierDefinitions";
import type { EconomyLedgerEntry } from "./economy/ledgerTypes";
import { DEFAULT_BUSINESS_STATE, type BusinessState } from "./business/businessTypes";
import { migrateBusinessFinanceState } from "./business/BusinessFinanceManager";
import { migrateMoneyToUsd } from "./economy/usdMigration";
import { walletInvariantViolation } from "./economy/wallet";
import {
  KITCHEN_DEVELOPMENT_SAVE_VERSION,
  migrateKitchenDevelopment,
} from "./kitchen/KitchenUpgradeManager";
import { dollars } from "./money";

const STORAGE_KEY = "knifecraft.save.v1";
/**
 * 2 — money is US dollars, stored as integer cents (economy/usdMigration.ts converts version-1 saves once).
 * 3 — Economy V2.5: kitchen tiers are bought, not granted by level
 *     (KitchenUpgradeManager.migrateKitchenDevelopment keeps what older saves had earned).
 */
const SAVE_VERSION = KITCHEN_DEVELOPMENT_SAVE_VERSION;

export type SaveData = {
  version: number;
  credits: number;
  equippedKnifeId: string;
  equippedBoardId: string;
  ownedKnifeIds: string[];
  ownedBoardIds: string[];
  /**
   * Phase 12B — kitchen upgrades (the six kitchen background images) are
   * a real owned/equipped collection, mirroring ownedBoardIds/
   * equippedBoardId in shape. Fresh save owns/equips "humble-kitchen"
   * only. Economy V2.5 — every later tier is bought (Restaurant
   * Development, KitchenUpgradeManager.purchaseKitchenUpgrade); saves
   * from before V2.5 keep the tiers their level had granted for free
   * (migrateKitchenDevelopment). See src/game/kitchen/.
   */
  ownedKitchenUpgradeIds: string[];
  equippedKitchenUpgradeId: string;
  /**
   * Economy V2.5 — migration version, milestone claims and exact lifetime
   * ledger totals (economy/economyState.ts). A save written before V2.5
   * has no `economy` and loads as LEGACY_ECONOMY_STATE (version 0), which
   * progression/economyMigration.ts migrates exactly once.
   */
  economy: EconomyState;
  /**
   * Economy V2 Phase 4 — Kitchen Investments (src/game/kitchen/
   * kitchenInvestmentDefinitions.ts): a SEPARATE, real shop-purchased
   * collection from ownedKitchenUpgradeIds above (which stays free/
   * automatic, untouched). No "equipped" counterpart — an investment is
   * either owned or not; ownership is its own end state. Added as a
   * field on the SAME save blob, following the exact `story`/
   * `levelProgress`/`dailyOrder`/`endless` precedent below — an old save
   * parsed before this field existed falls back to `DEFAULT_SAVE.ownedKitchenInvestmentIds`
   * (`[]`) via the `{...DEFAULT_SAVE, ...parsed}` merge in `load()`, so
   * no version bump or migration code is needed and no existing save
   * field is touched.
   *
   * LEGACY — Kitchen Investments were retired as purchases (their idea now
   * lives in the six kitchen backgrounds). Nothing in the game reads or
   * writes this any more; it stays on SaveData only so existing saves
   * load and round-trip unchanged.
   */
  ownedKitchenInvestmentIds: string[];
  /**
   * Economy V2 Phase 6 — Sharpness (src/game/economy/sharpness.ts):
   * each owned knife's current cutting condition, 0-100, keyed by knife
   * id. A knife missing from this map (a genuinely new knife, OR any
   * knife on an old save written before this field existed) is treated
   * as fully sharp (100) by `getKnifeSharpness` — never stored eagerly
   * for every catalog entry, only written once a knife's sharpness
   * actually changes (decay or sharpening). Same additive-field, zero-
   * migration precedent as `ownedKitchenInvestmentIds` above: an old
   * save falls back to `DEFAULT_SAVE.knifeSharpness` (`{}`) via the
   * `{...DEFAULT_SAVE, ...parsed}` merge in `load()`.
   */
  /**
   * Blacksmith upgrade levels per knife id (blacksmith.ts), e.g.
   * { chef: { sharpness: 2, speed: 1, handling: 3 } }. Missing knives and
   * missing stats read as level 1 (the knife as it always played), so an
   * old save without this field loads unchanged via DEFAULT_SAVE's `{}`.
   */
  knifeUpgrades: Record<string, Partial<Record<"sharpness" | "speed" | "handling", number>>>;
  knifeSharpness: Record<string, number>;
  /**
   * Economy V2 Phase 7 — Staff (src/game/economy/staffDefinitions.ts): a
   * SEPARATE, real shop-purchased collection, distinct from Kitchen
   * Investments (Phase 4) and from src/game/chefs/ (unrelated narrative
   * cuisine chefs). No "equipped" counterpart — every owned staff
   * member's effect applies simultaneously (staff.ts's getStaffModifier),
   * they are not mutually exclusive. Same additive-field, zero-migration
   * precedent as every prior phase's own field: an old save falls back
   * to `DEFAULT_SAVE.ownedStaffIds` (`[]`) via the `{...DEFAULT_SAVE,
   * ...parsed}` merge in `load()`.
   */
  ownedStaffIds: string[];
  /**
   * Economy V2 Phase 8 — Supplier (src/game/economy/supplierDefinitions.ts):
   * a SELECTION, not an owned/purchased item — free, always switchable,
   * no inventory. Same additive-field, zero-migration precedent as every
   * prior phase's own field: an old save falls back to
   * `DEFAULT_SAVE.selectedSupplierId` ("local-market") via the
   * `{...DEFAULT_SAVE, ...parsed}` merge in `load()`.
   */
  selectedSupplierId: string;
  /**
   * Economy V2 Phase 9 — the real, persisted wallet-transaction history
   * (src/game/economy/EconomyLedger.ts) — a SEPARATE concern from every
   * settlement/modifier calculation above; this array only ever grows via
   * EconomyLedger.appendLedgerEntry, atomically with the credits change
   * it records. Bounded to the most recent EconomyLedger.MAX_LEDGER_ENTRIES
   * (200) entries — see that module's own doc for why this bound is safe.
   * Same additive-field, zero-migration precedent as every prior phase's
   * own field: an old save falls back to `DEFAULT_SAVE.economyLedger`
   * (`[]`) via the `{...DEFAULT_SAVE, ...parsed}` merge in `load()`.
   */
  economyLedger: EconomyLedgerEntry[];
  recipeProgress: Record<string, { best: number | null; done: boolean }>;
  /** Only `sound` is a real setting. `music`/`reducedMotion` are legacy keys kept so older saves round-trip unchanged; nothing reads them. */
  settings: { sound: boolean; music: boolean; reducedMotion: boolean };
  /**
   * Level Engine progression (Phase 4 — design doc §15). Added as a field
   * on the SAME save blob, not a second storage system. Old saves parsed
   * before this field existed simply fall back to DEFAULT_SAVE.levelProgress
   * via the `{...DEFAULT_SAVE, ...parsed}` merge in load() below — no
   * migration code needed.
   */
  levelProgress: LevelProgress;
  /**
   * THE LAST WISH (Claude Design final freeze) — presentation-layer-only
   * state, ported from knifecraft.html's `story.introDone`/`story.ms`/
   * `story.fin` (three flags, source `:10774`'s `KEY` map). Added as a
   * field on this SAME save blob, not a second storage system — mirrors
   * how `levelProgress` itself was added in an earlier phase. An old
   * save parsed before this field existed falls back to
   * `DEFAULT_SAVE.story` via the `{...DEFAULT_SAVE, ...parsed}` merge in
   * `load()` below, so no migration code is needed and no existing save
   * is invalidated.
   */
  story: StoryProgress;
  /**
   * Corrective pass — Daily Order's own tiny persisted state: which
   * calendar day the bonus was last claimed (a plain "YYYY-MM-DD" local
   * date string, not a timestamp — avoids timezone-rollover edge cases
   * mattering for anything beyond "is it still today"), and a streak
   * counter for the same reason a login streak usually exists (repeat
   * engagement) — never a gate on content, only ever flavor. A genuinely
   * new field: no existing save data could already express "today's
   * bonus was claimed", so this isn't a duplicate of anything. Added as
   * a field on the SAME save blob, following the exact precedent
   * `story`/`levelProgress` already set — an old save missing this key
   * entirely falls back to `DEFAULT_DAILY_ORDER_PROGRESS` via the
   * `{...DEFAULT_SAVE, ...parsed}` merge in `load()` below.
   */
  dailyOrder: DailyOrderProgress;
  /**
   * Corrective pass — Endless Service's own tiny persisted state: how
   * many coins it has already paid out TODAY, so the daily coin cap
   * (EndlessServiceManager.ENDLESS_DAILY_COIN_CAP) can't be reset by
   * simply reloading the page. `date` is compared against today's own
   * "YYYY-MM-DD" key; a mismatch means a new day started, and
   * `coinsEarnedToday` is treated as 0 without needing a write until the
   * player actually earns something. Same additive-field precedent as
   * `dailyOrder` above.
   */
  endless: EndlessProgress;
  /**
   * Economy V3 Phase 1 (Business Calendar) — the one new field for the
   * entire Business Simulation layer (src/game/business/). A SEPARATE,
   * additive concern from every Economy V2 field above: Campaign Mode
   * never reads this, and nothing in here ever feeds
   * EconomySettlement/the 250-level campaign simulation. Same
   * additive-field, zero-migration precedent as every prior phase's own
   * field: an old save falls back to `DEFAULT_SAVE.business` via the
   * `{...DEFAULT_SAVE, ...parsed}` merge in `load()`. Every later V3
   * phase (inventory, refrigerator, menu pricing, ...) adds its own
   * field to `BusinessState` itself, never a new top-level SaveData
   * field.
   */
  business: BusinessState;
};

/**
 * `milestoneMask` is a 4-bit mask (bits 1/2/4/8, one per milestone —
 * levels 8/20/45/70), ported verbatim from the source's `story.ms`;
 * full value 15. A fired bit can never fire again (duplicate
 * prevention IS the mask, not a timestamp) and the mask only ever
 * gains bits (forward-only, matching `n >= m.at`) — see
 * `game/story/StoryManager.ts`'s own doc.
 */
export type StoryProgress = {
  introDone: boolean;
  milestoneMask: number;
  finaleSeen: boolean;
};

export const DEFAULT_STORY_PROGRESS: StoryProgress = {
  introDone: false,
  milestoneMask: 0,
  finaleSeen: false,
};

export type DailyOrderProgress = { lastClaimedDate: string | null; streak: number };
export const DEFAULT_DAILY_ORDER_PROGRESS: DailyOrderProgress = {
  lastClaimedDate: null,
  streak: 0,
};

export type EndlessProgress = { date: string; coinsEarnedToday: number };
export const DEFAULT_ENDLESS_PROGRESS: EndlessProgress = { date: "", coinsEarnedToday: 0 };

export const DEFAULT_SAVE: SaveData = {
  version: SAVE_VERSION,
  /** $1,240.00 starting balance (wallet amounts are integer US cents — see money.ts). */
  credits: dollars(1240),
  equippedKnifeId: "chef",
  equippedBoardId: "walnut",
  ownedKnifeIds: ["chef"],
  ownedBoardIds: ["walnut"],
  ownedKitchenUpgradeIds: ["humble-kitchen"],
  equippedKitchenUpgradeId: "humble-kitchen",
  economy: {
    ...DEFAULT_ECONOMY_STATE,
    claimedMilestoneIds: [],
    waivedMilestoneIds: [],
    lifetime: {},
  },
  ownedKitchenInvestmentIds: [],
  knifeSharpness: {},
  knifeUpgrades: {},
  ownedStaffIds: [],
  selectedSupplierId: DEFAULT_SUPPLIER_ID,
  economyLedger: [],
  recipeProgress: {},
  settings: { sound: true, music: true, reducedMotion: false },
  levelProgress: { ...DEFAULT_LEVEL_PROGRESS },
  story: { ...DEFAULT_STORY_PROGRESS },
  dailyOrder: { ...DEFAULT_DAILY_ORDER_PROGRESS },
  endless: { ...DEFAULT_ENDLESS_PROGRESS },
  business: {
    ...DEFAULT_BUSINESS_STATE,
    calendar: { ...DEFAULT_BUSINESS_STATE.calendar },
    inventory: { ...DEFAULT_BUSINESS_STATE.inventory },
    refrigerator: { ...DEFAULT_BUSINESS_STATE.refrigerator },
    spoilage: { ...DEFAULT_BUSINESS_STATE.spoilage },
    menu: { ...DEFAULT_BUSINESS_STATE.menu },
    popularity: { ...DEFAULT_BUSINESS_STATE.popularity },
    supplierContract: DEFAULT_BUSINESS_STATE.supplierContract,
    staff: { hiredRoles: [...DEFAULT_BUSINESS_STATE.staff.hiredRoles] },
    equipmentCondition: { ...DEFAULT_BUSINESS_STATE.equipmentCondition },
    inspectionFines: { ...DEFAULT_BUSINESS_STATE.inspectionFines },
    finance: {
      dailyAccumulator: { ...DEFAULT_BUSINESS_STATE.finance.dailyAccumulator },
      lifetimeCogs: DEFAULT_BUSINESS_STATE.finance.lifetimeCogs,
      lastDailyPnL: DEFAULT_BUSINESS_STATE.finance.lastDailyPnL,
      lifetime: { ...DEFAULT_BUSINESS_STATE.finance.lifetime },
    },
    menuActivation: {
      inactiveDishIds: [...DEFAULT_BUSINESS_STATE.menuActivation.inactiveDishIds],
    },
  },
};

function isSaveData(value: unknown): value is SaveData {
  return typeof value === "object" && value !== null && "version" in value && "credits" in value;
}

class SaveManagerImpl {
  private cache: SaveData | null = null;

  /** Loads the save, migrating/repairing anything malformed back to defaults. */
  async load(): Promise<SaveData> {
    if (this.cache) return this.cache;

    // Playgama: saves go through Bridge storage (never localStorage directly).
    // Plain localStorage is only the fallback when no Bridge exists at all.
    let raw: string | null = null;
    if (await platformReady()) {
      raw = await loadCloudSave().catch(() => null);
    } else if (typeof localStorage !== "undefined") {
      raw = localStorage.getItem(STORAGE_KEY);
    }

    if (!raw) {
      this.cache = { ...DEFAULT_SAVE };
      return this.cache;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSaveData(parsed)) throw new Error("malformed save");
      // Economy V3 — `business` is the one NESTED save object (everything
      // else on SaveData is a flat scalar/array/record, which the plain
      // shallow spread below already defaults correctly). A save written
      // by an earlier V3 phase has a real `business` object that's simply
      // missing whichever field a LATER phase added to `BusinessState` —
      // the outer shallow spread alone would keep that whole object
      // as-is and silently leave the new field `undefined`. This one
      // extra shallow-merge, specifically for `business`, gives every
      // field of `BusinessState` the exact same zero-migration default
      // behavior the rest of SaveData already gets for free.
      const partial = parsed as Partial<SaveData>;
      const merged: SaveData = {
        ...DEFAULT_SAVE,
        ...partial,
        // Economy V2.5 — a save without `economy` predates V2.5: version 0,
        // migrated exactly once below (never the fresh-save default).
        economy: partial.economy
          ? { ...DEFAULT_ECONOMY_STATE, ...partial.economy }
          : { ...LEGACY_ECONOMY_STATE, lifetime: {} },
        business: {
          ...DEFAULT_SAVE.business,
          ...partial.business,
          // Economy V3 Phase 16 — `finance` gained a nested field
          // (`lifetime`), so it gets its own nested merge + documented
          // seeding (BusinessFinanceManager.migrateBusinessFinanceState).
          finance: migrateBusinessFinanceState(
            partial.business?.finance,
            Array.isArray(partial.economyLedger) ? partial.economyLedger : [],
          ),
          // Business Supplies — a save from before supplies existed opens
          // with empty stock; a stored one keeps every known item.
          supplies: migrateBusinessSuppliesState(partial.business?.supplies),
        },
      };
      // Version-1 saves stored Campaign money in whole units that now mean
      // dollars; convert them to the wallet's cent unit exactly once.
      // Economy V2.5 — order matters: USD cents, then the kitchen tiers an
      // old save had earned, then the one-time economy migration (which
      // needs to know whether the save predates V2.5 — its stored version).
      const savedBeforeV25 = merged.version < KITCHEN_DEVELOPMENT_SAVE_VERSION;
      this.cache = migrateEconomy(
        migrateKitchenDevelopment(migrateMoneyToUsd(merged)),
        savedBeforeV25,
      );
      // The economy migration is written back at once, so it runs once —
      // not again on every load until the player's next save. (It is also
      // idempotent on its own: re-migrating the same old save pays nothing.)
      if (this.cache.economy.version !== merged.economy.version)
        void this.save(this.cache).catch(() => {});
    } catch {
      this.cache = { ...DEFAULT_SAVE };
    }
    return this.cache;
  }

  async save(data: SaveData): Promise<void> {
    // Economy V2.5 — never persist money the game can't have (economy/wallet.ts).
    const violation = walletInvariantViolation(data);
    if (violation) throw new Error(`Refusing to save: ${violation}`);
    this.cache = data;
    const serialized = JSON.stringify(data);
    if (await platformReady()) {
      await saveCloudSave(serialized);
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  }

  /**
   * Reads back what is ACTUALLY persisted (Bridge storage, or
   * localStorage when no Bridge exists), bypassing the in-memory cache — used to
   * confirm a write really landed before the game tells the player so
   * (the Replay Bonus). Null if nothing readable is stored.
   */
  async readPersisted(): Promise<Pick<SaveData, "credits" | "economyLedger"> | null> {
    let raw: string | null = null;
    if (await platformReady()) raw = await loadCloudSave();
    else if (typeof localStorage !== "undefined") raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSaveData(parsed)) return null;
      const p = parsed as Partial<SaveData>;
      return {
        credits: typeof p.credits === "number" ? p.credits : 0,
        economyLedger: Array.isArray(p.economyLedger) ? p.economyLedger : [],
      };
    } catch {
      return null;
    }
  }

  async reset(): Promise<SaveData> {
    const fresh = { ...DEFAULT_SAVE };
    await this.save(fresh);
    return fresh;
  }
}

/** Single shared instance — import this, never instantiate the class yourself. */
export const SaveManager = new SaveManagerImpl();
