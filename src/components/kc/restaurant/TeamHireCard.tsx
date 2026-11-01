import { KButton, Panel } from "../common/primitives";
import { PointerHand } from "../common/PointerHand";
import { firstRunHand } from "@/game/restaurant/firstRunGuide";
import { InfoTip } from "../common/InfoTip";
import { formatUsd } from "@/game/money";
import { teamOffers } from "@/game/restaurant/diningHire";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import type { SaveData } from "@/game/SaveManager";

/**
 * HIRE YOUR TEAM (Phase 10, developer 2026-11-01): the Server and the Cashier (the billing staff) are hired for good
 * in the first shop, with the opening cash that pays their fees (config/startingTeam.ts). Each hire is a normal
 * paid hire (App.hireStaff: one wallet debit, one ledger entry); the card is gone once both are on the team.
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
  const offers = teamOffers(save, restaurantLevelOf(save.levelProgress));
  if (offers.length === 0) return null;
  // The first-run hand: on the first Hire button (the team is hired before the food is bought) (restaurant/firstRunGuide.ts).
  const handRole =
    firstRunHand(save, "market")?.step === "hire" ? offers.find((o) => o.affordable)?.role : null;
  return (
    <div data-testid="team-hire">
      <Panel tone="cream" className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.12em] text-copper">
            🧑‍🤝‍🧑 Hire your team
          </p>
          {handRole ? (
            <span className="font-hand text-[15px] text-copper" data-testid="first-run-hire-hint">
              1️⃣ Tap Hire
            </span>
          ) : null}
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
              <span className="text-[26px]" aria-hidden>
                {o.icon}
              </span>
              <span className="min-w-0 flex-1 font-ui text-[13.5px] font-bold leading-snug text-walnut-dark">
                {o.name}
                <span className="block text-[12px] font-semibold text-walnut/65">{o.job}</span>
              </span>
              <div className="relative shrink-0">
                {handRole === o.role ? (
                  <span
                    data-testid="first-run-hand"
                    data-hand-for={`hire-${o.role}`}
                    className="pointer-events-none absolute right-full top-1/2 z-10 mr-0.5 -translate-y-1/2 rotate-90"
                  >
                    <PointerHand size={38} />
                  </span>
                ) : null}
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
