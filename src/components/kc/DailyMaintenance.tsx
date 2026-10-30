import type { SaveData } from "@/game/SaveManager";
import { inventoryView } from "@/game/business/inventoryView";
import { INVENTORY_STATUS_META } from "@/game/business/inventoryStatus";
import { formatQuantity } from "@/game/business/businessInventory";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { inventoryMenuOf, restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { closingPreview, restaurantDayOf, todaysServices } from "@/game/restaurant/restaurantDay";
import { INGREDIENTS } from "@/game/definitions";
import { INGREDIENT_EMOJI, knifeOrDefault } from "@/game/knives/knifeDefinitions";
import { boardOrDefault } from "@/game/boards/boardDefinitions";
import { getKnifeSharpness, sharpnessLabel } from "@/game/economy/sharpness";
import { restaurantAttention, type AttentionRow } from "@/game/restaurant/restaurantAttention";
import { isCleanlinessLive, phaseChecklist, type CleanlinessAction, type CleanlinessActionResult } from "@/game/restaurant/cleanliness";
import { dayStockFor, servicePlanFor } from "@/game/restaurant/preServiceCheck";
import { getLevel } from "@/game/levels/LevelManager";
import { openMarketIngredients, openMarketSupplies } from "./marketFocus";
import { ShiftChecklist } from "./restaurant/ShiftChecklist";
import type { ScreenId } from "./data";
import { BottomNav } from "./Kitchen";
import { Eyebrow } from "./common/Meters";
import { KButton, Panel, ScreenHeader } from "./common/primitives";
import { InfoTip } from "./common/InfoTip";

const urgencyClass = {
  urgent: "border-tomato/35 bg-tomato/5",
  low: "border-gold/40 bg-gold/10",
} as const;

function AttentionItem({ row, go }: { row: AttentionRow; go: (s: ScreenId) => void }) {
  function openAction() {
    const action = row.action;
    if (action.to === "ingredient") openMarketIngredients(go, action.id, action.quantity);
    else if (action.to === "supply")
      openMarketSupplies(go, getSupplyItem(action.id)?.section ?? "culinary", action.id);
    else if (action.to === "fridge") go("business-refrigerator");
    else go("business-staff");
  }
  const label = row.action.to === "ingredient" || row.action.to === "supply"
    ? row.severity === "urgent" ? "Refill" : "Top up"
    : row.action.to === "fridge" ? "Equipment" : "Team";
  return (
    <li className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${urgencyClass[row.severity]}`}>
      <span aria-hidden="true" className="text-lg">{row.severity === "urgent" ? "⛔" : "🟠"}</span>
      <p className="min-w-0 flex-1 font-ui text-[12.5px] font-bold leading-snug text-walnut-dark">{row.text}</p>
      <button type="button" onClick={openAction} className="press min-h-11 shrink-0 rounded-full bg-walnut px-3 font-ui text-[11px] font-extrabold text-ivory">
        {label} ›
      </button>
    </li>
  );
}

function StockItem({ item, go }: { item: ReturnType<typeof inventoryView>["items"][number]; go: (s: ScreenId) => void }) {
  const meta = INVENTORY_STATUS_META[item.status];
  const canRestock = item.status === "critical" || item.status === "low";
  return (
    <li className="flex items-center gap-2 rounded-xl border border-walnut/10 bg-ivory/70 px-3 py-2">
      <span aria-hidden="true">{meta.marker}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-ui text-[12.5px] font-extrabold text-walnut-dark">{item.name}</p>
        <p className="font-ui text-[11px] text-walnut/60">{meta.label} · {formatQuantity(item.quantity)} {item.unit}{item.daysRemaining >= 0 ? ` · ${item.daysRemaining}d freshness` : ""}</p>
      </div>
      <button type="button" onClick={() => canRestock ? openMarketIngredients(go, item.ingredientId) : go("inventory")} className="press min-h-11 shrink-0 rounded-full border border-walnut/20 bg-cream px-3 font-ui text-[11px] font-extrabold text-walnut-dark">
        {canRestock ? "Restock" : "Inventory"} ›
      </button>
    </li>
  );
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
  const urgent = attention.rows.filter((r) => r.severity === "urgent" && (!serviceSuppliesShown || r.kind !== "supply"));
  const urgentRows = dayStock ? urgent.filter((row) => row.kind !== "ingredient") : urgent;
  const lowRows = attention.rows.filter((r) =>
    r.severity === "low" &&
    (!serviceSuppliesShown || r.kind !== "supply") &&
    !(r.action.to === "ingredient" && dayStockIngredientIds.has(r.action.id)),
  );
  const inventory = inventoryView(save, inventoryMenuOf(save));
  const inventoryAttention = inventory.attention.flatMap((group) => group.items)
    .filter((item) => item.status !== "expired")
    .filter((item) => !dayStockIngredientIds.has(item.ingredientId))
    .filter((item) => !attention.rows.some((r) => r.kind === "ingredient" && r.action.to === "ingredient" && r.action.id === item.ingredientId));
  const expired = inventory.attention.flatMap((group) => group.items).filter((item) => item.status === "expired");
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
  const operationsAlerts = attention.rows.filter((r) => r.kind !== "ingredient").length + missingTools.length;
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
          <section className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-4 text-ivory shadow-lift">
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow dark>Opening briefing · Restaurant Day {day.day}</Eyebrow>
                  <h2 className="mt-1 font-display text-[22px] font-black leading-tight">{stateLabel}</h2>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 font-ui text-[10px] font-extrabold ${totalAttention ? "bg-gold/25 text-gold" : "bg-sage/25 text-ivory"}`}>
                  {totalAttention ? `${totalAttention} to review` : "CHECKED"}
                </span>
              </div>
              <p className="mt-1 font-ui text-[12px] text-ivory/75">{day.closingDue ? "🌙 Finish closing first" : day.opened ? "☀️ Day underway" : "📋 Check stock, supplies & chores"}</p>
              {schedule.length > 0 ? (
                <div className="mt-3 rounded-xl border border-ivory/15 bg-walnut-dark/25 p-2.5">
                  <p className="font-ui text-[10px] font-extrabold uppercase tracking-wider text-gold">Today’s service plan</p>
                  <ul className="mt-1 space-y-1">
                    {schedule.map((service) => <li key={`${service.name}-${service.levelNumber}`} className="font-ui text-[12px] font-bold text-ivory/90">{service.done ? "✓" : "•"} {service.name}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <KButton variant="copper" size="sm" onClick={() => go("kitchen")}>{day.closingDue ? "Go to closing →" : "Go to today’s service →"}</KButton>
                <KButton variant="ghost" size="sm" onClick={() => go("inventory")}>Open inventory</KButton>
              </div>
            </div>
          </section>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div><Eyebrow>⛔ Service blockers</Eyebrow><p className="mt-0.5 font-ui text-[12px] text-walnut/60">Staff · supplies · fridge</p></div>
              <span className="rounded-full bg-tomato/10 px-2.5 py-1 font-ui text-[11px] font-extrabold text-tomato">{urgentRows.length}</span>
            </div>
            {urgentRows.length ? <ul className="mt-3 space-y-2">{urgentRows.map((row) => <AttentionItem key={row.id} row={row} go={go} />)}</ul> : <p className="mt-3 rounded-xl bg-sage/10 px-3 py-2 font-ui text-[12.5px] font-bold text-olive">✓ No service blockers{dayStock ? " · ingredients below" : ""}</p>}
          </Panel>

          {dayStock ? (
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div><Eyebrow>🥕 Ingredients for the full day</Eyebrow><p className="mt-0.5 font-ui text-[12px] text-walnut/60">{dayStock.levels.length === 1 ? "1 service" : `${dayStock.levels.length} services`}</p></div>
                <span className={`rounded-full px-2.5 py-1 font-ui text-[11px] font-extrabold ${dayStockMissing ? "bg-gold/20 text-copper" : "bg-sage/15 text-olive"}`}>{dayStockMissing ? `${dayStockMissing} to buy` : "Ready"}</span>
              </div>
              {dayStock.rows.length ? (
                <ul className="mt-3 space-y-2">
                  {dayStock.rows.map((row) => (
                    <li key={row.ingredientId} className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2">
                      <span aria-hidden="true" className="text-lg">{INGREDIENT_EMOJI[row.ingredientId]}</span>
                      <p className="min-w-0 flex-1 font-ui text-[12.5px] font-bold text-walnut-dark">{INGREDIENTS[row.ingredientId]?.name ?? row.ingredientId} · buy {row.buyUnits}</p>
                      <button type="button" onClick={() => openMarketIngredients(go, row.ingredientId, row.buyUnits)} className="press min-h-11 shrink-0 rounded-full bg-walnut px-3 font-ui text-[11px] font-extrabold text-ivory">Buy ›</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 rounded-xl bg-sage/10 px-3 py-2 font-ui text-[12.5px] font-bold text-olive">✓ Stock covers the rest of today</p>}
              {!dayStock.fits ? <p className="mt-2 flex items-center gap-1.5 font-ui text-[12px] font-bold text-copper">❄️ Too big for the fridge <InfoTip label="Fridge too small for the day">The full day’s stock exceeds current fridge space. Restock before each service or upgrade refrigeration.</InfoTip></p> : null}
            </Panel>
          ) : null}

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div><Eyebrow>🟠 Running low · freshness watch</Eyebrow><p className="mt-0.5 font-ui text-[12px] text-walnut/60">Top up · use or clear old stock</p></div>
              <span className="rounded-full bg-gold/20 px-2.5 py-1 font-ui text-[11px] font-extrabold text-copper">{lowRows.length + inventoryAttention.length + expired.length}</span>
            </div>
            {lowRows.length || inventoryAttention.length || expired.length ? (
              <ul className="mt-3 space-y-2">
                {lowRows.map((row) => <AttentionItem key={row.id} row={row} go={go} />)}
                {inventoryAttention.map((item) => <StockItem key={item.ingredientId} item={item} go={go} />)}
                {expired.map((item) => <StockItem key={`expired-${item.ingredientId}`} item={item} go={go} />)}
              </ul>
            ) : <p className="mt-3 rounded-xl bg-sage/10 px-3 py-2 font-ui text-[12.5px] font-bold text-olive">✓ All covered today</p>}
            {inventory.summary.stocked === 0 && attention.rows.length === 0 ? <p className="mt-2 font-ui text-[12px] text-walnut/50">🔒 Opens with the Market</p> : null}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><Eyebrow>🌅 Opening clean</Eyebrow><p className="mt-0.5 font-ui text-[12px] text-walnut/60">🍳 Kitchen · 🚻 restroom · 🍽️ dining</p></div>
              <span className={`rounded-full px-2.5 py-1 font-ui text-[10px] font-extrabold ${openingDone ? "bg-sage/15 text-olive" : "bg-gold/20 text-copper"}`}>{opening.length ? `${opening.length} tasks` : "Clear"}</span>
            </div>
            {cleaningLive ? opening.length ? <ShiftChecklist save={save} phase="opening" onAction={cleanlinessAction} onBuy={(id) => openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id)} onOpenCleanliness={() => go("business-cleanliness")} /> : <p className="mt-3 rounded-xl bg-sage/10 px-3 py-2 font-ui text-[12.5px] font-bold text-olive">✓ No opening tasks</p> : <p className="mt-3 rounded-xl bg-cream px-3 py-2 font-ui text-[12px] text-walnut/60">🔒 Unlocks with restaurant operations</p>}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div><Eyebrow>🌙 Night close</Eyebrow><p className="mt-0.5 font-ui text-[12px] text-walnut/60">Clean & stocked for tomorrow</p></div>
              <span className={`rounded-full px-2.5 py-1 font-ui text-[10px] font-extrabold ${closing.length ? "bg-gold/20 text-copper" : "bg-walnut/5 text-walnut/55"}`}>{closing.length ? `${closing.length} tasks` : day.closingDue ? "Close due" : "After service"}</span>
            </div>
            {cleaningLive ? closing.length ? <ShiftChecklist save={save} phase="closing" onAction={cleanlinessAction} onBuy={(id) => openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id)} onOpenCleanliness={() => go("business-cleanliness")} /> : <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 font-ui text-[12px] text-walnut/60">🌙 Added after the last service <InfoTip label="About closing chores">Closing chores are added after the day’s final service. The full close-down lives in Cleanliness & Maintenance.</InfoTip></p> : <p className="mt-3 rounded-xl bg-cream px-3 py-2 font-ui text-[12px] text-walnut/60">🔒 Unlocks with restaurant operations</p>}
            <div className="mt-3 rounded-xl border border-walnut/10 bg-ivory/70 p-3">
              <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">Tonight’s close</p>
              <ul className="mt-1 space-y-1">
                {closePlan.chores.map((chore) => <li key={chore.id} className="font-ui text-[12px] text-walnut-dark">🌙 {chore.label}</li>)}
                {closePlan.fullDayEnd ? <li className="font-ui text-[12px] text-walnut-dark">💰 Close the books and pay the team</li> : null}
              </ul>
              {closePlan.spoiled ? <p className={`mt-2 font-ui text-[11px] font-bold ${closePlan.spoiled.quantity ? "text-tomato" : "text-olive"}`}>{closePlan.spoiled.quantity ? `🗑️ ${closePlan.spoiled.quantity} units expire tonight · use or clear` : "✓ Nothing expires tonight"}</p> : null}
              {closePlan.supplies.length ? <ul className="mt-2 space-y-1 border-t border-walnut/10 pt-2">
                {closePlan.supplies.map((line) => <li key={line.id} className="flex items-center gap-2 font-ui text-[11.5px]">
                  <span className={`min-w-0 flex-1 ${line.have < line.need ? "font-bold text-copper" : "text-walnut/70"}`}>{line.have >= line.need ? "✓" : "⚠️"} {line.label}: {line.have}/{line.need}</span>
                  {line.have < line.need ? <button type="button" onClick={() => openMarketSupplies(go, getSupplyItem(line.id)?.section ?? "packaging", line.id, Math.max(1, Math.ceil((line.need - line.have) / Math.max(1, getSupplyItem(line.id)?.packSize ?? 1))))} className="press min-h-10 shrink-0 rounded-full bg-walnut px-3 font-ui text-[10px] font-extrabold text-ivory">Restock ›</button> : null}
                </li>)}
              </ul> : null}
            </div>
            <button type="button" onClick={() => go("business-cleanliness")} className="press mt-2 min-h-11 w-full rounded-full border border-walnut/15 bg-ivory/70 font-ui text-[12px] font-extrabold text-copper">Open Cleanliness & Maintenance ›</button>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-2"><div><Eyebrow>🧭 Other checks</Eyebrow><p className="mt-0.5 font-ui text-[11px] text-walnut/60">Supplies, team, cold storage and tools</p></div><span className="font-ui text-[11px] font-bold text-walnut/50">{operationsAlerts} alerts</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => go("business-staff")} className="press min-h-12 rounded-xl border border-walnut/10 bg-ivory/70 px-2 text-left font-ui text-[11.5px] font-extrabold text-walnut-dark">👥 Team <span className="block text-[10px] font-medium text-walnut/55">Review staff cover</span></button>
              <button type="button" onClick={() => go("business-refrigerator")} className="press min-h-12 rounded-xl border border-walnut/10 bg-ivory/70 px-2 text-left font-ui text-[11.5px] font-extrabold text-walnut-dark">❄️ Equipment <span className="block text-[10px] font-medium text-walnut/55">Check fridge and repairs</span></button>
              <button type="button" onClick={() => go("business-cleanliness")} className="press min-h-12 rounded-xl border border-walnut/10 bg-ivory/70 px-2 text-left font-ui text-[11.5px] font-extrabold text-walnut-dark">🧽 Cleaning <span className="block text-[10px] font-medium text-walnut/55">Review all areas</span></button>
              <button type="button" onClick={() => go("inventory-supplies")} className="press min-h-12 rounded-xl border border-walnut/10 bg-ivory/70 px-2 text-left font-ui text-[11.5px] font-extrabold text-walnut-dark">📦 Supplies <span className="block text-[10px] font-medium text-walnut/55">See all stock levels</span></button>
              <button type="button" onClick={() => go("business-suppliers")} className="press min-h-12 rounded-xl border border-walnut/10 bg-ivory/70 px-2 text-left font-ui text-[11.5px] font-extrabold text-walnut-dark">🚚 Suppliers <span className="block text-[10px] font-medium text-walnut/55">Review deliveries & contracts</span></button>
              <button type="button" onClick={() => go("shop")} className="press min-h-12 rounded-xl border border-walnut/10 bg-ivory/70 px-2 text-left font-ui text-[11.5px] font-extrabold text-walnut-dark">🔪 Prep gear <span className="block truncate text-[10px] font-medium text-walnut/55">{equippedKnife.name} · {equippedBoard.name} · {knifeSharpness}% {sharpnessLabel(knifeSharpness)}</span></button>
            </div>
            {missingTools.length > 0 ? (
              <div className="mt-3 rounded-xl border border-tomato/25 bg-tomato/5 p-3">
                <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-tomato">🍳 Tools needed for today’s dishes</p>
                <ul className="mt-2 space-y-2">
                  {missingTools.map((tool) => (
                    <li key={tool.id} className="flex items-center gap-2 font-ui text-[12px] font-bold text-walnut-dark">
                      <span className="min-w-0 flex-1">{tool.label}: {tool.have}/{tool.need}</span>
                      <button type="button" onClick={() => openMarketSupplies(go, "culinary", tool.id, tool.packs)} className="press min-h-11 shrink-0 rounded-full bg-walnut px-3 text-[11px] font-extrabold text-ivory">Get tool ›</button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : plan?.tools.applies ? <p className="mt-3 rounded-xl bg-sage/10 px-3 py-2 font-ui text-[12px] font-bold text-olive">✓ Tools ready</p> : null}
            {plan?.supplies.applies ? (
              <div className="mt-3 rounded-xl border border-walnut/10 bg-ivory/70 p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">🍽️ Next service · cutlery & supplies</p><span className="font-ui text-[10px] font-extrabold text-walnut/55">{plan.supplies.dineIn} dine-in · {plan.supplies.takeaway} takeaway</span></div>
                {plan.supplies.rows.length ? <ul className="mt-2 space-y-1.5">{plan.supplies.rows.map((row) => <li key={`${row.id}-${row.guest ? "guest" : "service"}`} className="flex items-center gap-2 font-ui text-[11.5px]">
                  <span className={`min-w-0 flex-1 ${row.missing ? row.blocking ? "font-bold text-tomato" : "font-bold text-copper" : "text-walnut/70"}`}>{row.missing ? "⚠️" : "✓"} {row.label}: {row.have}/{row.need}{row.guest ? " · optional" : ""}</span>
                  {row.missing ? <button type="button" onClick={() => openMarketSupplies(go, getSupplyItem(row.id)?.section ?? "service", row.id, row.packs)} className="press min-h-10 shrink-0 rounded-full bg-walnut px-3 font-ui text-[10px] font-extrabold text-ivory">Restock ›</button> : null}
                </li>)}</ul> : <p className="mt-2 font-ui text-[11.5px] text-olive">✓ Nothing extra needed</p>}
              </div>
            ) : null}
            {plan?.staff.length ? (
              <div className="mt-3 rounded-xl border border-walnut/10 bg-ivory/70 p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">👩‍🍳 Required team</p><span className="font-ui text-[10px] font-extrabold text-walnut/55">{plan.staff.filter((person) => person.met).length}/{plan.staff.length} ready</span></div>
                <ul className="mt-2 space-y-1">{plan.staff.map((person) => <li key={person.id} className="flex items-start gap-2 font-ui text-[11.5px]"><span>{person.met ? "✓" : "⚠️"}</span><span className={`min-w-0 flex-1 ${person.met ? "text-walnut/70" : "font-bold text-copper"}`}><b>{person.title}</b> <InfoTip label={`Why a ${person.title}`}>{person.why}</InfoTip></span>{!person.met ? <button type="button" onClick={() => go("business-staff")} className="press min-h-10 shrink-0 rounded-full bg-walnut px-3 font-ui text-[10px] font-extrabold text-ivory">Hire ›</button> : null}</li>)}</ul>
              </div>
            ) : null}
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 font-ui text-[12px] text-walnut/60">🔪 Starter knife & board always equipped <InfoTip label="About knives and tools">New knives and boards are optional upgrades; the culinary smallwares listed above are what today’s dishes require.</InfoTip></p>
          </Panel>

          <div className="pb-1"><KButton full variant="sage" onClick={() => go("kitchen")}>Back to today’s service →</KButton></div>
        </div>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
