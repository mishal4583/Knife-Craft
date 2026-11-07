import type { CSSProperties, ReactNode } from "react";
import {
  PEOPLE_LOOKS,
  PEOPLE_SHEETS,
  peopleUrl,
  type Expression,
} from "@/game/restaurant/peopleLooks";
import { sheetStatus, usePeopleSheets } from "../restaurantMap/peopleSheets";

/**
 * A named regular's face (NPC realism, developer 2026-11-07: the 12 regulars were an emoji in the service card, so they had no face at
 * all). `public/people/<id>/bust.webp` holds six expressions of the same person (neutral, pleased, delighted, impatient, annoyed,
 * enjoying their food); the card shows the one that follows the service. A customer without a bust, or a picture that cannot load,
 * keeps the old emoji (`fallback`), so nothing is ever blank. Sizes itself in `em`, like the emoji it replaces.
 */
const CELL: Record<Expression, number> = {
  neutral: 0,
  pleased: 1,
  delighted: 2,
  impatient: 3,
  annoyed: 4,
  enjoying: 5,
};

export function CustomerBust({
  customerId,
  expression = "neutral",
  fallback,
  className = "",
  em = 1.6,
}: {
  customerId: string;
  expression?: Expression;
  fallback: ReactNode;
  className?: string;
  /** Width and height in `em`. */
  em?: number;
}) {
  const look = PEOPLE_LOOKS[customerId];
  const ids = look?.bust ? [customerId] : [];
  usePeopleSheets(ids, "bust");
  if (!look?.bust || sheetStatus(customerId, "bust") === "fail") return <>{fallback}</>;
  const g = PEOPLE_SHEETS.bust;
  const i = CELL[expression];
  const col = i % g.cols;
  const row = Math.floor(i / g.cols);
  const style: CSSProperties = {
    width: `${em}em`,
    height: `${em}em`,
    backgroundImage: `url(${peopleUrl(customerId, "bust", import.meta.env.BASE_URL)})`,
    backgroundSize: `${g.cols * 100}% ${g.rows * 100}%`,
    backgroundPosition: `${(col / (g.cols - 1)) * 100}% ${row * 100}%`,
  };
  return (
    <span
      aria-hidden="true"
      className={`customer-bust inline-block shrink-0 rounded-full bg-no-repeat align-middle ${className}`}
      data-bust={customerId}
      data-expression={expression}
      style={style}
    />
  );
}
