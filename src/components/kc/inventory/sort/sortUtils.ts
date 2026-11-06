/** Plain helpers of the two sorting games' shared look (kept apart from the components so fast refresh keeps working). */

export const fsUrl = (name: string) =>
  `${import.meta.env.BASE_URL}business/fridge-sort/${name}.webp`;

/** Where on the painted star bar (fraction of its width) the star marks sit, and the bar's usable track. */
export const BAR_MARKS = [0.406, 0.682, 0.917] as const;
export const BAR_LEFT = 0.06;
export const BAR_RIGHT = 0.95;

/** Progress (0..1, where `marks` are the 1-, 2- and 3-star shares) -> where the fill ends on the bar: piecewise linear through the star marks. */
export function barX(share: number, marks: readonly [number, number, number]): number {
  const at = [0, ...marks, 1];
  const xs = [BAR_LEFT, ...BAR_MARKS, BAR_RIGHT];
  const v = Math.min(1, Math.max(0, share));
  for (let i = 1; i < at.length; i++)
    if (v <= at[i]!)
      return xs[i - 1]! + ((v - at[i - 1]!) / (at[i]! - at[i - 1]!)) * (xs[i]! - xs[i - 1]!);
  return BAR_RIGHT;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const clock = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)}:${pad(Math.floor((Math.max(0, ms) % 60000) / 1000))}`;
