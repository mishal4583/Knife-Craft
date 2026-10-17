import { useState } from "react";
import { KButton } from "./common/primitives";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";
import {
  DEFAULT_RESTAURANT_NAME,
  RESTAURANT_NAME_MAX,
  cleanRestaurantName,
} from "@/game/restaurant/restaurantName";

/** A few ideas for a player who can't think of one. */
const IDEAS = ["Nonna's Table", "The Copper Pan", "Corner Bistro", "Golden Ladle"] as const;

/**
 * The restaurant's name (developer 2026-10-17): the field and its ideas. Used
 * by the one-time naming card and by Settings. `onSave` gets the cleaned name
 * (an empty field keeps the default).
 */
export function RestaurantNameField({
  initial,
  onSave,
  saveLabel,
  testId,
}: {
  initial: string;
  onSave: (name: string) => void;
  saveLabel: string;
  testId: string;
}) {
  const [draft, setDraft] = useState(initial);
  const clean = cleanRestaurantName(draft);
  return (
    <form
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        AudioManager.playSfx("tap");
        onSave(clean || DEFAULT_RESTAURANT_NAME);
      }}
    >
      <input
        aria-label="Restaurant name"
        data-testid={`${testId}-input`}
        value={draft}
        maxLength={RESTAURANT_NAME_MAX + 8}
        placeholder={DEFAULT_RESTAURANT_NAME}
        onChange={(e) => setDraft(e.target.value)}
        className="h-12 w-full rounded-2xl border border-walnut/25 bg-ivory px-4 font-display text-[18px] font-black text-walnut-dark outline-none focus:border-copper"
      />
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Name ideas">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setDraft(idea)}
            className={cn(
              "press min-h-12 rounded-full border px-3 font-ui text-[12.5px] font-extrabold",
              clean === idea
                ? "border-copper bg-copper/15 text-walnut-dark"
                : "border-walnut/20 bg-cream text-walnut/75",
            )}
          >
            {idea}
          </button>
        ))}
      </div>
      <KButton
        full
        className="mt-3 min-h-12"
        onClick={() => onSave(clean || DEFAULT_RESTAURANT_NAME)}
      >
        {saveLabel}
      </KButton>
    </form>
  );
}

/**
 * Shown once, after the intro and before Level 1 (an existing save sees it on
 * its next launch). Not dismissible without a name: "Keep" keeps the default.
 */
export function RestaurantNameCard({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (name: string) => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-walnut-dark/55 p-4 backdrop-blur-[2px]"
      data-testid="restaurant-name-card"
      role="dialog"
      aria-modal="true"
      aria-label="Name your restaurant"
    >
      <div className="anim-up paper w-full max-w-[400px] rounded-[26px] border border-walnut/20 p-5 shadow-lift">
        <p className="text-center text-[34px]" aria-hidden>
          🍽️
        </p>
        <h2 className="text-center font-display text-[24px] font-black leading-tight text-walnut-dark">
          Name your restaurant
        </h2>
        <p className="mb-3 text-center font-hand text-[16px] text-walnut/70">
          The sign above the door. Change it later in Settings.
        </p>
        <RestaurantNameField
          initial={initial}
          onSave={onSave}
          saveLabel="Open the doors →"
          testId="restaurant-name-form"
        />
        <button
          type="button"
          onClick={() => onSave(DEFAULT_RESTAURANT_NAME)}
          className="press mt-1 min-h-12 w-full rounded-full font-ui text-[12.5px] font-extrabold text-walnut/60"
        >
          Keep "{DEFAULT_RESTAURANT_NAME}"
        </button>
      </div>
    </div>
  );
}
