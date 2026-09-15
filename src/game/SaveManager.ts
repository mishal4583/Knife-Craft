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
import { isInsideYouTube, loadCloudSave, saveCloudSave } from "./PlayablesSDK";
import { DEFAULT_LEVEL_PROGRESS, type LevelProgress } from "./levels/LevelManager";

const STORAGE_KEY = "knifecraft.save.v1";
const SAVE_VERSION = 1;

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
   * only. Phase 14 — ownership is granted automatically by reaching a
   * tier's unlock level (KitchenUpgradeManager.syncKitchenUpgradeOwnership,
   * re-run on every load and every save mutation), never purchased —
   * only the equipped tier is a real player choice. See src/game/kitchen/.
   */
  ownedKitchenUpgradeIds: string[];
  equippedKitchenUpgradeId: string;
  recipeProgress: Record<string, { best: number | null; done: boolean }>;
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
  credits: 1240,
  equippedKnifeId: "chef",
  equippedBoardId: "walnut",
  ownedKnifeIds: ["chef"],
  ownedBoardIds: ["walnut"],
  ownedKitchenUpgradeIds: ["humble-kitchen"],
  equippedKitchenUpgradeId: "humble-kitchen",
  recipeProgress: {},
  settings: { sound: true, music: true, reducedMotion: false },
  levelProgress: { ...DEFAULT_LEVEL_PROGRESS },
  story: { ...DEFAULT_STORY_PROGRESS },
  dailyOrder: { ...DEFAULT_DAILY_ORDER_PROGRESS },
  endless: { ...DEFAULT_ENDLESS_PROGRESS },
};

function isSaveData(value: unknown): value is SaveData {
  return typeof value === "object" && value !== null && "version" in value && "credits" in value;
}

class SaveManagerImpl {
  private cache: SaveData | null = null;

  /** Loads the save, migrating/repairing anything malformed back to defaults. */
  async load(): Promise<SaveData> {
    if (this.cache) return this.cache;

    let raw: string | null = null;
    if (isInsideYouTube()) {
      raw = await loadCloudSave();
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
      this.cache = { ...DEFAULT_SAVE, ...parsed };
    } catch {
      this.cache = { ...DEFAULT_SAVE };
    }
    return this.cache;
  }

  async save(data: SaveData): Promise<void> {
    this.cache = data;
    const serialized = JSON.stringify(data);
    if (isInsideYouTube()) {
      await saveCloudSave(serialized);
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, serialized);
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
