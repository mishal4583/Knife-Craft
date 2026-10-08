import { useState } from "react";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { RestaurantDevelopmentCard } from "../restaurant/RestaurantDevelopmentCard";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { Bar, Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { REFRIGERATOR_CATALOG, getRefrigerator } from "@/game/business/refrigeratorDefinitions";
import {
  getInventoryUsedCapacity,
  getAvailableStorageCapacity,
} from "@/game/business/RefrigeratorManager";
import type { PurchaseRefrigeratorResult } from "@/game/business/RefrigeratorManager";
import { formatQuantity } from "@/game/business/businessInventory";
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

const CONDITION_BADGE_TONE: Record<ConditionBand, "cream" | "sage" | "copper" | "locked"> = {
  GOOD: "sage",
  WORN: "cream",
  POOR: "copper",
  CRITICAL: "copper",
  BROKEN: "locked",
};

/** Catalog position of a model: 0 Basic, 1 Commercial, 2 Professional (its drawing). */
function rankOf(id: string): number {
  return Math.max(
    0,
    REFRIGERATOR_CATALOG.findIndex((r) => r.id === id),
  );
}

/**
 * BUSINESS · EQUIPMENT tab (Economy V3 Phase 3 refrigerator + Phase 10/11
 * condition and maintenance). Capacity only through RefrigeratorManager,
 * condition bands/costs only through businessEquipmentCondition /
 * businessMaintenance — never recomputed here.
 */
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
    <div className="space-y-3">
      {RESTAURANT_MODE ? <RestaurantDevelopmentCard save={save} go={go} /> : null}
      {/* Your fridge */}
      <Panel tone="cream" className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow>Your refrigerator</Eyebrow>
            <p className="flex items-center gap-3 font-display text-[18px] font-black leading-tight text-walnut-dark">
              <FridgeMini rank={rankOf(current?.id ?? "")} />
              {current?.name ?? "Refrigerator"}
            </p>
            {current ? (
              <p className="mt-0.5 font-hand text-[16px] leading-tight text-walnut/65">
                {current.description}
              </p>
            ) : null}
          </div>
          <Badge tone={CONDITION_BADGE_TONE[conditionBand]}>{conditionBand}</Badge>
        </div>

        <div className="mt-3 flex items-baseline justify-between font-ui text-[13.5px] font-bold text-walnut/75">
          <span>Space used</span>
          <span className="font-extrabold text-walnut-dark">
            {formatQuantity(used)} / {capacity}
          </span>
        </div>
        <div className="mt-1">
          <Bar fraction={capacity > 0 ? used / capacity : 0} tone="sage" />
        </div>
        <p className="mt-1 font-hand text-[15px] text-walnut/60">
          {formatQuantity(available)} free
        </p>

        <div className="mt-3 flex items-baseline justify-between font-ui text-[13.5px] font-bold text-walnut/75">
          <span>Condition</span>
          <span className="font-extrabold text-walnut-dark">{condition} / 100</span>
        </div>
        <div className="mt-1">
          <Bar fraction={condition / 100} />
        </div>
        <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/60">
          Buying stock wears it (1 point per {DECAY_DIVISOR} units). Below 60 it needs service (
          {formatUsd(maintenanceCostFor(59) ?? 0)}); below 20 it breaks (
          {formatUsd(maintenanceCostFor(0) ?? 0)} repair). A worn fridge costs popularity, raises
          spoilage and fails inspections.
        </p>
        {maintenanceStatus !== "OPERATIONAL" ? (
          <KButton full variant="copper" className="mt-3" onClick={handleMaintenance}>
            {maintenanceStatus === "BROKEN" ? "Repair" : "Service"} ·{" "}
            {maintenanceCost !== null ? formatUsd(maintenanceCost) : ""}
          </KButton>
        ) : (
          <p className="mt-2 font-ui text-[13.5px] font-extrabold text-olive">✓ Working well</p>
        )}
      </Panel>

      {message ? (
        <p className="text-center font-hand text-[17px] text-copper" aria-live="polite">
          {message}
        </p>
      ) : null}

      <p className="font-display text-[17px] font-black text-walnut-dark">Refrigerators</p>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        {REFRIGERATOR_CATALOG.map((def) => {
          const isCurrent = def.id === save.business.refrigerator.refrigeratorId;
          const tooSmall = def.capacity < used;
          return (
            <article
              key={def.id}
              className={cn(
                "product-card flex flex-col rounded-[20px] border p-3 card-warm",
                isCurrent ? "border-copper/50" : "border-walnut/15",
              )}
            >
              <span className="grid h-[84px] place-items-center">
                <FridgeMini rank={rankOf(def.id)} className="kcf-mini--lg" />
              </span>
              <p className="mt-1 text-center font-display text-[15.5px] font-black leading-tight text-walnut-dark">
                {def.name}
              </p>
              <p className="mt-0.5 text-center font-hand text-[15px] leading-tight text-walnut/65">
                {def.description}
              </p>
              <div className="mt-2 space-y-1 rounded-[12px] bg-cream/70 px-2 py-1.5 font-ui text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-walnut/60">Capacity</span>
                  <span className="font-extrabold text-walnut-dark">
                    {def.capacity} units
                    {!isCurrent && def.capacity > capacity ? (
                      <span className="ml-1 text-olive">▲ +{def.capacity - capacity}</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-walnut/60">Size</span>
                  <span className="font-extrabold text-walnut-dark">
                    ≈{def.approxCubicFeet} cu ft
                  </span>
                </div>
              </div>
              <p className="mt-2 text-center font-ui text-[14.5px] font-extrabold text-walnut-dark">
                {def.price > 0 ? formatUsd(def.price) : "Included"}
              </p>
              <div className="mt-auto pt-1.5">
                {isCurrent ? (
                  <KButton full variant="sage" disabled>
                    Current
                  </KButton>
                ) : (
                  <KButton
                    full
                    variant="copper"
                    disabled={tooSmall}
                    onClick={() => handleUpgrade(def.id)}
                  >
                    {def.price > 0 ? `Upgrade · ${formatUsd(def.price)}` : "Switch"}
                  </KButton>
                )}
                {!isCurrent && tooSmall ? (
                  <p className="mt-1 text-center font-hand text-[14px] text-copper">
                    Too small for your {formatQuantity(used)} units.
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-center font-hand text-[16px] text-walnut/50">
        Upgrading keeps everything already in the fridge.
      </p>

      {/* Campaign gear lives in the Market — one shop, no second one here. */}
      <Panel className="p-4">
        <Eyebrow>🔪 Knives, boards & sharpening</Eyebrow>
        <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/70">
          Your knives and boards are shared with the kitchen. Buying and equipping happen in the
          Market, sharpening at the Market's Blacksmith.
        </p>
        <KButton full variant="cream" className="mt-2" onClick={() => go("shop")}>
          Manage in the Market →
        </KButton>
      </Panel>
    </div>
  );
}
