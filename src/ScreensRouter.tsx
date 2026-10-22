import { staffOnMap } from "@/game/restaurant/staffLife";
import { restaurantNameOf } from "@/game/restaurant/restaurantName";
import {
  cleanerRestroomJob,
  dayCleanerToday,
  type TaskKind,
} from "@/game/restaurant/cleanliness";
import type { DeliveryKind } from "@/game/restaurant/deliveries";
import type {
  CleanlinessAction,
  CleanlinessActionResult,
  DayCleanerOffer,
} from "@/game/restaurant/cleanliness";
import { Suspense, lazy, useState } from "react";
import { Kitchen, OrderBoard, BottomNav } from "@/components/kc/Kitchen";
import { Shop } from "@/components/kc/Shop";
import { RestaurantProgress } from "@/components/kc/RestaurantProgress";
import { Achievements } from "@/components/kc/Achievements";
import type { CollectResult } from "@/game/progression/achievements";
import { DailyMaintenance } from "@/components/kc/DailyMaintenance";
import { KitchenUpgrades } from "@/components/kc/KitchenUpgrades";
import type { PurchaseKitchenUpgradeResult } from "@/game/kitchen/KitchenUpgradeManager";
import { RecipeBook, RecipeDetail } from "@/components/kc/Recipes";
import { Settings, DailyOrder, EndlessService } from "@/components/kc/Journal";
import { PrepRush } from "@/components/kc/prepRush/lazyPrepRush";
import type { AdvanceDayResult } from "@/components/kc/business/BusinessDashboard";
import { businessTabForScreen } from "@/components/kc/business/businessTabs";
import type { PurchaseIngredientResult } from "@/game/business/BusinessInventoryManager";
import type { PurchaseSupplyResult } from "@/game/business/BusinessSuppliesManager";
import { openMarketSupplies, openMarketSecondFloor, peekMarketSecondFloor, peekSupplySection } from "@/components/kc/marketFocus";
import type { RestaurantZoneId } from "@/components/kc/restaurantMap/restaurantMap";
import type { SecondFloorAction } from "@/components/kc/restaurantMap/SecondFloorView";
import {
  SECOND_FLOOR_OPENS_AT,
  floorEarnings,
  isSecondFloorOpen,
  type FloorResult,
} from "@/game/restaurant/secondFloor";
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
import { kitchenMapArtStage, kitchenMapImageUrl } from "@/game/kitchen/kitchenMapArt";
import {
  NavAttentionContext,
  NavGuideContext,
  NavLevelContext,
  type NavGuide,
} from "@/components/kc/navLevel";
import { attentionBadgesFor } from "@/game/restaurant/attentionBadges";
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
const RestaurantMap = lazy(() =>
  loadRestaurantScreens().then((m) => ({ default: m.RestaurantMap })),
);
const SecondFloorView = lazy(() =>
  loadRestaurantScreens().then((m) => ({ default: m.SecondFloorView })),
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
  planLevelId = null,
  navGuide,
  recipeDetailLevelId,
  onOpenRecipe,
  onSelectLevel,
  onStartDaily,
  onOpenDailyGift,
  onStartEndless,
  buyKnife,
  buyBoard,
  sharpenKnife,
  upgradeKnife,
  buyStaff,
  selectSupplier,
  cleanlinessAction,
  dayCleaner,
  setStandingOrder,
  setEquippedKnife,
  setEquippedBoard,
  toggleSetting,
  setMeasure,
  setRestaurantName,
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
  secondFloorAction,
  cleanerCleans,
  collectAchievement,
}: {
  screen: ScreenId;
  go: (s: ScreenId) => void;
  save: SaveData;
  /** The level whose Pre-Service Check is open: what the Market highlights is for it. */
  planLevelId?: string | null;
  /** Grandma's pointer at a section that just opened (restaurant build; App decides when). */
  navGuide?: NavGuide;
  recipeDetailLevelId: string;
  onOpenRecipe: (levelId: string) => void;
  onSelectLevel: (levelId: string) => void;
  onStartDaily: () => void;
  /** Phase 5 (B3): the Kitchen's daily gift card opens the gift sheet. */
  onOpenDailyGift?: () => void;
  onStartEndless: () => void;
  buyKnife: (id: string) => BuyKnifeResult;
  buyBoard: (id: string) => BuyBoardResult;
  sharpenKnife: (id: string) => SharpenKnifeResult;
  upgradeKnife: (id: string, stat: BlacksmithStat) => UpgradeKnifeResult;
  buyStaff: (id: string) => BuyStaffResult;
  selectSupplier: (id: string) => void;
  /** Restaurant → Cleanliness (restaurant/cleanliness.ts). */
  cleanlinessAction: (action: CleanlinessAction) => CleanlinessActionResult | null;
  /** Restaurant → Cleanliness: a Cleaner for today, paid or for an ad (App). */
  dayCleaner?: DayCleanerOffer;
  /** Restaurant → Suppliers: the standing orders (restaurant/deliveries.ts). */
  setStandingOrder: (kind: DeliveryKind, on: boolean) => void;
  setEquippedKnife: (id: string) => void;
  setEquippedBoard: (id: string) => void;
  toggleSetting: (key: "sound" | "music" | "reducedMotion") => void;
  /** Settings: weighed ingredients in lb or kg (business/measure.ts). */
  setMeasure: (measure: Measure) => void;
  /** The restaurant's name (restaurant/restaurantName.ts): Settings and the map's nameboard. */
  setRestaurantName: (name: string) => void;
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
  /** The Second Floor: buy / upgrade a station or collect (restaurant/secondFloor.ts). */
  secondFloorAction: (action: SecondFloorAction) => FloorResult;
  /** The map's Cleaner finished a real restroom job (App: cleanTask by the Cleaner). */
  cleanerCleans: (job: TaskKind) => void;
  /** Achievements: collect one earned reward (progression/achievements.ts). */
  collectAchievement: (id: string) => CollectResult;
}) {
  const [mapReturnAvailable, setMapReturnAvailable] = useState(false);

  // Any normal navigation leaves map-return mode. A map hotspot sets it again
  // so the destination screen always has a direct route back to the map.
  const routeGo = (destination: ScreenId) => {
    setMapReturnAvailable(false);
    go(destination);
  };

  const openMapDestination = (destination: ScreenId, zoneId: RestaurantZoneId) => {
    setMapReturnAvailable(true);
    if (zoneId === "takeaway") {
      openMarketSupplies(go, "packaging");
    } else if (zoneId === "cleaning") {
      openMarketSupplies(go, "cleaning");
    } else {
      go(destination);
    }
  };

  const fridgeTier =
    save.business.refrigerator.refrigeratorId === "professional-refrigerator"
      ? "professional"
      : save.business.refrigerator.refrigeratorId === "commercial-refrigerator"
        ? "commercial"
        : "basic";
  const attentionBadges = attentionBadgesFor(save);

  return (
    <NavLevelContext.Provider value={restaurantLevelOf(save.levelProgress)}>
      <NavAttentionContext.Provider value={attentionBadges}>
       <NavGuideContext.Provider value={navGuide ?? null}>
        {screen === "restaurant-map" ? (
          <Suspense fallback={<RestaurantLoading go={routeGo} active="restaurant-map" />}>
            <div className="relative h-full w-full overflow-hidden bg-[#f7edd7]">
              <RestaurantMap
                className="restaurant-map-production"
                playerLevel={restaurantLevelOf(save.levelProgress)}
                kitchenMapImage={kitchenMapImageUrl(save.equippedKitchenUpgradeId)}
                fridgeTier={fridgeTier}
                reducedMotion={save.settings.reducedMotion}
                staffOnMap={staffOnMap(save.business.staff.hiredRoles, {
                  stage: kitchenMapArtStage(save.equippedKitchenUpgradeId),
                  diningOpen: true,
                  serviceOpen: true,
                  cleanerJob: cleanerRestroomJob(save),
                  cleanerToday: dayCleanerToday(save),
                })}
                onCleanerDone={cleanerCleans}
                attentionCounts={attentionBadges.map}
                attentionSymbols={attentionBadges.mapSymbols}
                currentScreen={screen}
                onNavigateToScreen={openMapDestination}
                restaurantName={restaurantNameOf(save)}
                onRestaurantNameChange={setRestaurantName}
              />
              {(() => {
                const level = restaurantLevelOf(save.levelProgress);
                const open = isSecondFloorOpen(level);
                const waiting = open && floorEarnings(save, Date.now()) > 0;
                return (
                  <button
                    type="button"
                    data-testid="upstairs"
                    className={`press absolute bottom-24 right-3 z-20 min-h-12 rounded-2xl border px-4 font-ui text-[13px] font-extrabold shadow-lift ${
                      open
                        ? "border-walnut-dark/40 bg-walnut text-ivory"
                        : "border-walnut/20 bg-ivory/90 text-walnut/60"
                    }`}
                    aria-label={
                      open
                        ? `Upstairs to the second floor${waiting ? ", money waiting" : ""}`
                        : `Second floor opens at Level ${SECOND_FLOOR_OPENS_AT}`
                    }
                    onClick={() => (open ? routeGo("second-floor") : undefined)}
                  >
                    {open
                      ? `⬆ 2nd floor${waiting ? " 💰" : ""}`
                      : `🔒 2nd floor · Lv ${SECOND_FLOOR_OPENS_AT}`}
                  </button>
                );
              })()}
              <BottomNav active="restaurant-map" go={routeGo} />
            </div>
          </Suspense>
        ) : null}
        {screen === "second-floor" ? (
          <Suspense fallback={<RestaurantLoading go={routeGo} active="restaurant-map" />}>
            <div className="relative h-full w-full overflow-hidden bg-[#f7edd7]">
              <SecondFloorView
                save={save}
                playerLevel={restaurantLevelOf(save.levelProgress)}
                reducedMotion={save.settings.reducedMotion}
                onAction={secondFloorAction}
                onDownstairs={() => routeGo("restaurant-map")}
                onOpenMarket={() => openMarketSecondFloor(routeGo)}
              />
              <BottomNav active="restaurant-map" go={routeGo} />
            </div>
          </Suspense>
        ) : null}
        {screen === "kitchen" ? (
          <Kitchen
            go={routeGo}
            save={save}
            onSelectLevel={onSelectLevel}
            {...(onOpenDailyGift ? { onOpenDailyGift } : {})}
          />
        ) : null}
        {screen === "board" ? (
          <OrderBoard go={routeGo} save={save} onSelectLevel={onSelectLevel} />
        ) : null}
        {screen === "shop" || screen === "shop-ingredients" || screen === "shop-supplies" ? (
          <Shop
            key={screen}
            initialCategory={
              screen === "shop-ingredients"
                ? "ingredients"
                : screen === "shop-supplies"
                  ? peekSupplySection()
                  : peekMarketSecondFloor()
                    ? "second-floor"
                    : "knives"
            }
            purchaseIngredient={purchaseIngredient}
            {...(purchaseIngredients ? { purchaseIngredients } : {})}
            purchaseSupply={purchaseSupply}
            secondFloorAction={secondFloorAction}
            planLevelId={planLevelId}
            go={routeGo}
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
        {screen === "rack" ? <RestaurantProgress go={routeGo} save={save} /> : null}
        {screen === "achievements" ? (
          <Achievements go={routeGo} save={save} onCollect={collectAchievement} />
        ) : null}
        {screen === "daily-maintenance" ? (
          <DailyMaintenance go={routeGo} save={save} cleanlinessAction={cleanlinessAction} />
        ) : null}
        {screen === "inventory" || screen === "inventory-supplies" ? (
          <Suspense fallback={<RestaurantLoading go={routeGo} active="inventory" />}>
            <InventoryScreen
              key={screen}
              go={routeGo}
              save={save}
              initialKind={screen === "inventory-supplies" ? "supplies" : "ingredients"}
              throwOutExpired={throwOutExpired}
            />
          </Suspense>
        ) : null}
        {screen === "kitchen-upgrades" ? (
          <KitchenUpgrades go={routeGo} save={save} buildKitchenUpgrade={buildKitchenUpgrade} />
        ) : null}
        {screen === "recipes" ? <RecipeBook go={routeGo} save={save} onOpen={onOpenRecipe} /> : null}
        {screen === "recipe-detail" ? (
          <RecipeDetail
            levelId={recipeDetailLevelId}
            save={save}
            go={routeGo}
            onSelectLevel={onSelectLevel}
          />
        ) : null}
        {screen === "daily" ? <DailyOrder go={routeGo} save={save} onStartDaily={onStartDaily} /> : null}
        {screen === "prep-rush" ? (
          <Suspense fallback={<div className="h-full w-full bg-[#ecd7b1]" />}>
            <PrepRush go={routeGo} />
          </Suspense>
        ) : null}
        {screen === "endless" ? (
          <EndlessService go={routeGo} save={save} onStartEndless={onStartEndless} />
        ) : null}
        {screen === "settings" ? (
          <Settings
            go={routeGo}
            settings={save.settings}
            onToggleSetting={toggleSetting}
            onSetMeasure={RESTAURANT_MODE ? setMeasure : undefined}
            {...(RESTAURANT_MODE
              ? { restaurantName: restaurantNameOf(save), onSetRestaurantName: setRestaurantName }
              : {})}
            onResetProgress={resetProgress}
          />
        ) : null}
        {/* Business Mode: one Market-style screen; every business route opens its tab.
          Rendered from one place so the screen stays mounted while switching tabs. */}
        {businessTabForScreen(screen) ? (
          <Suspense fallback={<RestaurantLoading go={routeGo} active="business" />}>
            <BusinessDashboard
              go={routeGo}
              save={save}
              tab={businessTabForScreen(screen)!}
              onAdvanceDay={advanceBusinessDay}
              businessServiceSession={businessServiceSession}
              purchaseRefrigerator={purchaseRefrigerator}
              buildKitchenUpgrade={buildKitchenUpgrade}
              performRefrigeratorMaintenance={performRefrigeratorMaintenance}
              rushRestock={rushRestock}
              rushAdAvailable={rushAdAvailable}
              setMenuPrice={setMenuPrice}
              setBusinessDishActive={setBusinessDishActive}
              signSupplierContract={signSupplierContract}
              cancelSupplierContract={cancelSupplierContract}
              selectSupplier={selectSupplier}
              cleanlinessAction={cleanlinessAction}
              {...(dayCleaner ? { dayCleaner } : {})}
              setStandingOrder={setStandingOrder}
              hireStaff={hireStaff}
              buyStaff={buyStaff}
              fireStaff={fireStaff}
            />
          </Suspense>
        ) : null}
        {screen === "business-service" ? (
          <Suspense fallback={<RestaurantLoading go={routeGo} active="business" />}>
            <BusinessService
              go={routeGo}
              save={save}
              businessServiceSession={businessServiceSession}
              onStartService={onStartBusinessService}
              onEnterPreparation={onEnterBusinessPreparation}
              rushRestock={rushRestock}
              rushAdAvailable={rushAdAvailable}
            />
          </Suspense>
        ) : null}
        {mapReturnAvailable && screen !== "restaurant-map" && screen !== "gameplay" ? (
          <button
            type="button"
            data-map-return
            aria-label="Return to restaurant map"
            onClick={() => routeGo("restaurant-map")}
            className="fixed bottom-[82px] right-3 z-[80] land:bottom-3 flex min-h-12 items-center gap-2 rounded-full border border-walnut-dark/60 bg-walnut-dark px-4 font-ui text-[12px] font-extrabold text-ivory shadow-lift"
          >
            🗺️ Map
          </button>
        ) : null}
       </NavGuideContext.Provider>
      </NavAttentionContext.Provider>
    </NavLevelContext.Provider>
  );
}
