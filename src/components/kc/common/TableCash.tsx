import type { CSSProperties } from "react";
import { formatUsd } from "@/game/money";
import { bundleCount, tablePiles } from "@/game/restaurant/tableCash";
import type { FloorPoint } from "@/game/restaurant/serviceFloor";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import "./tableCash.css";

/**
 * The cash lying on the tables (developer 2026-10-31): bundles of bills piled on the front
 * tables, with the amount; one tap collects the whole pile (`onCollect` = App.collectTableCash).
 * Used by the dining room (ServiceFloor) and the restaurant map. Absolute boxes inside a layer
 * that is the painting's own box; `place` turns a map point into that layer's percent.
 */
export function TableCash({
  stage,
  at,
  where = "the tables",
  testId = "table-cash",
  cents,
  onCollect,
  place = (p) => p,
  first = 0,
  className = "",
}: {
  /** The kitchen's art stage, for the table points (omit when `at` places the pile). */
  stage?: KitchenMapArtStage;
  /** One pile at this map point instead of on the tables (the Second Floor's Pickup Counter). */
  at?: FloorPoint;
  /** Where the cash lies, for the button's name. */
  where?: string;
  testId?: string;
  cents: number;
  onCollect: () => void;
  place?: (p: FloorPoint) => FloorPoint;
  /** The table the pile fills first (the dining room passes the one nobody sits at). */
  first?: 0 | 1;
  className?: string;
}) {
  const piles = at
    ? cents > 0
      ? [{ at, bundles: bundleCount(cents) }]
      : []
    : stage
      ? tablePiles(stage, cents, first)
      : [];
  if (piles.length === 0) return null;
  const owed = formatUsd(cents);
  return (
    <div className={`tc-layer ${className}`} data-testid={testId}>
      {piles.map((pile, i) => {
        const p = place(pile.at);
        return (
          <button
            key={i}
            type="button"
            className="tc-pile press"
            style={{ left: `${p.x}%`, top: `${p.y}%` } as CSSProperties}
            aria-label={`Collect ${owed} from ${where}`}
            data-testid={`${testId}-pile`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onCollect();
            }}
          >
            <span className="tc-stack" aria-hidden="true">
              {Array.from({ length: pile.bundles }, (_, k) => (
                <span
                  key={k}
                  className={`tc-bundle${k % 3 === 2 ? " tc-bundle--tip" : ""}`}
                  style={{ bottom: `${k * 5}px`, left: `${k % 2 === 0 ? -3 : 3}px` }}
                />
              ))}
            </span>
            {i === 0 ? (
              <span className="tc-label" data-testid={`${testId}-amount`}>
                💵 {owed}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
