import { useEffect, useState } from "react";
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
  SPECIALIST_CHEFS,
  halfPay,
  halfWage,
  restaurantStaffOf,
} from "@/game/restaurant/staffRequirements";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { isSystemLive, restaurantSystem } from "@/game/restaurant/restaurantProgression";
import { BusinessSectionBanner } from "./BusinessSectionBanner";
import { specialistCharacter } from "@/game/chefs/chefDefinitions";

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

function StaffPortrait({
  file,
  name,
  className,
}: {
  file: string;
  name: string;
  className: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}business/staff-portraits/${file}.webp`}
      alt={`${name} portrait`}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("select-none object-cover", className)}
    />
  );
}

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
    setMessage(result.ok ? null : "That role is already hired.");
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
            line={`🆓 Free to hire · ½ pay Lv ${HALF_WAGES_FROM} · full Lv ${wagesFrom}`}
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
              ? `🆓 Free to hire · ½ pay at closing until Lv ${wagesFrom}`
              : `🆓 Free until Lv ${HALF_WAGES_FROM} · ½ pay to Lv ${wagesFrom}`}
            {payroll > 0 ? ` · then ${formatUsd(payroll)}/day` : ""}
          </p>
        ) : null}
        <p className="relative mt-1.5 flex items-center gap-1.5 font-hand text-[14px] leading-snug text-walnut/65">
          🌙 Payroll is settled at closing
          <InfoTip label="About pay">
            Hiring is free — pay is charged at End Business Day. If the pay can't be covered, the
            whole team is let go rather than left unpaid.
          </InfoTip>
        </p>
      </Panel>

      {message ? <p className="text-center font-hand text-[16px] text-copper">{message}</p> : null}

      <TeamHeading
        id="restaurant-team-roster"
        title="👩‍🍳 The crew"
        line="Hire the people your next service needs"
      />
      <div className="grid grid-cols-1 gap-2.5 land:grid-cols-2">
        {roster.map((def) => {
          const hired = hiredRoles.includes(def.role);
          return (
            <article
              key={def.role}
              className={cn(
                "product-card grid grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-[20px] border p-2.5 card-warm",
                hired ? "border-olive/35" : "border-walnut/15",
                needed.has(def.role) &&
                  !hired &&
                  "ring-2 ring-copper ring-offset-2 ring-offset-cream",
              )}
              data-staff-role={def.role}
              data-staff-needed={needed.has(def.role) && !hired ? "true" : undefined}
            >
              <div className="relative min-h-[106px] overflow-hidden rounded-[15px] border border-walnut/15 bg-walnut/10">
                <StaffPortrait
                  file={ROLE_PORTRAIT[def.role] ?? "head-chef"}
                  name={def.name}
                  className="h-full min-h-[106px] w-full"
                />
                <span
                  className="absolute bottom-1.5 left-1.5 rounded-full border border-ivory/65 bg-ivory/90 px-1.5 py-0.5 text-[13px] leading-none shadow-soft"
                  aria-hidden
                >
                  {ROLE_ICON[def.role] ?? "🧑‍🍳"}
                </span>
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex min-w-0 items-start gap-1">
                    <p className="min-w-0 font-display text-[15px] font-black leading-tight text-walnut-dark">
                      {def.name}
                    </p>
                    <InfoTip label={`About the ${def.name}`}>
                      {def.description}
                      <span className="mt-1 block text-[12px] text-walnut/60">
                        {formatUsd(def.hourlyWageCents)}/hr × {def.scheduledHours}h + 25% employer
                        cost
                      </span>
                    </InfoTip>
                  </div>
                  {hired ? (
                    <Badge tone="sage">✓ Hired</Badge>
                  ) : needed.has(def.role) ? (
                    <Badge tone="copper">Needed now</Badge>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 font-ui text-[11.5px] leading-snug text-walnut/65">
                  {ROLE_GLANCE[def.role] ?? "🍽️ Supports the restaurant team"}
                </p>
                <p className="mt-auto pt-1.5 font-ui text-[12px] font-extrabold text-copper">
                  {wagesStarted ? (
                    <>
                      {formatUsd(def.salary)}
                      <span className="font-bold text-walnut/60">/day</span>
                    </>
                  ) : (
                    <>
                      {halfWages ? `${formatUsd(halfWage(def.role))}/day now` : "Free now"}
                      <span className="font-bold text-walnut/60">
                        {" "}
                        · {formatUsd(def.salary)}/day from Lv {wagesFrom}
                      </span>
                    </>
                  )}
                </p>
                <div className="pt-2">
                  {hired ? (
                    <KButton
                      full
                      size="sm"
                      variant="ghost"
                      className="min-h-12"
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
                      👋 Hire
                    </KButton>
                  )}
                </div>
              </div>
            </article>
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
 * (restaurant/staffRequirements.ts). Free to hire; from full operation their wage
 * is paid at closing. A chef is hireable once its first cuisine has opened.
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
              One chef per cuisine · free to hire · paid from Lv {wagesFrom}
            </p>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 font-ui text-[11px] font-extrabold text-copper">
            {SPECIALIST_CHEFS.length} chefs
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 land:grid-cols-2">
          {[...SPECIALIST_CHEFS]
            .sort((a, b) => a.firstLevel - b.firstLevel)
            .map((chef) => {
              const open = level >= chef.firstLevel;
              const isHired = hired.has(chef.id);
              const who = specialistCharacter(chef.id);
              const portrait = SPECIALIST_PORTRAIT[chef.id];
              return (
                <article
                  key={chef.id}
                  className={cn(
                    "grid grid-cols-[66px_minmax(0,1fr)] gap-2.5 rounded-[18px] border bg-ivory/75 p-2",
                    isHired
                      ? "border-olive/30"
                      : needed.has(chef.id)
                        ? "border-copper/50"
                        : "border-walnut/12",
                  )}
                  data-specialist={chef.id}
                >
                  <div className="relative min-h-[88px] overflow-hidden rounded-[13px] border border-walnut/15 bg-walnut/10">
                    {who && portrait ? (
                      <StaffPortrait
                        file={portrait}
                        name={who.name}
                        className="h-full min-h-[88px] w-full"
                      />
                    ) : (
                      <span
                        className="grid h-full min-h-[88px] place-items-center text-[30px]"
                        aria-hidden
                      >
                        {who?.portraitEmoji ?? "🧑‍🍳"}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex min-w-0 items-start gap-1">
                        <p className="min-w-0 font-display text-[14px] font-black leading-tight text-walnut-dark">
                          {who?.name ?? "Specialist Chef"}
                        </p>
                        {who ? (
                          <InfoTip label={`About ${who.name}`}>“{who.introLine}”</InfoTip>
                        ) : null}
                      </div>
                      {isHired ? (
                        <Badge tone="sage">✓ Hired</Badge>
                      ) : needed.has(chef.id) ? (
                        <Badge tone="copper">Needed now</Badge>
                      ) : null}
                    </div>
                    <p className="font-ui text-[12px] font-bold text-walnut/75">{chef.title}</p>
                    <p className="mt-1 line-clamp-2 font-ui text-[11px] leading-snug text-walnut/60">
                      {chef.cuisines.join(" · ")}
                    </p>
                    <p className="mt-auto pt-1 font-ui text-[11px] font-extrabold text-copper">
                      {wagesStarted
                        ? `${formatUsd(chef.dailyWage)} / day`
                        : `🆓 Free now · ${formatUsd(chef.dailyWage)}/day from Lv ${wagesFrom}`}
                    </p>
                    <div className="pt-1.5">
                      {!open ? (
                        <Badge tone="locked">Opens Lv {chef.firstLevel}</Badge>
                      ) : isHired ? (
                        <KButton
                          full
                          size="sm"
                          variant="ghost"
                          className="min-h-12"
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
                          👋 Hire
                        </KButton>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </Panel>
  );
}
