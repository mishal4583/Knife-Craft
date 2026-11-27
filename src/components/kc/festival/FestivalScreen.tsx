import { useRef, useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { festivalEvent, stageTier, type FestivalEvent } from "@/game/festival/events";
import { festivalsOf, stageToPlay } from "@/game/festival/state";
import { FestivalSelect } from "./FestivalSelect";
import { FestivalGame } from "./FestivalGame";

/** The developer's preview link: ?festival=<event number> opens that festival's round at once, ?pace=<1-15> plays it at another event's pace. */
export type FestivalPreview = { eventId: string; tier: number } | null;

type Playing = {
  event: FestivalEvent;
  tier: number;
  /** null: a preview at a pace past the event's stages. */
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
  const openStage = (event: FestivalEvent) => stageToPlay(save, event.id, event.stages ?? 1);
  /** The coach teaches the very first stage of the first festival, the first time it is played. */
  const first = (event: FestivalEvent, stage: number | null) =>
    event.number === 1 && stage === 1 && !festivalsOf(save).record[event.id];
  const atStage = (event: FestivalEvent, stage: number): Playing => ({
    event,
    stage,
    tier: stageTier(event, stage),
    attempt: 0,
    coach: first(event, stage),
  });
  const [playing, setPlaying] = useState<Playing | null>(() => {
    const event = preview ? festivalEvent(preview.eventId) : undefined;
    if (!event?.round) return null;
    const stage = preview!.tier - event.number + 1;
    const known = stage >= 1 && stage <= (event.stages ?? 1) ? stage : null;
    return { event, tier: preview!.tier, stage: known, attempt: 0, coach: first(event, known) };
  });
  // a new round gets new customers; the same day and attempt always the same ones
  const rounds = useRef(0);
  const seedFor = (p: Playing) =>
    p.event.number * 100003 +
    p.tier * 977 +
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
      key={`${playing.event.id}-${playing.tier}-${rounds.current}`}
      event={playing.event}
      tier={playing.tier}
      stage={playing.stage}
      openStage={openStage(playing.event)}
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
