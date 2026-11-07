import { useState } from "react";
import { cn } from "@/lib/utils";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";
import { formatStockAmount } from "@/game/business/measure";
import { checkTierAt, type CheckCard } from "@/game/restaurant/fridgeCheck";

/**
 * The painted pieces of Fridge Check that the game and its how-to tour both draw: the kit's art, the food picture that LOOKS its state
 * (fresh, going off, spoiled) and the paper inspection card. One source, so the tour shows exactly what the game shows.
 */

export const SHELF_LIFE_GUIDE =
  "Shelf life: meat, fish and herbs 3 days · dairy 4 · bread 5 · fruit 6 · vegetables 7 · garlic and ginger 12.";

export const fcUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/fridge-check/${name}.webp`;

/** One painted piece of the Fridge Check set; hidden if it fails to load. */
export function FcArt({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={fcUrl(name)}
      alt=""
      draggable={false}
      data-fc-art={name}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
      className={cn("pointer-events-none select-none", className)}
      style={style}
    />
  );
}

/** A small stable number from a string (which spoilage picture an ingredient gets: never random). */
export const hashOf = (s: string): number => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
};

/**
 * The ingredient's picture, made to LOOK its state: fresh and aging are clean, near-expiry is dull with a touch of wilt, expired is greyed with
 * mold or rot on it and a fly or two (the painted overlays of the kit; each ingredient always gets the same ones).
 */
export function FoodPicture({ card, className }: { card: CheckCard; className?: string }) {
  const h = hashOf(card.id);
  const ov = ((h % 12) + 1).toString().padStart(2, "0");
  const ov2 = (((h >> 4) % 12) + 1).toString().padStart(2, "0");
  // Spoiled food shows its painted "spoiled twin" (public/business/ingredients-spoiled/); an ingredient without one (or one that fails to
  // load) falls back to the fresh picture greyed out with the mold overlays.
  const [twinFailed, setTwinFailed] = useState(false);
  const twin = card.state === "EXPIRED" && !twinFailed && card.id !== "chicken";
  const filter =
    card.state === "EXPIRED"
      ? "[filter:saturate(0.55)_brightness(0.86)_contrast(0.95)]"
      : card.state === "NEAR_EXPIRY"
        ? "[filter:saturate(0.82)_sepia(0.18)]"
        : card.state === "AGING"
          ? "[filter:saturate(0.94)]"
          : "";
  const pic = cn(
    "!absolute !inset-[5%] !h-[90%] !w-[90%] object-contain drop-shadow-[0_6px_6px_rgba(60,35,15,0.35)]",
  );
  return (
    <span className={cn("relative grid place-items-center", className)} data-fc-state={card.state}>
      {twin ? (
        <img
          src={`${import.meta.env.BASE_URL}business/ingredients-spoiled/${card.id}.webp`}
          alt=""
          draggable={false}
          data-fc-twin={card.id}
          onError={() => setTwinFailed(true)}
          className={cn(
            "pointer-events-none select-none absolute inset-[5%] h-[90%] w-[90%]",
            "object-contain drop-shadow-[0_6px_6px_rgba(60,35,15,0.35)]",
          )}
        />
      ) : (
        <IngredientIcon
          id={card.id}
          fallback={<span className="text-[56px]">🥬</span>}
          className={cn(pic, filter)}
        />
      )}
      {card.state === "EXPIRED" ? (
        <>
          {!twin ? (
            <>
              <FcArt
                name={`ov-${ov}`}
                className="absolute left-[20%] top-[18%] w-[46%] opacity-90 mix-blend-multiply"
                style={{ transform: `rotate(${(h % 40) - 20}deg)` }}
              />
              <FcArt
                name={`ov-${ov2}`}
                className="absolute right-[14%] top-[44%] w-[34%] opacity-85 mix-blend-multiply"
              />
            </>
          ) : null}
          <FcArt name="fly-1" className="absolute right-[10%] top-[6%] w-[16%]" />
          <FcArt name="wisp-tall" className="absolute left-[8%] top-[0%] w-[14%] opacity-80" />
        </>
      ) : card.state === "NEAR_EXPIRY" ? (
        <FcArt
          name="ov-08"
          className="absolute left-[28%] top-[30%] w-[38%] opacity-45 mix-blend-multiply"
        />
      ) : null}
    </span>
  );
}

export const iconFor = (state: CheckCard["state"]) =>
  state === "EXPIRED"
    ? "icon-spoiled"
    : state === "NEAR_EXPIRY"
      ? "icon-near"
      : state === "AGING"
        ? "icon-aging"
        : "icon-fresh";

/** The paper card of one ingredient: its picture, name, quantity and (by tier) the cues. */
export function InspectionCard({
  card,
  level,
  measure,
  className,
}: {
  card: CheckCard;
  level: number;
  measure: "lb" | "kg";
  className?: string;
}) {
  const tier = checkTierAt(level);
  const bought =
    card.age === 0
      ? "Bought today"
      : card.age === 1
        ? "Bought 1 day ago"
        : `Bought ${card.age} days ago`;
  return (
    <div
      className={cn("relative aspect-[340/492] w-full [container-type:inline-size]", className)}
      data-testid="fc-card"
      data-id={card.id}
      data-verdict={card.verdict}
      data-state={card.state}
    >
      <FcArt name="card" className="absolute inset-0 h-full w-full object-fill" />
      <div className="absolute left-[8%] top-[16.5%] h-[42%] w-[84%]">
        <FoodPicture card={card} className="h-full w-full" />
      </div>
      <p className="absolute left-[8%] top-[61.5%] grid h-[8.5%] w-[84%] place-items-center truncate px-[3%] text-center font-display text-[6.6cqw] font-black leading-none text-walnut-dark">
        {card.name}
      </p>
      <div className="absolute left-[10%] top-[70.6%] w-[80%] font-hand text-[6.2cqw] leading-[1.15] text-walnut">
        {tier.cues.days ? <p className="truncate">{bought}</p> : <p className="truncate">&nbsp;</p>}
        {tier.cues.icon ? <p className="truncate">Lasts {card.shelfLife} days</p> : null}
      </div>
      <div className="absolute left-[8.5%] top-[81%] grid h-[12.5%] w-[17.5%] place-items-center">
        {tier.cues.icon ? <FcArt name={iconFor(card.state)} className="w-[88%]" /> : null}
      </div>
      <p className="absolute left-[32%] top-[83%] grid h-[10%] w-[59%] place-items-center font-ui text-[6.4cqw] font-black text-walnut-dark">
        {formatStockAmount(card.id, card.quantity, measure)}
      </p>
    </div>
  );
}
