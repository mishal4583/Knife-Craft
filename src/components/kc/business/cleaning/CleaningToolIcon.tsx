import type { CleaningToolId } from "@/game/restaurant/cleaningDirt";
import { TOOL_LOOK } from "./toolLook";

/**
 * CLEANING_TOOL_ICON — the cleaning tools as the player sees them, in the
 * toolbar and in the hand (developer 2026-10-22: "use proper cleaning tools").
 * Real emoji where Unicode has the tool (🧽 sponge, 🧹 broom); small
 * emoji-style drawings for the ones it hasn't (spray & cloth, mop, grill
 * scraper, toilet brush, squeegee — 🧴 is a lotion bottle, 🪣 a bucket), so no tool wears another object's emoji (a razor
 * for a scraper, a toothbrush for a toilet brush).
 */
function Drawn({ tool }: { tool: CleaningToolId }) {
  switch (tool) {
    case "mop": {
      // A string mop, filling the icon so it reads at toolbar size: a wooden handle,
      // a steel clamp and a full head of thick strands (developer 2026-10-22: "a mop").
      const strands = [8, 14, 20, 26, 32, 38, 44, 50, 56];
      return (
        <>
          <path d="M52 3 L33 35" stroke="#7a4a22" strokeWidth="7" strokeLinecap="round" />
          <path d="M52 3 L33 35" stroke="#c48a4c" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M51 6 L37 30" stroke="#e7b97f" strokeWidth="1.4" strokeLinecap="round" />
          {strands.map((x, i) => (
            <path
              key={`o${x}`}
              d={`M${31 + (i - 4) * 1.6} 40 Q${(31 + x) / 2} ${50 + (i % 2) * 2} ${x} ${58 + (i % 3)}`}
              stroke="#6f8597"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {strands.map((x, i) => (
            <path
              key={`i${x}`}
              d={`M${31 + (i - 4) * 1.6} 40 Q${(31 + x) / 2} ${50 + (i % 2) * 2} ${x} ${58 + (i % 3)}`}
              stroke={i % 2 ? "#dfe9f2" : "#f6fafd"}
              strokeWidth="4.4"
              strokeLinecap="round"
              fill="none"
            />
          ))}
          <rect
            x="21"
            y="33"
            width="21"
            height="9"
            rx="2.5"
            fill="#9aa6b1"
            stroke="#5d6873"
            strokeWidth="1.6"
          />
          <path d="M24 36 h15" stroke="#e3e9ee" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 61 q2-4 4 0 q-2 3-4 0z" fill="#5fb3ea" />
          <path d="M58 56 q2-4 4 0 q-2 3-4 0z" fill="#5fb3ea" />
        </>
      );
    }
    case "cloth":
      // A trigger spray bottle with a folded cloth.
      return (
        <>
          <path
            d="M6 50 q8-5 18-1 l-2 12 q-10 2-17-2z"
            fill="#f3c34a"
            stroke="#b8871e"
            strokeWidth="1.5"
          />
          <path d="M9 53 q7-2 13 0" stroke="#fbe39a" strokeWidth="1.4" fill="none" />
          <path
            d="M27 6 h16 l5 6 -9 2 v6 h-10z"
            fill="#3a7fc4"
            stroke="#24578a"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M31 14 l-5 8" stroke="#24578a" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="29" y="19" width="12" height="6" rx="1.5" fill="#24578a" />
          <path
            d="M28 25 h14 q6 8 6 18 v14 q0 4-4 4 h-18 q-4 0-4-4 v-14 q0-10 6-18z"
            fill="#7fd3e6"
            stroke="#3a93ad"
            strokeWidth="1.6"
          />
          <rect x="27" y="40" width="18" height="12" rx="2" fill="#ffffff" opacity="0.85" />
          <path d="M32 46 h10" stroke="#3a93ad" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M27 31 q-2 8-1 20"
            stroke="#d8f4fa"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="54" cy="8" r="1.6" fill="#7fd3e6" />
          <circle cx="58" cy="12" r="1.2" fill="#7fd3e6" />
          <circle cx="57" cy="5" r="1" fill="#7fd3e6" />
        </>
      );
    case "scraper":
      return (
        <>
          <rect x="27" y="4" width="10" height="28" rx="4" fill="#2f2a2a" />
          <rect x="29" y="7" width="6" height="3" rx="1" fill="#c0392b" />
          <rect x="26" y="30" width="12" height="7" rx="1.5" fill="#9aa3ab" />
          <path d="M14 37 h36 l-3 20 h-30 z" fill="#d9dee3" stroke="#8a949d" strokeWidth="1.8" />
          <path
            d="M18 52 h28"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />
        </>
      );
    case "toilet-brush":
      return (
        <>
          <rect
            x="29"
            y="2"
            width="6"
            height="38"
            rx="3"
            fill="#f4f4f4"
            stroke="#b9c2c9"
            strokeWidth="1.5"
          />
          <circle cx="32" cy="4" r="3.5" fill="#3b82c4" />
          <ellipse cx="32" cy="50" rx="15" ry="11" fill="#3b82c4" />
          {[-12, -6, 0, 6, 12].map((dx) => (
            <path
              key={dx}
              d={`M${32 + dx} 41 v18`}
              stroke="#1f5f99"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
          <ellipse cx="27" cy="45" rx="4" ry="2" fill="#ffffff" opacity="0.55" />
        </>
      );
    case "glass-cloth":
      return (
        <>
          <rect
            x="28"
            y="20"
            width="8"
            height="40"
            rx="4"
            fill="#f2b632"
            stroke="#c48a1c"
            strokeWidth="1.5"
          />
          <rect
            x="8"
            y="10"
            width="48"
            height="9"
            rx="2"
            fill="#c7ced4"
            stroke="#87919a"
            strokeWidth="1.5"
          />
          <rect x="6" y="4" width="52" height="7" rx="3" fill="#2d6fb3" />
          <path d="M12 7 h40" stroke="#8fc4f2" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

/** One tool, `size` px square: its emoji, or its drawing. */
export function CleaningToolIcon({ tool, size = 24 }: { tool: CleaningToolId; size?: number }) {
  const look = TOOL_LOOK[tool];
  if (look.emoji)
    return (
      <span
        aria-hidden
        className="inline-grid place-items-center leading-none"
        style={{ width: size, height: size, fontSize: size * 0.92 }}
      >
        {look.emoji}
      </span>
    );
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className="inline-block">
      <Drawn tool={tool} />
    </svg>
  );
}
