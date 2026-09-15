import { Kitchen, OrderBoard } from "@/components/kc/Kitchen";
import { Shop } from "@/components/kc/Shop";
import { Rack } from "@/components/kc/Rack";
import { KitchenUpgrades } from "@/components/kc/KitchenUpgrades";
import { RecipeBook, RecipeDetail } from "@/components/kc/Recipes";
import { Progression, Settings, DailyOrder, EndlessService } from "@/components/kc/Journal";
import { IngredientLab } from "@/components/kc/IngredientLab";
import type { ScreenId } from "@/components/kc/data";
import type { SaveData } from "@/game/SaveManager";
import type { BuyKnifeResult } from "@/game/knives/KnifeManager";
import type { BuyBoardResult } from "@/game/boards/BoardManager";

/**
 * Everything except the Prep/cutting screen, split into its own chunk
 * (§31 — the initial bundle only needs to carry what's required to
 * reach first playable interaction, which for KnifeCraft is Preparation,
 * not the other menu screens). Loaded once the player first leaves the
 * cutting board.
 *
 * Phase 15 — navigation consolidated to three primary destinations
 * (Kitchen/Shop/Rack) plus a small number of secondary screens
 * (Recipe Book, Kitchen Upgrade, Chef's Journey, Settings, the full
 * order board) that stay real and routable without being bottom-nav
 * tabs. The old separate Workshop/Boards/Journal screens are gone —
 * their logic lives in Shop/Rack/Kitchen HUD now, not duplicated.
 */
export function ScreensRouter({
  screen,
  go,
  save,
  recipeDetailLevelId,
  onOpenRecipe,
  onSelectLevel,
  onStartDaily,
  onStartEndless,
  buyKnife,
  buyBoard,
  setEquippedKnife,
  setEquippedBoard,
  setEquippedKitchenUpgrade,
  toggleSetting,
  resetProgress,
}: {
  screen: ScreenId;
  go: (s: ScreenId) => void;
  save: SaveData;
  recipeDetailLevelId: string;
  onOpenRecipe: (levelId: string) => void;
  onSelectLevel: (levelId: string) => void;
  onStartDaily: () => void;
  onStartEndless: () => void;
  buyKnife: (id: string) => BuyKnifeResult;
  buyBoard: (id: string) => BuyBoardResult;
  setEquippedKnife: (id: string) => void;
  setEquippedBoard: (id: string) => void;
  setEquippedKitchenUpgrade: (id: string) => void;
  toggleSetting: (key: "sound" | "music" | "reducedMotion") => void;
  resetProgress: () => void;
}) {
  return (
    <>
      {screen === "kitchen" ? <Kitchen go={go} save={save} onSelectLevel={onSelectLevel} /> : null}
      {screen === "board" ? <OrderBoard go={go} save={save} onSelectLevel={onSelectLevel} /> : null}
      {screen === "shop" ? (
        <Shop go={go} save={save} buyKnife={buyKnife} buyBoard={buyBoard} />
      ) : null}
      {screen === "rack" ? (
        <Rack
          go={go}
          save={save}
          setEquippedKnife={setEquippedKnife}
          setEquippedBoard={setEquippedBoard}
        />
      ) : null}
      {screen === "kitchen-upgrades" ? (
        <KitchenUpgrades go={go} save={save} setEquipped={setEquippedKitchenUpgrade} />
      ) : null}
      {screen === "recipes" ? <RecipeBook go={go} save={save} onOpen={onOpenRecipe} /> : null}
      {screen === "recipe-detail" ? (
        <RecipeDetail
          levelId={recipeDetailLevelId}
          save={save}
          go={go}
          onSelectLevel={onSelectLevel}
        />
      ) : null}
      {screen === "progression" ? <Progression go={go} save={save} /> : null}
      {screen === "daily" ? <DailyOrder go={go} save={save} onStartDaily={onStartDaily} /> : null}
      {screen === "endless" ? (
        <EndlessService go={go} save={save} onStartEndless={onStartEndless} />
      ) : null}
      {screen === "settings" ? (
        <Settings
          go={go}
          settings={save.settings}
          onToggleSetting={toggleSetting}
          onResetProgress={resetProgress}
        />
      ) : null}
      {screen === "ingredient-lab" ? <IngredientLab go={go} /> : null}
    </>
  );
}
