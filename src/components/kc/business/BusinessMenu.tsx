import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { useUnlockText } from "../navLevel";
import { Fragment, useState, type ReactNode } from "react";
import type { SaveData } from "@/game/SaveManager";
import { InfoTip, StatChip } from "../common/InfoTip";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { getCampaignRecipe } from "@/game/recipes/campaignRecipes";
import { BUSINESS_DISH_CATALOG, businessDishMargin } from "@/game/business/businessDishCatalog";
import type { SetMenuPriceResult } from "@/game/business/BusinessMenuManager";
import {
  isDishActive,
  activeBusinessDishes,
  type SetDishActiveResult,
} from "@/game/business/businessMenuActivation";
import { businessDishRequirements } from "@/game/business/businessServiceCatalog";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { formatQuantity, normalizeQuantity } from "@/game/business/businessInventory";
import { displayMeasure, formatStockAmount } from "@/game/business/measure";
import { purchaseUnitFor } from "@/game/business/businessPricing";
import {
  businessCustomerPayment,
  businessOrderAvailability,
} from "@/game/business/BusinessServiceManager";
import { defaultMenuPrice, menuPriceCap } from "@/game/business/businessMenu";
import { getRefrigeratorCapacity } from "@/game/business/RefrigeratorManager";
import {
  activeMenuDishes,
  campaignOrderKey,
  inCampaignOrder,
  lockedMenuDishes,
  playerChoosesMenu,
  unlockedMenuDishes,
} from "@/game/restaurant/restaurantMenu";
import {
  MENU_CHOICE_LEVEL,
  cuisineFor,
  restaurantSystem,
} from "@/game/restaurant/restaurantProgression";
import { Art, PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";
import { dishArtUrl } from "@/game/dishArt";
import { hasBusinessArt } from "@/game/businessArt";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";

/** The emoji a dish category shows until its painted icon (RB-icons-c) exists. */
const CATEGORY_EMOJI: Record<string, string> = {
  Salad: "🥗",
  Appetizer: "🍢",
  Entree: "🍽️",
  Side: "🍟",
  Curry: "🍛",
  Dessert: "🍰",
  "Stir-Fry": "🥘",
};

/** A quarter-dollar step — sensible for real USD menu pricing. */
const PRICE_STEP = 25;
/** From this popularity the menu suggests raising prices (developer 2026-10-16). */
const POPULAR_TIP_FROM = 60;

/**
 * BUSINESS · MENU tab (Economy V3 Phases 5/14). The dish list is
 * `BUSINESS_DISH_CATALOG`; price, food cost and margin come only from
 * `businessDishMargin` (businessMenu.ts's `marginFor`), the suggested price
 * from `defaultMenuPrice`, and what a customer actually pays from
 * `businessCustomerPayment` (menu price × popularity modifier) — the same
 * functions serving uses. Price changes persist immediately; they move no
 * money.
 *
 * Unified Restaurant (`restaurantLevel` given, RESTAURANT_MODE only): the
 * menu grows with the campaign (restaurant/restaurantMenu.ts). It lists the
 * ACTIVE dishes, then the unlocked ones switched off, then the LOCKED ones
 * with the level they join; before MENU_CHOICE_LEVEL the menu runs itself
 * (every unlocked dish on, no switches).
 */
export function BusinessMenu({
  save,
  setMenuPrice,
  setBusinessDishActive,
  restaurantLevel,
}: {
  save: SaveData;
  setMenuPrice: (recipeId: string, price: number) => SetMenuPriceResult;
  setBusinessDishActive: (dishId: string, active: boolean) => SetDishActiveResult;
  /** The restaurant's campaign level (Unified Restaurant only). */
  restaurantLevel?: number;
}) {
  const u = useUnlockText();
  const [messages, setMessages] = useState<Partial<Record<string, string>>>({});
  const [category, setCategory] = useState<string>("All");
  const activation = save.business.menuActivation;
  const restaurant = restaurantLevel !== undefined;
  const pool = restaurant ? unlockedMenuDishes(restaurantLevel) : BUSINESS_DISH_CATALOG;
  const activeDishes = restaurant
    ? activeMenuDishes(activation, restaurantLevel)
    : activeBusinessDishes(activation);
  const activeIds = new Set(activeDishes.map((d) => d.id));
  const chooses = !restaurant || playerChoosesMenu(restaurantLevel);
  const locked = restaurant ? lockedMenuDishes(restaurantLevel) : [];
  const fridgeCapacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  const activeIngredientIds = [
    ...new Set(activeDishes.flatMap((d) => businessDishRequirements(d).map((r) => r.ingredientId))),
  ];
  const categories = ["All", ...new Set(pool.map((d) => d.category))];
  const filtered = pool.filter((d) => category === "All" || d.category === category);
  // The restaurant lists dishes in the order the campaign brings them (developer
  // 2026-10-16); turning a dish off never moves it.
  const shown = restaurant ? inCampaignOrder(filtered) : filtered;
  // Popular restaurant → guests pay more than the menu price: suggest raising it.
  const popularity = pool[0] ? businessCustomerPayment(save, pool[0]) : null;
  const raiseTip =
    restaurant && popularity && popularity.popularity >= POPULAR_TIP_FROM
      ? Math.max(1, Math.round((popularity.popularity - 50) / 2.5))
      : null;

  function toggleDish(dishId: string, active: boolean) {
    const result = setBusinessDishActive(dishId, active);
    setMessages((m) => ({
      ...m,
      [dishId]: result.ok
        ? undefined
        : result.reason === "lastActiveDish"
          ? "Keep at least one dish on the menu."
          : "That dish couldn't be changed.",
    }));
  }

  function adjustPrice(dishId: string, recipeId: string, currentPrice: number, delta: number) {
    const result = setMenuPrice(recipeId, Math.max(0, currentPrice + delta));
    if (!result.ok) setMessages((m) => ({ ...m, [dishId]: "That price couldn't be set." }));
    else
      setMessages((m) => ({
        ...m,
        [dishId]: result.capped ? "That's the highest price guests will accept." : undefined,
      }));
  }

  return (
    <div className="space-y-5">
      {/* The heading plaque: the painted one (RB-banners, a blank plaque with the chef medallion; the words are written on it) or the walnut ribbon until it exists. */}
      {hasBusinessArt("banners/menu-plaque") ? (
        <div className="relative mx-auto aspect-[6.15/1] w-full max-w-[540px]">
          <Art
            name="biz:banners/menu-plaque"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
          <h2 className="absolute inset-y-0 left-[17%] right-[7%] flex items-center justify-center text-center font-display text-[18px] font-black leading-tight text-[#fff4dc] drop-shadow-[0_1px_1px_rgba(40,20,5,0.8)] sm:text-[23px]">
            Menu Management
          </h2>
        </div>
      ) : (
        <div className="relative mx-auto flex min-h-[52px] max-w-[560px] items-center justify-center">
          <span className="bz-ribbon-dark absolute inset-x-6 inset-y-1 rounded-full" aria-hidden />
          <PIcon
            name="icons-a/toque"
            fallback="👨‍🍳"
            size={46}
            className="absolute left-2 top-1/2 -translate-y-1/2"
          />
          <h2 className="relative px-14 py-2 text-center font-display text-[21px] font-black leading-tight text-[#fff4dc]">
            Menu Management
          </h2>
        </div>
      )}
      <ProgressCard className="pt-3" data-testid="menu-summary">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[15px] font-black text-walnut-dark">
            {restaurant ? "Active today" : "On the menu"}
          </p>
          <ValuePill className="text-[13px]">
            <span data-testid="menu-active-count">
              {activeDishes.length} / {pool.length} dishes
            </span>
          </ValuePill>
        </div>
        {restaurant && pool.length === 0 ? (
          <p
            className="mt-1 font-hand text-[15px] leading-snug text-walnut/70"
            data-testid="menu-opens-at"
          >
            🔒 The menu opens {u.when(restaurantSystem("menu").firstLevel)}
          </p>
        ) : null}
        {restaurant && !chooses && pool.length > 0 ? (
          <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/70">
            ✨ New dishes go straight on · 🎛️ you choose {u.when(MENU_CHOICE_LEVEL)}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatChip icon="🥕" title="Ingredients your menu needs in stock">
            {activeIngredientIds.length} ingredient{activeIngredientIds.length === 1 ? "" : "s"}
          </StatChip>
          <StatChip icon="❄️" title="Fridge capacity">
            {fridgeCapacity} units
          </StatChip>
          <InfoTip label="How the menu works">
            Customers only order dishes that are on. They pay your price × today's popularity
            modifier. A smaller menu means less stock to keep fresh.
          </InfoTip>
        </div>
      </ProgressCard>

      {raiseTip !== null && popularity ? (
        <ProgressCard className="pt-3" data-testid="menu-price-tip">
          <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
            ⭐ Tip: your restaurant is popular ({popularity.popularity}/100)
          </p>
          <p className="mt-0.5 font-ui text-[12.5px] leading-snug text-walnut/70">
            💵 Guests pay × {popularity.multiplier.toFixed(2)} today · 💡 raise your menu prices
            about +{raiseTip}%
          </p>
        </ProgressCard>
      ) : null}

      <div
        // Vertical room so the chips' borders and shadows aren't cut off (the row scrolls sideways).
        className="-mx-4 -my-1 flex gap-2 overflow-x-auto no-scrollbar px-4 py-1.5"
        aria-label="Dish categories"
      >
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "press flex h-12 min-w-12 shrink-0 items-center gap-1.5 rounded-full border px-4 font-ui text-[13.5px] font-extrabold",
              category === c
                ? "border-[#46250f] bg-[linear-gradient(180deg,#86522b,#5e3519_60%,#46250f)] text-[#fff4dc]"
                : "pg-pill text-walnut-dark",
            )}
          >
            {c !== "All" ? (
              <PIcon
                name={`biz:icons-c/${c.toLowerCase()}`}
                fallback={CATEGORY_EMOJI[c] ?? "🍽️"}
                size={26}
              />
            ) : null}
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((dish) => {
          const { price, cost, margin, foodCostPercent, grossMarginPercent } = businessDishMargin(
            save.business.menu,
            dish,
          );
          // A campaign guest pays the popular-dish rise (dishHeat.ts); the 🔥 tag shows it.
          const payment = businessCustomerPayment(save, dish, { popular: restaurant });
          const recipeId = dish.sourceRecipeId;
          const recipe = getCampaignRecipe(recipeId);
          const suggested = recipe ? defaultMenuPrice(recipe) : price;
          const cap = recipe ? menuPriceCap(recipe) : price;
          const atCap = price >= cap;
          const message = messages[dish.id];
          const onMenu = restaurant ? activeIds.has(dish.id) : isDishActive(activation, dish.id);
          const needTotals = new Map<IngredientId, number>();
          for (const r of businessDishRequirements(dish)) {
            needTotals.set(
              r.ingredientId,
              normalizeQuantity((needTotals.get(r.ingredientId) ?? 0) + r.quantity),
            );
          }
          const canMake = businessOrderAvailability(save, dish).available;
          return (
            <article
              key={dish.id}
              data-menu-dish={dish.id}
              data-menu-on={onMenu ? "true" : "false"}
              data-menu-order={restaurant ? campaignOrderKey(dish).join(".") : undefined}
              className={cn(
                "pg-card relative rounded-[22px] p-3",
                onMenu ? "" : "border-walnut/20",
              )}
            >
              <div className="grid grid-cols-[76px_minmax(0,1fr)_auto] gap-x-3 gap-y-2 [grid-template-areas:'photo_info_info''photo_switch_switch''minus_badge_plus''stats_stats_stats''foot_foot_foot'] @min-[720px]:grid-cols-[156px_minmax(0,1fr)_230px_auto] @min-[720px]:[grid-template-areas:'photo_info_badge_switch''photo_stats_stats_pm''photo_foot_foot_foot']">
                <DishPhoto
                  recipeId={recipeId}
                  emoji={recipe?.emoji ?? "🍽️"}
                  name={dish.name}
                  on={onMenu}
                />
                <div className="min-w-0 [grid-area:info]">
                  <p className="font-display text-[19px] font-black leading-tight text-walnut-dark">
                    {dish.name}
                    {/* Phase 2 (restaurant/dishHeat.ts): a popular dish costs more. */}
                    {payment.risePct > 0 ? (
                      <span
                        data-dish-hot={payment.risePct}
                        className="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-tomato/15 px-2 py-0.5 align-middle font-ui text-[11px] font-extrabold text-tomato"
                      >
                        🔥 +{payment.risePct}%
                        <InfoTip label="Why this dish costs more">
                          Guests have been ordering this dish a lot, so it sells for more: +5% for
                          each step of popularity, at most +25% and never above the menu price
                          limit. It cools down each night when fewer guests order it.
                        </InfoTip>
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 inline-block rounded-md bg-[#f3dfb6] px-2 py-0.5 font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-copper">
                    {dish.category}
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-ui text-[12.5px] font-bold leading-snug",
                      canMake ? "text-olive" : "text-walnut/60",
                    )}
                  >
                    {canMake ? "✓ " : "🛒 "}
                    {/* Each ingredient as its emoji and amount, the name on hover / for
                        screen readers (developer 2026-10-23: no long lists). */}
                    {[...needTotals].map(([id, q], i) => (
                      <Fragment key={id}>
                        {i > 0 ? " · " : ""}
                        <span className="whitespace-nowrap" title={INGREDIENTS[id]?.name ?? id}>
                          <span aria-hidden>
                            <IngredientIcon id={id} fallback={INGREDIENT_EMOJI[id] ?? "🥬"} />
                          </span>
                          <span className="sr-only">{INGREDIENTS[id]?.name ?? id}</span>{" "}
                          {formatStockAmount(id, q, displayMeasure())}
                        </span>
                      </Fragment>
                    ))}
                  </p>
                </div>

                <div className="flex items-start justify-start @min-[720px]:justify-end [grid-area:switch]">
                  {!chooses ? (
                    <span className="grid h-12 min-w-[92px] place-items-center rounded-full border border-[#5f8a35] bg-[linear-gradient(180deg,#9fc46a,#5f8a35)] px-4 font-ui text-[14px] font-extrabold text-white">
                      ✓ On
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      onClick={() => toggleDish(dish.id, !onMenu)}
                      aria-checked={onMenu}
                      aria-label={`${dish.name} on the menu`}
                      data-menu-switch={dish.id}
                      className="press grid h-12 min-w-[96px] place-items-center"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "relative flex h-9 w-[88px] items-center rounded-full border px-2.5 font-ui text-[14px] font-extrabold transition-colors",
                          onMenu
                            ? "border-[#5f8a35] bg-[linear-gradient(180deg,#9fc46a,#5f8a35)] text-white"
                            : "border-walnut/25 bg-walnut/15 pl-9 text-walnut/70",
                        )}
                      >
                        {onMenu ? "✓ On" : "Off"}
                        <span
                          className={cn(
                            "absolute top-[3px] h-7 w-7 rounded-full bg-ivory shadow-soft transition-transform",
                            onMenu ? "right-[3px]" : "left-[3px]",
                          )}
                        />
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center [grid-area:badge]">
                  <PriceBadge price={price} suggested={suggested} cap={cap} atCap={atCap} />
                </div>
                <div className="contents @min-[720px]:flex @min-[720px]:items-start @min-[720px]:justify-end @min-[720px]:gap-2 @min-[720px]:[grid-area:pm]">
                  <button
                    type="button"
                    onClick={() => adjustPrice(dish.id, recipeId, price, -PRICE_STEP)}
                    className="press grid h-12 w-12 place-items-center justify-self-start rounded-full border border-walnut/20 bg-ivory font-ui text-[20px] font-black text-walnut-dark shadow-soft [grid-area:minus]"
                    aria-label={`Decrease price for ${dish.name}`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustPrice(dish.id, recipeId, price, PRICE_STEP)}
                    disabled={atCap}
                    className="press grid h-12 w-12 place-items-center justify-self-end rounded-full border border-walnut/20 bg-ivory font-ui text-[20px] font-black text-walnut-dark shadow-soft disabled:opacity-35 [grid-area:plus]"
                    aria-label={`Increase price for ${dish.name}`}
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 @min-[380px]:grid-cols-3 [grid-area:stats]">
                  <DishStat
                    icon={<PIcon name="icons-a/coins" fallback="💰" size={34} />}
                    label="Customer pays"
                    value={formatUsd(payment.customerPays)}
                  />
                  <DishStat
                    icon={<PIcon name="icons-c/cloche" fallback="🍽️" size={34} />}
                    label="Food cost"
                    value={formatUsd(cost)}
                  />
                  <DishStat
                    icon={<PIcon name="icons-a/chart-trend" fallback="📈" size={34} />}
                    label="Kept per plate"
                    value={`${margin >= 0 ? "+" : ""}${formatUsd(margin)}`}
                    tone={margin >= 0 ? "good" : "bad"}
                  />
                </div>

                <div className="flex flex-col gap-1 [grid-area:foot]">
                  {message ? (
                    <p className="text-center font-hand text-[14px] text-copper">{message}</p>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="flex min-w-0 items-center gap-1.5 font-ui text-[12px] font-bold text-walnut/60"
                      title={`× ${payment.multiplier.toFixed(2)} at popularity ${payment.popularity}/100 · ${grossMarginPercent}% of the price kept`}
                    >
                      <PIcon name="icons-a/star" fallback="⭐" size={22} />
                      {payment.popularity} · ×{payment.multiplier.toFixed(2)} · {grossMarginPercent}
                      % kept
                    </p>
                    <span className="shrink-0 whitespace-nowrap">
                      <ValuePill
                        tone={margin >= 0 ? "green" : "red"}
                        className="min-h-7 px-3 text-[12px] uppercase tracking-wide"
                      >
                        {foodCostPercent}% food cost
                      </ValuePill>
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {locked.length > 0 ? (
        <div data-testid="menu-locked">
          <ProgressCard
            title="Locked"
            icon={<PIcon name="icons-a/padlock" fallback="🔒" size={26} />}
            dark
            className="pt-9"
          >
            <ul className="divide-y divide-walnut/10">
              {locked.map(({ dish, unlockLevel, cuisine }) => {
                const specialist = cuisineFor(dish.cuisineId).specialist;
                return (
                  <li
                    key={dish.id}
                    className="flex min-h-12 items-center justify-between gap-3 py-1.5"
                    data-menu-locked={dish.id}
                  >
                    <span className="min-w-0 font-ui text-[13.5px] font-bold text-walnut/70">
                      🔒 {dish.name}
                    </span>
                    <span className="shrink-0 text-right font-ui text-[12px] font-extrabold text-walnut/55">
                      {u.level(unlockLevel)} · {cuisine}
                      {specialist ? <span className="block">needs {specialist.title}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </ProgressCard>
        </div>
      ) : null}
    </div>
  );
}

/** The dish's own painted plate (public/dishes) on a wooden tabletop in a gold frame; the emoji until the dish has a picture. */
function DishPhoto({
  recipeId,
  emoji,
  name,
  on,
}: {
  recipeId: string;
  emoji: string;
  name: string;
  on: boolean;
}) {
  const url = dishArtUrl(recipeId);
  return (
    <div
      className="relative aspect-square w-full self-start overflow-hidden rounded-[18px] border-[3px] border-[#d9a22c] bg-[radial-gradient(circle_at_50%_40%,#d9a869,#a9743f_70%,#8a5a2e)] shadow-[inset_0_0_14px_rgba(60,30,10,0.35),0_2px_5px_rgba(80,40,10,0.25)] [grid-area:photo]"
      data-dish-photo={url ? "painted" : "emoji"}
    >
      <Art
        name="biz:pieces/plate-frame"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {url ? (
        <img
          src={url}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="lazy"
          decoding="async"
          title={name}
          className={cn(
            "absolute inset-[6%] h-[88%] w-[88%] select-none object-contain drop-shadow-[0_3px_4px_rgba(40,20,5,0.45)]",
            !on && "opacity-55 grayscale",
          )}
        />
      ) : (
        <span
          className={cn(
            "absolute inset-0 grid place-items-center text-[44px] leading-none",
            !on && "opacity-50 grayscale",
          )}
          aria-hidden
        >
          {emoji}
        </span>
      )}
    </div>
  );
}

/** The price on a cream plate between two laurel branches, with the suggested price and the cap under it (the branches are RB-pieces; the plate alone until they exist). */
function PriceBadge({
  price,
  suggested,
  cap,
  atCap,
}: {
  price: number;
  suggested: number;
  cap: number;
  atCap: boolean;
}) {
  return (
    <div className="flex w-full max-w-[250px] items-center justify-center gap-0.5">
      <Art name="biz:pieces/laurel-left" className="pointer-events-none h-[88px] w-auto shrink-0" />
      <div className="min-w-0 flex-1 rounded-[26px] border border-[#e4c06c] bg-[linear-gradient(180deg,#fff8e4,#fbe6ac)] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <p
          className="font-display text-[28px] font-black leading-none text-walnut-dark"
          data-testid="menu-price"
        >
          {formatUsd(price)}
        </p>
        <p className="mt-0.5 font-ui text-[12px] font-bold leading-tight text-walnut/65">
          {price === suggested ? "suggested price" : `suggested ${formatUsd(suggested)}`}
        </p>
        <p
          className={cn(
            "font-ui text-[12px] font-bold leading-tight",
            atCap ? "text-copper" : "text-walnut/55",
          )}
          data-testid="menu-price-cap"
        >
          {atCap ? "max price" : `max ${formatUsd(cap)}`}
        </p>
      </div>
      <Art
        name="biz:pieces/laurel-right"
        className="pointer-events-none h-[88px] w-auto shrink-0"
      />
    </div>
  );
}

/** One of the three money tiles of a dish (Customer pays, Food cost, Kept per plate). */
function DishStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-2 rounded-2xl border border-[#ebd2a0] bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] px-2.5 py-1.5">
      {icon}
      <span className="min-w-0 leading-tight">
        <span className="block font-ui text-[12px] font-bold text-walnut/65">{label}</span>
        <span
          className={cn(
            "block font-display text-[17px] font-black",
            tone === "good"
              ? "text-[#2f6b1f]"
              : tone === "bad"
                ? "text-copper"
                : "text-walnut-dark",
          )}
        >
          {value}
        </span>
      </span>
    </div>
  );
}
