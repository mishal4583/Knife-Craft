import { Suspense, lazy } from "react";
import { Kitchen, OrderBoard, BottomNav } from "@/components/kc/Kitchen";
import { Shop } from "@/components/kc/Shop";
import { RestaurantProgress } from "@/components/kc/RestaurantProgress";
import { KitchenUpgrades } from "@/components/kc/KitchenUpgrades";
import type { PurchaseKitchenUpgradeResult } from "@/game/kitchen/KitchenUpgradeManager";
import { RecipeBook, RecipeDetail } from "@/components/kc/Recipes";
import { Settings, DailyOrder, EndlessService } from "@/components/kc/Journal";
import type { AdvanceDayResult } from "@/components/kc/business/BusinessDashboard";
import { businessTabForScreen } from "@/components/kc/business/businessTabs";
import type { PurchaseIngredientResult } from "@/game/business/BusinessInventoryManager";
import type { PurchaseSupplyResult } from "@/game/business/BusinessSuppliesManager";
import { peekSupplySection } from "@/components/kc/marketFocus";
import type { PurchaseRefrigeratorResult } from "@/game/business/RefrigeratorManager";
import type { DiscardExpiredResult } from "@/game/business/discardExpired";
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
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { NavGuideContext, NavLevelContext, type NavGuide } from "@/components/kc/navLevel";
import type { Measure } from "@/game/business/measure";
import type { BuyKnifeResult } from "@/game/knives/KnifeManager";
import type { BuyBoardResult } from "@/game/boards/BoardManager";
import type { SharpenKnifeResult } from "@/game/economy/sharpness";
import type { BlacksmithStat, UpgradeKnifeResult } from "@/game/knives/blacksmith";
import type { BuyStaffResult } from "@/game/economy/StaffManager";
import type { ServiceSession } from "@/game/service/ServiceManager";

// The Restaurant screens load as their own chunk the first time one opens (task #24).
const loadRestaurantScreens = () => import("@/components/kc/restaurantScreens");
const BusinessDashboard = lazy(() =>
  loadRestaurantScreens().then((m) => ({ default: m.BusinessDashboard })),
);
const BusinessService = lazy(() =>
  loadRestaurantScreens().then((m) => ({ default: m.BusinessService })),
);
const InventoryScreen = lazy(() =>
  loadRestaurantScreens().then((m) => ({ default: m.InventoryScreen })),
);

