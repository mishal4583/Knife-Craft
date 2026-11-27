import { useRef, useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import {
  FESTIVAL_EVENTS,
  FESTIVAL_STAGES,
  festivalEvent,
  paceOfStage,
  type FestivalEvent,
} from "@/game/festival/events";
import { festivalStatus } from "@/game/festival/schedule";
import { festivalsOf, stageToPlay } from "@/game/festival/state";
import { paceFor } from "@/game/festival/tiers";
import type { Pace } from "@/game/festival/types";
import { FestivalSelect } from "./FestivalSelect";
import { FestivalGame } from "./FestivalGame";

/** The developer's preview link: ?festival=<event number> opens its round at once; &stage=<1-3>, or &pace=<1-15> for a row of the pace table. */
export type FestivalPreview = { eventId: string; stage: number; pace: number | null } | null;

type Playing = {
  event: FestivalEvent;
  pace: Pace;
  /** null: a preview at a row of the pace table. */
  stage: number | null;
  attempt: number;
  coach: boolean;
};

/**
 * THE FESTIVAL COMPETITION (developer 2026-11-27; plan: docs/planning/FESTIVAL-COMPETITION-PHASE0-2026-11-27.md): the list of the fifteen festivals,
 * and the round of the one chosen. A finished round is recorded (stars, best score); it pays no money and uses no stock.
 */
export function FestivalScreen({
  save,
  preview,
  onExit,
  onResult,
}: {
  save: SaveData;
  preview: FestivalPreview;
  onExit: () => void;
  onResult: (result: {
    eventId: string;
    score: number;
    stars: number;
    won: boolean;
    stage: number;
  }) => void;
}) {
  const day = save.business.calendar.businessDay;
  const openStage = (event: FestivalEvent) => stageToPlay(save, event.id, FESTIVAL_STAGES);
  /** After the third stage: when the next festival can be played. */
  const nextNote = (event: FestivalEvent): string => {
    const next = FESTIVAL_EVENTS[event.number];
    if (!next) return "";
    const status = festivalStatus(save, next);
    if (status.state === "services")
      return `${next.name} unlocked! Play it in ${status.left} more ${status.left === 1 ? "service" : "services"}.`;
    return status.state === "open" ? `${next.name} is unlocked.` : "";
  };
  /** The coach teaches the very first stage of the first festival, the first time it is played. */
  const first = (event: FestivalEvent, stage: number | null) =>
    event.number === 1 && stage === 1 && !festivalsOf(save).record[event.id];
  const atStage = (event: FestivalEvent, stage: number): Playing => ({
    event,
    stage,
    pace: paceOfStage(event, stage),
    attempt: 0,
    coach: first(event, stage),
  });
  const [playing, setPlaying] = useState<Playing | null>(() => {
    const event = preview ? festivalEvent(preview.eventId) : undefined;
    if (!event?.round) return null;
    if (preview!.pace !== null)
      return { event, pace: paceFor(preview!.pace), stage: null, attempt: 0, coach: false };
    return { ...atStage(event, preview!.stage) };
  });
  // a new round gets new customers; the same day and attempt always the same ones
  const rounds = useRef(0);
  const seedFor = (p: Playing) =>
    p.event.number * 100003 +
    (p.pace.tier * 977 + (p.stage ?? 0) * 7919) +
    day * 9176 +
    ((festivalsOf(save).record[p.event.id]?.plays ?? 0) + p.attempt) * 31;
  const [seed, setSeed] = useState(() => (playing ? seedFor(playing) : 0));

  const play = (next: Playing) => {
    rounds.current += 1;
    setSeed(seedFor(next));
    setPlaying(next);
  };

  if (!playing)
    return (
      <FestivalSelect
        save={save}
        onExit={onExit}
        onPlay={(event) => play(atStage(event, openStage(event)))}
      />
    );
  return (
    <FestivalGame
      // a new round is a new game: nothing of the last one is left over
      key={`${playing.event.id}-${playing.stage}-${playing.pace.tier}-${rounds.current}`}
      event={playing.event}
      pace={playing.pace}
      stage={playing.stage}
      openStage={openStage(playing.event)}
      nextNote={nextNote(playing.event)}
      seed={seed}
      coach={playing.coach}
      onResult={(r) =>
        onResult({
          eventId: playing.event.id,
          score: r.score,
          stars: r.stars,
          won: r.won,
          // a stage counts only when it was open (a preview link never skips ahead)
          stage:
            playing.stage !== null && playing.stage <= openStage(playing.event) ? playing.stage : 0,
        })
      }
      onAgain={() => play({ ...playing, attempt: playing.attempt + 1, coach: false })}
      onStage={(stage) => play(atStage(playing.event, stage))}
      onList={() => setPlaying(null)}
      onExit={onExit}
    />
  );
}
