import { Kitchen, OrderBoard } from "@/components/kc/Kitchen";
import { Shop } from "@/components/kc/Shop";
import { RestaurantProgress } from "@/components/kc/RestaurantProgress";
import { KitchenUpgrades } from "@/components/kc/KitchenUpgrades";
import type { PurchaseKitchenUpgradeResult } from "@/game/kitchen/KitchenUpgradeManager";
import { RecipeBook, RecipeDetail } from "@/components/kc/Recipes";
import { Settings, DailyOrder, EndlessService } from "@/components/kc/Journal";
import {
  BusinessDashboard,
  type AdvanceDayResult,
} from "@/components/kc/business/BusinessDashboard";
import { businessTabForScreen } from "@/components/kc/business/businessTabs";
import { BusinessService } from "@/components/kc/business/BusinessService";
import type { PurchaseIngredientResult } from "@/game/business/BusinessInventoryManager";
import type { PurchaseRefrigeratorResult } from "@/game/business/RefrigeratorManager";
import type { PerformMaintenanceResult } from "@/game/business/businessMaintenance";
import type { RushRestockOutcome, RushRestockPayment } from "@/game/business/businessRushRestock";
import type { SetMenuPriceResult } from "@/game/business/BusinessMenuManager";
import type { SetDishActiveResult } from "@/game/business/businessMenuActivation";
import type {
  SignContractResult,
  CancelContractResult,
} from "@/game/business/BusinessSupplierManager";
import type { HireStaffResult, FireStaffResult } from "@/game/business/BusinessStaffManager";
import type { ScreenId } from "@/components/kc/data";
import type { SaveData } from "@/game/SaveManager";
import type { BuyKnifeResult } from "@/game/knives/KnifeManager";
import type { BuyBoardResult } from "@/game/boards/BoardManager";
import type { SharpenKnifeResult } from "@/game/economy/sharpness";
import type { BlacksmithStat, UpgradeKnifeResult } from "@/game/knives/blacksmith";
import type { BuyStaffResult } from "@/game/economy/StaffManager";
import type { ServiceSession } from "@/game/service/ServiceManager";

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
  sharpenKnife,
  upgradeKnife,
  buyStaff,
  selectSupplier,
  setEquippedKnife,
  setEquippedBoard,
  toggleSetting,
  resetProgress,
  advanceBusinessDay,
  purchaseIngredient,
  purchaseRefrigerator,
  performRefrigeratorMaintenance,
  rushRestock,
  rushAdAvailable,
  buildKitchenUpgrade,
  setMenuPrice,
  setBusinessDishActive,
  signSupplierContract,
  cancelSupplierContract,
  hireStaff,
  fireStaff,
  businessServiceSession,
  onStartBusinessService,
  onEnterBusinessPreparation,
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
  sharpenKnife: (id: string) => SharpenKnifeResult;
  upgradeKnife: (id: string, stat: BlacksmithStat) => UpgradeKnifeResult;
  buyStaff: (id: string) => BuyStaffResult;
  selectSupplier: (id: string) => void;
  setEquippedKnife: (id: string) => void;
  setEquippedBoard: (id: string) => void;
  toggleSetting: (key: "sound") => void;
  resetProgress: () => void;
  /** Economy V3 Phase 1 — the player's own explicit "End Business Day" action. */
  advanceBusinessDay: () => AdvanceDayResult;
  /** Economy V3 Phase 2 — Business Mode's own ingredient purchase action. */
  purchaseIngredient: (ingredientId: string, quantity: number) => PurchaseIngredientResult;
  /** Economy V3 Phase 3 — Business Mode's own refrigerator purchase/upgrade action. */
  purchaseRefrigerator: (refrigeratorId: string) => PurchaseRefrigeratorResult;
  /** Economy V3 Phase 11 — Business Mode's own refrigerator maintenance/repair action. */
  performRefrigeratorMaintenance: () => PerformMaintenanceResult;
  /** Rush Restock — stock what the current order is missing (cash + rush fee, or free after an ad). */
  rushRestock: (payment: RushRestockPayment) => Promise<RushRestockOutcome>;
  /** Whether the platform can show a rewarded ad right now (hides the ad option when it can't). */
  rushAdAvailable: boolean;
  /** Economy V2.5 — Restaurant Development: build a kitchen tier. */
  buildKitchenUpgrade: (id: string) => PurchaseKitchenUpgradeResult;
  /** Economy V3 Phase 5 — Business Mode's own menu-price action. */
  setMenuPrice: (recipeId: string, price: number) => SetMenuPriceResult;
  /** Economy V3 Phase 16 — Business Mode's own Active Menu on/off action. */
  setBusinessDishActive: (dishId: string, active: boolean) => SetDishActiveResult;
  /** Economy V3 Phase 7 — Business Mode's own supplier-contract actions. */
  signSupplierContract: (supplierId: string) => SignContractResult;
  cancelSupplierContract: () => CancelContractResult;
  /** Economy V3 Phase 9 — Business Mode's own staff hire/fire actions. */
  hireStaff: (role: string) => HireStaffResult;
  fireStaff: (role: string) => FireStaffResult;
  /** Economy V3 Phase 14, Checkpoint 3 — Business Mode's own order/service session and its two entry actions ("open the counter" and "start preparing this order"). */
  businessServiceSession: ServiceSession | null;
  onStartBusinessService: () => void;
  onEnterBusinessPreparation: () => void;
}) {
  return (
    <>
      {screen === "kitchen" ? <Kitchen go={go} save={save} onSelectLevel={onSelectLevel} /> : null}
      {screen === "board" ? <OrderBoard go={go} save={save} onSelectLevel={onSelectLevel} /> : null}
      {screen === "shop" || screen === "shop-ingredients" ? (
        <Shop
          key={screen}
          initialCategory={screen === "shop-ingredients" ? "ingredients" : "knives"}
          purchaseIngredient={purchaseIngredient}
          go={go}
          save={save}
          buyKnife={buyKnife}
          buyBoard={buyBoard}
          buyStaff={buyStaff}
          selectSupplier={selectSupplier}
          equipKnife={setEquippedKnife}
          equipBoard={setEquippedBoard}
          sharpenKnife={sharpenKnife}
          upgradeKnife={upgradeKnife}
        />
      ) : null}
      {/* "rack" is the internal screen id; the player-facing screen is Restaurant Progress. */}
      {screen === "rack" ? <RestaurantProgress go={go} save={save} /> : null}
      {screen === "kitchen-upgrades" ? (
        <KitchenUpgrades go={go} save={save} buildKitchenUpgrade={buildKitchenUpgrade} />
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
      {/* Business Mode: one Market-style screen; every business route opens its tab.
          Rendered from one place so the screen stays mounted while switching tabs. */}
      {businessTabForScreen(screen) ? (
        <BusinessDashboard
          go={go}
          save={save}
          tab={businessTabForScreen(screen)!}
          onAdvanceDay={advanceBusinessDay}
          businessServiceSession={businessServiceSession}
          purchaseRefrigerator={purchaseRefrigerator}
          performRefrigeratorMaintenance={performRefrigeratorMaintenance}
          rushRestock={rushRestock}
          rushAdAvailable={rushAdAvailable}
          setMenuPrice={setMenuPrice}
          setBusinessDishActive={setBusinessDishActive}
          signSupplierContract={signSupplierContract}
          cancelSupplierContract={cancelSupplierContract}
          hireStaff={hireStaff}
          fireStaff={fireStaff}
        />
      ) : null}
      {screen === "business-service" ? (
        <BusinessService
          go={go}
          save={save}
          businessServiceSession={businessServiceSession}
          onStartService={onStartBusinessService}
          onEnterPreparation={onEnterBusinessPreparation}
          rushRestock={rushRestock}
          rushAdAvailable={rushAdAvailable}
        />
      ) : null}
    </>
  );
}
