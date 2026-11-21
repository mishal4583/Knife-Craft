import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import type { IngredientId } from "@/game/definitions";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";

/**
 * The picture tiles of Daily Maintenance's Opening clean and Night close cards (developer 2026-11-21: "make these also digitalized"): the same look as the freshness
 * watch and the supply tiles (paper tile, round plate under a painted picture), with the game's own painted icons (`public/icons/<name>.webp`) and the three
 * area photographs (`public/cleanliness/`). Every chore of the closing list was the same 🌙; each now has its own picture.
 */

const iconUrl = (name: string) => `${import.meta.env.BASE_URL}icons/${name}.webp`;

/** A painted icon by file name; the emoji shows if it cannot load. */
export function PaintedPic({
  name,
  fallback,
  className,
}: {
  name: string;
  fallback: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden="true">{fallback}</span>;
  return (
    <img
      src={iconUrl(name)}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      data-painted-icon={name}
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}

const PLATE =
  "bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.95),rgba(240,222,186,0.7)_58%,rgba(220,190,140,0.25)_74%,transparent_76%)]";

/** A painted picture on its round plate. */
export function Plate({
  name,
  fallback,
  className,
}: {
  name: string;
  fallback: string;
  className?: string;
}) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center", className)}>
      <span aria-hidden="true" className={cn("absolute inset-[3%] rounded-full", PLATE)} />
      <span className="relative block h-[72%] w-[72%] drop-shadow-[0_3px_3px_rgba(60,35,15,0.3)]">
        <PaintedPic name={name} fallback={fallback} />
      </span>
    </span>
  );
}

/** Which painted icon each closing chore wears. */
const CHORE_ICON: Record<string, { name: string; emoji: string }> = {
  "wash-up": { name: "soap", emoji: "🧼" },
  "wipe-down": { name: "sponge", emoji: "🧽" },
  spoiled: { name: "bin", emoji: "🗑️" },
  wrap: { name: "paper-roll", emoji: "🧻" },
  "dining-room": { name: "plate-cutlery", emoji: "🍽️" },
  count: { name: "coin", emoji: "🪙" },
  books: { name: "ledger", emoji: "📒" },
};

