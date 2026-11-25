import type { SaveData } from "@/game/SaveManager";
import { inventoryView } from "@/game/business/inventoryView";
import { INVENTORY_STATUS_META } from "@/game/business/inventoryStatus";
import { displayMeasure, formatStockAmount } from "@/game/business/measure";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { inventoryMenuOf, restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { todayPlanNeed } from "@/game/restaurant/marketPlan";
import { closingPreview, restaurantDayOf, todaysServices } from "@/game/restaurant/restaurantDay";
import { INGREDIENTS } from "@/game/definitions";
import { knifeOrDefault } from "@/game/knives/knifeDefinitions";
import { boardOrDefault } from "@/game/boards/boardDefinitions";
import { getKnifeSharpness, sharpnessLabel } from "@/game/economy/sharpness";
import { restaurantAttention, type AttentionRow } from "@/game/restaurant/restaurantAttention";
import {
  isCleanlinessLive,
  phaseChecklist,
  type CleanlinessAction,
  type CleanlinessActionResult,
} from "@/game/restaurant/cleanliness";
import { dayStockFor, servicePlanFor } from "@/game/restaurant/preServiceCheck";
import { getLevel } from "@/game/levels/LevelManager";
import { openMarketIngredients, openMarketSupplies } from "./marketFocus";
import { openAttentionRow } from "./attentionActions";
import { openStaffFor } from "./staffFocus";
import { ShiftChecklist } from "./restaurant/ShiftChecklist";
import type { ScreenId } from "./data";
import { BottomNav } from "./Kitchen";
import { Eyebrow } from "./common/Meters";
import { KButton, Panel, ScreenHeader } from "./common/primitives";
import { CardBackdrop } from "./progress/ProgressKit";
import { InfoTip } from "./common/InfoTip";
import { FreshnessGrid, type WatchTile } from "./FreshnessWatch";
import { SupplyCheckGrid } from "./SupplyCheckTiles";
import { TeamGrid } from "./TeamTiles";
import { AllClear, AreaThumbs, ClosingPlan, MealPills, Plate } from "./ChoreTiles";
import type { SupplyCheckRow } from "@/game/restaurant/serviceSupplies";

const urgencyClass = {
  urgent: "border-tomato/35 bg-tomato/5",
  low: "border-gold/40 bg-gold/10",
} as const;

function AttentionItem({ row, go }: { row: AttentionRow; go: (s: ScreenId) => void }) {
  const openAction = () => openAttentionRow(row, go);
  const label =
    row.action.to === "ingredient" || row.action.to === "supply"
      ? row.severity === "urgent"
        ? "Refill"
        : "Top up"
      : row.action.to === "fridge"
        ? "Equipment"
        : "Team";
  return (
    <li
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${urgencyClass[row.severity]}`}
    >
      <span aria-hidden="true" className="text-lg">
        {row.severity === "urgent" ? "⛔" : "🟠"}
      </span>
      <p className="min-w-0 flex-1 font-ui text-[12.5px] font-bold leading-snug text-walnut-dark">
        {row.text}
      </p>
      <button
        type="button"
        onClick={openAction}
        className="press min-h-11 shrink-0 rounded-full bg-walnut px-3 font-ui text-[11px] font-extrabold text-ivory"
      >
        {label} ›
      </button>
    </li>
  );
}

/** A stocked ingredient as a freshness-watch tile (picture in its state, status, amount, freshness bar, the fixing button). */
function stockTile(
  item: ReturnType<typeof inventoryView>["items"][number],
  go: (s: ScreenId) => void,
): WatchTile {
  const meta = INVENTORY_STATUS_META[item.status];
  const canRestock = item.status === "critical" || item.status === "low";
  const measure = displayMeasure();
  return {
    id: item.ingredientId,
    name: item.name,
    label: meta.label,
    marker: meta.marker,
    tone: meta.tone,
    // "Spoils tonight" is drawn going off even while the shelf-life state still reads aging.
    state:
      item.daysRemaining === 1 && item.freshnessState !== "EXPIRED"
        ? "NEAR_EXPIRY"
        : item.freshnessState,
    freshness: item.freshness,
    days: item.daysRemaining <= 0 ? "Expired" : `${item.daysRemaining}d left`,
    amount: formatStockAmount(item.ingredientId, item.quantity, measure),
    ...(item.todayRequirement && item.todayRequirement > 0
      ? { need: formatStockAmount(item.ingredientId, item.todayRequirement, measure) }
      : {}),
    action: canRestock ? "Restock" : "Inventory",
    onAction: () => (canRestock ? openMarketIngredients(go, item.ingredientId) : go("inventory")),
  };
}

/** A low-stock alert for an ingredient (no freshness known) as a tile of the same look. */
function lowTile(row: AttentionRow, go: (s: ScreenId) => void): WatchTile | null {
  const urgent = row.severity === "urgent";
  if (row.action.to !== "ingredient") return null;
  return {
    id: row.action.id,
    name: row.name,
    label: urgent ? "Needed now" : "Running low",
    marker: urgent ? "⛔" : "🟡",
    tone: urgent ? "tomato" : "gold",
    state: "FRESH",
    freshness: null,
    days: "",
    amount: row.amount,
    action: urgent ? "Refill" : "Top up",
    onAction: () => openAttentionRow(row, go),
  };
}

export function DailyMaintenance({
  go,
  save,
  cleanlinessAction,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  cleanlinessAction: (action: CleanlinessAction) => CleanlinessActionResult | null;
}) {
  const day = restaurantDayOf(save);
  const level = restaurantLevelOf(save.levelProgress);
  const equippedKnife = knifeOrDefault(save.equippedKnifeId);
  const equippedBoard = boardOrDefault(save.equippedBoardId);
  const knifeSharpness = getKnifeSharpness(save, equippedKnife.id);
  const schedule = todaysServices(save, level);
  const attention = restaurantAttention(save);
  const currentLevel = getLevel(save.levelProgress.highestUnlockedLevelId);
  const plan = currentLevel ? servicePlanFor(save, currentLevel) : null;
  const dayStock = currentLevel ? dayStockFor(save, currentLevel) : null;
  const closePlan = closingPreview(save, level);
  const missingTools = plan?.tools.applies ? plan.tools.rows.filter((row) => row.missing > 0) : [];
  const serviceSuppliesShown = plan?.supplies.applies === true;
  const serviceSupplyRows = plan?.supplies.applies ? plan.supplies.rows : [];
  const dayStockIngredientIds = new Set(dayStock?.rows.map((row) => row.ingredientId) ?? []);
  const urgent = attention.rows.filter(
    (r) => r.severity === "urgent" && (!serviceSuppliesShown || r.kind !== "supply"),
  );
  const urgentRows = dayStock ? urgent.filter((row) => row.kind !== "ingredient") : urgent;
  const lowRows = attention.rows.filter(
    (r) =>
      r.severity === "low" &&
      (!serviceSuppliesShown || r.kind !== "supply") &&
      !(r.action.to === "ingredient" && dayStockIngredientIds.has(r.action.id)),
  );
  const urgentIngredientRows = urgentRows.filter((r) => r.action.to === "ingredient");
  const urgentStaffRows = urgentRows.filter((r) => r.action.to === "staff");
  const urgentOtherRows = urgentRows.filter(
    (r) => r.action.to !== "ingredient" && r.action.to !== "staff",
  );
  const otherLowRows = lowRows.filter((r) => r.action.to !== "ingredient");
  const inventory = inventoryView(save, inventoryMenuOf(save), todayPlanNeed(save));
  const inventoryAttention = inventory.attention
    .flatMap((group) => group.items)
    .filter((item) => item.status !== "expired")
    .filter((item) => !dayStockIngredientIds.has(item.ingredientId))
    .filter(
      (item) =>
        !attention.rows.some(
          (r) =>
            r.kind === "ingredient" &&
            r.action.to === "ingredient" &&
            r.action.id === item.ingredientId,
        ),
    );
  const expired = inventory.attention
    .flatMap((group) => group.items)
    .filter((item) => item.status === "expired");
  const opening = phaseChecklist(save, "opening");
  const closing = phaseChecklist(save, "closing");
  const cleaningLive = isCleanlinessLive(level);
  const dayStockMissing = dayStock?.rows.length ?? 0;
  const serviceSupplyMissing = serviceSupplyRows.filter((row) => row.missing > 0).length;
  const closingSupplyMissing = closePlan.supplies.filter((line) => line.have < line.need).length;
  const totalAttention =
    urgentRows.length +
    lowRows.length +
    inventoryAttention.length +
    expired.length +
    missingTools.length +
    serviceSupplyMissing +
    opening.length +
    closing.length +
    dayStockMissing +
    closingSupplyMissing;
  const operationsAlerts =
    attention.rows.filter((r) => r.kind !== "ingredient").length + missingTools.length;
  const openingDone = opening.length === 0;
  const stateLabel = totalAttention > 0 ? "Needs a look" : "Ready for the day";

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.25),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="🌅 Daily Maintenance"
          subtitle="A quick check before today’s service"
          wrapTitle
          onBack={() => go("business")}
        />

        <div className="space-y-3 px-4 pb-4">
          <section
            className="@container relative isolate overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-4 text-ivory shadow-lift"
            data-testid="opening-briefing"
          >
            <CardBackdrop name="briefing" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow dark>Opening briefing · Restaurant Day {day.day}</Eyebrow>
                  <h2 className="mt-1 font-display text-[22px] font-black leading-tight">
                    {stateLabel}
                  </h2>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 font-ui text-[10px] font-extrabold ${totalAttention ? "border border-gold/40 bg-walnut-dark/70 text-gold" : "border border-ivory/20 bg-walnut-dark/70 text-ivory"}`}
                >
                  {totalAttention ? `${totalAttention} to review` : "CHECKED"}
                </span>
              </div>
              <p className="mt-1 font-ui text-[12px] text-ivory/75">
                {day.closingDue
                  ? "🌙 Finish closing first"
                  : day.opened
                    ? "☀️ Day underway"
                    : "📋 Check stock, supplies & chores"}
              </p>
              {schedule.length > 0 ? (
                <div className="mt-3 rounded-xl border border-ivory/15 bg-walnut-dark/25 p-2.5">
                  <p className="font-ui text-[10px] font-extrabold uppercase tracking-wider text-gold">
                    Today’s service plan
                  </p>
                  <MealPills services={schedule} />
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <KButton variant="copper" size="sm" onClick={() => go("kitchen")}>
                  {day.closingDue ? "Go to closing →" : "Go to today’s service →"}
                </KButton>
                <KButton variant="cream" size="sm" onClick={() => go("inventory")}>
                  Open inventory
                </KButton>
              </div>
            </div>
          </section>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Eyebrow>⛔ Service blockers</Eyebrow>
                <p className="mt-0.5 font-ui text-[12px] text-walnut/60">
                  Staff · supplies · fridge
                </p>
              </div>
              <span className="rounded-full bg-tomato/10 px-2.5 py-1 font-ui text-[11px] font-extrabold text-tomato">
                {urgentRows.length}
              </span>
            </div>
            {urgentRows.length ? (
              <>
                {urgentIngredientRows.length ? (
                  <FreshnessGrid
                    tiles={urgentIngredientRows.flatMap((row) => lowTile(row, go) ?? [])}
                  />
                ) : null}
                {urgentStaffRows.length ? (
                  <TeamGrid
                    people={urgentStaffRows.flatMap((row) =>
                      row.action.to === "staff"
                        ? [
                            {
                              id: row.action.id,
                              title: row.name,
                              specialist: row.action.specialist,
                              met: false,
                              onHire: () => openAttentionRow(row, go),
                            },
                          ]
                        : [],
                    )}
                  />
                ) : null}
                {urgentOtherRows.length ? (
                  <ul className="mt-3 space-y-2">
                    {urgentOtherRows.map((row) => (
                      <AttentionItem key={row.id} row={row} go={go} />
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <AllClear>No service blockers{dayStock ? " · ingredients below" : ""}</AllClear>
            )}
          </Panel>

          {dayStock ? (
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Eyebrow>🥕 Ingredients for the full day</Eyebrow>
                  <p className="mt-0.5 font-ui text-[12px] text-walnut/60">
                    {dayStock.levels.length === 1
                      ? "1 service"
                      : `${dayStock.levels.length} services`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 font-ui text-[11px] font-extrabold ${dayStockMissing ? "bg-gold/20 text-copper" : "bg-sage/15 text-olive"}`}
                >
                  {dayStockMissing ? `${dayStockMissing} to buy` : "Ready"}
                </span>
              </div>
              {dayStock.rows.length ? (
                <FreshnessGrid
                  tiles={dayStock.rows.map((row) => ({
                    id: row.ingredientId,
                    name: INGREDIENTS[row.ingredientId]?.name ?? row.ingredientId,
                    label: "To buy",
                    marker: "🛒",
                    tone: "gold" as const,
                    state: "FRESH" as const,
                    freshness: null,
                    days: "",
                    amount: `Buy ${row.buyUnits}`,
                    action: "Buy",
                    onAction: () => openMarketIngredients(go, row.ingredientId, row.buyUnits),
                  }))}
                />
              ) : (
                <AllClear>Stock covers the rest of today</AllClear>
              )}
              {!dayStock.fits ? (
                <p className="mt-2 flex items-center gap-1.5 font-ui text-[12px] font-bold text-copper">
                  ❄️ Too big for the fridge{" "}
                  <InfoTip label="Fridge too small for the day">
                    The full day’s stock exceeds current fridge space. Restock before each service
                    or upgrade refrigeration.
                  </InfoTip>
                </p>
              ) : null}
            </Panel>
          ) : null}

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Eyebrow>🟠 Running low · freshness watch</Eyebrow>
                <p className="mt-0.5 font-ui text-[12px] text-walnut/60">
                  Top up · use or clear old stock
                </p>
              </div>
              <span className="rounded-full bg-gold/20 px-2.5 py-1 font-ui text-[11px] font-extrabold text-copper">
                {lowRows.length + inventoryAttention.length + expired.length}
              </span>
            </div>
            {lowRows.length || inventoryAttention.length || expired.length ? (
              <>
                <FreshnessGrid
                  tiles={[
                    ...lowRows.flatMap((row) => lowTile(row, go) ?? []),
                    ...inventoryAttention.map((item) => stockTile(item, go)),
                    ...expired.map((item) => stockTile(item, go)),
                  ]}
                />
                {otherLowRows.length ? (
                  <ul className="mt-2 space-y-2">
                    {otherLowRows.map((row) => (
                      <AttentionItem key={row.id} row={row} go={go} />
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <AllClear>All covered today</AllClear>
            )}
            {inventory.summary.stocked === 0 && attention.rows.length === 0 ? (
              <p className="mt-2 font-ui text-[12px] text-walnut/50">🔒 Opens with the Market</p>
            ) : null}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>🌅 Opening clean</Eyebrow>
                <AreaThumbs />
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-ui text-[10px] font-extrabold ${openingDone ? "bg-sage/15 text-olive" : "bg-gold/20 text-copper"}`}
              >
                {opening.length ? `${opening.length} tasks` : "Clear"}
              </span>
            </div>
            {cleaningLive ? (
              opening.length ? (
                <ShiftChecklist
                  save={save}
                  phase="opening"
                  onAction={cleanlinessAction}
                  onBuy={(id) =>
                    openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id)
                  }
                  onOpenCleanliness={() => go("business-cleanliness")}
                />
              ) : (
                <AllClear>No opening tasks</AllClear>
              )
            ) : (
              <p className="mt-3 rounded-xl bg-cream px-3 py-2 font-ui text-[12px] text-walnut/60">
                🔒 Unlocks with restaurant operations
              </p>
            )}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Eyebrow>🌙 Night close</Eyebrow>
                <p className="mt-0.5 font-ui text-[12px] text-walnut/60">
                  Clean & stocked for tomorrow
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-ui text-[10px] font-extrabold ${closing.length ? "bg-gold/20 text-copper" : "bg-walnut/5 text-walnut/55"}`}
              >
                {closing.length
                  ? `${closing.length} tasks`
                  : day.closingDue
                    ? "Close due"
                    : "After service"}
              </span>
            </div>
            {cleaningLive ? (
              closing.length ? (
                <ShiftChecklist
                  save={save}
                  phase="closing"
                  onAction={cleanlinessAction}
                  onBuy={(id) =>
                    openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id)
                  }
                  onOpenCleanliness={() => go("business-cleanliness")}
                />
              ) : (
                <AllClear icon="moon" fallback="🌙">
                  Added after the last service{" "}
                  <InfoTip label="About closing chores">
                    Closing chores are added after the day’s final service. The full close-down
                    lives in Cleanliness & Maintenance.
                  </InfoTip>
                </AllClear>
              )
            ) : (
              <p className="mt-3 rounded-xl bg-cream px-3 py-2 font-ui text-[12px] text-walnut/60">
                🔒 Unlocks with restaurant operations
              </p>
            )}
            <ClosingPlan
              chores={closePlan.chores}
              fullDayEnd={closePlan.fullDayEnd}
              spoiled={closePlan.spoiled}
            >
              {closePlan.supplies.length ? (
                <p className="mt-3 font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">
                  Stock for tonight’s close
                </p>
              ) : null}
              {closePlan.supplies.length ? (
                <SupplyCheckGrid
                  rows={closePlan.supplies.map((line): SupplyCheckRow => {
                    const missing = Math.max(0, line.need - line.have);
                    const pack = Math.max(1, getSupplyItem(line.id)?.packSize ?? 1);
                    return {
                      id: line.id,
                      label: line.label,
                      need: line.need,
                      have: line.have,
                      dirty: 0,
                      missing,
                      blocking: false,
                      packs: Math.max(1, Math.ceil(missing / pack)),
                      cost: 0,
                    };
                  })}
                  softLabel="Low"
                  onRestock={(row) =>
                    openMarketSupplies(
                      go,
                      getSupplyItem(row.id)?.section ?? "packaging",
                      row.id,
                      row.packs,
                    )
                  }
                />
              ) : null}
            </ClosingPlan>
            <button
              type="button"
              onClick={() => go("business-cleanliness")}
              className="press mt-2 min-h-11 w-full rounded-full border border-walnut/15 bg-ivory/70 font-ui text-[12px] font-extrabold text-copper"
            >
              Open Cleanliness & Maintenance ›
            </button>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Eyebrow>🧭 Other checks</Eyebrow>
                <p className="mt-0.5 font-ui text-[11px] text-walnut/60">
                  Supplies, team, cold storage and tools
                </p>
              </div>
              <span className="font-ui text-[11px] font-bold text-walnut/50">
                {operationsAlerts} alerts
              </span>
            </div>
            <ul
              className="mt-3 grid grid-cols-2 gap-2.5 land:grid-cols-3"
              data-testid="other-checks"
            >
              {(
                [
                  {
                    to: "business-staff",
                    icon: "team",
                    emoji: "👥",
                    title: "Team",
                    sub: "Review staff cover",
                  },
                  {
                    to: "business-refrigerator",
                    icon: "snowflake",
                    emoji: "❄️",
                    title: "Equipment",
                    sub: "Check fridge and repairs",
                  },
                  {
                    to: "business-cleanliness",
                    icon: "sponge",
                    emoji: "🧽",
                    title: "Cleaning",
                    sub: "Review all areas",
                  },
                  {
                    to: "inventory-supplies",
                    icon: "box",
                    emoji: "📦",
                    title: "Supplies",
                    sub: "See all stock levels",
                  },
                  {
                    to: "business-suppliers",
                    icon: "truck",
                    emoji: "🚚",
                    title: "Suppliers",
                    sub: "Review deliveries & contracts",
                  },
                  {
                    to: "shop",
                    icon: "knife",
                    emoji: "🔪",
                    title: "Prep gear",
                    sub: `${equippedKnife.name} · ${equippedBoard.name} · ${knifeSharpness}% ${sharpnessLabel(knifeSharpness)}`,
                  },
                ] as const
              ).map((c) => (
                <li key={c.to}>
                  <button
                    type="button"
                    onClick={() => go(c.to)}
                    className="press flex min-h-[72px] w-full items-center gap-2.5 rounded-2xl border-2 border-gold/40 bg-gradient-to-b from-ivory to-cream p-2 text-left shadow-[0_3px_0_rgba(200,150,50,0.18)]"
                  >
                    <Plate name={c.icon} fallback={c.emoji} className="h-[52px] w-[52px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[14.5px] font-black leading-tight text-walnut-dark">
                        {c.title}
                      </span>
                      <span className="block truncate font-ui text-[10.5px] font-bold text-walnut/55">
                        {c.sub}
                      </span>
                    </span>
                    <span aria-hidden="true" className="font-ui text-[18px] font-black text-copper">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {missingTools.length > 0 ? (
              <div className="mt-3 rounded-xl border border-tomato/25 bg-tomato/5 p-3">
                <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-tomato">
                  🍳 Tools needed for today’s dishes
                </p>
                <SupplyCheckGrid
                  rows={missingTools.map((tool): SupplyCheckRow => ({
                    id: tool.id,
                    label: tool.label,
                    need: tool.need,
                    have: tool.have,
                    dirty: 0,
                    missing: tool.missing,
                    blocking: true,
                    packs: tool.packs,
                    cost: 0,
                  }))}
                  action="Get tool"
                  onRestock={(row) => openMarketSupplies(go, "culinary", row.id, row.packs)}
                />
              </div>
            ) : plan?.tools.applies ? (
              <AllClear>Tools ready</AllClear>
            ) : null}
            {plan?.supplies.applies ? (
              <div className="mt-3 rounded-xl border border-walnut/10 bg-ivory/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">
                    🍽️ Next service · cutlery & supplies
                  </p>
                  <span className="font-ui text-[10px] font-extrabold text-walnut/55">
                    {plan.supplies.dineIn} dine-in · {plan.supplies.takeaway} takeaway
                  </span>
                </div>
                {plan.supplies.rows.length ? (
                  <SupplyCheckGrid
                    rows={plan.supplies.rows}
                    onRestock={(row) =>
                      openMarketSupplies(
                        go,
                        getSupplyItem(row.id)?.section ?? "service",
                        row.id,
                        row.packs,
                      )
                    }
                  />
                ) : (
                  <AllClear>Nothing extra needed</AllClear>
                )}
              </div>
            ) : null}
            {plan?.staff.length ? (
              <div className="mt-3 rounded-xl border border-walnut/10 bg-ivory/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">
                    👩‍🍳 Required team
                  </p>
                  <span className="font-ui text-[10px] font-extrabold text-walnut/55">
                    {plan.staff.filter((person) => person.met).length}/{plan.staff.length} ready
                  </span>
                </div>
                <TeamGrid
                  people={plan.staff.map((person) => ({
                    id: person.id,
                    title: person.title,
                    specialist: person.kind === "specialist",
                    met: person.met,
                    why: <InfoTip label={`Why a ${person.title}`}>{person.why}</InfoTip>,
                    onHire: () => openStaffFor(go, [person.id]),
                  }))}
                />
              </div>
            ) : null}
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 font-ui text-[12px] text-walnut/60">
              🔪 Starter knife & board always equipped{" "}
              <InfoTip label="About knives and tools">
                New knives and boards are optional upgrades; the culinary smallwares listed above
                are what today’s dishes require.
              </InfoTip>
            </p>
          </Panel>

          <div className="pb-1">
            <KButton full variant="sage" onClick={() => go("kitchen")}>
              Back to today’s service →
            </KButton>
          </div>
        </div>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
