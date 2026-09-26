import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import { BottomNav } from "../Kitchen";
import { knifeOrDefault, DEFAULT_KNIFE_ID } from "@/game/knives/knifeDefinitions";
import { boardOrDefault } from "@/game/boards/boardDefinitions";
import { getKnifeSharpness, sharpnessLabel } from "@/game/economy/sharpness";
import { REFRIGERATOR_CATALOG, getRefrigerator } from "@/game/business/refrigeratorDefinitions";
import {
  getInventoryUsedCapacity,
  getAvailableStorageCapacity,
} from "@/game/business/RefrigeratorManager";
import { conditionBandFor, type ConditionBand } from "@/game/business/businessEquipmentCondition";
import { maintenanceStatusFor, maintenanceCostFor } from "@/game/business/businessMaintenance";
import { getAllStaffDefinitions, dailyPayroll, isHired } from "@/game/business/businessStaff";
import { getSupplier } from "@/game/economy/supplierDefinitions";
import {
  getAllContractOffers,
  isContractActive,
  effectiveUnitCost,
} from "@/game/business/businessSupplierContract";
import { eventForDay, eventAdjustedUnitCost } from "@/game/business/businessSupplierEvents";
import { supplierEventSummary } from "@/game/business/businessAlerts";

const CONDITION_BADGE_TONE: Record<ConditionBand, "cream" | "sage" | "copper" | "locked"> = {
  GOOD: "sage",
  WORN: "cream",
  POOR: "copper",
  CRITICAL: "copper",
  BROKEN: "locked",
};

/** A representative $1.00/lb "Vegetable" reference price — suppliers never change the base catalog price itself (see businessPricing.ts), only the contract discount layered on top of it — so this one worked example is honestly the same shape a real Aromatic/Protein/etc. purchase would see, just at a round, easy-to-follow number. */
const REFERENCE_BASE_PRICE_CENTS = 100;

/**
 * BUSINESS_SHOP — Economy V3 Phase 14, Checkpoint 5. The categorized
 * Business Mode investment overview the checkpoint's own brief asks
 * for — organized by real, currently-existing mechanic (Equipment,
 * Refrigeration, Staff, Suppliers), each section explaining itself
 * (price, status, effect, recurring cost, what changes) using ONLY
 * data already computed by the existing pure functions (RefrigeratorManager/
 * businessMaintenance/businessStaff/businessSupplierContract/
 * businessSupplierEvents) — never a second pricing/effect calculation.
 *
 * Deliberately NOT a duplicate transaction engine: the deeper
 * management flows (upgrading the refrigerator beyond the one-tap
 * "Repair" action, hiring/firing every staff role, signing/cancelling
 * a supplier contract) stay on their own existing, already-tested
 * screens (BusinessRefrigerator/BusinessStaff/BusinessSuppliers) —
 * this screen links into them rather than re-implementing their logic
 * a second time, so there is exactly one place each of those actions
 * can ever be triggered from.
 *
 * KNIFE/BOARD — Business Mode has NO Business-specific knife or board
 * ownership/upgrade mechanic (confirmed by code audit: `equippedKnifeId`/
 * `equippedBoardId` are the SAME global SaveData fields Campaign's own
 * Rack/Shop manage, and PreparationScene.ts reads the identical
 * `KnifeDefinition`/`BoardDefinition` for both Campaign and Business
 * preparation sessions — see App.tsx's shared `knife={equippedKnife}
 * board={equippedBoard}` props). Knife/board CHOICE genuinely affects
 * the cutting scene's visuals in both modes; knife SHARPNESS and
 * equipment CATEGORY SPECIALIZATION only ever affect Campaign's own
 * `computeSettlement` COGS math (never called by Business Mode's
 * `serveBusinessOrder`) — sharpness doesn't even decay from playing
 * Business Mode (no `applySharpnessDecay` call exists in
 * `recordBusinessServiceResult`). This section is deliberately
 * INFORMATIONAL ONLY, with a link to the existing Rack screen —
 * inventing a separate Business knife-purchase flow would misrepresent
 * a system that doesn't exist.
 */
