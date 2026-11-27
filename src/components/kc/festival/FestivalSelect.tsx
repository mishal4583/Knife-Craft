import type { SaveData } from "@/game/SaveManager";
import { rivalPortraitPath } from "@/game/chefArt";
import { rivalChefOf } from "@/game/restaurant/rivalChefs";
import { RIVALS } from "@/game/restaurant/cityRanking";
import {
  FESTIVAL_EVENTS,
  FESTIVAL_STAGES,
  stageIndex,
  type FestivalEvent,
} from "@/game/festival/events";
import { festivalStatus, type FestivalStatus } from "@/game/festival/schedule";
import { festivalsOf } from "@/game/festival/state";
import { useUnlockText } from "@/components/kc/navLevel";
import { UI_ART, festivalUrl, gameUrl } from "./festivalArt";

/**
 * THE FIFTEEN FESTIVALS (developer 2026-11-27): which are open, which come next and what opens them (a locked one in the game's own words: the
 * restaurant game never names a level), who hosts each, and the best of each one played. Upright: one column; on its side: two, or three when each card has room.
 */
export function FestivalSelect({
  save,
  onPlay,
  onExit,
}: {
  save: SaveData;
  onPlay: (event: FestivalEvent) => void;
  onExit: () => void;
}) {
  const unlock = useUnlockText();
  const records = festivalsOf(save).record;
  const lockLine = (status: FestivalStatus): string => {
    if (status.state === "level") return `Opens ${unlock.when(status.level)}`;
    if (status.state === "previous") return `Win the ${status.previous.name}`;
    if (status.state === "services")
      return `Opens in ${status.left} ${status.left === 1 ? "service" : "services"}`;
    return "";
  };

  return (
    <div
      className="@container flex h-full w-full flex-col bg-[linear-gradient(180deg,#ffcf8a_0%,#f59a5c_38%,#b4521f_100%)] text-[#492b19]"
      data-testid="festival-select"
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to the Kitchen"
          data-testid="festival-back"
          className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] border-[#ffd98a] bg-[linear-gradient(#e2672f,#a63c12)] text-xl font-black text-white shadow-md"
        >
          ←
        </button>
        <img
          src={festivalUrl(UI_ART.trophy)}
          alt=""
          className="h-11 w-11 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <h1 className="font-display text-[19px] font-black leading-tight text-[#3d1c06]">
            Festival Competition
          </h1>
          <p className="font-ui text-[12.5px] font-extrabold text-[#5a2c0c]">
            Out-cook a rival at the food fair
          </p>
        </div>
      </header>
      <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2.5 overflow-y-auto overscroll-contain px-3 pb-5 pt-1 land:grid-cols-2 land:@min-[1000px]:grid-cols-3">
        {FESTIVAL_EVENTS.map((event) => {
          const status = festivalStatus(save, event);
          const record = records[event.id];
          const open = status.state === "open";
          const playable = open && !!event.round;
          // the card names the rival to beat next (the third, once all are beaten)
          const beaten = Math.min(record?.cleared ?? 0, FESTIVAL_STAGES);
          const nextRival = event.rivals[stageIndex(beaten + 1)];
          const chef = rivalChefOf(nextRival);
          const stall = RIVALS.find((r) => r.id === nextRival)?.name ?? "";
          const state = playable ? "play" : open ? "soon" : "locked";
          return (
            <li
              key={event.id}
              data-testid={`festival-card-${event.id}`}
              data-state={state}
              className={`flex min-h-[88px] items-center gap-2.5 rounded-[20px] border-2 p-2.5 shadow-[0_4px_8px_rgba(70,25,0,0.28)] ${
                playable
                  ? "border-[#e5a437] bg-[linear-gradient(170deg,#fffaf0,#ffe9bd)]"
                  : "border-[#d9b787] bg-[#fff4e0]/80"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#ffe2b0] text-[30px] ${state === "locked" ? "grayscale" : ""}`}
              >
                {event.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-ui text-[11px] font-black uppercase tracking-wide text-[#a4581c]">
                  Event {event.number}
                </span>
                <span className="block font-display text-[15px] font-black leading-tight">
                  {event.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-ui text-[12px] font-bold text-[#7a4a24]">
                  {/* the three rivals, in stage order: a green ring and tick on each one beaten */}
                  <span
                    className="flex shrink-0 gap-0.5"
                    data-testid={`festival-rivals-${event.id}`}
                  >
                    {event.rivals.map((id, i) => {
                      const face = rivalPortraitPath(id);
                      return face ? (
                        <span key={id} className="relative" data-beaten={i < beaten || undefined}>
                          <img
                            src={gameUrl(face)}
                            alt=""
                            loading="lazy"
                            className={`h-6 w-5 rounded-full bg-[#ffd9a8] object-cover object-top ${
                              i < beaten
                                ? "ring-2 ring-[#4c9a2a]"
                                : i === beaten
                                  ? "ring-2 ring-[#e5a437]"
                                  : "opacity-60"
                            }`}
                          />
                          {i < beaten ? (
                            <span
                              aria-hidden="true"
                              className="absolute -bottom-1 -right-1 grid h-3 w-3 place-items-center rounded-full bg-[#4c9a2a] text-[8.5px] font-black leading-none text-white"
                            >
                              ✓
                            </span>
                          ) : null}
                        </span>
                      ) : null;
                    })}
                  </span>
                  <span className="min-w-0 flex-[1_1_120px] leading-tight">
                    {chef ? `Chef ${chef.chef.split(" ")[0]} · ` : ""}
                    {stall}
                  </span>
                </span>
                {record ? (
                  <span
                    className="mt-0.5 block font-ui text-[12px] font-extrabold"
                    data-testid={`festival-record-${event.id}`}
                  >
                    <span aria-label={`${record.stars} of 3 stars`}>
                      {"★".repeat(record.stars)}
                      <span className="opacity-30">{"★".repeat(3 - record.stars)}</span>
                    </span>{" "}
                    · stages {beaten}/{FESTIVAL_STAGES} · best {record.best}
                  </span>
                ) : null}
              </span>
              {playable ? (
                <button
                  type="button"
                  onClick={() => onPlay(event)}
                  data-testid={`festival-play-${event.id}`}
                  className="press min-h-12 shrink-0 rounded-2xl bg-[linear-gradient(#6fb04a,#437a28)] px-4 font-ui text-[15px] font-black text-white shadow-[0_3px_0_#2f5a1a]"
                >
                  Play
                </button>
              ) : (
                <span
                  data-testid={`festival-lock-${event.id}`}
                  className="max-w-[104px] shrink-0 text-center font-ui text-[11.5px] font-extrabold leading-tight text-[#7a4a24]"
                >
                  {open ? (
                    <span aria-hidden="true" className="block text-[18px]">
                      🛠️
                    </span>
                  ) : (
                    <img
                      src={festivalUrl(UI_ART.lock)}
                      alt=""
                      loading="lazy"
                      className="mx-auto mb-0.5 h-7 w-7 object-contain"
                    />
                  )}
                  {open ? "Coming soon" : lockLine(status)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
