import { useEffect, useState } from "react";
import { useUnlockText } from "../navLevel";
import { clearStaffFocus, peekStaffFocus } from "../staffFocus";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { getAllStaffDefinitions, dailyPayroll } from "@/game/business/businessStaff";
import type { BuyStaffResult } from "@/game/economy/StaffManager";
import { KitchenHelpers } from "./KitchenHelpers";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import {
  HALF_WAGES_FROM,
  HIRE_FEE_DAYS,
  SPECIALIST_CHEFS,
  STAFF_HIRE_FROM,
  halfPay,
  halfWage,
  restaurantStaffOf,
  specialistOpensAt,
  staffHireFee,
} from "@/game/restaurant/staffRequirements";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { isSystemLive, restaurantSystem } from "@/game/restaurant/restaurantProgression";
import { BusinessSectionBanner } from "./BusinessSectionBanner";
import { specialistCharacter } from "@/game/chefs/chefDefinitions";
import { StaffCard, StaffPay, StaffPortrait, StaffRow, StaffStatus } from "./StaffCard";

/** A face per role — visual only. */
const ROLE_ICON: Record<string, string> = {
  "prep-cook": "🧑‍🍳",
  "line-cook": "👨‍🍳",
  "head-chef": "👨‍🍳",
  server: "🧑‍💼",
  cleaner: "🧽",
  manager: "📋",
};

/** Portraits are presentation only; staff rules and save state remain data-driven. */
const ROLE_PORTRAIT: Record<string, string> = {
  "prep-cook": "prep-cook",
  "line-cook": "line-cook",
  "head-chef": "head-chef",
  server: "server",
  cleaner: "cleaner",
  manager: "manager",
};

/** Compact summaries for the cards; the full, authoritative text stays behind ⓘ. */
const ROLE_GLANCE: Record<string, string> = {
  "prep-cook": "🛒 3% off ingredients",
  "line-cook": "⭐ +1 popularity / day",
  "head-chef": "⭐ +3 popularity / day",
  server: "⭐ +2 popularity / day",
  cleaner: "🛡️ Inspection · ♻️ 20% less loss",
  manager: "💸 10% off other staff wages",
};