/** Shown for the moment the Restaurant chunk takes to arrive: the screen's own frame, never a blank. */
function RestaurantLoading({ go, active }: { go: (s: ScreenId) => void; active: ScreenId }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-cream"
      data-testid="restaurant-loading"
    >
      <div className="grid h-full place-items-center pb-24">
        <p className="font-hand text-[18px] text-walnut/60">Opening the restaurant…</p>
      </div>
      <BottomNav active={active} go={go} />
    </div>
  );
}

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
  navGuide,
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
  setMeasure,
  resetProgress,
  advanceBusinessDay,
  purchaseIngredient,
  purchaseIngredients,
  purchaseSupply,
  purchaseRefrigerator,
  throwOutExpired,
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
  /** Grandma's pointer at a section that just opened (restaurant build; App decides when). */
  navGuide?: NavGuide;
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
  toggleSetting: (key: "sound" | "reducedMotion") => void;
  /** Settings: weighed ingredients in lb or kg (business/measure.ts). */
  setMeasure: (measure: Measure) => void;
  resetProgress: () => void;
  /** Economy V3 Phase 1 — the player's own explicit "End Business Day" action. */
  advanceBusinessDay: () => AdvanceDayResult;
  /** Economy V3 Phase 2 — Business Mode's own ingredient purchase action. */
  purchaseIngredient: (ingredientId: string, quantity: number) => PurchaseIngredientResult;
  /** Restaurant Market plan: buy several lines at once. */
  purchaseIngredients?: (lines: ReadonlyArray<{ ingredientId: string; quantity: number }>) => {
    bought: number;
    skipped: number;
    totalCost: number;
  };
  purchaseSupply: (supplyId: string, packs: number) => PurchaseSupplyResult;
  /** Economy V3 Phase 3 — Business Mode's own refrigerator purchase/upgrade action. */
  purchaseRefrigerator: (refrigeratorId: string) => PurchaseRefrigeratorResult;
  /** Inventory → Throw Out Expired (discardExpired.ts). */
  throwOutExpired: () => DiscardExpiredResult;
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
  hireStaff: (role: string) => { ok: boolean };
  fireStaff: (role: string) => { ok: boolean };
  /** Economy V3 Phase 14, Checkpoint 3 — Business Mode's own order/service session and its two entry actions ("open the counter" and "start preparing this order"). */
  businessServiceSession: ServiceSession | null;
  onStartBusinessService: () => void;
  onEnterBusinessPreparation: () => void;
}) {
  return (
    <NavLevelContext.Provider value={restaurantLevelOf(save.levelProgress)}>
      <NavGuideContext.Provider value={navGuide ?? null}>
        {screen === "kitchen" ? (
          <Kitchen go={go} save={save} onSelectLevel={onSelectLevel} />
        ) : null}
        {screen === "board" ? (
          <OrderBoard go={go} save={save} onSelectLevel={onSelectLevel} />
        ) : null}
        {screen === "shop" || screen === "shop-ingredients" || screen === "shop-supplies" ? (
          <Shop
            key={screen}
            initialCategory={
              screen === "shop-ingredients"
                ? "ingredients"
                : screen === "shop-supplies"
                  ? peekSupplySection()
                  : "knives"
            }
            purchaseIngredient={purchaseIngredient}
            {...(purchaseIngredients ? { purchaseIngredients } : {})}
            purchaseSupply={purchaseSupply}
            go={go}
            save={save}
            buyKnife={buyKnife}
            buyBoard={buyBoard}
            selectSupplier={selectSupplier}
            equipKnife={setEquippedKnife}
            equipBoard={setEquippedBoard}
            sharpenKnife={sharpenKnife}
            upgradeKnife={upgradeKnife}
          />
        ) : null}
        {/* "rack" is the internal screen id; the player-facing screen is Restaurant Progress. */}
        {screen === "rack" ? <RestaurantProgress go={go} save={save} /> : null}
        {screen === "inventory" || screen === "inventory-supplies" ? (
          <Suspense fallback={<RestaurantLoading go={go} active="inventory" />}>
            <InventoryScreen
              key={screen}
              go={go}
              save={save}
              initialKind={screen === "inventory-supplies" ? "supplies" : "ingredients"}
              throwOutExpired={throwOutExpired}
            />
          </Suspense>
        ) : null}
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
            onSetMeasure={RESTAURANT_MODE ? setMeasure : undefined}
            onResetProgress={resetProgress}
          />
        ) : null}
        {/* Business Mode: one Market-style screen; every business route opens its tab.
          Rendered from one place so the screen stays mounted while switching tabs. */}
        {businessTabForScreen(screen) ? (
          <Suspense fallback={<RestaurantLoading go={go} active="business" />}>
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
              selectSupplier={selectSupplier}
              hireStaff={hireStaff}
              buyStaff={buyStaff}
              fireStaff={fireStaff}
            />
          </Suspense>
        ) : null}
        {screen === "business-service" ? (
          <Suspense fallback={<RestaurantLoading go={go} active="business" />}>
            <BusinessService
              go={go}
              save={save}
              businessServiceSession={businessServiceSession}
              onStartService={onStartBusinessService}
              onEnterPreparation={onEnterBusinessPreparation}
              rushRestock={rushRestock}
              rushAdAvailable={rushAdAvailable}
            />
          </Suspense>
        ) : null}
      </NavGuideContext.Provider>
    </NavLevelContext.Provider>
  );
}
