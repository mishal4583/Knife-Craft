import { landscapeSectionArt, type LandscapeSection } from "@/game/landscapeArt";
import { useLandscape } from "./layoutMode";

/**
 * A screen's landscape backdrop: the section's 16:9 painting behind the
 * content, under a soft paper wash so text stays readable. Renders nothing in
 * portrait (the screen keeps its own look there).
 */
export function LandscapeBackdrop({
  section,
  wash = "paper",
}: {
  section: LandscapeSection;
  /** "paper": a light wash for list screens; "dim": a dark, soft frame around a map; "none": as is. */
  wash?: "paper" | "dim" | "none";
}) {
  const landscape = useLandscape();
  if (!landscape) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <img
        src={landscapeSectionArt(section)}
        alt=""
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover ${wash === "dim" ? "scale-105 blur-[3px]" : ""}`}
        draggable={false}
      />
      {wash === "dim" ? (
        <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_50%_50%,rgba(40,24,14,0.25),rgba(30,18,10,0.7))]" />
      ) : null}
      {wash === "paper" ? (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,232,0.86),rgba(250,238,214,0.9))]" />
      ) : null}
    </div>
  );
}
