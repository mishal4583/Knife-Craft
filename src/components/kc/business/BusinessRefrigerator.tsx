import { useState, type CSSProperties, type ReactNode } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { REFRIGERATOR_CATALOG, getRefrigerator } from "@/game/business/refrigeratorDefinitions";
import {
  getInventoryUsedCapacity,
  getAvailableStorageCapacity,
} from "@/game/business/RefrigeratorManager";
import type { PurchaseRefrigeratorResult } from "@/game/business/RefrigeratorManager";
import {
  conditionBandFor,
  DECAY_DIVISOR,
  type ConditionBand,
} from "@/game/business/businessEquipmentCondition";
import { FridgeMini } from "../inventory/fridge/PhysicalFridge";
import {
  maintenanceStatusFor,
  maintenanceCostFor,
  type PerformMaintenanceResult,
} from "@/game/business/businessMaintenance";
import { hasBusinessArt } from "@/game/businessArt";
import { Art, GlossBar, PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";
import { GoldButton } from "./BizKit";

/** The status badge of the fridge's condition: a laurel badge, green when good. */
const CONDITION_TONE: Record<ConditionBand, "green" | "gold" | "red"> = {
  GOOD: "green",
  WORN: "gold",
  POOR: "red",
  CRITICAL: "red",
  BROKEN: "red",
};

/** Catalog position of a model: 0 Basic, 1 Commercial, 2 Professional (its drawing). */
function rankOf(id: string): number {
  return Math.max(
    0,
    REFRIGERATOR_CATALOG.findIndex((r) => r.id === id),
  );
}

/** The painted fridge of a model (`RB-fridges`), or the old drawing until the picture exists. */
function Fridge({ id, className = "" }: { id: string; className?: string }) {
  const rank = rankOf(id);
  const key = ["basic", "commercial", "professional"][Math.min(2, rank)];
  return (
    <Art
      name={`biz:fridges/${key}`}
      className={className}
      fallback={<FridgeMini rank={rank} className="kcf-mini--lg" />}
    />
  );
}

/**
 * BUSINESS · EQUIPMENT tab (Economy V3 Phase 3 refrigerator + Phase 10/11
 * condition and maintenance). Capacity only through RefrigeratorManager,
 * condition bands/costs only through businessEquipmentCondition /
 * businessMaintenance — never recomputed here.
 *
 * Painted (developer 2026-11-25, Business UI design pictures 02 and 03): the banner, "Your refrigerator", the three refrigerator cards and the
 * knives card, on the Restaurant Progress kit. Behaviour and numbers are unchanged.
 */
/** A stock amount for display: whole, or one decimal ("91.9"), never "91.882". */
const shortUnits = (n: number) =>
  Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");

export function BusinessRefrigerator({
  go,
  save,
  purchaseRefrigerator,
  performRefrigeratorMaintenance,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  purchaseRefrigerator: (refrigeratorId: string) => PurchaseRefrigeratorResult;
  performRefrigeratorMaintenance: () => PerformMaintenanceResult;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const current = getRefrigerator(save.business.refrigerator.refrigeratorId);
  const used = getInventoryUsedCapacity(save.business.inventory);
  const available = getAvailableStorageCapacity(
    save.business.inventory,
    save.business.refrigerator.refrigeratorId,
  );
  const capacity = current?.capacity ?? 0;
  const condition = save.business.equipmentCondition.refrigeratorCondition;
  const conditionBand = conditionBandFor(condition);
  const maintenanceStatus = maintenanceStatusFor(condition);
  const maintenanceCost = maintenanceCostFor(condition);
  const sceneReady = hasBusinessArt("banners/equipment-scene");

  function handleMaintenance() {
    const result = performRefrigeratorMaintenance();
    if (!result.ok) {
      setMessage(
        result.reason === "insufficientFunds"
          ? "Not quite enough cash for that repair."
          : "The refrigerator doesn't need repair right now.",
      );
      return;
    }
    setMessage(`Repaired for ${formatUsd(result.cost)} — condition restored to 100.`);
  }

  function handleUpgrade(id: string) {
    const result = purchaseRefrigerator(id);
    if (!result.ok) {
      setMessage(
        result.reason === "insufficientFunds"
          ? "Not quite enough cash for that refrigerator."
          : result.reason === "invalidDowngrade"
            ? "That refrigerator can't hold what's already in storage."
            : result.reason === "alreadyOwned"
              ? "That's already your current refrigerator."
              : "That upgrade couldn't be made.",
      );
      return;
    }
    setMessage(
      `Upgraded to ${getRefrigerator(result.refrigeratorId)?.name} for ${formatUsd(result.price)}.`,
    );
  }

  return (
    <div className="space-y-5">
      {/* The banner: the painted scene with its own blank plaque (the words are written on it), or the old photo until the picture exists. */}
      {sceneReady ? (
        <section
          className="kc-banner relative isolate mx-auto aspect-[3/1] w-full max-w-[640px]"
          aria-label="Commercial kitchen equipment"
          style={{ "--kc-ratio": 3, "--kc-short-h": "56px" } as CSSProperties}
        >
          <Art
            name="biz:banners/equipment-scene"
            className="absolute inset-0 h-full w-full object-contain"
          />
          <h2 className="absolute left-[6.5%] top-[40%] flex h-[30%] w-[36%] items-center justify-center text-center font-display text-[13px] font-black leading-none text-[#fff1cf] drop-shadow-[0_1px_1px_rgba(40,20,5,0.8)] sm:text-[19px]">
            Kitchen equipment
          </h2>
        </section>
      ) : (
        <section
          className="kc-banner relative isolate h-[88px] overflow-hidden rounded-[20px] border border-walnut/20 bg-walnut-dark shadow-soft sm:h-[96px]"
          aria-label="Commercial kitchen equipment"
          style={{ "--kc-ratio": 2.5, "--kc-short-h": "56px" } as CSSProperties}
        >
          <img
            src={`${import.meta.env.BASE_URL}business/equipment-banner.webp`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full select-none object-cover object-[center_52%]"
            draggable={false}
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-walnut-dark/65 via-walnut-dark/20 to-transparent"
            aria-hidden="true"
          />
          <div className="relative flex h-full items-center px-3.5 sm:px-4">
            <h2 className="rounded-[14px] border border-ivory/25 bg-walnut-dark/35 px-3 py-2 font-display text-[16px] font-black text-ivory shadow-soft backdrop-blur-sm sm:text-[18px]">
              Kitchen equipment
            </h2>
          </div>
        </section>
      )}

      {/* Your fridge */}
      <ProgressCard
        title="Your refrigerator"
        icon={<PIcon name="biz:icons-a/fridge-icon" fallback="❄️" size={26} />}
        right={
          <ValuePill tone={CONDITION_TONE[conditionBand]} className="min-h-8 px-3 text-[13px]">
            <PIcon name="biz:icons-a/thumbs-up" fallback="👍" size={20} />
            {conditionBand}
          </ValuePill>
        }
        className="pt-10"
        data-testid="your-refrigerator"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-[84px] w-16 shrink-0 place-items-center">
            <Fridge id={current?.id ?? ""} className="max-h-[84px] w-full" />
          </span>
          <p className="flex min-w-0 items-center gap-2 font-display text-[21px] font-black leading-tight text-walnut-dark">
            {current?.name ?? "Refrigerator"}
            {current ? (
              <InfoTip label={`About the ${current.name}`}>{current.description}</InfoTip>
            ) : null}
          </p>
        </div>

        <div className="mt-3 space-y-2">
          <MeterRow
            icon={<PIcon name="icons-b/box" fallback="📦" size={30} />}
            label="Space"
            fraction={capacity > 0 ? used / capacity : 0}
            tone="green"
            value={`${shortUnits(used)} / ${capacity}`}
            pill={`${shortUnits(available)} free`}
          />
          <MeterRow
            icon={<PIcon name="biz:icons-a/wrench" fallback="🔧" size={30} />}
            label="Condition"
            fraction={condition / 100}
            tone="gold"
            value={`${condition} / 100`}
          />
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-walnut/20 pt-3 font-hand text-[15px] leading-snug text-walnut/65">
          <PIcon name="biz:icons-a/wrench" fallback="🔧" size={24} />
          &lt;60: {formatUsd(maintenanceCostFor(59) ?? 0)}
          <PIcon name="biz:icons-a/burst" fallback="💥" size={24} />
          &lt;20: {formatUsd(maintenanceCostFor(0) ?? 0)}
          <InfoTip label="How the fridge wears">
            Buying stock wears it (1 point per {DECAY_DIVISOR} units). Below 60 it needs service (
            {formatUsd(maintenanceCostFor(59) ?? 0)}); below 20 it breaks (
            {formatUsd(maintenanceCostFor(0) ?? 0)} repair). A worn fridge costs popularity, raises
            spoilage and fails inspections.
          </InfoTip>
        </p>
        {maintenanceStatus !== "OPERATIONAL" ? (
          <KButton full variant="copper" className="mt-3" onClick={handleMaintenance}>
            {maintenanceStatus === "BROKEN" ? "Repair" : "Service"} ·{" "}
            {maintenanceCost !== null ? formatUsd(maintenanceCost) : ""}
          </KButton>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 font-display text-[16px] font-black text-[#2f6b1f]">
            <PIcon name="icons-c/tick" fallback="✓" size={24} />
            Working well
          </p>
        )}
      </ProgressCard>

      {message ? (
        <p className="text-center font-hand text-[16px] text-copper" aria-live="polite">
          {message}
        </p>
      ) : null}

      <ProgressCard
        title="Refrigerators"
        icon={<PIcon name="biz:icons-a/fridge-icon" fallback="❄️" size={26} />}
        className="pt-10"
      >
        <Art
          name="biz:decor-a/fridge-shelf"
          className="pointer-events-none absolute right-3 top-0 hidden h-14 w-auto @min-[720px]:block"
        />
        <div className="grid grid-cols-1 gap-3 @min-[440px]:grid-cols-2 @min-[760px]:grid-cols-3">
          {REFRIGERATOR_CATALOG.map((def) => {
            const isCurrent = def.id === save.business.refrigerator.refrigeratorId;
            const tooSmall = def.capacity < used;
            return (
              <article
                key={def.id}
                className={cn(
                  "relative flex flex-col rounded-[20px] border bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] p-3",
                  isCurrent
                    ? "border-[#e2b24a] shadow-[0_0_0_2px_rgba(248,199,82,0.45)]"
                    : "border-[#ebd2a0]",
                )}
                data-fridge={def.id}
                data-current={isCurrent ? "true" : "false"}
              >
                <span className="absolute right-2 top-2 z-10">
                  <InfoTip label={`About the ${def.name}`}>{def.description}</InfoTip>
                </span>
                <span className="relative grid h-[120px] place-items-center">
                  {isCurrent ? (
                    <Art
                      name="biz:pieces/sunburst"
                      className="pointer-events-none absolute inset-0 m-auto h-full w-auto opacity-90"
                    />
                  ) : null}
                  <Fridge id={def.id} className="relative max-h-[112px] w-auto" />
                </span>
                <p className="mt-1 text-center font-display text-[16px] font-black leading-tight text-walnut-dark">
                  {def.name}
                </p>
                <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                  <ValuePill className="min-h-7 px-2.5 text-[13px]">
                    <PIcon name="icons-b/box" fallback="📦" size={20} />
                    {def.capacity}
                    {!isCurrent && def.capacity > capacity ? (
                      <span className="text-[#2f6b1f]">▲{def.capacity - capacity}</span>
                    ) : null}
                  </ValuePill>
                  <ValuePill className="min-h-7 px-2.5 text-[13px]">
                    <PIcon name="biz:icons-a/volume-wedge" fallback="📐" size={20} />
                    {def.approxCubicFeet} ft³
                  </ValuePill>
                </div>
                <p className="mt-2 text-center font-display text-[17px] font-black text-walnut-dark">
                  {def.price > 0 ? formatUsd(def.price) : "Included"}
                </p>
                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <KButton full variant="green" disabled>
                      ✓ Current
                    </KButton>
                  ) : def.price > 0 ? (
                    <GoldButton
                      disabled={tooSmall}
                      onClick={() => handleUpgrade(def.id)}
                      icon={<PIcon name="icons-a/hammer" fallback="🔨" size={24} />}
                      className="text-[15px]"
                    >
                      Upgrade · {formatUsd(def.price)}
                    </GoldButton>
                  ) : (
                    <KButton
                      full
                      variant="cream"
                      disabled={tooSmall}
                      onClick={() => handleUpgrade(def.id)}
                    >
                      Switch
                    </KButton>
                  )}
                  {!isCurrent && tooSmall ? (
                    <p className="mt-1.5 flex items-center justify-center gap-1 text-center font-ui text-[12px] font-bold text-copper">
                      <PIcon name="icons-b/box" fallback="📦" size={18} />
                      Too small · {shortUnits(used)} stored
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-center font-hand text-[16px] text-walnut/60">
          <span aria-hidden className="h-px w-10 bg-walnut/25" />
          <PIcon name="icons-b/box" fallback="📦" size={22} />
          Your stock moves to the new fridge
          <span aria-hidden className="h-px w-10 bg-walnut/25" />
        </p>
      </ProgressCard>

      {/* Campaign gear lives in the Market — one shop, no second one here. */}
      <ProgressCard
        title="Knives, boards & sharpening"
        icon={<PIcon name="icons-a/knife" fallback="🔪" size={26} />}
        className="pt-10"
      >
        <Art
          name="biz:decor-c/knives-deco"
          className="pointer-events-none absolute right-3 top-1 hidden h-[60px] w-auto @min-[900px]:block"
        />
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-hand text-[16px] leading-snug text-walnut/75">
          <span className="inline-flex items-center gap-1.5">
            <PIcon name="biz:icons-a/cart" fallback="🛒" size={26} /> Shared
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PIcon name="icons-a/storefront" fallback="🏪" size={26} /> Buy in Market
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PIcon name="icons-b/wrench-hammer" fallback="⚒️" size={26} /> Blacksmith sharpens
          </span>
        </p>
        <GoldButton
          className="mt-3 @min-[900px]:max-w-[60%]"
          icon={<PIcon name="icons-a/storefront" fallback="🏪" size={28} />}
          onClick={() => go("shop")}
        >
          Manage in the Market →
        </GoldButton>
      </ProgressCard>
    </div>
  );
}

/** A meter row: icon, label, a glossy bar, the figure and (optionally) a green pill ("45.8 free"). */
function MeterRow({
  icon,
  label,
  fraction,
  tone,
  value,
  pill,
}: {
  icon: ReactNode;
  label: string;
  fraction: number;
  tone: "gold" | "green";
  value: string;
  pill?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[#ebd2a0] bg-white/45 px-3 py-2">
      <span className="flex min-w-[104px] items-center gap-2 font-display text-[16px] font-black text-walnut-dark">
        {icon}
        {label}
      </span>
      <span className="min-w-[120px] flex-1">
        <GlossBar fraction={fraction} tone={tone} height={14} label={label} />
      </span>
      <span className="font-display text-[16px] font-black tabular-nums text-walnut-dark">
        {value}
      </span>
      {pill ? (
        <ValuePill tone="green" className="min-h-7 text-[13px]">
          {pill}
        </ValuePill>
      ) : null}
    </div>
  );
}
