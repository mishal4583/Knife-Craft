import { cn } from "@/lib/utils";
import type { IngredientId } from "@/game/definitions";
import type { PerishabilityState } from "@/game/business/perishability";
import { FcArt, FoodPicture, iconFor } from "./restaurant/FridgeCheckParts";

/**
 * The freshness watch of Daily Maintenance as the Fridge Check draws food (developer 2026-11-21: "instead of just showing a list … digitalized, the same
 * system from the fridge check, showing the image of each ingredient"). Every ingredient that is running low or going off is a paper tile: its painted
 * picture made to LOOK its state (clean, bruised, spoiled with flies: the Fridge Check's `FoodPicture`), a status chip (marker AND word, never colour alone),
 * the amount, a freshness bar and the one button that fixes it. One component, so the low-stock rows and the stock rows look alike.
 */

export type WatchTone = "sage" | "gold" | "copper" | "tomato";

export type WatchTile = {
  id: IngredientId;
  name: string;
  /** The status in words and its marker ("Spoils tonight" 🔴). */
  label: string;
  marker: string;
  tone: WatchTone;
  /** The freshness the picture is drawn in. */
  state: PerishabilityState;
  /** 0–1 for the bar; null when the row does not know it (a low-stock alert: the bar is left out). */
  freshness: number | null;
  /** "1d left", "Expired", or "" when unknown. */
  days: string;
  /** What is in the kitchen, in the player's measure. */
  amount: string;
  /** What today's service needs, when the menu uses it. */
  need?: string;
  /** The button: "Restock ›" or "Inventory ›". */
  action: string;
  onAction: () => void;
};

const TONE: Record<WatchTone, { card: string; chip: string; button: string }> = {
  tomato: {
    card: "border-tomato/45 shadow-[0_3px_0_rgba(184,60,48,0.16),0_8px_16px_rgba(60,35,15,0.10)]",
    chip: "bg-tomato/12 text-tomato",
    button: "bg-tomato text-ivory",
  },
  copper: {
    card: "border-copper/40 shadow-[0_3px_0_rgba(160,90,40,0.16),0_8px_16px_rgba(60,35,15,0.10)]",
    chip: "bg-copper/12 text-copper",
    button: "bg-walnut text-ivory",
  },
  gold: {
    card: "border-gold/55 shadow-[0_3px_0_rgba(200,150,50,0.2),0_8px_16px_rgba(60,35,15,0.10)]",
    chip: "bg-gold/25 text-copper",
    button: "bg-walnut text-ivory",
  },
  sage: {
    card: "border-sage/50 shadow-[0_3px_0_rgba(110,140,90,0.18),0_8px_16px_rgba(60,35,15,0.10)]",
    chip: "bg-sage/20 text-olive",
    button: "bg-walnut text-ivory",
  },
};

const BAR: Record<PerishabilityState, string> = {
  FRESH: "bg-sage",
  AGING: "bg-gold",
  NEAR_EXPIRY: "bg-copper",
  EXPIRED: "bg-tomato",
};

export function FreshnessTile({ tile }: { tile: WatchTile }) {
  const tone = TONE[tile.tone];
  const expired = tile.state === "EXPIRED";
  return (
    <li
      data-testid="freshness-tile"
      data-ingredient={tile.id}
      data-state={tile.state}
      data-tone={tile.tone}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border-2 bg-gradient-to-b from-ivory to-cream p-2.5",
        tone.card,
      )}
    >
      <p
        className={cn(
          "flex w-full items-center gap-1 self-start rounded-full px-2 py-1 font-ui text-[10.5px] font-extrabold leading-none",
          tone.chip,
        )}
      >
        <span aria-hidden="true">{tile.marker}</span>
        <span className="truncate">{tile.label}</span>
      </p>

      <div className="relative mx-auto mt-1.5 aspect-square w-full max-w-[132px]">
        <span
          aria-hidden="true"
          className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.95),rgba(240,222,186,0.7)_58%,rgba(220,190,140,0.25)_74%,transparent_76%)]"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-[3%] left-[18%] right-[18%] h-[7%] rounded-full bg-walnut-dark/15 blur-[3px]"
        />
        <FoodPicture card={{ id: tile.id, state: tile.state }} className="h-full w-full" />
        {tile.state === "NEAR_EXPIRY" || tile.state === "AGING" || expired ? (
          <FcArt
            name={iconFor(tile.state)}
            className="absolute right-0 top-0 w-[26%] drop-shadow"
          />
        ) : null}
      </div>

      <p className="mt-1 truncate text-center font-display text-[15px] font-black leading-tight text-walnut-dark">
        {tile.name}
      </p>
      <p className="text-center font-ui text-[12.5px] font-extrabold text-walnut/80">
        {tile.amount}
      </p>
      {tile.need ? (
        <p className="truncate text-center font-ui text-[10.5px] font-bold text-walnut/55">
          Today needs {tile.need}
        </p>
      ) : null}

      <div className="mt-auto">
        {tile.freshness !== null ? (
          <div className="pt-1.5">
            <div className="flex items-center justify-between font-ui text-[10px] font-extrabold uppercase tracking-wide text-walnut/55">
              <span>Freshness</span>
              <span className={expired ? "text-tomato" : undefined}>{tile.days}</span>
            </div>
            <div
              role="meter"
              aria-label={`${tile.name} freshness`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(tile.freshness * 100)}
              className="mt-0.5 h-2 overflow-hidden rounded-full bg-walnut/10 ring-1 ring-inset ring-walnut/10"
            >
              <span
                className={cn("block h-full rounded-full", BAR[tile.state])}
                style={{ width: `${Math.max(6, Math.round(tile.freshness * 100))}%` }}
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={tile.onAction}
          className={cn(
            "press mt-2 min-h-11 w-full rounded-full px-3 font-ui text-[12px] font-extrabold shadow-[0_2px_0_rgba(60,35,15,0.25)]",
            tone.button,
          )}
        >
          {tile.action} ›
        </button>
      </div>
    </li>
  );
}

/** The grid of tiles: two across on a phone, more as the window widens. */
export function FreshnessGrid({ tiles }: { tiles: WatchTile[] }) {
  return (
    <ul
      data-testid="freshness-grid"
      className="mt-3 grid grid-cols-2 gap-2.5 land:grid-cols-4 landx:grid-cols-5"
    >
      {tiles.map((tile) => (
        <FreshnessTile key={`${tile.id}-${tile.label}`} tile={tile} />
      ))}
    </ul>
  );
}