/** Tonight's close: the steps in order as numbered picture tiles, what spoils tonight, then the supplies (the caller's grid). */
export function ClosingPlan({
  chores,
  fullDayEnd,
  spoiled,
  children,
}: {
  chores: { id: string; label: string }[];
  fullDayEnd: boolean;
  spoiled: { quantity: number; ingredientIds: IngredientId[] } | null;
  children?: ReactNode;
}) {
  const steps = [
    ...chores,
    ...(fullDayEnd ? [{ id: "books", label: "Close the books and pay the team" }] : []),
  ];
  const shown = (spoiled?.ingredientIds ?? []).slice(0, 8);
  const more = (spoiled?.ingredientIds.length ?? 0) - shown.length;
  return (
    <div
      data-testid="closing-plan"
      className="mt-3 rounded-2xl border border-walnut/12 bg-gradient-to-b from-ivory to-cream p-3"
    >
      <p className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/60">
        Tonight’s close · {steps.length} steps
      </p>
      <ol className="mt-2 grid grid-cols-2 gap-2 land:grid-cols-4 landx:grid-cols-4">
        {steps.map((s, i) => {
          const icon = CHORE_ICON[s.id] ?? { name: "moon", emoji: "🌙" };
          return (
            <li
              key={s.id}
              data-testid="closing-step"
              data-step={s.id}
              className="relative flex min-w-0 flex-col items-center rounded-[18px] border border-walnut/15 bg-cream/80 px-2 pb-2 pt-2.5 text-center shadow-[0_2px_0_rgba(60,35,15,0.08)]"
            >
              <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-walnut font-ui text-[12px] font-black text-gold">
                {i + 1}
              </span>
              <Plate name={icon.name} fallback={icon.emoji} className="h-[76px] w-[76px]" />
              <span className="mt-1 font-ui text-[12px] font-extrabold leading-tight text-walnut-dark">
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {spoiled ? (
        spoiled.quantity ? (
          <div
            data-testid="closing-spoiled"
            className="mt-3 rounded-2xl border-2 border-tomato/40 bg-tomato/5 p-2.5"
          >
            <div className="flex items-center gap-2">
              <Plate name="bin" fallback="🗑️" className="h-[40px] w-[40px]" />
              <p className="min-w-0 flex-1 font-ui text-[12.5px] font-extrabold leading-snug text-tomato">
                {Math.round(spoiled.quantity * 10) / 10} units expire tonight · use or clear
              </p>
            </div>
            {shown.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {shown.map((id) => (
                  <li
                    key={id}
                    data-spoils={id}
                    className="grid h-[42px] w-[42px] place-items-center rounded-full border border-tomato/30 bg-ivory text-[26px] shadow-[0_2px_0_rgba(184,60,48,0.15)]"
                  >
                    <IngredientIcon
                      id={id}
                      fallback={INGREDIENT_EMOJI[id]}
                      className="!align-baseline"
                    />
                  </li>
                ))}
                {more > 0 ? (
                  <li className="grid h-[42px] min-w-[42px] place-items-center rounded-full bg-tomato/12 px-2 font-ui text-[12px] font-extrabold text-tomato">
                    +{more}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : (
          <p
            data-testid="closing-spoiled"
            className="mt-3 flex items-center gap-2 rounded-2xl border border-sage/45 bg-sage/10 px-3 py-2 font-ui text-[12.5px] font-extrabold text-olive"
          >
            <Plate name="check" fallback="✓" className="h-[30px] w-[30px]" /> Nothing expires
            tonight
          </p>
        )
      ) : null}
      {children}
    </div>
  );
}

/** "Nothing to do": a big painted tick on a green card. */
export function AllClear({
  icon = "check",
  fallback = "✓",
  children,
}: {
  icon?: string;
  fallback?: string;
  children: ReactNode;
}) {
  return (
    <p
      data-testid="all-clear"
      className="mt-3 flex items-center gap-3 rounded-2xl border border-sage/45 bg-gradient-to-b from-sage/15 to-sage/5 px-3 py-2.5 font-ui text-[13.5px] font-extrabold text-olive"
    >
      <Plate name={icon} fallback={fallback} className="h-[44px] w-[44px]" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

/** The three areas as round photographs (the cleaning areas' own pictures). */
export function AreaThumbs() {
  const areas = [
    { id: "kitchen", label: "Kitchen" },
    { id: "restroom", label: "Restroom" },
    { id: "dining", label: "Dining" },
  ];
  return (
    <ul className="mt-1.5 flex gap-3" data-testid="area-thumbs">
      {areas.map((a) => (
        <li key={a.id} className="flex items-center gap-1.5 font-ui text-[12px] text-walnut/70">
          <img
            src={`${import.meta.env.BASE_URL}cleanliness/${a.id}.webp`}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="h-8 w-8 rounded-full border-2 border-gold/60 object-cover shadow-sm"
          />
          {a.label}
        </li>
      ))}
    </ul>
  );
}

/** The painted icon of a service by its name (Breakfast, Lunch, Afternoon Tea, Dinner). */
function mealIcon(name: string): { name: string; emoji: string } {
  const n = name.toLowerCase();
  if (n.includes("breakfast")) return { name: "toast", emoji: "🍞" };
  if (n.includes("brunch")) return { name: "egg", emoji: "🍳" };
  if (n.includes("lunch")) return { name: "bento", emoji: "🍱" };
  if (n.includes("tea")) return { name: "teapot", emoji: "🫖" };
  if (n.includes("dinner") || n.includes("supper")) return { name: "plate-cutlery", emoji: "🍽️" };
  return { name: "service-bell", emoji: "🛎️" };
}

/** The day's services as meal pills (a painted icon, the name, ✓ once served), for the dark wood cards of Daily Maintenance and the Business Overview. */
export function MealPills({ services }: { services: { name: string; done: boolean }[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-2" data-testid="service-plan">
      {services.map((service) => {
        const meal = mealIcon(service.name);
        return (
          <li
            key={service.name}
            data-done={service.done ? "true" : "false"}
            className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 font-ui text-[12.5px] font-extrabold ${service.done ? "border-sage/60 bg-sage/25 text-ivory" : "border-gold/40 bg-ivory/12 text-ivory/95"}`}
          >
            <Plate name={meal.name} fallback={meal.emoji} className="h-[30px] w-[30px]" />
            {service.name}
            {service.done ? <span aria-label="done"> ✓</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
