import type { CSSProperties } from "react";
import { cellStyle, type SheetName } from "./peopleSheets";
import "./people.css";

/**
 * A painted person from `public/people/<id>/` (NPC realism, developer 2026-11-07). One sheet is one WebP of equal cells (a: 6 x 4, b: 6 x 1,
 * bust: 3 x 2); a pose is a cell, a walk cycle is four cells stepped by CSS `steps()` (no animation library, no JS per frame).
 * Sheets load lazily when a map shows the person (peopleSheets.ts); a sheet that fails leaves the old SVG puppet (GuestPoses) in its place.
 */

/** A person's pose as a box: fills its parent, one cell of the sheet. `walk` steps through the four walk cells of `row`. */
export function PoseCell({
  id,
  sheet = "a",
  col = 0,
  row = 0,
  walk = false,
  flip = false,
  seconds = 0.72,
  className = "",
  style,
  testId,
}: {
  id: string;
  sheet?: SheetName;
  col?: number;
  row?: number;
  walk?: boolean;
  flip?: boolean;
  /** One walk cycle (four steps). */
  seconds?: number;
  className?: string;
  style?: CSSProperties | undefined;
  testId?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={`cs-cell ${walk ? "cs-walk" : ""} ${flip ? "cs-flip" : ""} ${className}`}
      data-testid={testId}
      style={{
        ...cellStyle(id, sheet, col, row),
        ...(walk ? { animationDuration: `${seconds}s` } : null),
        ...style,
      }}
    />
  );
}
