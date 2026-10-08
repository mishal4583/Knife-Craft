import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { getAllStaffDefinitions, dailyPayroll } from "@/game/business/businessStaff";
import type { BuyStaffResult } from "@/game/economy/StaffManager";
import { KitchenHelpers } from "./KitchenHelpers";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { SPECIALIST_CHEFS, restaurantStaffOf } from "@/game/restaurant/staffRequirements";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";

/** A face per role — visual only. */
const ROLE_ICON: Record<string, string> = {
  "prep-cook": "🧑‍🍳",
  "line-cook": "👨‍🍳",
  "head-chef": "👩‍🍳",
  server: "🧑‍💼",
  cleaner: "🧽",
  manager: "📋",
};

/**
 * BUSINESS · STAFF tab (Economy V3 Phase 9) — all of the restaurant's
 * staff: the waged team below, then the one-time kitchen helpers
 * (KitchenHelpers, moved here from the Market). Roster, wages and each role's
 * effect come only from `businessStaff.ts` (`getAllStaffDefinitions`,
 * `dailyPayroll` — which already applies the Manager's discount); hiring
 * and letting go are free and immediate, payroll is charged at End
 * Business Day.
 */
export function BusinessStaff({
  save,
  hireStaff,
  fireStaff,
  buyStaff,
}: {
  save: SaveData;
  /** A role or (restaurant build) a specialist chef id; only `ok` is read. */
  hireStaff: (role: string) => { ok: boolean };
  fireStaff: (role: string) => { ok: boolean };
  /** The kitchen helpers' one-time hire (App.buyStaff → StaffManager.buyStaff). */
  buyStaff: (id: string) => BuyStaffResult;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const hiredRoles = save.business.staff.hiredRoles;
  const payroll = dailyPayroll(hiredRoles);
  const roster = getAllStaffDefinitions();

  function handleHire(role: string) {
    const result = hireStaff(role);
    setMessage(result.ok ? null : "That role is already hired.");
  }

  function handleFire(role: string) {
    const result = fireStaff(role);
    setMessage(result.ok ? null : "That role isn't hired.");
  }

  // Unified Restaurant: ONE Staff screen in two teams — the Kitchen Team
  // (one-time helpers, permanent, no wages) and the Restaurant Team (waged
  // roles + specialist chefs; pay from Level 91). Same data and actions.
  const restaurantTeams = RESTAURANT_MODE;
  return (
    <div className="space-y-3">
      {restaurantTeams ? (
        <>
          <TeamHeading
            id="kitchen-team"
            title="🔪 Kitchen Team"
            line="One-time hires that stay for good — no wages."
          />
          <KitchenHelpers save={save} buyStaff={buyStaff} />
          <TeamHeading
            id="restaurant-team"
            title="🍽️ Restaurant Team"
            line="Waged staff. Hiring is free; from Level 91 their pay is charged at closing."
          />
        </>
      ) : null}
      <Panel tone="cream" className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>🧑‍🍳 Your team</Eyebrow>
          <span className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
            {hiredRoles.length} / {roster.length} hired
          </span>
        </div>
        <p className="mt-1 font-display text-[22px] font-black leading-none text-walnut-dark">
          {formatUsd(payroll)}
          <span className="font-hand text-[17px] font-normal text-walnut/60"> per day</span>
        </p>
        <p className="mt-1.5 font-hand text-[16px] leading-snug text-walnut/65">
          Hiring is free — pay is charged at End Business Day. If the pay can't be covered, the
          whole team is let go rather than left unpaid.
        </p>
      </Panel>

      {message ? <p className="text-center font-hand text-[17px] text-copper">{message}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        {roster.map((def) => {
          const hired = hiredRoles.includes(def.role);
          return (
            <article
              key={def.role}
              className={cn(
                "product-card flex flex-col rounded-[20px] border p-3 card-warm",
                hired ? "border-olive/40" : "border-walnut/15",
              )}
            >
              <div className="flex items-start justify-between">
                <span className="text-[34px] leading-none" aria-hidden>
                  {ROLE_ICON[def.role] ?? "🧑‍🍳"}
                </span>
                {hired ? <Badge tone="sage">Hired</Badge> : null}
              </div>
              <p className="mt-1 font-display text-[15.5px] font-black leading-tight text-walnut-dark">
                {def.name}
              </p>
              <p className="font-ui text-[13.5px] font-extrabold text-copper">
                {formatUsd(def.salary)}
                <span className="font-bold text-walnut/60">/day</span>
              </p>
              <p className="mt-1 rounded-[12px] bg-cream/70 px-2 py-1.5 font-hand text-[15px] leading-tight text-walnut-dark">
                {def.description}
              </p>
              <p className="mt-1 font-ui text-[11.5px] font-bold text-walnut/50">
                {formatUsd(def.hourlyWageCents)}/hr × {def.scheduledHours}h + 25% employer cost
              </p>
              <div className="mt-auto pt-2">
                {hired ? (
                  <KButton full variant="ghost" onClick={() => handleFire(def.role)}>
                    Let go
                  </KButton>
                ) : (
                  <KButton full onClick={() => handleHire(def.role)}>
                    Hire
                  </KButton>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {restaurantTeams ? (
        <SpecialistChefs save={save} onHire={handleHire} onFire={handleFire} />
      ) : (
        <KitchenHelpers save={save} buyStaff={buyStaff} />
      )}
    </div>
  );
}

/** A team's heading on the unified Staff screen (restaurant build). */
function TeamHeading({ id, title, line }: { id: string; title: string; line: string }) {
  return (
    <div className="px-1 pt-1" data-testid={id}>
      <p className="font-display text-[18px] font-black text-walnut-dark">{title}</p>
      <p className="font-hand text-[16px] leading-snug text-walnut/65">{line}</p>
    </div>
  );
}

/**
 * Unified Restaurant (RESTAURANT_MODE): the specialist chefs a cuisine needs
 * (restaurant/staffRequirements.ts). Free to hire; from Level 91 their wage
 * is paid at closing. A chef is hireable once its first cuisine has opened.
 */
function SpecialistChefs({
  save,
  onHire,
  onFire,
}: {
  save: SaveData;
  onHire: (id: string) => void;
  onFire: (id: string) => void;
}) {
  const level = restaurantLevelOf(save.levelProgress);
  const hired = new Set(restaurantStaffOf(save).specialists);
  return (
    <Panel className="p-4">
      <div data-testid="specialist-chefs">
        <Eyebrow>🌍 Specialist chefs</Eyebrow>
        <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/65">
          Each new cuisine needs its own chef. Hiring is free; from Level 91 their pay is charged at
          closing.
        </p>
        <ul className="mt-2 divide-y divide-walnut/10">
          {SPECIALIST_CHEFS.map((chef) => {
            const open = level >= chef.firstLevel;
            const isHired = hired.has(chef.id);
            return (
              <li
                key={chef.id}
                className="flex min-h-12 items-center gap-2 py-2"
                data-specialist={chef.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-ui text-[15.5px] font-bold text-walnut-dark">
                    {chef.title} {isHired ? <Badge tone="sage">Hired</Badge> : null}
                  </p>
                  <p className="font-ui text-[13.5px] text-walnut/60">
                    {chef.cuisines.join(" · ")} · {formatUsd(chef.dailyWage)}/day
                  </p>
                </div>
                {!open ? (
                  <span className="font-ui text-[13.5px] font-bold text-walnut/50">
                    Level {chef.firstLevel}
                  </span>
                ) : isHired ? (
                  <KButton
                    size="sm"
                    variant="ghost"
                    className="min-h-12"
                    onClick={() => onFire(chef.id)}
                  >
                    Let go
                  </KButton>
                ) : (
                  <KButton size="sm" className="min-h-12" onClick={() => onHire(chef.id)}>
                    Hire
                  </KButton>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
