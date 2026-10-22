import type { CleaningToolId } from "@/game/restaurant/cleaningDirt";
import { TOOL_LOOK } from "./toolLook";

/**
 * CLEANING_TOOL_ICON — the cleaning tools as the player sees them, in the
 * toolbar and in the hand (developer 2026-10-22: "use proper cleaning tools").
 * Real emoji where Unicode has the tool (🧽 sponge, 🧹 broom, 🧴 spray bottle);
 * small emoji-style drawings for the ones it hasn't (mop, grill scraper,
 * toilet brush, squeegee), so no tool wears another object's emoji (a razor
 * for a scraper, a toothbrush for a toilet brush).
 */
function Drawn({ tool }: { tool: CleaningToolId }) {
  switch (tool) {
    case "mop":
      return (
        <>
          <rect
            x="30"
            y="2"
            width="5"
            height="40"
            rx="2.5"
            fill="#b0763e"
            transform="rotate(18 32 22)"
          />
          <rect x="22" y="38" width="20" height="7" rx="2" fill="#8d99a6" />
          <path
            d="M20 44 h24 l4 15 q-2 3-5 0 l-2-6 -2 8 q-3 3-5 0 l-1-8 -2 8 q-3 3-5 0 l-1-8 -2 7 q-3 2-4-1z"
            fill="#eef5fb"
            stroke="#9fb6c8"
            strokeWidth="1.5"
          />
          <circle cx="52" cy="58" r="2.4" fill="#7cc3ef" />
          <circle cx="14" cy="57" r="1.8" fill="#7cc3ef" />
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
