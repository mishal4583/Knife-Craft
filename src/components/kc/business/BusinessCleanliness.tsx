import { useState } from "react";
import type { ScreenId } from "../data";
import { KButton, Panel } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { CLEANING_TOOL_IDS, getSupplyItem, type SupplyId } from "@/game/business/businessSupplies";
import { supplyUnits } from "@/game/business/BusinessSuppliesManager";
import { BUSINESS_STAFF_CATALOG } from "@/game/business/businessStaff";
import { formatUsd } from "@/game/money";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { restaurantSystem } from "@/game/restaurant/restaurantProgression";
import { bottleView } from "@/game/restaurant/serviceSupplies";
import {
  SPOTLESS_QUALITY_PCT,
  SPOTLESS_QUALITY_STREAK,
  restaurantRecordOf,
} from "@/game/restaurant/serviceReport";
import { isSpotless } from "@/game/restaurant/hygiene";
import {
  AREA_META,
  CLEAN_AREAS,
  CLEANING_FROM_LEVEL,
  STRIP_SUPPLIES,
  areaView,
  cleanlinessOf,
  hasCleaner,
  supplyGauge,
  type AreaView,
  type CleanArea,
  type CleanlinessAction,
  type CleanlinessActionResult,
  type TaskKind,
} from "@/game/restaurant/cleanliness";
import { openMarketSupplies } from "../marketFocus";
import { openStaffFor } from "../staffFocus";

/**
 * RESTAURANT → CLEANLINESS & MAINTENANCE (restaurant build, from Level 21 —
 * developer 2026-10-10). Every number is read from the save
 * (restaurant/cleanliness.ts, serviceSupplies, serviceReport); the only
 * actions are cleaning a task (its supplies, once), cleaning everything it
 * can, the Cleaner's areas and the intro — App applies them
 * (`cleanlinessAction`). No money moves here: "+" opens the exact Market
 * line.
 */
export function BusinessCleanliness({
  go,
  save,
  cleanlinessAction,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  cleanlinessAction: (action: CleanlinessAction) => CleanlinessActionResult | null;
}) {
  const level = restaurantLevelOf(save.levelProgress);
  const st = cleanlinessOf(save);
  const areas = CLEAN_AREAS.map((a) => areaView(save, a, level));
  const open = st.tasks.length;
  const [flash, setFlash] = useState<string | null>(null);
  const [details, setDetails] = useState<CleanArea | null>(null);

  if (level < CLEANING_FROM_LEVEL)
    return (
      <Panel className="p-4 text-center" data-testid="cleanliness-locked">
        <p className="text-[34px]" aria-hidden>
          🧹
        </p>
        <p className="font-display text-[18px] font-black text-walnut-dark">
          Cleanliness opens at Level {CLEANING_FROM_LEVEL}
        </p>
      </Panel>
    );

  function run(action: CleanlinessAction) {
    const r = cleanlinessAction(action);
    if (!r) return;
    if (r.cleaned.length)
      setFlash(`✨ ${r.cleaned.length === 1 ? "Cleaned!" : `${r.cleaned.length} tasks cleaned!`}`);
    else if (r.needs.length)
      setFlash(`Needs ${r.needs.map((id) => getSupplyItem(id)?.name ?? id).join(", ")}`);
    window.setTimeout(() => setFlash(null), 1600);
  }

  return (
    <div className="space-y-3" data-testid="cleanliness">
      {/* Header */}
      <Panel className="flex items-center gap-3 p-3">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-walnut-dark/90 text-[30px] shadow-soft"
          aria-hidden
        >
          🧹
        </span>
        <div className="min-w-0">
          <p className="font-display text-[19px] font-black leading-tight text-walnut-dark">
            Cleanliness &amp; Maintenance
          </p>
          <p className="font-hand text-[15px] leading-snug text-walnut/70">
            👵 “Good food tastes even better in a clean place.”
          </p>
        </div>
      </Panel>

      {/* Ready for service */}
      <ReadyCard areas={areas} open={open} onCleanAll={() => run({ kind: "clean-all" })} />

      {flash ? (
        <p
          className="anim-pop rounded-full bg-sage/90 px-4 py-2 text-center font-ui text-[13.5px] font-extrabold text-ivory shadow-soft"
          role="status"
          data-testid="cleanliness-flash"
        >
          {flash}
        </p>
      ) : null}

      {/* The three areas */}
      {areas.map((v) => (
        <AreaCard
          key={v.area}
          view={v}
          open={details === v.area}
          onToggle={() => setDetails((d) => (d === v.area ? null : v.area))}
          onClean={(task) => run({ kind: "clean", task })}
          onBuy={(id) => openMarketSupplies(go, getSupplyItem(id)?.section ?? "cleaning", id)}
        />
      ))}

      <StaffCard
        save={save}
        go={go}
        level={level}
        onAreas={(a) => run({ kind: "areas", areas: a })}
      />
      <HistoryCard save={save} level={level} />
      <SuppliesCard save={save} go={go} />

      {!st.introSeen ? <Intro onDone={() => run({ kind: "intro-seen" })} /> : null}
    </div>
  );
}

