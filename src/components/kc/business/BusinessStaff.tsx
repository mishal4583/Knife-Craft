import { useState } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { formatUsd } from "@/game/business/businessCurrency";
import { BottomNav } from "../Kitchen";
import { getAllStaffDefinitions, dailyPayroll } from "@/game/business/businessStaff";
import type { HireStaffResult, FireStaffResult } from "@/game/business/BusinessStaffManager";

/**
 * BUSINESS_STAFF — Economy V3 Phase 9. Business Mode only; reuses
 * `businessStaff.ts`'s own `getAllStaffDefinitions`/`dailyPayroll` as the
 * ONLY source of roster/payroll numbers shown here — never recomputed
 * inline. Hiring/firing are both free and immediate; the real cost is
 * the running payroll total shown at the top.
 */
export function BusinessStaff({
  go,
  save,
  hireStaff,
  fireStaff,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  hireStaff: (role: string) => HireStaffResult;
  fireStaff: (role: string) => FireStaffResult;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const hiredRoles = save.business.staff.hiredRoles;
  const payroll = dailyPayroll(hiredRoles);

  function handleHire(role: string) {
    const result = hireStaff(role);
    if (!result.ok) {
      setMessage("That role is already hired.");
      return;
    }
    setMessage(null);
  }

  function handleFire(role: string) {
    const result = fireStaff(role);
    if (!result.ok) {
      setMessage("That role isn't hired.");
      return;
    }
    setMessage(null);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(125,146,112,0.24),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Staff"
          subtitle="who's running the restaurant"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        <div className="px-4">
          <Panel tone="dark" className="p-4">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
              Daily Payroll
            </p>
            <p className="font-display text-[22px] font-black leading-none text-ivory">
              {formatUsd(payroll)} / day
            </p>
            <p className="mt-1.5 font-hand text-[13px] text-ivory/70">
              Hiring is free — payroll is paid automatically each business day. If you can't cover
              it, the whole staff is let go rather than left unpaid.
            </p>
          </Panel>
        </div>

        {message ? (
          <p className="px-4 pt-2 text-center font-hand text-[14px] text-copper">{message}</p>
        ) : null}

        <div className="px-4 pt-3">
          <div className="flex flex-col gap-2">
            {getAllStaffDefinitions().map((def) => {
              const hired = hiredRoles.includes(def.role);
              return (
                <Panel key={def.role} tone="cream" className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                        {def.name}
                      </p>
                      <p className="font-hand text-[13px] leading-tight text-walnut/60">
                        {def.description}
                      </p>
                      <p className="mt-0.5 font-ui text-[11px] font-bold text-copper">
                        {formatUsd(def.hourlyWageCents)}/hr × {def.scheduledHours}h + 25% employer
                        burden = {formatUsd(def.salary)}/day
                      </p>
                    </div>
                    {hired ? (
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone="sage">Hired</Badge>
                        <KButton size="sm" variant="ghost" onClick={() => handleFire(def.role)}>
                          Let Go
                        </KButton>
                      </div>
                    ) : (
                      <KButton size="sm" onClick={() => handleHire(def.role)}>
                        Hire
                      </KButton>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
