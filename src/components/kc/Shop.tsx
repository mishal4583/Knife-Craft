import { MarketSecondFloor } from "./MarketSecondFloor";
import { ShopItemArt } from "./common/ShopItemArt";
import { BuyButton, PricePill, ShopCard, ShopLine } from "./market/ShopCard";
import { marketNeeds } from "@/game/restaurant/marketNeeds";
import type { SecondFloorAction } from "./restaurantMap/SecondFloorView";
import type { FloorResult } from "@/game/restaurant/secondFloor";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ScreenId } from "./data";
import { BottomNav } from "./Kitchen";
import { FIRST_INGREDIENT_PURCHASE_LEVEL } from "@/game/restaurant/firstLevels";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { KnifeGlyph } from "./Workshop";
import { BoardPreview } from "./Boards";
import {
  Badge,
  Coin,
  Divider,
  KButton,
  Panel,
  ScreenHeader,
  SectionTitle,
} from "./common/primitives";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { KNIFE_CATALOG, INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import type { KnifeDefinition } from "@/game/knives/knifeTypes";
import { getKnifePurchaseState, type BuyKnifeResult } from "@/game/knives/KnifeManager";
import { BOARD_CATALOG } from "@/game/boards/boardDefinitions";
import { getBoardPurchaseState, type BuyBoardResult } from "@/game/boards/BoardManager";
import {
  KNIFE_SPECIALIZATION_LABEL,
  BOARD_SPECIALIZATION_LABEL,
} from "@/game/economy/equipmentSpecialization";
import { SUPPLIER_CATALOG } from "@/game/economy/supplierDefinitions";
import { getSelectedSupplierId } from "@/game/economy/SupplierManager";
import { formatUsd, formatUsdChange } from "@/game/money";
import type { PurchaseIngredientResult } from "@/game/business/BusinessInventoryManager";
import { MarketIngredients } from "./MarketIngredients";
import { MarketSupplies } from "./MarketSupplies";
import type { PurchaseSupplyResult } from "@/game/business/BusinessSuppliesManager";
import {
  SUPPLY_SECTIONS,
  getSupplyItem,
  type SupplyId,
  type SupplySection,
} from "@/game/business/businessSupplies";
import {
  peekMarketFocus,
  peekMarketPlan,
  peekMarketQuantity,
  clearMarketFocus,
  peekSupplyFocus,
  peekSupplyPacks,
  clearMarketSecondFloor,
  clearSupplyFocus,
} from "./marketFocus";
import { ledgerTotals, LEDGER_CATEGORY_LABEL } from "@/game/economy/EconomyLedger";
import { ShortfallOffer } from "./ads/ShortfallOffer";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import {
  getKnifeSharpness,
  sharpnessLabel,
  SHARPEN_COST,
  type SharpenKnifeResult,
} from "@/game/economy/sharpness";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { InfoTip, StatChip } from "./common/InfoTip";
import {
  BLACKSMITH_STATS,
  MAX_UPGRADE_LEVEL,
  getKnifeUpgrades,
  knifeLevel,
  forgePreview,
  type ForgeFigures,
  upgradeCost,
  type BlacksmithStat,
  type UpgradeKnifeResult,
} from "@/game/knives/blacksmith";

/**
 * SHOP — the one purchase destination. Every item, price, ownership state
 * and action is KnifeCraft's own — the SAME catalogs and the SAME App.tsx
 * actions the Rack uses (buyKnife/buyBoard/selectSupplier,
 * equipKnife/equipBoard, sharpenKnife) plus the Blacksmith's upgradeKnife.
 * One wallet (save.credits, US dollars — see money.ts), one ledger, one save.
 *
 * Presentation uses the game's own theme, exactly like Rack and Business:
 * ScreenHeader + Coin wallet chip, Panel/card-warm/wood surfaces, KButton,
 * Badge, the Fraunces/Nunito/Caveat type scale and emoji symbols.
 *
 * Artwork: the shop and blacksmith illustrations are loaded from
 * src/assets/shop/ when present; without them the hero shows the knife.
 */
// shop-mobile/ holds 1200px-wide copies of src/assets/shop/ (the full-size
// originals): the header never renders wider than ~1200 device pixels on a phone.
const shopArt = import.meta.glob("/src/assets/shop-mobile/*.{png,jpg,jpeg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
function artFor(...names: string[]): string | undefined {
  const key = Object.keys(shopArt).find((path) =>
    names.includes(
      path
        .split("/")
        .pop()!
        .replace(/\.[a-z]+$/i, ""),
    ),
  );
  return key ? shopArt[key] : undefined;
}
const HEADER_ART = artFor("market-header");
const BLACKSMITH_ART = artFor("blacksmith", "blacksmith-market");

export type ShopCategory =
  | "knives"
  | "boards"
  | "suppliers"
  | "ingredients"
  | "blacksmith"
  // The Second Floor's machines, upgrades and Floor Team (restaurant build only).
  | "second-floor"
  // Business Supplies (master spec §25): smallwares, tableware, takeaway packaging.
  | SupplySection;

function isSupplySection(c: ShopCategory): c is SupplySection {
  return c === "culinary" || c === "service" || c === "packaging" || c === "cleaning";
}

const categories: Array<{ id: ShopCategory; label: string; emoji: string }> = [
  { id: "knives", label: "Knives", emoji: "🔪" },
  { id: "boards", label: "Cutting Boards", emoji: "🪵" },
  { id: "suppliers", label: "Campaign Supplier", emoji: "🚚" },
  { id: "ingredients", label: "Ingredients", emoji: "🧺" },
  { id: "blacksmith", label: "Blacksmith", emoji: "⚒️" },
  { id: "culinary", label: SUPPLY_SECTIONS.culinary.short, emoji: SUPPLY_SECTIONS.culinary.emoji },
  { id: "service", label: SUPPLY_SECTIONS.service.short, emoji: SUPPLY_SECTIONS.service.emoji },
  {
    id: "packaging",
    label: SUPPLY_SECTIONS.packaging.short,
    emoji: SUPPLY_SECTIONS.packaging.emoji,
  },
  // Restaurant build only (filtered below): the Cleanliness screen's supplies.
  { id: "cleaning", label: SUPPLY_SECTIONS.cleaning.short, emoji: SUPPLY_SECTIONS.cleaning.emoji },
  // Restaurant build only: the Second Floor's machines, upgrades and team.
  { id: "second-floor", label: "Second Floor", emoji: "🏬" },
];

/**
 * Unified Restaurant phase 7: in the restaurant build the ingredient supplier
 * is chosen on Restaurant → Suppliers (it sets Market prices), so the Market
 * has no supplier tab. The release build keeps its Campaign Supplier tab.
 */
const shopCategories = RESTAURANT_MODE
  ? categories.filter((c) => c.id !== "suppliers")
  : categories.filter((c) => c.id !== "cleaning" && c.id !== "second-floor");

const categoryCopy: Record<ShopCategory, { title: string; description: string }> = {
  knives: {
    title: "Knives",
    description: "🔪 Speed · precision · prep",
  },
  boards: {
    title: "Cutting Boards",
    description: "🪵 Cleaner chops, smoother service",
  },
  suppliers: {
    title: "Campaign Supplier",
    description: "🚚 Bulk or premium · switch any time",
  },
  ingredients: {
    title: "Fresh Ingredients",
    description: "🧊 Into your fridge · today's prices",
  },
  blacksmith: { title: "Blacksmith", description: "⚒️ Forge your knife · cut faster" },
  culinary: {
    title: SUPPLY_SECTIONS.culinary.title,
    description: "🍳 Pots, pans & prep tools",
  },
  service: {
    title: SUPPLY_SECTIONS.service.title,
    description: "🍽️ Cutlery, plates & glasses",
  },
  packaging: {
    title: SUPPLY_SECTIONS.packaging.title,
    description: "🥡 Containers & bags",
  },
  cleaning: {
    title: SUPPLY_SECTIONS.cleaning.title,
    description: "🧽 Kitchen · dining · restroom",
  },
  "second-floor": {
    title: "Second Floor",
    description: "🏬 Machines · upgrades · team",
  },
};

type CardAction =
  | {
      kind: "buy";
      label: string;
      onClick: () => void;
      disabled?: boolean;
      /** The price (cents): a small shortfall gets the "📺 Watch · +$X" top-up (ads/adBonuses.ts). */
      price?: number;
    }
  | { kind: "equip"; onClick: () => void }
  | { kind: "equipped"; label?: string }
  | { kind: "locked"; label: string }
  | { kind: "owned"; label: string };

type Card = {
  id: string;
  name: string;
  description: string;
  visual: ReactNode;
  stats: Array<[string, string]>;
  price: string;
  action: CardAction;
  locked?: boolean;
};

/** Small uppercase copper label — the same section label Business and Rack use. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
      {children}
    </p>
  );
}

export function Shop({
  go,
  save,
  buyKnife,
  buyBoard,
  selectSupplier,
  equipKnife,
  equipBoard,
  sharpenKnife,
  upgradeKnife,
  purchaseIngredient,
  purchaseIngredients,
  purchaseSupply,
  initialCategory = "knives",
  secondFloorAction,
  planLevelId = null,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  buyKnife: (id: string) => BuyKnifeResult;
  buyBoard: (id: string) => BuyBoardResult;
  selectSupplier: (id: string) => void;
  equipKnife: (id: string) => void;
  equipBoard: (id: string) => void;
  sharpenKnife: (id: string) => SharpenKnifeResult;
  upgradeKnife: (id: string, stat: BlacksmithStat) => UpgradeKnifeResult;
  /** Business stock — the Ingredients tab is where it is bought (MarketIngredients). */
  purchaseIngredient: (ingredientId: string, quantity: number) => PurchaseIngredientResult;
  purchaseIngredients?: (lines: ReadonlyArray<{ ingredientId: string; quantity: number }>) => {
    bought: number;
    skipped: number;
    totalCost: number;
  };
  /** Business supplies — bought in their three Market sections (MarketSupplies). */
  purchaseSupply: (supplyId: string, packs: number) => PurchaseSupplyResult;
  /** "shop-ingredients" opens the Market on Ingredients (Business → Market links). */
  initialCategory?: ShopCategory;
  /** The Second Floor's buy / upgrade / hire (App.secondFloorAction, the floor's own action). */
  secondFloorAction?: (action: SecondFloorAction) => FloorResult;
  /** The level whose Pre-Service Check is open: what the Market highlights is for it. */
  planLevelId?: string | null;
}) {
  // First levels (restaurant build, firstLevels.ts): before Level 3 the
  // Market is locked; from Level 3 all ingredient categories can be purchased.
  const browseOnly =
    RESTAURANT_MODE && restaurantLevelOf(save.levelProgress) < FIRST_INGREDIENT_PURCHASE_LEVEL;
  const visibleCategories = browseOnly
    ? shopCategories.filter((c) => c.id === "knives" || c.id === "boards")
    : shopCategories;
  const startCategory = visibleCategories.some((c) => c.id === initialCategory)
    ? initialCategory
    : "knives";
  const [category, setCategory] = useState<ShopCategory>(startCategory);
  const [notice, setNotice] = useState(
    browseOnly
      ? `🔒 Ingredients from Level ${FIRST_INGREDIENT_PURCHASE_LEVEL}`
      : startCategory === "knives"
        ? "Welcome back, Chef!"
        : categoryCopy[startCategory].description,
  );
  const [focusId] = useState(peekMarketFocus);
  const [focusQuantity] = useState(peekMarketQuantity);
  const [supplyFocusId] = useState(peekSupplyFocus);
  const [supplyFocusPacks] = useState(peekSupplyPacks);
  const [planFocus] = useState(peekMarketPlan);
  useEffect(() => {
    clearMarketFocus();
    clearSupplyFocus();
    clearMarketSecondFloor();
  }, []);

  function selectCategory(next: ShopCategory) {
    setCategory(next);
    setNotice(categoryCopy[next].description);
  }

  function purchaseMessage(
    result: { ok: boolean; reason?: string },
    name: string,
    price: number,
    unlockLevel?: number,
  ) {
    if (result.ok) return setNotice(`${name} purchased!`);
    if (result.reason === "insufficientFunds")
      return setNotice(notEnoughMoneyText(price, save.credits));
    if (result.reason === "notUnlocked" && unlockLevel)
      return setNotice(`${name} unlocks at Level ${unlockLevel}.`);
    setNotice(`${name} couldn't be bought right now.`);
  }

  const cards = cardsFor(category);
  // How many items each section needs for today / tonight (restaurant build): a badge on its tab.
  // …and, in gold, how many it needs for the next levels when nothing is due today.
  const [needCount, soonCount] = useMemo(() => {
    const counts: Partial<Record<ShopCategory, number>> = {};
    const soon: Partial<Record<ShopCategory, number>> = {};
    if (!RESTAURANT_MODE) return [counts, soon];
    const needs = marketNeeds(save, planLevelId);
    for (const n of Object.values(needs.ingredients))
      if (n && n.when !== "soon") counts.ingredients = (counts.ingredients ?? 0) + 1;
    for (const [id, n] of Object.entries(needs.supplies)) {
      const section = getSupplyItem(id as SupplyId)?.section;
      if (!n || !section) continue;
      if (n.when !== "soon") counts[section] = (counts[section] ?? 0) + 1;
      else soon[section] = (soon[section] ?? 0) + 1;
    }
    return [counts, soon];
  }, [save, planLevelId]);

  function cardsFor(c: ShopCategory): Card[] {
    if (c === "knives") {
      return KNIFE_CATALOG.map((k) => {
        const state = getKnifePurchaseState(save, k.id);
        const owned = state === "owned" || state === "equipped";
        const stats: Array<[string, string]> = [
          ["Style", k.weight === k.style ? k.style : `${k.weight} · ${k.style}`],
          ["Best for", KNIFE_SPECIALIZATION_LABEL[k.id] ?? "—"],
        ];
        if (owned) stats.push(["Blacksmith", `Level ${knifeLevel(getKnifeUpgrades(save, k.id))}`]);
        return {
          id: k.id,
          name: k.name,
          description: k.description,
          visual: <KnifeVisual knife={k} />,
          stats,
          price: k.price === 0 ? "Included" : formatUsd(k.price),
          locked: state === "locked",
          action:
            state === "equipped"
              ? { kind: "equipped" }
              : state === "owned"
                ? {
                    kind: "equip",
                    onClick: () => {
                      equipKnife(k.id);
                      setNotice(`${k.name} is now equipped.`);
                    },
                  }
                : state === "locked"
                  ? { kind: "locked", label: `Unlocks at Level ${k.unlockLevel}` }
                  : {
                      kind: "buy",
                      label: "Buy",
                      price: k.price,
                      onClick: () =>
                        purchaseMessage(buyKnife(k.id), k.name, k.price, k.unlockLevel),
                    },
        };
      });
    }
    if (c === "boards") {
      return BOARD_CATALOG.map((b) => {
        const state = getBoardPurchaseState(b.id, save);
        return {
          id: b.id,
          name: b.name,
          description: b.description,
          visual: <BoardPreview board={b} size={96} />,
          stats: [
            ["Material", b.material],
            ["Best for", BOARD_SPECIALIZATION_LABEL[b.id] ?? "—"],
          ],
          price: b.price === 0 ? "Included" : formatUsd(b.price),
          locked: state === "locked",
          action:
            state === "equipped"
              ? { kind: "equipped" }
              : state === "owned"
                ? {
                    kind: "equip",
                    onClick: () => {
                      equipBoard(b.id);
                      setNotice(`${b.name} is now in use.`);
                    },
                  }
                : state === "locked"
                  ? { kind: "locked", label: `Unlocks at Level ${b.unlockLevel}` }
                  : {
                      kind: "buy",
                      label: "Buy",
                      price: b.price,
                      onClick: () =>
                        purchaseMessage(buyBoard(b.id), b.name, b.price, b.unlockLevel),
                    },
        };
      });
    }
    // suppliers — a free SELECTION (Economy V2 Phase 8), never a purchase.
    const selected = getSelectedSupplierId(save);
    return SUPPLIER_CATALOG.map((sup) => ({
      id: sup.id,
      name: sup.name,
      description: sup.description,
      visual: (
        <EmojiVisual emoji={sup.cogsModifier < 0 ? "🚚" : sup.cogsModifier > 0 ? "🧺" : "🏪"} />
      ),
      stats: [
        [
          "Ingredient cost",
          sup.cogsModifier === 0
            ? "Standard"
            : `${sup.cogsModifier > 0 ? "+" : ""}${Math.round(sup.cogsModifier * 100)}%`,
        ],
        ["Term", "Switch any time"],
      ],
      price: "Free",
      action:
        sup.id === selected
          ? { kind: "equipped", label: "Current supplier" }
          : {
              kind: "buy",
              label: "Choose supplier",
              onClick: () => {
                selectSupplier(sup.id);
                setNotice(`${sup.name} now stocks your kitchen.`);
              },
            },
    }));
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Market"
          subtitle={
            RESTAURANT_MODE ? "tools, ingredients & supplies" : "tools, ingredients & suppliers"
          }
          onBack={() => go("kitchen")}
          right={<Coin n={save.credits} />}
        />

        {/* Shopfront — the shop illustration in the same rounded hero frame Rack uses for its knife. */}
        <div className="px-4">
          <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood shadow-lift">
            {HEADER_ART ? (
              <img
                src={HEADER_ART}
                alt="A friendly merchant behind the counter of a warm wooden kitchen market"
                // Restaurant Ingredients: a shorter banner so the Plan ahead panel is on
                // screen (audit 2026-10-08: it sat below the fold).
                className={cn(
                  "block w-full object-cover object-top land:!h-[72px] land:object-[center_35%]",
                  RESTAURANT_MODE && category === "ingredients" ? "h-[96px]" : "h-[168px]",
                )}
              />
            ) : (
              <div className="grid h-[140px] place-items-center">
                <KnifeGlyph knife={KNIFE_CATALOG[0]!} size={180} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(46,28,16,0.82))] px-4 pb-2.5 pt-8">
              <p className="font-hand text-[18px] leading-tight text-ivory" aria-live="polite">
                ✦ {notice}
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <nav
          className={cn(
            "category-tabs grid gap-2 px-4 pt-3",
            browseOnly ? "grid-cols-2" : "grid-cols-3 land:grid-cols-6",
          )}
          aria-label="Shop categories"
        >
          {visibleCategories.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => selectCategory(item.id)}
                data-category={item.id}
                data-needs={needCount[item.id] || undefined}
                className={cn(
                  "press relative flex h-[64px] flex-col items-center justify-center gap-0.5 rounded-[18px] border px-1",
                  active
                    ? "wood border-walnut-dark/50 text-ivory shadow-soft"
                    : "card-warm border-walnut/15 text-walnut-dark",
                )}
              >
                {needCount[item.id] ? (
                  <span
                    className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-copper px-1.5 font-ui text-[11px] font-extrabold text-ivory shadow-soft"
                    aria-label={`${needCount[item.id]} needed`}
                  >
                    {needCount[item.id]}
                  </span>
                ) : soonCount[item.id] ? (
                  <span
                    className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1.5 font-ui text-[11px] font-extrabold text-walnut-dark shadow-soft"
                    aria-label={`${soonCount[item.id]} important`}
                    data-needs-soon={soonCount[item.id]}
                  >
                    {soonCount[item.id]}
                  </span>
                ) : null}
                <span className="text-[20px] leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <span className="font-ui text-[12px] font-extrabold leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 pt-5">
          <SectionTitle sub={categoryCopy[category].description}>
            {categoryCopy[category].title}
          </SectionTitle>

          {category === "ingredients" ? (
            <MarketIngredients
              save={save}
              purchaseIngredient={purchaseIngredient}
              {...(purchaseIngredients ? { purchaseIngredients } : {})}
              focusId={focusId}
              focusQuantity={focusQuantity}
              focusPlan={planFocus}
              planLevelId={planLevelId}
              setNotice={setNotice}
              {...(RESTAURANT_MODE ? { onChangeSupplier: () => go("business-suppliers") } : {})}
            />
          ) : isSupplySection(category) ? (
            <MarketSupplies
              key={category}
              save={save}
              section={category}
              focusId={supplyFocusId}
              focusPacks={supplyFocusPacks}
              planLevelId={planLevelId}
              purchaseSupply={purchaseSupply}
              setNotice={setNotice}
            />
          ) : category === "second-floor" && secondFloorAction ? (
            <MarketSecondFloor
              save={save}
              onAction={secondFloorAction}
              setNotice={setNotice}
              go={go}
            />
          ) : category === "blacksmith" ? (
            <Blacksmith
              save={save}
              setNotice={setNotice}
              sharpenKnife={sharpenKnife}
              upgradeKnife={upgradeKnife}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 max-[359px]:grid-cols-1 land:grid-cols-3">
              {cards.map((card) => (
                <ProductCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pt-5">
          <LedgerSummary save={save} />
        </div>
      </div>
      <BottomNav active="shop" go={go} />
    </div>
  );
}

function KnifeVisual({ knife }: { knife: KnifeDefinition }) {
  return (
    <div className="rotate-[-8deg]">
      <KnifeGlyph knife={knife} size={104} />
    </div>
  );
}

function EmojiVisual({ emoji }: { emoji: string }) {
  return <span aria-hidden>{emoji}</span>;
}

function ProductCard({ card }: { card: Card }) {
  const { action } = card;
  const owned = action.kind === "equipped" || action.kind === "owned";
  return (
    <ShopCard
      title={card.name}
      ring={owned ? "owned" : null}
      art={
        <ShopItemArt
          icon={card.visual}
          className={cn(card.locked && "opacity-55 grayscale-[0.35]")}
        >
          <InfoTip label={`About ${card.name}`}>{card.description}</InfoTip>
        </ShopItemArt>
      }
    >
      {/^\$/.test(card.price) ? (
        <PricePill price={card.price} />
      ) : (
        <ShopLine className="font-display text-[15px] font-black">{card.price}</ShopLine>
      )}
      <div className="mt-2 space-y-1 rounded-[12px] border border-walnut/10 bg-ivory/60 px-2 py-1.5">
        {card.stats.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 font-ui text-[11px]">
            <span className="text-walnut/60">{label}</span>
            <span className="text-right font-extrabold capitalize text-walnut-dark">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-2">
        {action.kind === "equipped" ? (
          <BuyButton tone="done" disabled>
            ✓ {action.label ?? "Equipped"}
          </BuyButton>
        ) : action.kind === "owned" ? (
          <BuyButton tone="done" disabled>
            {action.label}
          </BuyButton>
        ) : action.kind === "equip" ? (
          <BuyButton tone="wood" icon={false} onClick={action.onClick}>
            Equip
          </BuyButton>
        ) : action.kind === "locked" ? (
          <div className="flex justify-center">
            <Badge tone="locked">🔒 {action.label.replace("Unlocks at Level", "Lv")}</Badge>
          </div>
        ) : (
          <>
            <BuyButton
              tone={action.disabled ? "short" : "go"}
              onClick={action.onClick}
              disabled={action.disabled ?? false}
            >
              {action.label}
            </BuyButton>
            {action.price ? <ShortfallOffer price={action.price} item={card.name} /> : null}
          </>
        )}
      </div>
    </ShopCard>
  );
}

const forgeCopy: Record<
  BlacksmithStat,
  { name: string; short: string; detail: string; emoji: string }
> = {
  sharpness: {
    name: "Sharpness",
    short: "Faster slices · wider peel",
    detail: "The blade passes through food faster, and peels a slightly wider strip.",
    emoji: "🗡️",
  },
  speed: {
    name: "Speed",
    short: "Next cut ready sooner",
    detail: "The knife lifts and comes back down faster, so the next cut is ready sooner.",
    emoji: "⚡",
  },
  handling: {
    name: "Handling",
    short: "Fast taps never missed",
    detail:
      "Catches rapid taps: a tap made while a cut is finishing is queued instead of missed, and the pause after each cut is shorter.",
    emoji: "🪶",
  },
};

/** The step's real effect, from forgePreview (knifeTiming.ts maths) — "now → next" figures, or the mastered values. */
function previewText(
  stat: BlacksmithStat,
  p: { now: ForgeFigures; next: ForgeFigures | null },
): string {
  const { now, next } = p;
  if (stat === "handling")
    return next
      ? `🎯 ${now.queueMs} → ${next.queueMs} ms tap catch · ⏸ ${now.pauseMs} → ${next.pauseMs} ms`
      : `🎯 ${now.queueMs} ms tap catch · ⏸ ${now.pauseMs} ms`;
  const slice = next ? `⏱ ${now.cycleMs} → ${next.cycleMs} ms/slice` : `⏱ ${now.cycleMs} ms/slice`;
  if (stat === "speed") return slice;
  return next
    ? `${slice} · 🥕 ${now.peelPct}% → ${next.peelPct}% peel`
    : `${slice} · 🥕 ${now.peelPct}% peel`;
}

function Blacksmith({
  save,
  setNotice,
  sharpenKnife,
  upgradeKnife,
}: {
  save: SaveData;
  setNotice: (n: string) => void;
  sharpenKnife: (id: string) => SharpenKnifeResult;
  upgradeKnife: (id: string, stat: BlacksmithStat) => UpgradeKnifeResult;
}) {
  const ownedKnives = KNIFE_CATALOG.filter((k) => save.ownedKnifeIds.includes(k.id));
  const [knifeId, setKnifeId] = useState(save.equippedKnifeId);
  const knife = ownedKnives.find((k) => k.id === knifeId) ?? ownedKnives[0] ?? KNIFE_CATALOG[0]!;
  const levels = getKnifeUpgrades(save, knife.id);
  const condition = getKnifeSharpness(save, knife.id);

  function report(result: UpgradeKnifeResult, stat: BlacksmithStat, cost: number) {
    if (result.ok)
      setNotice(`${forgeCopy[stat].emoji} ${forgeCopy[stat].name} → Level ${result.level}!`);
    else if (result.reason === "insufficientFunds")
      setNotice(notEnoughMoneyText(cost, save.credits));
    else if (result.reason === "maxLevel")
      setNotice(`${forgeCopy[stat].name} is already mastered.`);
    else setNotice("The blacksmith can only work on a knife you own.");
  }

  return (
    <div className="space-y-3">
      <Panel className="flex items-center gap-2 p-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <StatChip icon="♾️">Permanent</StatChip>
          <StatChip icon="🔪">Per knife</StatChip>
          <StatChip icon="⭐">Score unchanged</StatChip>
        </div>
        <InfoTip label="About the Blacksmith">
          Upgrade your knife to cut faster and catch more of your taps. Upgrades are permanent and
          belong to the knife you forge — they change how cutting feels, never your score, grade or
          earnings.
        </InfoTip>
      </Panel>

      {/* The forge — illustration (or the knife) in the same wood hero frame as Rack. */}
      <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood shadow-lift">
        {BLACKSMITH_ART ? (
          <img
            src={BLACKSMITH_ART}
            alt="A cheerful blacksmith forging a chef's knife in the shop's workshop"
            className="block h-[180px] w-full object-cover"
          />
        ) : (
          <div className="grid h-[160px] place-items-center rotate-[-6deg]">
            <KnifeGlyph knife={knife} size={200} />
          </div>
        )}
      </div>

      <Panel tone="cream" className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[19px] font-black leading-tight text-walnut-dark">
              {knife.name}
            </p>
            <p className="font-ui text-[12px] font-bold uppercase tracking-wide text-copper">
              ★ Level {knifeLevel(levels)}
            </p>
          </div>
          <div className="shrink-0 rotate-[-8deg]">
            <KnifeGlyph knife={knife} size={84} />
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <StatChip icon="⏱" title="Time per slice when tapping fast">
            {forgePreview(knife, levels, "speed").now.cycleMs} ms/slice
          </StatChip>
        </div>
        <div className="mt-3 space-y-2">
          {BLACKSMITH_STATS.map((stat) => (
            <div key={stat} className="flex items-center gap-3">
              <span className="w-[82px] shrink-0 font-ui text-[12px] font-bold text-walnut/80">
                {forgeCopy[stat].emoji} {forgeCopy[stat].name}
              </span>
              <span className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-walnut/15">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--color-gold),var(--color-copper))]"
                  style={{ width: `${(levels[stat] / MAX_UPGRADE_LEVEL) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right font-ui text-[12px] font-bold text-walnut/60">
                {levels[stat]}/{MAX_UPGRADE_LEVEL}
              </span>
            </div>
          ))}
        </div>
        {ownedKnives.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Choose a knife to forge">
            {ownedKnives.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKnifeId(k.id)}
                className={cn(
                  "press rounded-full border px-2.5 py-[3px] font-ui text-[12px] font-bold",
                  k.id === knife.id
                    ? "wood border-walnut-dark/50 text-ivory"
                    : "border-walnut/15 bg-cream/70 text-walnut-dark",
                )}
              >
                {k.name}
              </button>
            ))}
          </div>
        ) : null}
        <Divider />
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 font-ui text-[12.5px] font-bold text-walnut/75">
            <span>
              🔪 Edge {condition}/100 · {sharpnessLabel(condition)}
            </span>
            <InfoTip label="About the knife's edge">
              Wears with use; a dull edge wastes a little more of each ingredient. Sharpening
              restores it — upgrades never wear off.
            </InfoTip>
          </p>
          <KButton
            size="sm"
            variant="ghost"
            className="shrink-0 whitespace-nowrap"
            disabled={condition >= 100 || save.credits < SHARPEN_COST}
            onClick={() => {
              const r = sharpenKnife(knife.id);
              setNotice(
                r.ok
                  ? `${knife.name} is freshly sharpened.`
                  : notEnoughMoneyText(SHARPEN_COST, save.credits),
              );
            }}
          >
            Sharpen · {formatUsd(SHARPEN_COST)}
          </KButton>
        </div>
      </Panel>

      <div className="forge-grid space-y-3 land:grid land:grid-cols-3 land:gap-3 land:space-y-0">
        {BLACKSMITH_STATS.map((stat) => {
          const { name, short, detail, emoji } = forgeCopy[stat];
          const level = levels[stat];
          const cost = upgradeCost(level);
          const maxed = cost === null;
          return (
            <ShopCard
              key={stat}
              data-forge={stat}
              title={
                <>
                  <span aria-hidden>{emoji}</span> {name}
                </>
              }
            >
              <div className="flex justify-center">
                <Badge tone={maxed ? "sage" : "copper"}>
                  {maxed ? `Level ${level} · Mastered` : `Level ${level} → ${level + 1}`}
                </Badge>
              </div>
              <ShopLine hand>
                <span>{short}</span>
                <InfoTip label={`About ${name}`}>{detail}</InfoTip>
              </ShopLine>
              <p className="mt-2 rounded-[12px] border border-walnut/10 bg-ivory/60 px-3 py-1.5 text-center font-ui text-[12px] font-bold text-walnut-dark">
                {previewText(stat, forgePreview(knife, levels, stat))}
              </p>
              <div className="mt-3 space-y-2">
                {maxed ? (
                  <BuyButton tone="done" disabled>
                    ✓ Mastered
                  </BuyButton>
                ) : (
                  <BuyButton
                    tone={save.credits < (cost ?? Infinity) ? "short" : "go"}
                    icon={false}
                    disabled={save.credits < (cost ?? Infinity)}
                    onClick={() => report(upgradeKnife(knife.id, stat), stat, cost ?? 0)}
                  >
                    ⚒️ Upgrade · {formatUsd(cost ?? 0)}
                  </BuyButton>
                )}
                {!maxed && save.credits < (cost ?? 0) && (
                  <>
                    <p className="text-center font-hand text-[14px] text-walnut/65">
                      {notEnoughMoneyText(cost ?? 0, save.credits)}
                    </p>
                    <ShortfallOffer price={cost ?? 0} item={name} />
                  </>
                )}
              </div>
            </ShopCard>
          );
        })}
      </div>
    </div>
  );
}

/** Economy V2 Phase 9's ledger summary — derived purely from save.economyLedger. */
function LedgerSummary({ save }: { save: SaveData }) {
  const totals = ledgerTotals(save.economyLedger);
  const recent = save.economyLedger.slice(-8).reverse();
  return (
    <Panel className="p-4">
      <details className="ledger-summary">
        <summary className="cursor-pointer list-none">
          <Eyebrow>Economy summary ▾</Eyebrow>
        </summary>
        <div className="mt-2 space-y-1.5 font-ui text-[12.5px] font-bold text-walnut/80">
          <div className="flex justify-between">
            <span>Total income</span>
            <span className="text-olive">{formatUsdChange(totals.totalIncome)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total expenses</span>
            <span className="text-copper">{formatUsd(-totals.totalExpense)}</span>
          </div>
          <div className="flex justify-between text-walnut-dark">
            <span>Net cash flow</span>
            <span>{formatUsdChange(totals.netCashFlow)}</span>
          </div>
          {recent.length ? <Divider /> : null}
          {recent.map((entry) => (
            <div className="flex justify-between gap-3" key={entry.id}>
              <span className="min-w-0 truncate">
                {LEDGER_CATEGORY_LABEL[entry.category]}
                {entry.description ? ` · ${entry.description}` : ""}
              </span>
              <span className={cn("shrink-0", entry.amount < 0 ? "text-copper" : "text-olive")}>
                {formatUsdChange(entry.amount)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </Panel>
  );
}
