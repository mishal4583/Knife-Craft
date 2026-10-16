import { useState } from "react";
import type { ScreenId } from "./data";
import { BottomNav } from "./Kitchen";
import { Bar, Eyebrow } from "./common/Meters";
import { Coin, KButton, Panel, ScreenHeader } from "./common/primitives";
import type { SaveData } from "@/game/SaveManager";
import { formatUsd } from "@/game/money";
import {
  achievementsFor,
  collectableTotal,
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
  const achievements = achievementsFor(save);
  const unlocked = achievements.filter((a) => a.reached).length;
  const waiting = collectableTotal(save);
  const next = achievements
    .filter((a) => !a.reached && a.target > 1)
    .sort((a, b) => b.value / b.target - a.value / a.target)[0];

  const collect = (id: string, title: string) => {
    const r = onCollect(id);
    setNote(r.ok ? `${title}: collected ${formatUsd(r.amount)}` : null);
  };

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
              <p className="mt-2 font-ui text-[12.5px] text-ivory/85" data-testid="achievements-waiting">
                {waiting > 0
                  ? `💰 ${formatUsd(waiting)} waiting to collect`
                  : "Earn achievements to collect cash rewards."}
              </p>
            </div>
          </section>

          {note ? (
            <p role="status" className="text-center font-ui text-[13px] font-extrabold text-sage">
              {note}
            </p>
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

          {GROUPS.map((group) => {
            const items = achievements.filter((a) => a.group === group.name);
            return (
              <section key={group.name}>
                <h2 className="mb-2 px-1 font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-copper">
                  {group.icon} {group.name}
                </h2>
                <div className="space-y-2">
                  {items.map((a) => {
                    const ready = a.reached && !a.claimed && !a.automatic && a.reward > 0;
                    return (
                      <article
                        key={a.id}
                        data-achievement={a.id}
                        className={`rounded-2xl border p-3 shadow-soft ${
                          a.reached
                            ? "border-sage/40 bg-[linear-gradient(120deg,rgba(238,247,225,0.96),rgba(255,248,230,0.96))]"
                            : "border-walnut/10 bg-ivory/75"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[23px] ${
                              a.reached ? "bg-sage/20" : "bg-walnut/5 grayscale-[0.55] opacity-75"
                            }`}
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
                                  className={`shrink-0 rounded-full px-2 py-1 font-ui text-[11px] font-extrabold ${
                                    a.claimed || (a.automatic && a.reached)
                                      ? "bg-sage/15 text-sage"
                                      : "bg-gold/20 text-walnut-dark"
                                  }`}
                                >
                                  {a.claimed || (a.automatic && a.reached)
                                    ? "✓ Collected"
                                    : formatUsd(a.reward)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 font-ui text-[12px] leading-snug text-walnut/65">
                              {a.description}
                            </p>
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
                                <KButton full variant="sage" onClick={() => collect(a.id, a.title)}>
                                  {`Collect ${formatUsd(a.reward)}`}
                                </KButton>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
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
