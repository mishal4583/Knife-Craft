import { useRef, useState } from "react";
import type { ScreenId } from "./data";
import { BottomNav } from "./Kitchen";
import { Bar, Eyebrow } from "./common/Meters";
import { Coin, KButton, Panel, ScreenHeader } from "./common/primitives";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { formatUsd } from "@/game/money";
import {
  achievementsFor,
  collectableTotal,
  type Achievement,
  type AchievementGroup,
  type CollectResult,
} from "@/game/progression/achievements";

/**
 * Achievements (economy plan, developer 2026-10-16): every achievement comes
 * from real saved progress and pays its reward once — tap Collect. The
 * money rules live in game/progression/achievements.ts; this view only
 * shows them. The Family Legacy pays by itself at Level 150.
 */
const GROUPS: { name: AchievementGroup; icon: string }[] = [
  { name: "Restaurant", icon: "🏆" },
  { name: "Kitchen", icon: "👨‍🍳" },
  { name: "Service", icon: "🧽" },
  { name: "Business", icon: "📈" },
];

/** The list's filter (the ready ones always sit at the top, in their own section). */
type Filter = "all" | "progress" | "earned";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "progress", label: "In progress" },
  { id: "earned", label: "Earned" },
];

const isReady = (a: Achievement) => a.reached && !a.claimed && !a.automatic && a.reward > 0;
const isDone = (a: Achievement) => a.reached && !isReady(a);
/** Closest first: in progress by how far along, then not started, then the earned ones. */
const rank = (a: Achievement) => (isDone(a) ? 2 : a.value > 0 ? 0 : 1);
const byProgress = (a: Achievement, b: Achievement) =>
  rank(a) - rank(b) || b.value / b.target - a.value / a.target;

