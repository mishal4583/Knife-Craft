import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { getAllStaffDefinitions, dailyPayroll } from "@/game/business/businessStaff";
import type { HireStaffResult, FireStaffResult } from "@/game/business/BusinessStaffManager";

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
 * BUSINESS · STAFF tab (Economy V3 Phase 9). Roster, wages and each role's
 * effect come only from `businessStaff.ts` (`getAllStaffDefinitions`,
 * `dailyPayroll` — which already applies the Manager's discount); hiring
 * and letting go are free and immediate, payroll is charged at End
 * Business Day.
 */
export function BusinessStaff({
  save,
  hireStaff,
  fireStaff,
}: {
  save: SaveData;
  hireStaff: (role: string) => HireStaffResult;
  fireStaff: (role: string) => FireStaffResult;
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

  return (
    <div className="space-y-3">
      <Panel tone="cream" className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>🧑‍🍳 Your team</Eyebrow>
          <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
            {hiredRoles.length} / {roster.length} hired
          </span>
        </div>
        <p className="mt-1 font-display text-[22px] font-black leading-none text-walnut-dark">
          {formatUsd(payroll)}
          <span className="font-hand text-[15px] font-normal text-walnut/60"> per day</span>
        </p>
        <p className="mt-1.5 font-hand text-[14px] leading-snug text-walnut/65">
          Hiring is free — pay is charged at End Business Day. If the pay can't be covered, the
          whole team is let go rather than left unpaid.
        </p>
      </Panel>

      {message ? <p className="text-center font-hand text-[15px] text-copper">{message}</p> : null}

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
              <p className="mt-1 font-display text-[14px] font-black leading-tight text-walnut-dark">
                {def.name}
              </p>
              <p className="font-ui text-[12px] font-extrabold text-copper">
                {formatUsd(def.salary)}
                <span className="font-bold text-walnut/60">/day</span>
              </p>
              <p className="mt-1 rounded-[12px] bg-cream/70 px-2 py-1.5 font-hand text-[13px] leading-tight text-walnut-dark">
                {def.description}
              </p>
              <p className="mt-1 font-ui text-[10px] font-bold text-walnut/50">
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
    </div>
  );
}
