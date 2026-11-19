/**
 * The two upright mini-games (Dessert Run, Unload the Van) are drawn on one fixed 9:16 stage. In a wide window (a desktop, a tablet turned) that stage is
 * a column in the middle, and the game must still fill the window (developer 2026-11-19, Playgama 1.6.1 / 1.6.8, YouTube Playables Design 1: no empty
 * bars). So the room is carried on to the sides: the stage's own backdrop picture, repeated side by side and mirrored every other copy, so each seam is
 * the same picture reflected (a wall with the same shelves going on, never a blur and never a black strip).
 *
 * Put it as the FIRST child of the game's `<main>` (which must be a `[container-type:size]` box); the stage stays centered over it.
 */
export function StageSides({
  src,
  stage,
}: {
  src: string;
  stage: { readonly w: number; readonly h: number };
}) {
  const tile = `min(100cqw, calc(100cqh * ${stage.w} / ${stage.h}))`;
  return (
    <div
      aria-hidden="true"
      data-testid="stage-sides"
      className="pointer-events-none absolute inset-0 flex items-stretch justify-center overflow-hidden"
    >
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <img
          key={i}
          src={src}
          alt=""
          draggable={false}
          className="h-full shrink-0 object-cover"
          style={{ width: tile, transform: Math.abs(i) % 2 === 1 ? "scaleX(-1)" : undefined }}
        />
      ))}
    </div>
  );
}