export function Achievements({
  go,
  save,
  onCollect,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onCollect: (id: string) => CollectResult;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const readyRef = useRef<HTMLElement | null>(null);
  const achievements = achievementsFor(save);
  const unlocked = achievements.filter((a) => a.reached).length;
  const waiting = collectableTotal(save);
  const ready = achievements.filter(isReady);
  const next = achievements
    .filter((a) => !a.reached && a.target > 1)
    .sort((a, b) => b.value / b.target - a.value / a.target)[0];

  const collect = (id: string, title: string) => {
    const r = onCollect(id);
    setNote(r.ok ? `${title}: collected ${formatUsd(r.amount)}` : null);
  };
  // Each one is its own collect (one ledger entry each); App builds on the latest save.
  const collectAll = () => {
    let total = 0;
    let n = 0;
    for (const a of ready) {
      const r = onCollect(a.id);
      if (r.ok) {
        total += r.amount;
        n += 1;
      }
    }
    setNote(n > 0 ? `✓ Collected ${n} · ${formatUsd(total)}` : null);
  };
  const shown = (a: Achievement) =>
    !isReady(a) &&
    (filter === "all" || (filter === "earned" ? isDone(a) : !a.reached));

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="🏆 Achievements"
          subtitle="Earned by playing — each one pays once"
          wrapTitle
          onBack={() => go("rack")}
          right={<Coin n={save.credits} />}
        />
        <div className="space-y-4 px-4 pb-4">
          <section className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 text-ivory shadow-lift">
            <div className="absolute -right-6 -top-10 text-[110px] opacity-[0.12]" aria-hidden="true">
              🏆
            </div>
            <div className="relative">
              <Eyebrow dark>Your collection</Eyebrow>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-display text-4xl font-bold">{unlocked}</span>
                <span className="mb-1 font-ui text-sm text-ivory/75">
                  of {achievements.length} achievements
                </span>
              </div>
              <div className="mt-3">
                <Bar dark tone="sage" fraction={unlocked / achievements.length} />
              </div>
              {waiting > 0 ? (
                <button
                  type="button"
                  data-testid="achievements-waiting"
                  onClick={() => readyRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="press mt-2 flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl bg-gold/25 px-3 font-ui text-[13px] font-extrabold text-ivory"
                >
                  <span>💰 {formatUsd(waiting)} waiting to collect</span>
                  <span aria-hidden>▾</span>
                </button>
              ) : (
                <p
                  className="mt-2 font-ui text-[12.5px] text-ivory/85"
                  data-testid="achievements-waiting"
                >
                  Earn achievements to collect cash rewards.
                </p>
              )}
            </div>
          </section>

          {note ? (
            <p role="status" className="text-center font-ui text-[13px] font-extrabold text-sage">
              {note}
            </p>
          ) : null}

          {ready.length > 0 ? (
            <section
              ref={readyRef}
              data-testid="achievements-ready"
              className="scroll-mt-4 rounded-[22px] border-2 border-gold/70 bg-gold/10 p-3 shadow-soft"
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 className="font-ui text-[13px] font-extrabold uppercase tracking-[0.14em] text-copper">
                  🎁 Ready to collect · {ready.length}
                </h2>
              </div>
              {ready.length > 1 ? (
                <KButton full variant="copper" className="mb-2 min-h-12" onClick={collectAll}>
                  {`Collect all · ${formatUsd(waiting)}`}
                </KButton>
              ) : null}
              <div className="space-y-2">
                {ready.map((a) => (
                  <AchievementCard key={a.id} a={a} onCollect={collect} />
                ))}
              </div>
            </section>
          ) : null}

          {next ? (
            <Panel className="p-4">
              <Eyebrow>Closest reward</Eyebrow>
              <div className="mt-2 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/20 text-2xl">
                  {next.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 font-ui text-[13px] font-extrabold text-walnut-dark">
                    <span className="truncate">{next.title}</span>
                    <span className="shrink-0">
                      {Math.min(next.value, next.target)} / {next.target}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Bar fraction={next.value / next.target} />
                  </div>
                  {next.reward > 0 ? (
                    <p className="mt-1 font-ui text-[12px] text-walnut/65">
                      Pays {formatUsd(next.reward)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}

          <div className="flex gap-2" role="tablist" aria-label="Show achievements">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                data-achievement-filter={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "press min-h-12 flex-1 rounded-full border px-2 font-ui text-[12.5px] font-extrabold",
                  filter === f.id
                    ? "border-copper bg-copper/15 text-walnut-dark"
                    : "border-walnut/20 bg-ivory/80 text-walnut/70",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {GROUPS.map((group) => {
            const items = achievements
              .filter((a) => a.group === group.name && shown(a))
              .sort(byProgress);
            if (items.length === 0) return null;
            return (
              <section key={group.name}>
                <h2 className="mb-2 px-1 font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-copper">
                  {group.icon} {group.name}
                </h2>
                <div className="space-y-2">
                  {items.map((a) => (
                    <AchievementCard key={a.id} a={a} onCollect={collect} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <BottomNav active="rack" go={go} />
    </div>
  );
}

/** One achievement: ready ones glow gold with a red mark and their Collect button. */
function AchievementCard({
  a,
  onCollect,
}: {
  a: Achievement;
  onCollect: (id: string, title: string) => void;
}) {
  const ready = isReady(a);
  const done = a.claimed || (a.automatic && a.reached);
  return (
    <article
      data-achievement={a.id}
      data-ready={ready || undefined}
      className={cn(
        "relative rounded-2xl border p-3 shadow-soft",
        ready
          ? "border-gold bg-[linear-gradient(120deg,rgba(255,240,200,0.98),rgba(255,248,230,0.98))] ring-2 ring-gold/40"
          : a.reached
            ? "border-sage/40 bg-[linear-gradient(120deg,rgba(238,247,225,0.96),rgba(255,248,230,0.96))]"
            : "border-walnut/10 bg-ivory/75",
      )}
    >
      {ready ? (
        <span
          aria-hidden
          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#fff3db] bg-[#e53c32] font-ui text-[12px] font-black leading-none text-white shadow-md"
        >
          !
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[23px]",
            ready ? "bg-gold/30" : a.reached ? "bg-sage/20" : "bg-walnut/5 grayscale-[0.55] opacity-75",
          )}
          aria-hidden="true"
        >
          {a.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-bold leading-tight text-walnut-dark">
              {a.title}
            </h3>
            {a.reward > 0 ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-1 font-ui text-[11px] font-extrabold",
                  done ? "bg-sage/15 text-sage" : "bg-gold/20 text-walnut-dark",
                )}
              >
                {done ? "✓ Collected" : formatUsd(a.reward)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-ui text-[12px] leading-snug text-walnut/65">{a.description}</p>
          {!a.reached && a.target > 1 ? (
            <div className="mt-2">
              <Bar fraction={a.value / a.target} />
              <p className="mt-1 font-ui text-[11px] text-walnut/55">
                {Math.min(a.value, a.target)} / {a.target} {a.unit}
              </p>
            </div>
          ) : null}
          {ready ? (
            <div className="mt-2">
              <KButton full variant="sage" onClick={() => onCollect(a.id, a.title)}>
                {`Collect ${formatUsd(a.reward)}`}
              </KButton>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
