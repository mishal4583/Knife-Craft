import { useState, type ReactNode } from "react";
import type { ScreenId } from "./data";
import { BottomNav } from "./Kitchen";
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
import { STAFF_CATALOG } from "@/game/economy/staffDefinitions";
import { getStaffPurchaseState, type BuyStaffResult } from "@/game/economy/StaffManager";
import { SUPPLIER_CATALOG } from "@/game/economy/supplierDefinitions";
import { getSelectedSupplierId } from "@/game/economy/SupplierManager";
import { getSupplierModifier } from "@/game/economy/supplier";
import { ingredientBaselineCost } from "@/game/economy/ingredientCostRegistry";
import { dollars, formatUsd, formatUsdChange } from "@/game/money";
import { ledgerTotals, LEDGER_CATEGORY_LABEL } from "@/game/economy/EconomyLedger";
import {
  getKnifeSharpness,
  sharpnessLabel,
  SHARPEN_COST,
  type SharpenKnifeResult,
} from "@/game/economy/sharpness";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
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
 * actions the Rack uses (buyKnife/buyBoard/buyStaff/selectSupplier,
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

type ShopCategory = "knives" | "boards" | "staff" | "suppliers" | "ingredients" | "blacksmith";

const categories: Array<{ id: ShopCategory; label: string; emoji: string }> = [
  { id: "knives", label: "Knives", emoji: "🔪" },
  { id: "boards", label: "Cutting Boards", emoji: "🪵" },
  { id: "staff", label: "Staff", emoji: "🧑‍🍳" },
  { id: "suppliers", label: "Suppliers", emoji: "🚚" },
  { id: "ingredients", label: "Ingredients", emoji: "🧺" },
  { id: "blacksmith", label: "Blacksmith", emoji: "⚒️" },
];

const categoryCopy: Record<ShopCategory, { title: string; description: string }> = {
  knives: {
    title: "Knives",
    description: "Choose the perfect blade for speed, precision, and dependable prep.",
  },
  boards: {
    title: "Cutting Boards",
    description: "A reliable surface makes every chop cleaner and every service smoother.",
  },
  staff: { title: "Staff", description: "Hire talented people to help across every recipe." },
  suppliers: {
    title: "Suppliers",
    description: "Choose who stocks your kitchen — cheaper in bulk, or carefully sourced.",
  },
  ingredients: {
    title: "Fresh Ingredients",
    description: "What your supplier charges for each ingredient you cook with.",
  },
  blacksmith: { title: "Blacksmith", description: "Forge your knife. Cut faster. Cut better." },
};

const NOT_ENOUGH = "Not quite enough money yet.";

type CardAction =
  | { kind: "buy"; label: string; onClick: () => void; disabled?: boolean }
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
    <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
      {children}
    </p>
  );
}