const SPECIALIST_PORTRAIT: Record<string, string> = {
  "mexican-chef": "specialist-mexican",
  "indian-chef": "specialist-indian",
  "mediterranean-chef": "specialist-mediterranean",
  "asian-chef": "specialist-asian",
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
  /** A role or (restaurant build) a specialist chef id; the restaurant's hire also says why it failed. */
  hireStaff: (role: string) => { ok: boolean; reason?: string; fee?: number; onCredit?: boolean };
  fireStaff: (role: string) => { ok: boolean };
  /** The kitchen helpers' one-time hire (App.buyStaff → StaffManager.buyStaff). */
  buyStaff: (id: string) => BuyStaffResult;
}) {
  const u = useUnlockText();
  const [message, setMessage] = useState<string | null>(null);
  // Opened from the Pre-Service Check: the roles that service needs (staffFocus.ts).
  const [needed] = useState(() => new Set(peekStaffFocus() ?? []));
  useEffect(() => {
    if (needed.size === 0) return;
    clearStaffFocus();
    document
      .querySelector("[data-testid=restaurant-team]")
      ?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
  }, [needed]);
  const hiredRoles = save.business.staff.hiredRoles;
  const payroll = dailyPayroll(hiredRoles);
  const roster = getAllStaffDefinitions();

  function handleHire(role: string) {
    const result = hireStaff(role);
    setMessage(
      result.ok
        ? result.onCredit
          ? `💳 Hired on account · ${formatUsd(result.fee ?? 0)} repaid from your next earnings`
          : null
        : result.reason === "insufficientFunds"
          ? notEnoughMoneyText(result.fee ?? 0, save.credits)
          : result.reason === "notYet"
            ? `Hiring opens ${u.when(STAFF_HIRE_FROM)}.`
            : "That role is already hired.",
    );
  }

  function handleFire(role: string) {
    const result = fireStaff(role);
    setMessage(result.ok ? null : "That role isn't hired.");
  }

  // Unified Restaurant: ONE Staff screen in two teams — the Kitchen Upgrades
  // (one-time helpers, permanent, no wages) and the Restaurant Team (waged
  // roles + specialist chefs; pay from full operation). Same data and actions.
  const restaurantTeams = RESTAURANT_MODE;
  // Restaurant build: before full operation no full wage is charged —
  // say so on every card, so "$X/day" doesn't read as a cost today.
  const wagesFrom = restaurantSystem("full-operation").firstLevel;
  const wagesStarted =
    !restaurantTeams || isSystemLive("full-operation", restaurantLevelOf(save.levelProgress));
  // Economy F2 (developer 2026-10-12): half pay at closing from the Prep Cook until full operation.
  const halfWages =
    restaurantTeams && !wagesStarted && restaurantLevelOf(save.levelProgress) >= HALF_WAGES_FROM;
  return (
    <div className="space-y-3">
      <BusinessSectionBanner image="staff-banner.webp" title="Your Restaurant Team" />
      {restaurantTeams ? (
        <>
          <TeamHeading
            id="kitchen-team"
            // F4 (developer 2026-10-12): one-time helpers read as upgrades, not staff.
            title="🔪 Kitchen Upgrades"
            line="🔁 One-time hire · no wages"
          />
          <KitchenHelpers save={save} buyStaff={buyStaff} />
          <TeamHeading
            id="restaurant-team"
            title="🍽️ Restaurant Team"
            line={`💵 One-time hiring fee · ½ pay ${u.lv(HALF_WAGES_FROM)} · full ${u.lv(wagesFrom)}`}
          />
        </>
      ) : null}
      <Panel tone="cream" className="relative isolate overflow-hidden p-4">
        <div
          className="pointer-events-none absolute -right-5 -top-8 select-none text-[96px] opacity-[0.07]"
          aria-hidden="true"
        >
          🧑‍🍳
        </div>
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <Eyebrow>🍽️ Restaurant crew</Eyebrow>
            <p className="mt-1 font-display text-[24px] font-black leading-none text-walnut-dark">
              {formatUsd(wagesStarted ? payroll : halfWages ? halfPay(hiredRoles) : 0)}
              <span className="ml-1 font-hand text-[15px] font-normal text-walnut/65">/ day</span>
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-olive/25 bg-olive/10 px-3 py-1.5 font-ui text-[12px] font-extrabold text-olive">
            {hiredRoles.length} / {roster.length} hired
          </span>
        </div>
        {!wagesStarted ? (
          <p
            className="mt-1 font-ui text-[12.5px] font-extrabold text-olive"
            data-testid="staff-free-until"
          >
            {halfWages
              ? `💵 Hiring fee once · ½ pay at closing · full ${u.lv(wagesFrom)}`
              : `💵 Hiring fee once · ½ pay ${u.lv(HALF_WAGES_FROM)} · full ${u.lv(wagesFrom)}`}
            {payroll > 0 ? ` · then ${formatUsd(payroll)}/day` : ""}
          </p>
        ) : null}
        <p className="relative mt-1.5 flex items-center gap-1.5 font-hand text-[14px] leading-snug text-walnut/65">
          🌙 Payroll is settled at closing
          <InfoTip label="About pay">
            {restaurantTeams
              ? `Each hire pays a one-time fee of ${HIRE_FEE_DAYS} days' full pay. Pay is charged at closing. If the pay can't be covered, the whole team is let go rather than left unpaid.`
              : "Hiring is free — pay is charged at End Business Day. If the pay can't be covered, the whole team is let go rather than left unpaid."}
          </InfoTip>
        </p>
      </Panel>

      {message ? <p className="text-center font-hand text-[16px] text-copper">{message}</p> : null}

      <TeamHeading
        id="restaurant-team-roster"
        title="👩‍🍳 The crew"
        line="Hire the people your next service needs"
      />
      <div className="grid grid-cols-2 gap-2.5">
        {roster.map((def) => {
          const hired = hiredRoles.includes(def.role);
          const isNeeded = needed.has(def.role) && !hired;
          return (
            <StaffCard
              key={def.role}
              data-staff-role={def.role}
              data-staff-needed={isNeeded ? "true" : undefined}
              tone={hired ? "hired" : isNeeded ? "needed" : "plain"}
              portrait={
                <StaffPortrait
                  file={ROLE_PORTRAIT[def.role]}
                  name={def.name}
                  emoji={ROLE_ICON[def.role]}
                  className="h-full w-full"
                />
              }
              status={
                hired ? (
                  <StaffStatus tone="hired">✓ Hired</StaffStatus>
                ) : isNeeded ? (
                  <StaffStatus tone="needed">Needed now</StaffStatus>
                ) : null
              }
              title={def.name}
              info={
                <InfoTip label={`About the ${def.name}`}>
                  {def.description}
                  <span className="mt-1 block text-[12px] text-walnut/60">
                    {formatUsd(def.hourlyWageCents)}/hr × {def.scheduledHours}h + 25% employer cost
                  </span>
                </InfoTip>
              }
              glance={ROLE_GLANCE[def.role] ?? "🍽️ Supports the restaurant team"}
              pay={
                wagesStarted ? (
                  <StaffPay now={`${formatUsd(def.salary)}/day`} />
                ) : (
                  <StaffPay
                    now={halfWages ? `${formatUsd(halfWage(def.role))}/day now` : "No pay yet"}
                    later={`${formatUsd(def.salary)}/day ${u.lv(wagesFrom)}`}
                  />
                )
              }
              action={
                hired ? (
                  <KButton
                    full
                    size="sm"
                    variant="ghost"
                    className="min-h-12 text-tomato"
                    onClick={() => handleFire(def.role)}
                  >
                    🗑️ Let go
                  </KButton>
                ) : (
                  <KButton
                    full
                    size="sm"
                    variant="sage"
                    className="min-h-12"
                    onClick={() => handleHire(def.role)}
                  >
                    {restaurantTeams
                      ? `👋 Hire · ${formatUsd(staffHireFee(def.role) ?? 0)}`
                      : "👋 Hire"}
                  </KButton>
                )
              }
            />
          );
        })}
      </div>
      {restaurantTeams ? (
        <SpecialistChefs save={save} onHire={handleHire} onFire={handleFire} needed={needed} />
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
      <p className="font-hand text-[15px] leading-snug text-walnut/65">{line}</p>
    </div>
  );
}

/**
 * Unified Restaurant (RESTAURANT_MODE): the specialist chefs a cuisine needs
 * (restaurant/staffRequirements.ts). A one-time hiring fee; from full operation their wage
 * is paid at closing. Every chef can be hired from STAFF_HIRE_FROM (Level 5).
 */
function SpecialistChefs({
  save,
  onHire,
  onFire,
  needed = new Set<string>(),
}: {
  save: SaveData;
  onHire: (id: string) => void;
  onFire: (id: string) => void;
  /** Opened from the Pre-Service Check: the chefs that service needs. */
  needed?: ReadonlySet<string>;
}) {
  const u = useUnlockText();
  const level = restaurantLevelOf(save.levelProgress);
  const wagesFrom = restaurantSystem("full-operation").firstLevel;
  const wagesStarted = isSystemLive("full-operation", level);
  const hired = new Set(restaurantStaffOf(save).specialists);
  return (
    <Panel tone="cream" className="overflow-hidden p-3.5 sm:p-4">
      <div data-testid="specialist-chefs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Eyebrow>🌍 Specialist chefs</Eyebrow>
            <p className="mt-1 font-hand text-[14px] leading-snug text-walnut/65">
              One chef per cuisine · hiring fee once · paid {u.lv(wagesFrom)}
            </p>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 font-ui text-[11px] font-extrabold text-copper">
            {SPECIALIST_CHEFS.length} chefs
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {[...SPECIALIST_CHEFS]
            .sort((a, b) => a.firstLevel - b.firstLevel)
            .map((chef) => {
              const open = level >= specialistOpensAt(chef);
              const isHired = hired.has(chef.id);
              const isNeeded = needed.has(chef.id) && !isHired;
              const who = specialistCharacter(chef.id);
              return (
                <StaffRow
                  key={chef.id}
                  data-specialist={chef.id}
                  tone={isHired ? "hired" : isNeeded ? "needed" : open ? "plain" : "locked"}
                  portrait={
                    <StaffPortrait
                      file={who ? SPECIALIST_PORTRAIT[chef.id] : undefined}
                      name={who?.name ?? chef.title}
                      emoji={who?.portraitEmoji ?? "🧑‍🍳"}
                      className="h-full w-full"
                    />
                  }
                  title={who?.name ?? "Specialist Chef"}
                  subtitle={chef.title}
                  status={
                    isHired ? (
                      <StaffStatus tone="hired">✓ Hired</StaffStatus>
                    ) : isNeeded ? (
                      <StaffStatus tone="needed">Needed now</StaffStatus>
                    ) : null
                  }
                  info={
                    who ? <InfoTip label={`About ${who.name}`}>“{who.introLine}”</InfoTip> : null
                  }
                  // One cuisine is already in the title ("Mexican Chef"); several are listed.
                  glance={chef.cuisines.length > 1 ? chef.cuisines.join(" · ") : undefined}
                  pay={
                    wagesStarted ? (
                      <StaffPay now={`${formatUsd(chef.dailyWage)}/day`} />
                    ) : (
                      <StaffPay
                        now="No pay yet"
                        later={`${formatUsd(chef.dailyWage)}/day ${u.lv(wagesFrom)}`}
                      />
                    )
                  }
                  action={
                    !open ? (
                      <Badge tone="locked">{u.badge(specialistOpensAt(chef))}</Badge>
                    ) : isHired ? (
                      <KButton
                        full
                        size="sm"
                        variant="ghost"
                        className="min-h-12 text-tomato"
                        onClick={() => onFire(chef.id)}
                      >
                        🗑️ Let go
                      </KButton>
                    ) : (
                      <KButton
                        full
                        size="sm"
                        variant="sage"
                        className="min-h-12"
                        onClick={() => onHire(chef.id)}
                      >
                        👋 Hire · {formatUsd(staffHireFee(chef.id) ?? 0)}
                      </KButton>
                    )
                  }
                />
              );
            })}
        </div>
      </div>
    </Panel>
  );
}
