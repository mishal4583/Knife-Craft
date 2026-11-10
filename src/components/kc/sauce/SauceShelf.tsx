import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import {
  MAX_PINS,
  SAUCES,
  isMastered,
  isSauceStationOpen,
  masteredCount,
  pinsOf,
  sauceStationOf,
} from "@/game/business/sauceStation";
import { Art, Plaque, SortButton } from "@/components/kc/inventory/sort/SortParts";
import { sauceUrl, useSauceArt } from "./sauceArt";
import { SauceIcon, Sprite } from "./SauceParts";

/** Where the cubbies are on the painted shelf (shares of its width / height): the six column centres, the first cubby's floor and the row step. */
const COL_X = [0.121, 0.272, 0.423, 0.574, 0.724, 0.875] as const;
const SHELF_BOTTOM = 0.357;
const ROW_STEP = 0.138;

/**
 * THE SAUCE SHELF (developer 2026-11-08): the collection of the 24 sauces. A sauce stands in colour on the shelf once the player has made it with three
 * stars; one that is unlocked but not mastered is a dim bottle; one not unlocked yet is a locked tag (no level number: the level system is hidden, scripts/service-loop-qa.mts U1). Also the Saucier pins. Read-only:
 * it never changes the save. Without the painted shelf, a wooden board stands in.
 */
export function SauceShelf({
  save,
  playerLevel,
  onPlay,
  onExit,
}: {
  save: SaveData;
  playerLevel: number;
  onPlay: () => void;
  onExit: () => void;
}) {
  const art = useSauceArt("shelf-backdrop");
  const [pick, setPick] = useState<number | null>(null);
  const st = sauceStationOf(save);
  const pins = pinsOf(save);
  const n = masteredCount(save);
  const sel = pick !== null ? SAUCES[pick]! : null;
  return (
    <div
      className="absolute inset-0 z-[100] select-none overflow-hidden bg-[linear-gradient(180deg,#5b3a22,#3a2417)]"
      style={{ containerType: "size" }}
      data-testid="sauce-shelf"
      data-mastered={n}
    >
      {/* the painted shelf, fitted (never cropped) so the slots below sit exactly in its cubbies */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(100cqw, 56.25cqh)",
          aspectRatio: "702 / 1248",
          ...(art
            ? {
                backgroundImage: `url(${sauceUrl("shelf-backdrop")})`,
                backgroundSize: "100% 100%",
              }
            : { background: "linear-gradient(180deg,#7a4a26,#4a2c16)" }),
        }}
        data-testid="sauce-shelf-board"
      >
        {SAUCES.map((s, i) => {
          const open = isSauceStationOpen(playerLevel) && playerLevel >= s.unlock;
          const got = isMastered(save, s.id);
          const col = i % 6;
          const row = Math.floor(i / 6);
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`sauce-slot-${s.id}`}
              data-state={got ? "mastered" : open ? "open" : "locked"}
              onClick={() => setPick(i)}
              aria-label={`${s.name}: ${got ? "mastered" : open ? "not mastered yet" : "locked, keep cooking to unlock it"}`}
              className={cn(
                "press absolute flex -translate-x-1/2 items-end justify-center rounded-lg",
                pick === i && "bg-[#ffd25a]/25 ring-2 ring-[#ffd25a]",
              )}
              style={{
                left: `${COL_X[col]! * 100}%`,
                bottom: `${(1 - (SHELF_BOTTOM + row * ROW_STEP)) * 100}%`,
                width: "14.5%",
                height: "10.6%",
              }}
            >
              {open ? (
                <SauceIcon index={i} emoji={s.icon} grey={!got} className="h-full" />
              ) : (
                <span className="relative flex h-[88%] items-center justify-center">
                  <Sprite sheet="slot-states" index={1} emoji="🔒" className="h-full" />
                </span>
              )}
              {got ? (
                <Sprite
                  sheet="mastered"
                  index={0}
                  emoji="★"
                  className="absolute -right-1 -top-1 h-[34%]"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back"
          data-testid="sauce-shelf-back"
          className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-walnut text-[18px] text-gold"
        >
          <Art name="hud-round" className="absolute inset-0 h-full w-full object-fill" />
          <span className="relative">←</span>
        </button>
        <Plaque className="h-12 min-w-0 flex-1 font-display text-[20px] font-extrabold text-ivory">
          Sauce Shelf
        </Plaque>
        <Plaque
          testId="sauce-shelf-count"
          className="h-12 min-w-[84px] px-2 font-ui text-[16px] font-black tabular-nums text-ivory"
        >
          🍾 {n}/{SAUCES.length}
        </Plaque>
      </div>

      <div className="absolute inset-x-3 bottom-3 grid gap-2">
        <div
          className="rounded-2xl bg-[#f7edd7]/92 p-2 text-center font-ui"
          data-testid="sauce-shelf-info"
        >
          {sel ? (
            <p className="text-[13.5px] font-extrabold text-walnut-dark">
              {sel.icon} {sel.name}
              <span className="block text-[12px] font-bold text-walnut/70">
                {isMastered(save, sel.id)
                  ? "Mastered with three stars"
                  : isSauceStationOpen(playerLevel) && playerLevel >= sel.unlock
                    ? "Make it with three stars to put it on the shelf"
                    : "Locked. Keep cooking to unlock it"}
              </span>
            </p>
          ) : (
            <p className="text-[13px] font-bold text-walnut/75">
              Tap a bottle · 🎖️ {pins}/{MAX_PINS} Saucier pins · {st.perfect ?? 0} perfect
            </p>
          )}
        </div>
        {isSauceStationOpen(playerLevel) ? (
          <SortButton onClick={onPlay} testId="sauce-shelf-play">
            Make a sauce
          </SortButton>
        ) : null}
      </div>
    </div>
  );
}

export default SauceShelf;
