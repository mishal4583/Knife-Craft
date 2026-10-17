/**
 * THE PAR AUDIT (a real restaurant's day, plan F4 — developer 2026-10-11:
 * "culinary smallwares and replacement cutlery: checked once a month …
 * against a par level, e.g. 2.5 sets of cutlery per dining seat";
 * answer: the "month" is AUDIT_EVERY = 14 restaurant days).
 *
 * On an audit day (from AUDIT_FROM, dine-in) the opening card counts the
 * tableware against its par and the kitchen tools against what the menu's
 * dishes need — from what is actually owned (broken pieces have already
 * left the stock; dirty ones are still owned) — and lists what's short,
 * with "Buy" to the exact Market line. Read-only: nothing is bought or
 * moved here (the Market and the standing orders do that); Inventory stays
 * read-only. Pure; no randomness; never reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import { SUPPLY_CATALOG, type SupplyId } from "../business/businessSupplies";
import { supplyUnits } from "../business/BusinessSuppliesManager";
import { restaurantDayOf } from "./restaurantDay";
import { kitchenGuestSeats } from "./restaurantInvestments";
import { SERVICE_SUPPLY_RULES, tablesFor } from "./serviceSupplies";
import { levelRecipesAt, toolsCheck } from "./kitchenTools";
import { remapCampaignThreshold } from "../levels/campaignSelection";

export const AUDIT_EVERY = 14;
/**
 * With dine-in (old L31 → new L21). 2026-10-17 audit: it had stayed at the raw
 * 31, so on L21–30 the dining deep clean ran "on the audit day" with no audit.
 */
export const AUDIT_FROM = remapCampaignThreshold(31);
/** Settings of each piece per dining seat (a real restaurant's par, 2.5). */
export const PAR_PER_SEAT = 2.5;
/** The fewest seats an audit counts (the first tables). */
const MIN_SEATS = 4;

export const isAuditDay = (day: number) => day > 0 && day % AUDIT_EVERY === 0;

export type AuditRow = { id: SupplyId; par: number; have: number; short: number };

export type ParAudit = {
  day: number;
  seats: number;
  tableware: AuditRow[];
  tools: AuditRow[];
  /** Total pieces short across the audit. */
  short: number;
};

/** The audit for today (null when today isn't an audit day, or before dine-in). */
export function parAuditFor(save: SaveData, levelNumber: number): ParAudit | null {
  const day = restaurantDayOf(save).day;
  if (levelNumber < AUDIT_FROM || !isAuditDay(day)) return null;
  return parAudit(save, levelNumber);
}

/** The par audit itself (read-only; any day — the Cleanliness / Inventory views may show it). */
export function parAudit(save: SaveData, levelNumber: number): ParAudit {
  const stock = save.business.supplies;
  const seats = Math.min(
    SERVICE_SUPPLY_RULES.maxTables * SERVICE_SUPPLY_RULES.coversPerTable,
    Math.max(MIN_SEATS, kitchenGuestSeats(save)),
  );
  const tables = tablesFor(seats);
  const tableAccessory = new Map(SERVICE_SUPPLY_RULES.tablePieces.map((t) => [t.id, t]));
  const settingPieces = new Set<SupplyId>([...SERVICE_SUPPLY_RULES.placeSetting, "water-glasses"]);
  const tableware: AuditRow[] = [];
  for (const item of SUPPLY_CATALOG) {
    if (item.section !== "service") continue;
    const have = supplyUnits(stock, item.id);
    const accessory = tableAccessory.get(item.id);
    let par = 0;
    if (accessory) {
      if (levelNumber >= accessory.fromLevel) par = tables * accessory.perTable;
    } else if (settingPieces.has(item.id) || have > 0) {
      // The plain setting and the glasses always; other pieces once the menu has made them part of the kit.
      par = Math.ceil(PAR_PER_SEAT * seats);
    }
    if (par === 0) continue;
    tableware.push({ id: item.id, par, have, short: Math.max(0, par - have) });
  }
  const kit = toolsCheck(save, levelNumber, levelRecipesAt(levelNumber));
  const tools: AuditRow[] = kit.applies
    ? kit.rows.map((r) => ({
        id: r.id,
        par: r.need,
        have: r.have,
        short: Math.max(0, r.need - r.have),
      }))
    : [];
  const short = [...tableware, ...tools].reduce((n, r) => n + r.short, 0);
  return { day: restaurantDayOf(save).day, seats, tableware, tools, short };
}
