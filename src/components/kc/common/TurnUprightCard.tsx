/** The "turn your phone upright" card (see `useTurnUpright`). Covers the whole game it sits in. */
export function TurnUprightCard({
  game,
  onPlayAnyway,
  onLeave,
  testId,
}: {
  game: string;
  onPlayAnyway: () => void;
  onLeave: () => void;
  testId: string;
}) {
  return (
    <div
      className="absolute inset-0 z-40 flex overflow-y-auto overscroll-contain bg-[#2b1a10]/90 p-3"
      data-testid={testId}
      role="dialog"
      aria-label={`${game}: turn your phone upright`}
    >
      <div className="m-auto flex w-full max-w-[560px] items-center gap-4 rounded-[28px] border-2 border-[#e6c579] bg-[#fff4dc] p-4 text-[#492b19] shadow-2xl">
        <p className="shrink-0 text-5xl" aria-hidden="true">
          📱
        </p>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black">Turn your phone upright</h2>
          <p className="mt-1 text-sm">
            {game} is drawn for a tall screen and is easiest to play held upright.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPlayAnyway}
              data-testid={`${testId}-anyway`}
              className="min-h-12 flex-1 rounded-2xl border border-[#cfb58a] px-4 font-bold"
            >
              Play anyway
            </button>
            <button
              type="button"
              onClick={onLeave}
              data-testid={`${testId}-leave`}
              className="min-h-12 flex-1 rounded-2xl bg-[#557b47] px-4 font-bold text-white"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
