import type { ScreenId } from "./data";
import { BottomNav } from "./Kitchen";
import { Bar, Eyebrow } from "./common/Meters";
import { Coin, Panel, ScreenHeader } from "./common/primitives";
import type { SaveData } from "@/game/SaveManager";
import { restaurantProgress } from "@/game/progression/restaurantProgress";
import { endlessStarsOf } from "@/game/restaurant/restaurantStanding";
import { restaurantRecordOf } from "@/game/restaurant/serviceReport";
import { restaurantSuppliesOf } from "@/game/restaurant/serviceSupplies";

type AchievementGroup = "Restaurant" | "Kitchen" | "Service" | "Business";
type Achievement = {
  id: string;
  group: AchievementGroup;
  icon: string;
  title: string;
  description: string;
  value: number;
  target: number;
  unit: string;
};

/** Achievements are a read-only view of real, already persisted game progress. */
function achievementsFor(save: SaveData): Achievement[] {
  const p = restaurantProgress(save);
  const service = restaurantRecordOf(save);
  const supplies = restaurantSuppliesOf(save);
  const endless = endlessStarsOf(save);
  const out: Achievement[] = [];
  const add = (
    id: string,
    group: AchievementGroup,
    icon: string,
    title: string,
    description: string,
    value: number,
    target: number,
    unit: string,
  ) => out.push({ id, group, icon, title, description, value: Math.max(0, value), target: Math.max(1, target), unit });

  const levelMarks = [1, 10, 50, 100, p.level.total].filter((n, i, a) => n <= p.level.total && a.indexOf(n) === i);
  levelMarks.forEach((n) => add(
    `levels-${n}`, "Restaurant", "🗺️", n === p.level.total ? "Restaurant legend" : `Level ${n} reached`,
    n === p.level.total ? "Complete every campaign level." : `Complete ${n} campaign ${n === 1 ? "level" : "levels"}.`,
    p.level.completed, n, "levels",
  ));

  const recipeMarks = [1, 10, 25, p.recipes.total].filter((n, i, a) => n <= p.recipes.total && a.indexOf(n) === i);
  recipeMarks.forEach((n) => add(
    `recipes-${n}`, "Kitchen", "🍲", n === p.recipes.total ? "Full recipe book" : `${n} ${n === 1 ? "recipe" : "recipes"} mastered`,
    n === p.recipes.total ? "Cook every recipe in the campaign." : `Complete levels featuring ${n} different ${n === 1 ? "recipe" : "recipes"}.`,
    p.recipes.cooked, n, "recipes",
  ));

  const knifeTotal = p.knives.length;
  [1, 3, knifeTotal].filter((n, i, a) => n <= knifeTotal && a.indexOf(n) === i).forEach((n) => add(
    `knives-${n}`, "Kitchen", "🔪", n === knifeTotal ? "Knife collector" : `Knife ${n === 1 ? "in" : "collection"}`,
    n === knifeTotal ? "Own every knife in the Blacksmith." : `Own ${n} ${n === 1 ? "knife" : "knives"}.`,
    p.knivesOwned, n, "knives",
  ));

  const boardTotal = p.boards.length;
  [1, 3, boardTotal].filter((n, i, a) => n <= boardTotal && a.indexOf(n) === i).forEach((n) => add(
    `boards-${n}`, "Kitchen", "🪵", n === boardTotal ? "Board collector" : `Board ${n === 1 ? "in" : "collection"}`,
    n === boardTotal ? "Own every cutting board." : `Own ${n} ${n === 1 ? "cutting board" : "cutting boards"}.`,
    p.boardsOwned, n, "boards",
  ));

  const upgradeTotal = p.kitchen.stages.length;
  [2, 4, upgradeTotal].filter((n, i, a) => n <= upgradeTotal && a.indexOf(n) === i).forEach((n) => add(
    `kitchens-${n}`, "Kitchen", "🏠", n === upgradeTotal ? "Dream kitchen" : `Kitchen stage ${n}`,
    n === upgradeTotal ? "Unlock every kitchen upgrade." : `Unlock ${n} kitchen designs.`,
    p.kitchen.stages.filter((s) => s.reached).length, n, "stages",
  ));

  [1, 25, 100].forEach((n) => add(
    `services-${n}`, "Service", "🍽️", n === 1 ? "First service" : `${n} services served`,
    `Complete ${n} ${n === 1 ? "restaurant service" : "restaurant services"}.`, service.services, n, "services",
  ));
  [1, 10, 50].forEach((n) => add(
    `spotless-${n}`, "Service", "✨", n === 1 ? "Spotless service" : `${n} spotless services`,
    `Finish ${n} ${n === 1 ? "service" : "services"} with all hygiene checks passed.`, service.spotless, n, "spotless services",
  ));
  [3, 7].forEach((n) => add(
    `streak-${n}`, "Service", "🧼", `${n} spotless in a row`,
    `Keep the restaurant spotless for ${n} consecutive services.`, service.bestStreak, n, "service streak",
  ));
  add("washed-100", "Service", "🫧", "Dishwashing pro", "Wash 100 pieces of restaurant tableware.", supplies.washedTotal, 100, "pieces washed");
  add("covers-250", "Service", "🧑‍🍳", "Guest favourite", "Serve 250 dine-in guests.", supplies.coversTotal, 250, "guests served");

  [3, 7].forEach((n) => add(
    `daily-streak-${n}`, "Business", "📅", `${n}-day daily order streak`,
    `Complete daily orders on a ${n}-day streak.`, save.dailyOrder.streak, n, "day streak",
  ));
  add("business-days-10", "Business", "🌙", "A steady hand", "Run the restaurant for 10 business days.", p.business.daysRun, 10, "days run");
  add("endless-stars-100", "Business", "⭐", "Endless excellence", "Earn 100 stars in the Endless Restaurant.", endless.total, 100, "stars");

  return out;
}

