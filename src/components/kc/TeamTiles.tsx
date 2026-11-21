import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StaffPortrait } from "./business/StaffCard";
import { staffFallbackEmoji, staffPortraitFile } from "./business/staffPortraits";

/**
 * The people a service needs as picture tiles (developer 2026-11-21: "check the whole screen, if anything else needs to be digitalized"), the look of the freshness
 * watch and the supply tiles: the person's own portrait in a gold ring, the role, ready or needed, an ⓘ for why, and Hire ›. Used by the service blockers (a missing
 * person) and by Required team.
 */

export type TeamTileData = {
  /** The role or specialist id (the portrait's file is read from it). */
  id: string;
  title: string;
  specialist: boolean;
  met: boolean;
  /** The ⓘ beside the role (why it is needed). */
  why?: ReactNode;
  onHire: () => void;
};

export function TeamTile({ person }: { person: TeamTileData }) {
  const { met } = person;
  return (
    <li
      data-testid="team-tile"
      data-role={person.id}
      data-met={met ? "true" : "false"}
      className={cn(
        "relative flex min-w-0 flex-col items-center overflow-hidden rounded-[20px] border-2 bg-gradient-to-b from-ivory to-cream p-2.5",
        met
          ? "border-sage/50 shadow-[0_3px_0_rgba(110,140,90,0.18),0_8px_16px_rgba(60,35,15,0.10)]"
          : "border-tomato/45 shadow-[0_3px_0_rgba(184,60,48,0.16),0_8px_16px_rgba(60,35,15,0.10)]",
      )}
    >
      <p
        className={cn(
          "flex w-full items-center gap-1 rounded-full px-2 py-1 font-ui text-[10.5px] font-extrabold leading-none",
          met ? "bg-sage/20 text-olive" : "bg-tomato/12 text-tomato",
        )}
      >
        <span aria-hidden="true">{met ? "✓" : "⛔"}</span>
        <span className="truncate">{met ? "On the team" : "Needed"}</span>
      </p>
      <span className="relative mt-2 block h-[84px] w-[84px] overflow-hidden rounded-full border-[3px] border-gold/70 bg-cream shadow-[0_4px_8px_rgba(60,35,15,0.25)]">
        <StaffPortrait
          file={staffPortraitFile(person.id)}
          name={person.title}
          emoji={staffFallbackEmoji(person.id, person.specialist)}
          className="h-full w-full text-[40px]"
        />
      </span>
      <p className="mt-1.5 flex items-center gap-1 text-center font-display text-[15px] font-black leading-tight text-walnut-dark">
        <span className="min-w-0">{person.title}</span>
        {person.why ? <span className="shrink-0">{person.why}</span> : null}
      </p>
      {met ? (
        <p className="mt-auto pt-2 font-ui text-[11.5px] font-bold text-olive">Ready for service</p>
      ) : (
        <button
          type="button"
          onClick={person.onHire}
          className="press mt-auto min-h-11 w-full rounded-full bg-tomato px-3 font-ui text-[12px] font-extrabold text-ivory shadow-[0_2px_0_rgba(60,35,15,0.25)]"
        >
          Hire ›
        </button>
      )}
    </li>
  );
}

export function TeamGrid({ people }: { people: TeamTileData[] }) {
  return (
    <ul
      data-testid="team-grid"
      className="mt-3 grid grid-cols-2 gap-2.5 land:grid-cols-4 landx:grid-cols-5"
    >
      {people.map((p) => (
        <TeamTile key={p.id} person={p} />
      ))}
    </ul>
  );
}
