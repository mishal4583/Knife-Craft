import { useState } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { formatUsd } from "@/game/business/businessCurrency";
import { BottomNav } from "../Kitchen";
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

/**
 * BUSINESS_REFRIGERATOR — Economy V3 Phase 3. Shows the owned
 * refrigerator's storage bar plus the upgrade catalog. Reads capacity
 * exclusively through RefrigeratorManager's own functions — never
 * recomputes `capacity - used` inline, so this screen and the Inventory
 * screen can never drift out of sync with each other.
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
  const fillFraction = capacity > 0 ? Math.min(1, used / capacity) : 0;
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
      const text =
        result.reason === "insufficientFunds"
          ? "Not quite enough cash for that refrigerator."
          : result.reason === "invalidDowngrade"
            ? "That refrigerator can't hold what's already in storage."
            : result.reason === "alreadyOwned"
              ? "That's already your current refrigerator."
              : "That upgrade couldn't be made.";
      setMessage(text);
      return;
    }
    setMessage(
      `Upgraded to ${getRefrigerator(result.refrigeratorId)?.name} for ${formatUsd(result.price)}.`,
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(125,146,112,0.24),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Refrigerator"
          subtitle="storage for the restaurant's stock"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        <div className="px-4">
          <Panel tone="dark" className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
              {current?.name ?? "Refrigerator"}
            </p>
            <p className="mt-1 font-hand text-[14px] text-ivory/70">{current?.description}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between font-ui text-[11px] font-bold text-ivory/80">
                <span>Storage {current ? `(≈${current.approxCubicFeet} cu ft)` : ""}</span>
                <span>
                  {formatQuantity(used)} / {capacity}
                </span>
              </div>
              <span className="relative mt-1.5 block h-[10px] overflow-hidden rounded-full bg-ivory/15">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.round(fillFraction * 100)}%`,
                    background: "linear-gradient(90deg,var(--color-gold),var(--color-copper))",
                  }}
                />
              </span>
            </div>
            <p className="mt-2 font-ui text-[12px] font-bold text-ivory/80">
              Available: <span className="text-gold">{formatQuantity(available)}</span>
            </p>
            <Divider />
            <div className="flex items-center justify-between">
              <p className="font-ui text-[11px] font-bold text-ivory/80">
                Condition: {condition}/100
              </p>
              <Badge tone={CONDITION_BADGE_TONE[conditionBand]}>{conditionBand}</Badge>
            </div>
            <p className="mt-1 font-hand text-[12px] leading-snug text-ivory/55">
              Loading stock wears it: 1 point for every {DECAY_DIVISOR} units you buy. Below 60 it
              needs service ({formatUsd(maintenanceCostFor(59) ?? 0)}); below 20 it breaks down (
              {formatUsd(maintenanceCostFor(0) ?? 0)}). A worn unit raises recorded spoilage losses,
              costs popularity and fails inspection categories.
            </p>
            {maintenanceStatus !== "OPERATIONAL" ? (
              <>
                <p className="mt-1 font-ui text-[11px] font-extrabold uppercase tracking-[0.12em] text-gold">
                  Status: {maintenanceStatus.replace("_", " ")}
                </p>
                <p className="mt-1 font-hand text-[12px] text-ivory/60">
                  {maintenanceStatus === "BROKEN"
                    ? "Broken down — spoilage and reputation are taking a real hit."
                    : "Wear from regular use is hurting your reputation and spoilage a little."}{" "}
                  Repairing restores it to full, cheaper than replacing it outright.
                </p>
                <KButton full variant="copper" className="mt-2" onClick={handleMaintenance}>
                  Repair · {maintenanceCost !== null ? formatUsd(maintenanceCost) : ""}
                </KButton>
              </>
            ) : null}
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            Refrigerator Options
          </p>
          {message ? (
            <p className="mb-2 text-center font-hand text-[14px] text-copper">{message}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            {REFRIGERATOR_CATALOG.map((def) => {
              const isCurrent = def.id === save.business.refrigerator.refrigeratorId;
              const tooSmall = def.capacity < used;
              return (
                <Panel key={def.id} tone="cream" className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                        {def.name}
                      </p>
                      <p className="font-hand text-[13px] leading-tight text-walnut/60">
                        {def.description}
                      </p>
                      <p className="mt-0.5 font-ui text-[11px] font-bold text-copper">
                        Capacity: {def.capacity} (≈{def.approxCubicFeet} cu ft)
                      </p>
                    </div>
                    {isCurrent ? (
                      <Badge tone="sage">Current</Badge>
                    ) : (
                      <KButton
                        variant="copper"
                        disabled={tooSmall}
                        onClick={() => handleUpgrade(def.id)}
                      >
                        {def.price > 0 ? `Upgrade · ${formatUsd(def.price)}` : "Switch"}
                      </KButton>
                    )}
                  </div>
                  {!isCurrent && tooSmall ? (
                    <p className="mt-1.5 text-center font-hand text-[12px] text-copper">
                      Too small for {formatQuantity(used)} units already in storage.
                    </p>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        </div>

        <Divider />

        <p className="px-8 pb-2 pt-3 text-center font-hand text-[15px] text-walnut/50">
          upgrading never touches what's already in the fridge.
        </p>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