const GROUPS: { name: AchievementGroup; icon: string }[] = [
  { name: "Restaurant", icon: "🏆" },
  { name: "Kitchen", icon: "👨‍🍳" },
  { name: "Service", icon: "🧽" },
  { name: "Business", icon: "📈" },
];

export function Achievements({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const achievements = achievementsFor(save);
  const unlocked = achievements.filter((a) => a.value >= a.target).length;
  const next = achievements
    .filter((a) => a.value < a.target)
    .sort((a, b) => b.value / b.target - a.value / a.target)[0];

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="🏆 Achievements"
          subtitle="Milestones earned through your game progress"
          wrapTitle
          onBack={() => go("rack")}
          right={<Coin n={save.credits} />}
        />
        <div className="space-y-4 px-4 pb-4">
          <section className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-5 text-ivory shadow-lift">
            <div className="absolute -right-6 -top-10 text-[110px] opacity-[0.12]" aria-hidden="true">🏆</div>
            <div className="relative">
              <Eyebrow dark>Your collection</Eyebrow>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-display text-4xl font-bold">{unlocked}</span>
                <span className="mb-1 font-ui text-sm text-ivory/75">of {achievements.length} achievements</span>
              </div>
              <div className="mt-3"><Bar dark tone="sage" fraction={unlocked / achievements.length} /></div>
              <p className="mt-2 font-ui text-[12px] text-ivory/75">Earned by playing: campaign, kitchen, service and business.</p>
            </div>
          </section>

          {next ? (
            <Panel className="p-4">
              <Eyebrow>Closest milestone</Eyebrow>
              <div className="mt-2 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/20 text-2xl">{next.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 font-ui text-[13px] font-extrabold text-walnut-dark">
                    <span className="truncate">{next.title}</span>
                    <span className="shrink-0">{Math.min(next.value, next.target)} / {next.target}</span>
                  </div>
                  <div className="mt-2"><Bar fraction={next.value / next.target} /></div>
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
                  {items.map((achievement) => {
                    const done = achievement.value >= achievement.target;
                    const progress = Math.min(achievement.value, achievement.target);
                    return (
                      <article key={achievement.id} className={`rounded-2xl border p-3 shadow-soft ${done ? "border-sage/40 bg-[linear-gradient(120deg,rgba(238,247,225,0.96),rgba(255,248,230,0.96))]" : "border-walnut/10 bg-ivory/75"}`}>
                        <div className="flex items-start gap-3">
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[23px] ${done ? "bg-sage/20" : "bg-walnut/5 grayscale-[0.55] opacity-75"}`} aria-hidden="true">{achievement.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-display text-[15px] font-bold leading-tight text-walnut-dark">{achievement.title}</h3>
                              <span aria-label={done ? "Achievement earned" : `${progress} of ${achievement.target} ${achievement.unit}`} className={`shrink-0 rounded-full px-2 py-1 font-ui text-[10px] font-extrabold ${done ? "bg-sage/20 text-olive" : "bg-walnut/5 text-walnut/50"}`}>{done ? "EARNED" : `${progress}/${achievement.target}`}</span>
                            </div>
                            <p className="mt-1 font-ui text-[12px] leading-snug text-walnut/65">{achievement.description}</p>
                            {!done ? <div className="mt-2"><Bar fraction={achievement.value / achievement.target} /></div> : null}
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