export function BusinessShop({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const knife = knifeOrDefault(save.equippedKnifeId);
  const board = boardOrDefault(save.equippedBoardId);
  const sharpness = getKnifeSharpness(save, save.equippedKnifeId || DEFAULT_KNIFE_ID);

  const refrigerator = getRefrigerator(save.business.refrigerator.refrigeratorId);
  const used = getInventoryUsedCapacity(save.business.inventory);
  const available = getAvailableStorageCapacity(
    save.business.inventory,
    save.business.refrigerator.refrigeratorId,
  );
  const condition = save.business.equipmentCondition.refrigeratorCondition;
  const conditionBand = conditionBandFor(condition);
  const maintenanceStatus = maintenanceStatusFor(condition);
  const maintenanceCost = maintenanceCostFor(condition);
  const currentTierIndex = REFRIGERATOR_CATALOG.findIndex(
    (r) => r.id === save.business.refrigerator.refrigeratorId,
  );
  const nextTier = REFRIGERATOR_CATALOG[currentTierIndex + 1];

  const hiredRoles = save.business.staff.hiredRoles;
  const payroll = dailyPayroll(hiredRoles);
  const staffDefs = getAllStaffDefinitions();

  const businessDay = save.business.calendar.businessDay;
  const contract = save.business.supplierContract;
  const contractActive = isContractActive(contract, businessDay);
  const todaysEvent = eventForDay(businessDay);
  const eventAdjustedReference = eventAdjustedUnitCost(REFERENCE_BASE_PRICE_CENTS, todaysEvent);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Market"
          subtitle="what you can invest in, and why"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        {/* ===== 1. Equipment — Knife / Board (hero, informational) ===== */}
        <div className="px-4 pt-2">
          <Panel tone="dark" className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
              Kitchen Equipment
            </p>
            <p className="mt-1.5 font-display text-[18px] font-black leading-tight text-ivory">
              🔪 {knife.name}
            </p>
            <p className="font-hand text-[13px] text-ivory/70">
              {sharpnessLabel(sharpness)} ({Math.round(sharpness)}/100) — sharpness only affects
              Campaign settlement math, never Business revenue.
            </p>
            <p className="mt-2 font-display text-[16px] font-black leading-tight text-ivory">
              🧑‍🍳 {board.name}
            </p>
            <p className="font-hand text-[13px] text-ivory/70">
              Cutting board, currently equipped.
            </p>
            <Divider />
            <p className="font-hand text-[12px] leading-snug text-ivory/60">
              Business Mode has no separate knife or board ownership — you cut with whichever
              knife/board are equipped in Campaign. Buying and equipping happen in the Market,
              sharpening at the Market's Blacksmith, and apply to both modes at once.
            </p>
            <KButton full variant="cream" className="mt-2" onClick={() => go("shop")}>
              Manage in the Market →
            </KButton>
          </Panel>
        </div>

        {/* ===== 2. Refrigeration / Storage ===== */}
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            Refrigeration &amp; Storage
          </p>
          <Panel tone="cream" className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                {refrigerator?.name ?? "Refrigerator"}
              </p>
              <Badge tone={CONDITION_BADGE_TONE[conditionBand]}>{conditionBand}</Badge>
            </div>
            <p className="font-hand text-[13px] leading-tight text-walnut/60">
              {refrigerator?.description}
            </p>
            <p className="mt-1 font-ui text-[11px] font-bold text-copper">
              Capacity: {refrigerator?.capacity ?? 0} (≈{refrigerator?.approxCubicFeet ?? 0} cu ft,
              modeled benchmark) · Storage: {formatQuantity(used)}/{refrigerator?.capacity ?? 0}{" "}
              used · {formatQuantity(available)} available
            </p>
            <p className="font-hand text-[12px] text-walnut/60">
              Condition: {condition}/100.{" "}
              {maintenanceStatus === "OPERATIONAL"
                ? "No repair needed right now."
                : maintenanceStatus === "BROKEN"
                  ? "Broken down — this raises spoilage risk and hurts reputation until repaired."
                  : "Wearing down — this is already nudging spoilage risk and reputation."}
            </p>
            {maintenanceStatus !== "OPERATIONAL" ? (
              <p className="font-ui text-[11px] font-bold text-copper">
                Repair cost: {maintenanceCost !== null ? formatUsd(maintenanceCost) : "—"} →
                restores condition to 100.
              </p>
            ) : null}
            {nextTier ? (
              <p className="mt-1 font-hand text-[12px] leading-snug text-walnut/60">
                Next tier — {nextTier.name}: capacity {refrigerator?.capacity ?? 0} →{" "}
                {nextTier.capacity} (≈{nextTier.approxCubicFeet} cu ft) for{" "}
                {formatUsd(nextTier.price)}. A new unit starts at 100/100 condition, and your stock
                moves over. ROI depends on your usage — how often you're bumping against your
                current capacity.
              </p>
            ) : (
              <p className="mt-1 font-hand text-[12px] text-walnut/60">
                Already the top-tier refrigerator.
              </p>
            )}
            <Divider />
            <KButton full onClick={() => go("business-refrigerator")}>
              Manage Refrigerator →
            </KButton>
          </Panel>
        </div>

        {/* ===== 3. Staff ===== */}
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">Staff</p>
          <Panel tone="cream" className="p-3">
            <p className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-copper">
              Daily payroll: {formatUsd(payroll)} · {hiredRoles.length}/{staffDefs.length} hired
            </p>
            <p className="font-hand text-[12px] leading-snug text-walnut/60">
              Payroll is charged automatically at End Business Day. Hiring is free — the recurring
              wage is the real cost. Staff are entirely optional; the business runs fine unstaffed.
            </p>
            <Divider />
            <div className="flex flex-col gap-1.5">
              {staffDefs.map((def) => {
                const hired = isHired({ hiredRoles }, def.role);
                return (
                  <div key={def.role} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-ui text-[12px] font-bold text-walnut-dark">
                        {def.name}
                      </p>
                      <p className="truncate font-hand text-[11px] text-walnut/50">
                        {def.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-ui text-[11px] font-bold text-copper">
                        {formatUsd(def.salary)}/day
                      </p>
                      {hired ? <Badge tone="sage">Hired</Badge> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 font-hand text-[11px] text-walnut/40">
              ROI depends on your order volume — a reputation boost or purchase discount is only
              worth its wage if it changes outcomes you'd otherwise miss.
            </p>
            <Divider />
            <KButton full onClick={() => go("business-staff")}>
              Manage Staff →
            </KButton>
          </Panel>
        </div>

        {/* ===== 4. Suppliers / Procurement ===== */}
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            Suppliers &amp; Procurement
          </p>
          <Panel tone="cream" className="p-3">
            <p className="font-hand text-[12px] leading-snug text-walnut/60">
              Every supplier buys from the same base catalog price (e.g.{" "}
              {formatUsd(REFERENCE_BASE_PRICE_CENTS)}/lb for a Vegetable-category ingredient) — a
              contract only changes the DISCOUNT layered on top of it.
            </p>
            <p className="mt-1 font-ui text-[11px] font-bold text-copper">
              Today's market:{" "}
              {todaysEvent
                ? `${todaysEvent.name} (${todaysEvent.priceModifier >= 0 ? "+" : ""}${Math.round(todaysEvent.priceModifier * 100)}%)`
                : "no event — normal pricing"}{" "}
              → reference price {formatUsd(eventAdjustedReference)}/lb today, before any contract
              discount.
            </p>
            {todaysEvent ? (
              <p className="font-hand text-[11px] leading-snug text-walnut/50">
                {supplierEventSummary(todaysEvent, contractActive)}
              </p>
            ) : null}
            <Divider />
            <div className="flex flex-col gap-2">
              {getAllContractOffers().map(({ supplierId, terms }) => {
                const supplier = getSupplier(supplierId);
                const isCurrent = contractActive && contract?.supplierId === supplierId;
                const exampleActiveTerms = isCurrent ? contract : { ...terms, supplierId };
                const effective = todaysEvent?.suspendsContractDiscount
                  ? eventAdjustedReference
                  : effectiveUnitCost(
                      eventAdjustedReference,
                      {
                        ...exampleActiveTerms,
                        contractStartDay: businessDay,
                        contractEndDay: businessDay + 1,
                      },
                      businessDay,
                      terms.minimumOrder,
                    );
                return (
                  <div key={supplierId} className="rounded-[12px] bg-ivory/60 p-2">
                    <div className="flex items-center justify-between">
                      <p className="font-ui text-[12px] font-bold text-walnut-dark">
                        {supplier?.name ?? supplierId}
                      </p>
                      {isCurrent ? <Badge tone="sage">Active</Badge> : null}
                    </div>
                    <p className="font-hand text-[11px] leading-snug text-walnut/55">
                      {Math.round(terms.discount * 100)}% off orders of {terms.minimumOrder}+ units
                      · {terms.contractLength}-day contract ·{" "}
                      {terms.cancellationFee > 0
                        ? `${formatUsd(terms.cancellationFee)} to cancel early`
                        : "no cancellation fee"}
                    </p>
                    <p className="font-ui text-[11px] font-bold text-copper">
                      Effective price at {terms.minimumOrder}+ units today: {formatUsd(effective)}
                      /lb {isCurrent ? "(your active contract)" : "(if signed)"}
                    </p>
                  </div>
                );
              })}
            </div>
            <Divider />
            <KButton full onClick={() => go("business-suppliers")}>
              Manage Suppliers →
            </KButton>
          </Panel>
        </div>

        {/* ===== 5. Maintenance note ===== */}
        <div className="px-4 pt-4">
          <Panel tone="cream" className="p-3">
            <p className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-copper">
              Maintenance &amp; Operations
            </p>
            <p className="mt-1 font-hand text-[12px] leading-snug text-walnut/60">
              The only maintainable equipment in Business Mode today is the refrigerator — its
              condition, repair cost, and effect on spoilage/reputation are shown in the
              Refrigeration section above. No other equipment has a maintenance mechanic yet.
            </p>
          </Panel>
        </div>

        <p className="px-8 pb-2 pt-4 text-center font-hand text-[12px] text-walnut/40">
          Every price here is a modeled 2026 U.S. benchmark, not a claim about real prices in your
          own market.
        </p>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
