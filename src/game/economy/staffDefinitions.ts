/**
 * STAFF_DEFINITIONS — the single authoritative Staff catalog (Economy V2
 * Phase 7), mirroring kitchenInvestmentDefinitions.ts's own shape/doc
 * style. A SEPARATE, NEW category from Kitchen Investments (QoL/
 * cosmetic, Phase 4) and from src/game/chefs/ (narrative cuisine-arc
 * chefs — CONFIRMED unrelated by direct inspection: chefTypes.ts's own
 * doc explicitly forbids attaching any stat/speed/payment bonus to a
 * chef, so that system is never reused or touched here).
 *
 * Exactly 3 roles, no more, per the Phase 7 brief. No "equipped" state —
 * unlike knives/boards, a player may own and benefit from all three
 * simultaneously (staff.ts's getStaffModifier sums every OWNED staff
 * member's applicable effect, capped — see that file's own doc).
 * Purchase-only: no salary, no recurring cost of any kind (Phase 7
 * brief §13 — Kitchen Investment upkeep remains the only recurring
 * operating-cost model; Staff never introduces a second one).
 */
import { dollars } from "../money";
import { remapCampaignThreshold } from "../levels/campaignSelection";

export type StaffDefinition = {
  id: string;
  name: string;
  description: string;
  price: number;
  unlockLevel: number;
};

const SOURCE_STAFF_CATALOG: StaffDefinition[] = [
  {
    id: "prep-assistant",
    name: "Prep Assistant",
    description: "Cuts down ingredient waste across every recipe.",
    price: dollars(3000),
    unlockLevel: 20,
  },
  {
    id: "quality-chef",
    name: "Quality Chef",
    description: "A steady hand that keeps every plate a little more consistent.",
    price: dollars(6000),
    unlockLevel: 45,
  },
  {
    id: "kitchen-assistant",
    name: "Kitchen Assistant",
    description: "Extra hands for shared, batch-style preparation.",
    price: dollars(4000),
    unlockLevel: 65,
  },
];

export const STAFF_CATALOG: StaffDefinition[] = SOURCE_STAFF_CATALOG.map((staff) => ({
  ...staff,
  unlockLevel: remapCampaignThreshold(staff.unlockLevel),
}));

export function getStaffMember(id: string): StaffDefinition | undefined {
  return STAFF_CATALOG.find((s) => s.id === id);
}

export function getAllStaff(): StaffDefinition[] {
  return STAFF_CATALOG;
}
