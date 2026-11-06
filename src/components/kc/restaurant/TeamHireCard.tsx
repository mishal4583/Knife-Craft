import { KButton, Panel } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { StaffPortrait } from "../business/StaffCard";
import { staffPortraitFile } from "../business/staffPortraits";
import { formatUsd } from "@/game/money";
import { teamOffers } from "@/game/restaurant/diningHire";
import { TEAM_CARD_FROM } from "@/game/restaurant/serviceHire";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { SaveData } from "@/game/SaveManager";

/**
 * HIRE YOUR TEAM (Phase 10, developer 2026-11-01; moved 2026-11-07): the Server and the Cashier (the billing staff) are hired
 * for good. The FIRST service offers each hire at the moment it is needed (restaurant/serviceHire.ts); this Market card is
 * the later way (Level 2 on), if one was put off. Each hire is a normal paid hire (App.hireStaff: one wallet debit, one
 * ledger entry); the card is gone once both are on the team.
 */
export function TeamHireCard({
  save,
  onHire,
  setNotice,
}: {
  save: SaveData;
  onHire: (role: string) => { ok: boolean; reason?: string; fee?: number };
  setNotice: (text: string) => void;
}) {
  const level = restaurantLevelOf(save.levelProgress);
  const offers = teamOffers(save, level);
  // The first service offers these hires inside it (restaurant/serviceHire.ts); the card is the later, calmer way (Level 2 on).
  if (offers.length === 0 || level < TEAM_CARD_FROM) return null;
  return (
    <div data-testid="team-hire">
      <Panel tone="cream" className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.12em] text-copper">
            🧑‍🤝‍🧑 Hire your team
          </p>
          <InfoTip label="About your team">
            The Server carries the food to the tables. The Cashier makes each customer&apos;s bill,
            takes the parcel orders at the counter and counts the till at night. They stay with you
            for good; they are paid like everyone on the team once wages start.
          </InfoTip>
        </div>
        <ul className="mt-2 space-y-1.5">
          {offers.map((o) => (
            <li
              key={o.role}
              className="flex items-center gap-2 rounded-xl bg-ivory/70 px-2 py-1.5"
              data-team-offer={o.role}
            >
              {/* The person themself (public/business/staff-portraits/), the same picture as their Staff card; the emoji only if it fails to load. */}
              <span
                className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-copper/35 bg-walnut/10"
                data-team-portrait={o.role}
              >
                <StaffPortrait
                  file={staffPortraitFile(o.role)}
                  name={o.name}
                  emoji={o.icon}
                  className="h-full w-full text-[26px]"
                />
              </span>
              <span className="min-w-0 flex-1 font-ui text-[13.5px] font-bold leading-snug text-walnut-dark">
                {o.name}
                <span className="block text-[12px] font-semibold text-walnut/65">{o.job}</span>
              </span>
              <div className="relative shrink-0">
                <KButton
                  size="sm"
                  variant="sage"
                  className="min-h-12 shrink-0"
                  disabled={!o.affordable}
                  onClick={() => {
                    const r = onHire(o.role);
                    setNotice(
                      r.ok
                        ? `✓ ${o.name} hired · ${formatUsd(o.fee)}`
                        : r.reason === "insufficientFunds"
                          ? `✗ ${o.name} · 💸 not enough money`
                          : r.reason === "alreadyHired"
                            ? `✓ ${o.name} is already on your team`
                            : `✗ ${o.name} can't be hired yet`,
                    );
                  }}
                >
                  Hire · {formatUsd(o.fee)}
                </KButton>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