/* ── Ready for service ─────────────────────────────────────────────── */

function ReadyCard({
  areas,
  open,
  onCleanAll,
}: {
  areas: AreaView[];
  open: number;
  onCleanAll: () => void;
}) {
  const ready = areas.every((a) => a.tasks.length === 0);
  return (
    <Panel className="p-3" data-testid="cleanliness-ready">
      <Eyebrow>Today's cleanliness</Eyebrow>
      <ul className="mt-1 space-y-1">
        {areas.map((a) => (
          <li
            key={a.area}
            className="flex min-h-7 items-center justify-between gap-2 font-ui text-[14px] font-bold text-walnut-dark"
            data-ready-area={a.area}
            data-ready={a.tasks.length === 0 ? "ready" : "attention"}
          >
            <span>
              <span aria-hidden>{a.tasks.length === 0 ? "✅" : "❗"}</span>{" "}
              {AREA_META[a.area].title}
            </span>
            <span className={a.tasks.length === 0 ? "text-olive" : "text-tomato"}>
              {a.tasks.length === 0
                ? "Ready"
                : `${a.tasks.length} ${a.tasks.length === 1 ? "task" : "tasks"}`}
            </span>
          </li>
        ))}
      </ul>
      {ready ? (
        <p
          className="mt-2 rounded-2xl bg-sage/90 px-3 py-3 text-center font-ui text-[15px] font-extrabold text-ivory"
          data-testid="cleanliness-all-ready"
        >
          ✨ Ready for service — every area is spotless
        </p>
      ) : (
        <KButton full variant="sage" className="mt-2 min-h-12" onClick={onCleanAll}>
          🧽 Clean everything I can ({open})
        </KButton>
      )}
    </Panel>
  );
}

/* ── An area card ──────────────────────────────────────────────────── */

const SCENE: Record<CleanArea, { bg: string; art: string }> = {
  kitchen: {
    bg: "bg-[linear-gradient(160deg,#5b3a22,#8a5a32_55%,#c98d4c)]",
    art: "🍳 🥘 🔪 🧄",
  },
  dining: {
    bg: "bg-[linear-gradient(160deg,#3f4a2c,#6f7c45_55%,#c9a45c)]",
    art: "🍽️ 🪑 🍷 🪴",
  },
  restroom: {
    bg: "bg-[linear-gradient(160deg,#2f4f4f,#4f7f7a_55%,#b8c9b8)]",
    art: "🚽 🚰 🧻 🪞",
  },
};

function face(meter: number) {
  return meter >= 85 ? "😊" : meter >= 60 ? "😐" : "😟";
}

