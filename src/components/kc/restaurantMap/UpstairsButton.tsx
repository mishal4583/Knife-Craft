import { cn } from "@/lib/utils";
import "./upstairs.css";

/**
 * THE WAY UP (developer 2026-11-08: "the second floor button is not quickly noticeable; make it better and beautiful, suitable for a
 * game"). A brass-and-walnut medallion button with a stairway icon, "2nd Floor" in the display face and one short line under it: the
 * money waiting, "Full", "Buy a machine" or "New!". When there is a reason to go up it breathes (a glow ring, transform and opacity
 * only) and wears a red chip. Locked: a padlock and the level it opens. It owns no rule: the map passes in what to say.
 */
export function UpstairsButton({
  open,
  note,
  attention,
  chip,
  ariaLabel,
  lockedText,
  onClick,
  className,
}: {
  open: boolean;
  /** The line under the title (open): money waiting, full, a goal. */
  note: string | null;
  /** A reason to go up now: the button breathes. */
  attention: boolean;
  /** A small chip on the corner ("$4.40", "New!"), or null. */
  chip: string | null;
  ariaLabel: string;
  /** Locked: when it opens ("Level 11"). */
  lockedText: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-testid="upstairs"
      data-attention={attention ? "1" : undefined}
      data-open={open ? "1" : "0"}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn("upstairs-btn press", open ? "is-open" : "is-locked", className)}
    >
      {open && attention ? <span className="upstairs-glow" aria-hidden /> : null}
      <span className="upstairs-medal" aria-hidden>
        {open ? (
          <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
            <path
              d="M5 26h6v-5h6v-5h6v-5h4"
              stroke="#4a2a14"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22 6h6v6M28 6 20 14"
              stroke="#4a2a14"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="text-[20px] leading-none">🔒</span>
        )}
      </span>
      <span className="upstairs-text">
        <span className="upstairs-title">2nd Floor</span>
        <span className="upstairs-note">
          {open ? (note ?? "Machines earn for you") : lockedText}
        </span>
      </span>
      {open && chip ? <span className="upstairs-chip">{chip}</span> : null}
    </button>
  );
}