export function Shop({
  go,
  save,
  buyKnife,
  buyBoard,
  buyStaff,
  selectSupplier,
  equipKnife,
  equipBoard,
  sharpenKnife,
  upgradeKnife,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  buyKnife: (id: string) => BuyKnifeResult;
  buyBoard: (id: string) => BuyBoardResult;
  buyStaff: (id: string) => BuyStaffResult;
  selectSupplier: (id: string) => void;
  equipKnife: (id: string) => void;
  equipBoard: (id: string) => void;
  sharpenKnife: (id: string) => SharpenKnifeResult;
  upgradeKnife: (id: string, stat: BlacksmithStat) => UpgradeKnifeResult;
}) {
  const [category, setCategory] = useState<ShopCategory>("knives");
  const [notice, setNotice] = useState("Welcome back, Chef. What can I get for you?");

  function selectCategory(next: ShopCategory) {
    setCategory(next);
    setNotice(categoryCopy[next].description);
  }

  function purchaseMessage(
    result: { ok: boolean; reason?: string },
    name: string,
    unlockLevel?: number,
  ) {
    if (result.ok) return setNotice(`${name} purchased!`);
    if (result.reason === "insufficientFunds") return setNotice(NOT_ENOUGH);
    if (result.reason === "notUnlocked" && unlockLevel)
      return setNotice(`${name} unlocks at Level ${unlockLevel}.`);
    setNotice(`${name} couldn't be bought right now.`);
  }

  const cards = cardsFor(category);

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
                      onClick: () => purchaseMessage(buyKnife(k.id), k.name, k.unlockLevel),
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
                      onClick: () => purchaseMessage(buyBoard(b.id), b.name, b.unlockLevel),
                    },
        };
      });
    }
    if (c === "staff") {
      return STAFF_CATALOG.map((st) => {
        const state = getStaffPurchaseState(save, st.id);
        return {
          id: st.id,
          name: st.name,
          description: st.description,
          visual: <EmojiVisual emoji={st.id === "quality-chef" ? "👨‍🍳" : "🧑‍🍳"} />,
          stats: [["Works on", "Every recipe"]],
          price: formatUsd(st.price),
          locked: state === "locked",
          action:
            state === "owned"
              ? { kind: "owned", label: "Hired" }
              : state === "locked"
                ? { kind: "locked", label: `Unlocks at Level ${st.unlockLevel}` }
                : {
                    kind: "buy",
                    label: "Hire",
                    onClick: () => purchaseMessage(buyStaff(st.id), st.name, st.unlockLevel),
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
          subtitle="tools, staff & suppliers"
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
                className="block h-[168px] w-full object-cover object-top"
              />
            ) : (
              <div className="grid h-[140px] place-items-center">
                <KnifeGlyph knife={KNIFE_CATALOG[0]!} size={180} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(46,28,16,0.82))] px-4 pb-2.5 pt-8">
              <p className="font-hand text-[17px] leading-tight text-ivory" aria-live="polite">
                ✦ {notice}
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <nav
          className="category-tabs grid grid-cols-3 gap-2 px-4 pt-3"
          aria-label="Shop categories"
        >
          {categories.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => selectCategory(item.id)}
                className={cn(
                  "press flex h-[64px] flex-col items-center justify-center gap-0.5 rounded-[18px] border px-1",
                  active
                    ? "wood border-walnut-dark/50 text-ivory shadow-soft"
                    : "card-warm border-walnut/15 text-walnut-dark",
                )}
              >
                <span className="text-[20px] leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <span className="font-ui text-[11px] font-extrabold leading-tight">
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
            <IngredientPrices save={save} go={go} />
          ) : category === "blacksmith" ? (
            <Blacksmith
              save={save}
              setNotice={setNotice}
              sharpenKnife={sharpenKnife}
              upgradeKnife={upgradeKnife}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
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
  return (
    <span className="text-[46px] leading-none" aria-hidden>
      {emoji}
    </span>
  );
}

function ProductCard({ card }: { card: Card }) {
  const { action } = card;
  return (
    <article className="product-card flex flex-col rounded-[20px] border border-walnut/15 p-3 card-warm">
      <div
        className={cn(
          "grid h-[92px] place-items-center",
          card.locked && "opacity-55 grayscale-[0.35]",
        )}
      >
        {card.visual}
      </div>
      <p className="mt-1 text-center font-display text-[14px] font-black leading-tight text-walnut-dark">
        {card.name}
      </p>
      <p className="mt-0.5 line-clamp-3 text-center font-hand text-[14px] leading-tight text-walnut/70">
        {card.description}
      </p>
      <div className="mt-2 space-y-1 rounded-[12px] bg-cream/70 px-2 py-1.5">
        {card.stats.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 font-ui text-[10px]">
            <span className="text-walnut/60">{label}</span>
            <span className="text-right font-extrabold capitalize text-walnut-dark">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-2">
        <p className="mb-1.5 text-center font-ui text-[13px] font-extrabold text-walnut-dark">
          {card.price}
        </p>
        {action.kind === "equipped" ? (
          <KButton full size="sm" variant="sage" disabled>
            {action.label ?? "Equipped"}
          </KButton>
        ) : action.kind === "owned" ? (
          <KButton full size="sm" variant="sage" disabled>
            {action.label}
          </KButton>
        ) : action.kind === "equip" ? (
          <KButton full size="sm" variant="cream" onClick={action.onClick}>
            Equip
          </KButton>
        ) : action.kind === "locked" ? (
          <div className="flex justify-center">
            <Badge tone="locked">🔒 {action.label.replace("Unlocks at Level", "Lv")}</Badge>
          </div>
        ) : (
          <KButton full size="sm" onClick={action.onClick} disabled={action.disabled ?? false}>
            {action.label}
          </KButton>
        )}
      </div>
    </article>
  );
}

/**
 * Campaign has no ingredient purchasing: each recipe's ingredients are paid
 * automatically at settlement (EconomySettlement — baseline cost, scaled by
 * chapter, adjusted by the chosen supplier). This tab shows those real
 * baseline prices; stock you BUY and keep lives in Business Mode's pantry.
 */
function IngredientPrices({ save, go }: { save: SaveData; go: (s: ScreenId) => void }) {
  const supplierId = getSelectedSupplierId(save);
  const modifier = getSupplierModifier(supplierId);
  const supplier = SUPPLIER_CATALOG.find((s) => s.id === supplierId);
  const ids = Object.keys(INGREDIENTS) as IngredientId[];
  return (
    <Panel className="p-4">
      <p className="font-hand text-[15px] leading-snug text-walnut/75">
        In the kitchen, ingredients are paid for automatically as you cook each recipe. These are{" "}
        <strong className="text-walnut-dark">{supplier?.name ?? "your supplier"}</strong>'s base
        prices per ingredient
        {modifier === 0
          ? ""
          : ` (${modifier > 0 ? "+" : ""}${Math.round(modifier * 100)}% vs standard)`}
        ; later chapters scale them up. Stocking a restaurant pantry happens in Business Mode.
      </p>
      <Divider />
      <div>
        {ids.map((id) => {
          const def = INGREDIENTS[id];
          const cost = dollars(ingredientBaselineCost(id) * (1 + modifier));
          return (
            <div
              className="ingredient-card flex items-center gap-3 border-b border-walnut/10 py-2 last:border-b-0"
              key={id}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream/80 text-[20px]">
                {INGREDIENT_EMOJI[id] ?? "🥕"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-ui text-[13px] font-extrabold text-walnut-dark">
                  {def.name}
                </span>
                <span className="block font-hand text-[13px] capitalize text-walnut/60">
                  {def.category}
                </span>
              </span>
              <span className="font-ui text-[13px] font-extrabold text-walnut-dark">
                {formatUsd(cost)}
              </span>
            </div>
          );
        })}
      </div>
      <KButton full variant="ghost" className="mt-3" onClick={() => go("business-inventory")}>
        🧺 Stock the restaurant pantry (Business Mode)
      </KButton>
    </Panel>
  );
}

const forgeCopy: Record<BlacksmithStat, { name: string; detail: string; emoji: string }> = {
  sharpness: {
    name: "Sharpness",
    detail: "The blade passes through food faster, and peels a slightly wider strip.",
    emoji: "🗡️",
  },
  speed: {
    name: "Speed",
    detail: "The knife lifts and comes back down faster, so the next cut is ready sooner.",
    emoji: "⚡",
  },
  handling: {
    name: "Handling",
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
      ? `Catches taps ${now.queueMs} → ${next.queueMs} ms before a cut ends · pause ${now.pauseMs} → ${next.pauseMs} ms`
      : `Catches taps ${now.queueMs} ms before a cut ends · pause ${now.pauseMs} ms`;
  const slice = next
    ? `Slices every ${now.cycleMs} → ${next.cycleMs} ms`
    : `Slices every ${now.cycleMs} ms`;
  if (stat === "speed") return `${slice} when tapping fast`;
  return next
    ? `${slice} · peel strip ${now.peelPct}% → ${next.peelPct}%`
    : `${slice} · peel strip ${now.peelPct}%`;
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

  function report(result: UpgradeKnifeResult, stat: BlacksmithStat) {
    if (result.ok)
      setNotice(
        `${forgeCopy[stat].name} forged to level ${result.level}! Your ${knife.name} feels it on the board.`,
      );
    else if (result.reason === "insufficientFunds") setNotice(NOT_ENOUGH);
    else if (result.reason === "maxLevel")
      setNotice(`${forgeCopy[stat].name} is already mastered.`);
    else setNotice("The blacksmith can only work on a knife you own.");
  }

  return (
    <div className="space-y-3">
      <Panel className="p-4">
        <p className="font-ui text-[12px] leading-snug text-walnut/80">
          Upgrade your knife to cut faster and catch more of your taps.{" "}
          <strong className="text-walnut-dark">
            Upgrades are permanent and belong to the knife you forge
          </strong>{" "}
          — they change how cutting feels, never your score, grade or earnings.
        </p>
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
            <p className="font-ui text-[11px] font-bold uppercase tracking-wide text-copper">
              ★ Level {knifeLevel(levels)}
            </p>
          </div>
          <div className="shrink-0 rotate-[-8deg]">
            <KnifeGlyph knife={knife} size={84} />
          </div>
        </div>
        <p className="mt-1 font-hand text-[14px] leading-tight text-walnut/70">
          Slices every {forgePreview(knife, levels, "speed").now.cycleMs} ms when tapping fast ·
          each knife keeps its own upgrades
        </p>
        <div className="mt-3 space-y-2">
          {BLACKSMITH_STATS.map((stat) => (
            <div key={stat} className="flex items-center gap-3">
              <span className="w-[82px] shrink-0 font-ui text-[11px] font-bold text-walnut/80">
                {forgeCopy[stat].emoji} {forgeCopy[stat].name}
              </span>
              <span className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-walnut/15">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--color-gold),var(--color-copper))]"
                  style={{ width: `${(levels[stat] / MAX_UPGRADE_LEVEL) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right font-ui text-[11px] font-bold text-walnut/60">
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
                  "press rounded-full border px-2.5 py-[3px] font-ui text-[11px] font-bold",
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
          <p className="font-ui text-[11px] font-bold text-walnut/70">
            Edge condition {condition}/100 · {sharpnessLabel(condition)}
            <span className="mt-0.5 block font-hand text-[13px] font-normal leading-tight text-walnut/60">
              Wears with use; a dull edge wastes a little more of each ingredient. Sharpening
              restores it — upgrades never wear off.
            </span>
          </p>
          <KButton
            size="sm"
            variant="ghost"
            className="shrink-0 whitespace-nowrap"
            disabled={condition >= 100 || save.credits < SHARPEN_COST}
            onClick={() => {
              const r = sharpenKnife(knife.id);
              setNotice(r.ok ? `${knife.name} is freshly sharpened.` : NOT_ENOUGH);
            }}
          >
            Sharpen · {formatUsd(SHARPEN_COST)}
          </KButton>
        </div>
      </Panel>

      <div className="forge-grid space-y-3">
        {BLACKSMITH_STATS.map((stat) => {
          const { name, detail, emoji } = forgeCopy[stat];
          const level = levels[stat];
          const cost = upgradeCost(level);
          const maxed = cost === null;
          return (
            <Panel key={stat} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-[17px] font-black leading-tight text-walnut-dark">
                  <span aria-hidden>{emoji}</span> {name}
                </p>
                <Badge tone={maxed ? "sage" : "copper"}>
                  {maxed ? `Level ${level} · Mastered` : `Level ${level} → ${level + 1}`}
                </Badge>
              </div>
              <p className="mt-1 font-hand text-[14px] leading-tight text-walnut/70">{detail}</p>
              <p className="mt-2 rounded-[12px] bg-cream/70 px-3 py-1.5 font-ui text-[11px] font-bold text-walnut-dark">
                {previewText(stat, forgePreview(knife, levels, stat))}
              </p>
              <div className="mt-3 space-y-2">
                <KButton
                  full
                  size="sm"
                  disabled={maxed || save.credits < (cost ?? Infinity)}
                  onClick={() => report(upgradeKnife(knife.id, stat), stat)}
                >
                  {maxed ? "Mastered" : `Upgrade · ${formatUsd(cost ?? 0)}`}
                </KButton>
              </div>
            </Panel>
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
        <div className="mt-2 space-y-1.5 font-ui text-[12px] font-bold text-walnut/80">
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