function AreaCard({
  view,
  open,
  onToggle,
  onClean,
  onBuy,
}: {
  view: AreaView;
  open: boolean;
  onToggle: () => void;
  onClean: (task: TaskKind) => void;
  onBuy: (id: SupplyId) => void;
}) {
  const meta = AREA_META[view.area];
  const tone =
    view.status === "clean" ? "bg-sage" : view.status === "attention" ? "bg-gold" : "bg-tomato";
  return (
    <Panel
      className="overflow-hidden p-0"
      data-testid={`area-${view.area}`}
      data-area-status={view.status}
    >
      <div className={cn("relative px-3 pb-3 pt-2 text-ivory", SCENE[view.area].bg)}>
        <div className="flex items-center gap-2">
          <span className="text-[22px]" aria-hidden>
            {meta.icon}
          </span>
          <p className="font-display text-[19px] font-black">{meta.title}</p>
          <span
            className="ml-auto font-display text-[20px] font-black"
            data-area-meter={view.meter}
          >
            {view.meter}%
          </span>
          <span className="text-[22px]" aria-hidden>
            {face(view.meter)}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/30">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", tone)}
            style={{ width: `${view.meter}%` }}
          />
        </div>
        <p
          className="mt-2 select-none text-center text-[30px] leading-none tracking-[0.2em] opacity-90"
          aria-hidden
        >
          {SCENE[view.area].art}
        </p>
      </div>
      <div
        className="grid gap-1 px-2 pt-3"
        style={{ gridTemplateColumns: `repeat(${view.spots.length}, minmax(0, 1fr))` }}
      >
        {view.spots.map((s) => (
          <div
            key={s.id}
            className="flex flex-col items-center gap-1"
            data-spot={s.id}
            data-spot-status={s.status}
            title={s.note}
          >
            <span className="relative grid h-12 w-12 place-items-center rounded-full border border-walnut/15 bg-ivory text-[22px] shadow-soft">
              <span aria-hidden>{s.icon}</span>
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full font-ui text-[11px] font-black text-ivory",
                  s.status === "ok" ? "bg-sage" : s.status === "todo" ? "bg-gold" : "bg-tomato",
                )}
                aria-label={
                  s.status === "ok" ? "clean" : s.status === "todo" ? "to clean" : "needs supplies"
                }
              >
                {s.status === "ok" ? "✓" : "!"}
              </span>
            </span>
            <span className="text-center font-ui text-[11.5px] font-bold leading-tight text-walnut/80">
              {s.label}
            </span>
          </div>
        ))}
      </div>
      <div className="p-3 pt-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="press wood min-h-12 w-full rounded-full font-ui text-[14px] font-extrabold text-ivory shadow-soft"
        >
          {open
            ? "Hide details ‹"
            : view.tasks.length
              ? `View details · ${view.tasks.length} to do ›`
              : "View details ›"}
        </button>
        {open ? (
          <div className="anim-up mt-2 space-y-2" data-testid={`area-details-${view.area}`}>
            {view.tasks.length === 0 ? (
              <p className="text-center font-ui text-[13.5px] font-bold text-olive">
                ✨ Nothing to clean here.
              </p>
            ) : null}
            {view.tasks.map((t) => (
              <div
                key={t.kind}
                className="rounded-2xl border border-walnut/12 bg-ivory/80 p-2"
                data-task={t.kind}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[22px]" aria-hidden>
                    {t.rule.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-[14px] font-extrabold leading-tight text-walnut-dark">
                      {t.rule.label}
                      {t.count > 1 ? ` ×${t.count}` : ""}
                    </p>
                    <p className="font-ui text-[12px] text-walnut/65">
                      Uses{" "}
                      {t.rule.uses.map((u) => getSupplyItem(u.id)?.name.split(" ·")[0]).join(", ")}
                      {t.rule.routine ? "" : " · not a Cleaner's job"}
                    </p>
                  </div>
                  <KButton
                    size="sm"
                    variant={t.needs.length ? "cream" : "sage"}
                    className="min-h-12 shrink-0"
                    disabled={t.needs.length > 0}
                    onClick={() => onClean(t.kind)}
                  >
                    Clean
                  </KButton>
                </div>
                {t.needs.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.needs.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onBuy(id)}
                        data-need={id}
                        className="press min-h-12 rounded-full bg-tomato/90 px-3 font-ui text-[12.5px] font-extrabold text-ivory"
                      >
                        Buy {getSupplyItem(id)?.name.split(" ·")[0]} ›
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {view.spots
              .filter((s) => s.note)
              .map((s) => (
                <p key={s.id} className="font-ui text-[12.5px] text-walnut/70">
                  {s.icon} {s.note}
                </p>
              ))}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

/* ── Cleaning staff ────────────────────────────────────────────────── */

function StaffCard({
  save,
  go,
  level,
  onAreas,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
  level: number;
  onAreas: (areas: CleanArea[]) => void;
}) {
  const hired = hasCleaner(save);
  const st = cleanlinessOf(save);
  const wagesFrom = restaurantSystem("full-operation").firstLevel;
  const wage = BUSINESS_STAFF_CATALOG.cleaner.salary;
  return (
    <Panel className="p-3" data-testid="cleanliness-staff">
      <Eyebrow>Cleaning staff</Eyebrow>
      <div className="mt-2 flex items-center gap-3">
        <span
          className={cn(
            "grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-[34px] shadow-soft",
            hired ? "bg-sage/25" : "bg-walnut/10 grayscale",
          )}
          aria-hidden
        >
          🧑‍🔧
        </span>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 font-ui text-[11px] font-extrabold text-ivory",
              hired ? "bg-sage" : "bg-walnut/50",
            )}
          >
            {hired ? "On duty" : "Not hired"}
          </span>
          <p className="font-display text-[17px] font-black text-walnut-dark">Cleaner</p>
          <p className="font-ui text-[12.5px] text-walnut/70">
            {level < wagesFrom
              ? `Free until Level ${wagesFrom}, then ${formatUsd(wage)}/day`
              : `${formatUsd(wage)}/day`}{" "}
            · cleans the routine tasks after each service
          </p>
        </div>
      </div>
      {hired ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="The Cleaner's areas">
          {CLEAN_AREAS.map((a) => {
            const on = st.cleanerAreas.includes(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                data-cleaner-area={a}
                onClick={() =>
                  onAreas(on ? st.cleanerAreas.filter((x) => x !== a) : [...st.cleanerAreas, a])
                }
                className={cn(
                  "press min-h-12 rounded-full border px-3 font-ui text-[13px] font-extrabold",
                  on
                    ? "wood border-walnut-dark/50 text-ivory"
                    : "card-warm border-walnut/20 text-walnut-dark",
                )}
              >
                {on ? "✓ " : ""}
                {AREA_META[a].title}
              </button>
            );
          })}
        </div>
      ) : null}
      <KButton
        full
        variant={hired ? "cream" : "wood"}
        className="mt-2 min-h-12"
        onClick={() => openStaffFor(go, ["cleaner"])}
      >
        {hired ? "Manage the team ›" : "Hire a Cleaner ›"}
      </KButton>
      <p className="mt-1 font-ui text-[12px] text-walnut/60">
        Spills, and anything short of supplies, stay yours.
      </p>
    </Panel>
  );
}

/* ── Recent history + inspection ───────────────────────────────────── */

function HistoryCard({ save, level }: { save: SaveData; level: number }) {
  const rec = restaurantRecordOf(save);
  const inspections = restaurantSystem("full-operation").firstLevel;
  const dots = Array.from({ length: SPOTLESS_QUALITY_STREAK }, (_, i) => i < rec.streak);
  const last = rec.lastHygiene;
  return (
    <Panel className="p-3" data-testid="cleanliness-history">
      <Eyebrow>Recent history</Eyebrow>
      <div className="mt-2 flex items-center gap-2">
        {dots.map((on, i) => (
          <span
            key={i}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border-2 font-ui text-[16px] font-black",
              on ? "border-sage bg-sage text-ivory" : "border-walnut/25 text-walnut/30",
            )}
            aria-hidden
          >
            ✓
          </span>
        ))}
        <p
          className="ml-1 font-ui text-[13.5px] font-bold leading-tight text-walnut-dark"
          data-testid="cleanliness-streak"
        >
          {rec.streak >= SPOTLESS_QUALITY_STREAK
            ? `✨ ${rec.streak} spotless in a row · +${SPOTLESS_QUALITY_PCT * 100}% dish quality`
            : `${rec.streak} / ${SPOTLESS_QUALITY_STREAK} spotless → +${SPOTLESS_QUALITY_PCT * 100}% dish quality`}
        </p>
      </div>
      {last ? (
        <p className="mt-1 font-ui text-[12.5px] text-walnut/70">
          Last service: {isSpotless(last) ? "✨ spotless" : "🧽 not spotless"} · best streak{" "}
          {rec.bestStreak}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-2 rounded-2xl bg-walnut-dark/90 p-2 text-ivory">
        <span className="text-[24px]" aria-hidden>
          🛡️
        </span>
        <p className="font-ui text-[12.5px] font-bold leading-snug">
          {level >= inspections
            ? "The inspector checks every closing: leave tasks undone and it warns — repeated warnings are fined. A Cleaner on staff passes."
            : `Inspections start at Level ${inspections}. Keep every area clean.`}
        </p>
      </div>
    </Panel>
  );
}

/* ── Supplies strip ────────────────────────────────────────────────── */

/** Short names for the strip's narrow tiles (the Market card keeps the full name). */
const SHORT_NAME: Partial<Record<SupplyId, string>> = {
  "floor-cleaner": "Floor cleaner",
  disinfectant: "Sanitizer",
  "hand-soap": "Hand soap",
  "toilet-paper": "Toilet paper",
  "paper-towels": "Hand towels",
  "sponges-cloths": "Cloths",
  "bin-liners": "Bin liners",
  "dish-soap": "Dish soap",
  "cleaning-liquid": "Cleaner",
};

function SuppliesCard({ save, go }: { save: SaveData; go: (s: ScreenId) => void }) {
  const soap = bottleView(save, "dish-soap");
  const liquid = bottleView(save, "cleaning-liquid");
  const bottles = [
    {
      id: "dish-soap" as SupplyId,
      label: `${soap.servicesLeft} washes`,
      fill: Math.min(1, soap.servicesLeft / 20),
      low: soap.status !== "ok",
    },
    {
      id: "cleaning-liquid" as SupplyId,
      label: `${liquid.servicesLeft} closings`,
      fill: Math.min(1, liquid.servicesLeft / 10),
      low: liquid.status !== "ok",
    },
  ];
  const items = [
    ...STRIP_SUPPLIES.map((id) => {
      const g = supplyGauge(save, id);
      return { id, label: `${g.uses} ${g.uses === 1 ? "use" : "uses"}`, fill: g.fill, low: g.low };
    }),
    ...bottles,
  ];
  return (
    <Panel className="p-3" data-testid="cleanliness-supplies">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Cleaning supplies</Eyebrow>
        <button
          type="button"
          onClick={() => openMarketSupplies(go, "cleaning")}
          className="press min-h-12 rounded-full bg-copper px-3 font-ui text-[13px] font-extrabold text-ivory shadow-soft"
        >
          🛒 Market
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {items.map((it) => {
          const item = getSupplyItem(it.id)!;
          return (
            <button
              type="button"
              key={it.id}
              data-clean-supply={it.id}
              data-low={it.low ? "true" : "false"}
              aria-label={`Buy ${item.name}`}
              onClick={() => openMarketSupplies(go, item.section, it.id)}
              className={cn(
                "press relative flex min-h-12 items-center gap-1.5 rounded-2xl border bg-ivory/80 p-2 pr-7 text-left",
                it.low ? "border-tomato/50" : "border-walnut/12",
              )}
            >
              <span className="text-[20px]" aria-hidden>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-ui text-[12.5px] font-extrabold text-walnut-dark">
                  {SHORT_NAME[it.id] ?? item.name.split(" ·")[0]}
                </span>
                <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-walnut/15">
                  <span
                    className={cn("block h-full rounded-full", it.low ? "bg-tomato" : "bg-sage")}
                    style={{ width: `${Math.round(it.fill * 100)}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "block font-ui text-[11px] font-bold",
                    it.low ? "text-tomato" : "text-walnut/60",
                  )}
                >
                  {it.low ? "Low · " : ""}
                  {it.label}
                </span>
              </span>
              <span
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-gold/40 font-display text-[16px] font-black leading-none text-walnut-dark"
                aria-hidden
              >
                +
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" data-testid="cleanliness-tools">
        {CLEANING_TOOL_IDS.map((id) => {
          const item = getSupplyItem(id)!;
          const owned = supplyUnits(save.business.supplies, id) > 0;
          return (
            <button
              key={id}
              type="button"
              data-clean-tool={id}
              data-owned={owned ? "true" : "false"}
              onClick={() => (owned ? undefined : openMarketSupplies(go, "cleaning", id))}
              className={cn(
                "press min-h-12 rounded-full border px-3 font-ui text-[12.5px] font-extrabold",
                owned
                  ? "border-sage/40 bg-sage/15 text-olive"
                  : "border-tomato/40 bg-tomato/10 text-tomato",
              )}
            >
              {item.icon} {item.name.split(" ·")[0]} {owned ? "✓" : "· Buy"}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── The guided introduction (once) ────────────────────────────────── */

const INTRO_STEPS: readonly { icon: string; title: string; line: string }[] = [
  {
    icon: "🏠",
    title: "Three areas",
    line: "Kitchen, Dining Area and Restroom. Each service leaves cleaning in all three.",
  },
  {
    icon: "🧽",
    title: "Clean the tasks",
    line: "Tap Clean: each task uses its real supplies once. Spotless before the next service builds your streak.",
  },
  {
    icon: "🛒",
    title: "Keep supplies in",
    line: "Floor cleaner, sanitizer, restroom refills and liners come from the Market — tap + to restock.",
  },
  {
    icon: "🧑‍🔧",
    title: "Your Cleaner",
    line: "Hire one and they do the routine tasks after each service. 3 spotless services = +1% dish quality.",
  },
];

function Intro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = INTRO_STEPS[step]!;
  const last = step === INTRO_STEPS.length - 1;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      data-testid="cleanliness-intro"
    >
      <div className="absolute inset-0 bg-walnut-dark/55" aria-hidden />
      <Panel className="anim-up relative w-full max-w-[420px] p-4 text-center">
        <p className="text-[40px]" aria-hidden>
          {s.icon}
        </p>
        <p className="font-display text-[20px] font-black text-walnut-dark">{s.title}</p>
        <p className="mt-1 font-ui text-[14px] leading-snug text-walnut/80">{s.line}</p>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {INTRO_STEPS.map((_, i) => (
            <span
              key={i}
              className={cn("h-2 w-2 rounded-full", i === step ? "bg-copper" : "bg-walnut/20")}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <KButton variant="cream" className="min-h-12 flex-1" onClick={onDone}>
            Skip
          </KButton>
          <KButton
            className="min-h-12 flex-1"
            onClick={() => (last ? onDone() : setStep(step + 1))}
          >
            {last ? "Got it" : "Next ›"}
          </KButton>
        </div>
      </Panel>
    </div>
  );
}
