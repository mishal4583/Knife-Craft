/** The shapes of the temporary food art (DrawnFood.tsx puts them where food stands). */
import type { ReactNode } from "react";
import type { Shape } from "./foodLooks";

export const INK = "rgba(60, 26, 4, 0.55)";
export const SHINE = "rgba(255, 255, 255, 0.45)";

/** A colour part of the way to another (both #rrggbb). */
export function mix(from: string, to: string, t: number): string {
  const part = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const at = (i: number) =>
    Math.round(part(from, i) + (part(to, i) - part(from, i)) * Math.max(0, Math.min(1, t)))
      .toString(16)
      .padStart(2, "0");
  return `#${at(0)}${at(1)}${at(2)}`;
}

/** A little heap of small round things. */
const PILE: readonly (readonly [number, number])[] = [
  [26, 31],
  [38, 22],
  [52, 18],
  [66, 23],
  [76, 32],
  [34, 40],
  [47, 31],
  [61, 33],
  [48, 45],
  [68, 43],
  [24, 43],
  [56, 25],
  [41, 15],
  [73, 19],
];

/** Places for several small pieces inside a 100 x 60 box. */
const SCATTER: readonly (readonly [number, number])[] = [
  [30, 24],
  [56, 18],
  [74, 30],
  [44, 38],
  [66, 44],
  [22, 40],
];

/** A piece of food drawn in a 100 x 60 box, seen from a little above. */
export function piece(shape: Shape, color: string, accent: string): ReactNode {
  const line = { stroke: INK, strokeWidth: 1.4 };
  switch (shape) {
    case "flat":
    case "disc":
      return (
        <g>
          <ellipse cx="50" cy="34" rx="46" ry="22" fill={accent} {...line} />
          <ellipse cx="50" cy="31" rx="43" ry="19" fill={color} />
          {[
            [32, 28],
            [58, 24],
            [68, 36],
            [44, 40],
          ].map(([x, y]) => (
            <ellipse key={x} cx={x} cy={y} rx="5" ry="2.6" fill={accent} opacity="0.55" />
          ))}
          <ellipse cx="38" cy="22" rx="14" ry="4" fill={SHINE} />
        </g>
      );
    case "crepe":
      return (
        <g>
          <path d="M8 44 Q50 4 92 44 Q50 58 8 44 Z" fill={color} {...line} />
          <path d="M18 42 Q50 16 82 42" fill="none" stroke={accent} strokeWidth="3" />
          <path d="M30 41 Q50 26 70 41" fill="none" stroke={accent} strokeWidth="2.4" />
        </g>
      );
    case "slice":
      return (
        <g>
          <path d="M16 22 Q16 8 50 10 Q84 8 84 22 L86 46 Q50 58 14 46 Z" fill={accent} {...line} />
          <path d="M22 23 Q22 14 50 15 Q78 14 78 23 L79 42 Q50 51 21 42 Z" fill={color} />
          <ellipse cx="38" cy="23" rx="13" ry="4" fill={SHINE} />
        </g>
      );
    case "plate":
      return (
        <g>
          <ellipse cx="50" cy="36" rx="48" ry="22" fill={accent} {...line} />
          <ellipse cx="50" cy="33" rx="45" ry="19" fill={color} />
          <ellipse cx="50" cy="34" rx="31" ry="12" fill="none" stroke={accent} strokeWidth="1.6" />
        </g>
      );
    case "bowl":
      return (
        <g>
          <path d="M6 26 Q10 56 50 56 Q90 56 94 26 Z" fill={accent} {...line} />
          <ellipse cx="50" cy="26" rx="44" ry="15" fill={accent} {...line} />
          <ellipse cx="50" cy="27" rx="39" ry="12" fill={color} />
          <path d="M20 42 Q50 54 80 42" fill="none" stroke={SHINE} strokeWidth="3" />
        </g>
      );
    case "board":
      return (
        <g>
          <path d="M12 16 L88 16 L96 48 L4 48 Z" fill={color} {...line} />
          <path d="M4 48 L96 48 L95 55 L5 55 Z" fill={accent} {...line} />
          {[24, 33, 41].map((y) => (
            <path key={y} d={`M12 ${y} H88`} stroke={accent} strokeWidth="1.2" opacity="0.7" />
          ))}
        </g>
      );
    case "fillet":
      return (
        <g>
          <path
            d="M10 34 Q14 14 44 15 Q72 8 90 26 Q96 44 66 48 Q32 56 10 34 Z"
            fill={color}
            {...line}
          />
          {[28, 46, 64].map((x) => (
            <path
              key={x}
              d={`M${x} 19 L${x + 12} 45`}
              stroke={accent}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.85"
            />
          ))}
          <ellipse cx="36" cy="23" rx="13" ry="3.5" fill={SHINE} />
        </g>
      );
    case "claw":
      return (
        <g>
          <path
            d="M14 38 Q30 14 56 26 Q70 8 90 14 Q82 22 74 28 Q92 28 92 40 Q70 48 58 40 Q40 56 14 38 Z"
            fill={color}
            {...line}
          />
          <path d="M26 36 Q40 26 54 32" fill="none" stroke={accent} strokeWidth="3" />
          <path d="M33 45 L30 30 M45 44 L42 28" stroke={accent} strokeWidth="2.4" />
        </g>
      );
    case "sausages":
      return (
        <g transform="rotate(-8 50 32)">
          {[17, 34].map((y) => (
            <g key={y}>
              <rect x="10" y={y} width="80" height="15" rx="7.5" fill={color} {...line} />
              <path
                d={`M28 ${y + 2} l8 11 M48 ${y + 2} l8 11 M68 ${y + 2} l8 11`}
                stroke={accent}
                strokeWidth="2.6"
              />
              <rect x="18" y={y + 3} width="40" height="3" rx="1.5" fill={SHINE} />
            </g>
          ))}
        </g>
      );
    case "ribs":
      return (
        <g>
          {[18, 38, 58].map((x) => (
            <rect key={x} x={x + 4} y="6" width="9" height="50" rx="4.5" fill={accent} {...line} />
          ))}
          <path d="M10 22 Q50 12 90 22 L88 44 Q50 52 12 44 Z" fill={color} {...line} />
          <path d="M30 20 V46 M50 18 V47 M70 20 V46" stroke={INK} strokeWidth="2" />
          <ellipse cx="36" cy="25" rx="15" ry="3.5" fill={SHINE} />
        </g>
      );
    case "prawns":
      return (
        <g>
          {[
            [30, 28],
            [64, 24],
            [50, 44],
          ].map(([x, y]) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <path
                d="M-16 6 Q-14 -14 6 -12 Q20 -8 14 6 Q8 2 4 -1 Q-6 -4 -7 8 Z"
                fill={color}
                {...line}
              />
              <path d="M-9 -7 l3 7 M0 -11 l1 8 M9 -8 l-3 7" stroke={accent} strokeWidth="2" />
              <path
                d="M-16 6 l-5 6 M-7 8 l-3 6"
                stroke={accent}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>
      );
    case "balls":
      return (
        <g>
          {[
            [32, 30],
            [66, 28],
            [49, 43],
          ].map(([x, y]) => (
            <g key={x}>
              <circle cx={x} cy={y} r="14" fill={color} {...line} />
              <path
                d={`M${x! - 8} ${y! + 5} q8 6 16 0`}
                fill="none"
                stroke={accent}
                strokeWidth="2.4"
              />
              <circle cx={x! - 5} cy={y! - 5} r="3.6" fill={SHINE} />
            </g>
          ))}
        </g>
      );
    case "cubes":
      return (
        <g>
          {[
            [18, 20],
            [48, 12],
            [34, 34],
            [64, 28],
          ].map(([x, y]) => (
            <g key={x}>
              <rect x={x} y={y} width="22" height="20" rx="4" fill={color} {...line} />
              <path d={`M${x! + 3} ${y! + 13} h16`} stroke={accent} strokeWidth="3" />
              <rect x={x! + 3} y={y! + 3} width="10" height="3" rx="1.5" fill={SHINE} />
            </g>
          ))}
        </g>
      );
    case "strips":
      return (
        <g>
          {[18, 31, 44].map((y, i) => (
            <path
              key={y}
              d={`M12 ${y} q13 -9 26 0 t26 0 t24 -2`}
              fill="none"
              stroke={i === 1 ? accent : color}
              strokeWidth="9"
              strokeLinecap="round"
            />
          ))}
        </g>
      );
    case "egg":
      return (
        <g>
          <path
            d="M14 32 Q12 14 36 16 Q56 6 74 18 Q94 22 86 40 Q78 54 52 49 Q22 56 14 32 Z"
            fill={color}
            {...line}
          />
          <ellipse cx="50" cy="30" rx="15" ry="11" fill={accent} {...line} />
          <ellipse cx="45" cy="26" rx="5" ry="3" fill={SHINE} />
        </g>
      );
    case "waffle":
      return (
        <g>
          <path d="M22 12 L78 12 L90 48 L10 48 Z" fill={color} {...line} />
          <path d="M10 48 L90 48 L88 55 L12 55 Z" fill={accent} {...line} />
          <path
            d="M19 22 H81 M15 34 H85 M38 12 L32 48 M62 12 L68 48 M50 12 V48"
            stroke={accent}
            strokeWidth="3.4"
          />
        </g>
      );
    case "noodles":
      return (
        <g fill="none" strokeLinecap="round">
          <ellipse cx="50" cy="34" rx="40" ry="18" fill={color} stroke={INK} strokeWidth="1.4" />
          {[0, 1, 2, 3].map((i) => (
            <ellipse
              key={i}
              cx={38 + i * 8}
              cy={31 + (i % 2) * 6}
              rx={24 - i * 2}
              ry={9 + (i % 2) * 2}
              stroke={i % 2 ? accent : "#fff0b0"}
              strokeWidth="2.6"
            />
          ))}
        </g>
      );
    case "tubes":
      return (
        <g>
          {SCATTER.slice(0, 5).map(([x, y], i) => (
            <g key={x} transform={`rotate(${i % 2 ? 26 : -22} ${x} ${y})`}>
              <rect x={x - 15} y={y - 7} width="30" height="14" rx="3" fill={color} {...line} />
              <ellipse cx={x + 15} cy={y} rx="3.6" ry="6.4" fill={accent} />
              <path
                d={`M${x - 11} ${y - 2} h20 M${x - 11} ${y + 2.5} h20`}
                stroke={accent}
                strokeWidth="1.4"
              />
            </g>
          ))}
        </g>
      );
    case "squares":
      return (
        <g>
          {[
            [16, 18],
            [46, 10],
            [34, 34],
            [64, 30],
          ].map(([x, y]) => (
            <g key={x}>
              <rect
                x={x}
                y={y}
                width="24"
                height="20"
                rx="3"
                fill={accent}
                {...line}
                strokeDasharray="3 2"
              />
              <rect x={x! + 4} y={y! + 4} width="16" height="12" rx="5" fill={color} />
            </g>
          ))}
        </g>
      );
    case "muffin":
      return (
        <g>
          <path d="M28 32 L72 32 L66 56 L34 56 Z" fill={accent} {...line} />
          <path d="M40 34 L43 55 M50 34 V55 M60 34 L57 55" stroke={SHINE} strokeWidth="2" />
          <path
            d="M22 34 Q18 20 34 18 Q38 6 52 9 Q68 6 70 19 Q84 20 78 34 Q50 40 22 34 Z"
            fill={color}
            {...line}
          />
          <ellipse cx="42" cy="17" rx="9" ry="3.4" fill={SHINE} />
        </g>
      );
    case "croissant":
      return (
        <g>
          <path
            d="M6 46 Q14 12 50 12 Q86 12 94 46 Q80 40 70 40 Q50 24 30 40 Q20 40 6 46 Z"
            fill={color}
            {...line}
          />
          <path
            d="M26 20 L34 37 M42 14 L45 31 M58 14 L55 31 M74 20 L66 37"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );
    case "swirl":
      return (
        <g>
          <ellipse cx="50" cy="34" rx="36" ry="22" fill={color} {...line} />
          <path
            d="M50 34 q8 -2 6 5 q-3 7 -13 3 q-9 -6 0 -13 q12 -8 23 1 q9 11 -5 19 q-18 9 -34 -3"
            fill="none"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M30 24 q14 -10 32 -5"
            fill="none"
            stroke="#fff7e8"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      );
    case "rounds":
      return (
        <g>
          {SCATTER.slice(0, 5).map(([x, y]) => (
            <g key={x}>
              <ellipse cx={x} cy={y} rx="14" ry="10" fill={accent} {...line} />
              <ellipse cx={x} cy={y - 1} rx="11" ry="7.6" fill={color} />
              <circle cx={x - 3} cy={y - 2} r="1.8" fill={accent} />
              <circle cx={x + 4} cy={y + 1} r="1.6" fill={accent} />
            </g>
          ))}
        </g>
      );
    case "rings":
      return (
        <g fill="none">
          {SCATTER.map(([x, y]) => (
            <g key={x}>
              <ellipse cx={x} cy={y} rx="11" ry="8" stroke={INK} strokeWidth="7.4" />
              <ellipse cx={x} cy={y} rx="11" ry="8" stroke={color} strokeWidth="5" />
              <ellipse cx={x} cy={y} rx="9" ry="6" stroke={accent} strokeWidth="1.6" />
            </g>
          ))}
        </g>
      );
    case "leaves":
      return (
        <g>
          {SCATTER.map(([x, y], i) => (
            <g key={x} transform={`rotate(${i * 58} ${x} ${y})`}>
              <path
                d={`M${x - 15} ${y} Q${x} ${y - 14} ${x + 15} ${y} Q${x} ${y + 14} ${x - 15} ${y} Z`}
                fill={i % 2 ? accent : color}
                {...line}
              />
              <path d={`M${x - 12} ${y} H${x + 12}`} stroke={SHINE} strokeWidth="1.6" />
            </g>
          ))}
        </g>
      );
    case "shreds":
      return (
        <g fill="none" strokeLinecap="round">
          {Array.from({ length: 16 }, (_, i) => {
            const x = 18 + ((i * 23) % 62);
            const y = 16 + ((i * 13) % 30);
            return (
              <path
                key={i}
                d={`M${x} ${y} q9 ${i % 2 ? -8 : 8} 19 ${i % 3 ? 2 : -3}`}
                stroke={i % 3 ? color : accent}
                strokeWidth="4"
              />
            );
          })}
        </g>
      );
    case "beads":
      return (
        <g>
          {PILE.map(([x, y], i) => {
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="6.4" fill={i % 4 ? color : accent} {...line} />
                <circle cx={x - 2} cy={y - 2} r="1.7" fill={SHINE} />
              </g>
            );
          })}
        </g>
      );
    case "mound":
      return (
        <g>
          <path
            d="M14 42 Q16 24 34 24 Q40 10 56 16 Q72 14 74 28 Q90 30 86 43 Q50 56 14 42 Z"
            fill={color}
            {...line}
          />
          <path
            d="M30 34 q10 -9 22 -2 t22 1"
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="44" cy="23" rx="10" ry="3.6" fill={SHINE} />
        </g>
      );
    case "spears":
      return (
        <g>
          {[18, 31, 44].map((y, i) => (
            <g key={y} transform={`rotate(${-10 + i * 4} 50 ${y})`}>
              <rect x="12" y={y - 4} width="66" height="8" rx="4" fill={color} {...line} />
              <path d={`M76 ${y - 6} L92 ${y} L76 ${y + 6} Z`} fill={accent} {...line} />
            </g>
          ))}
        </g>
      );
    case "crumbs":
      return (
        <g>
          {Array.from({ length: 18 }, (_, i) => {
            const x = 20 + ((i * 31) % 60);
            const y = 17 + ((i * 11) % 30);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width="8"
                height="5"
                rx="1.6"
                fill={i % 3 ? color : accent}
                stroke={INK}
                strokeWidth="0.8"
                transform={`rotate(${(i * 41) % 180} ${x + 4} ${y + 2.5})`}
              />
            );
          })}
        </g>
      );
    case "wedge":
      return (
        <g>
          {[
            [18, 22],
            [46, 32],
          ].map(([x, y]) => (
            <g key={x}>
              <path
                d={`M${x} ${y! + 14} L${x! + 36} ${y! - 10} L${x! + 36} ${y! + 14} Z`}
                fill={color}
                {...line}
              />
              <path d={`M${x! + 36} ${y! - 10} V${y! + 14}`} stroke={accent} strokeWidth="5" />
            </g>
          ))}
        </g>
      );
    case "sticks":
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const x = 20 + ((i * 19) % 50);
            const y = 14 + ((i * 13) % 26);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width="30"
                height="8"
                rx="3.5"
                fill={i % 3 ? color : accent}
                {...line}
                transform={`rotate(${((i * 37) % 70) - 35} ${x + 15} ${y + 4})`}
              />
            );
          })}
        </g>
      );
    case "chips":
      return (
        <g>
          {SCATTER.map(([x, y], i) => (
            <path
              key={x}
              d={`M${x - 14} ${y + 8} L${x + 2} ${y - 14} L${x + 15} ${y + 9} Q${x} ${y + 14} ${x - 14} ${y + 8} Z`}
              fill={i % 2 ? accent : color}
              {...line}
              transform={`rotate(${i * 47} ${x} ${y})`}
            />
          ))}
        </g>
      );
    case "pyramids":
      return (
        <g>
          {[
            [28, 36],
            [64, 30],
            [48, 46],
          ].map(([x, y]) => (
            <g key={x}>
              <path
                d={`M${x! - 18} ${y! + 9} L${x} ${y! - 22} L${x! + 18} ${y! + 9} Q${x} ${y! + 15} ${x! - 18} ${y! + 9} Z`}
                fill={color}
                {...line}
              />
              <path
                d={`M${x! - 13} ${y! + 5} Q${x} ${y! + 10} ${x! + 13} ${y! + 5}`}
                fill="none"
                stroke={accent}
                strokeWidth="2.6"
              />
            </g>
          ))}
        </g>
      );
    case "cookie":
      return (
        <g>
          {[
            [32, 28],
            [66, 38],
          ].map(([x, y]) => (
            <g key={x}>
              <ellipse cx={x} cy={y} rx="22" ry="17" fill={color} {...line} />
              {[
                [-9, -5],
                [7, -7],
                [1, 5],
                [12, 3],
                [-12, 6],
              ].map(([dx, dy]) => (
                <circle key={dx} cx={x! + dx!} cy={y! + dy!} r="3" fill={accent} />
              ))}
            </g>
          ))}
        </g>
      );
    case "bottle":
      return (
        <g>
          <path d="M45 3 h10 l2 9 h-14 Z" fill="#f5ead4" {...line} />
          <path
            d="M38 12 h24 l4 10 q2 3 2 8 v24 q0 4 -5 4 H37 q-5 0 -5 -4 V30 q0 -5 2 -8 Z"
            fill={color}
            {...line}
          />
          <rect x="37" y="25" width="6" height="26" rx="3" fill={SHINE} />
        </g>
      );
    case "cup":
      return (
        <g>
          <path d="M58 2 L52 24" stroke="#d8432a" strokeWidth="4.4" strokeLinecap="round" />
          <path d="M31 13 H69 L64 57 Q50 61 36 57 Z" fill="rgba(255,255,255,0.55)" {...line} />
          <path d="M34 23 H66 L62.5 55 Q50 58.5 37.5 55 Z" fill={color} />
          <path d="M39 26 L42 52" stroke={SHINE} strokeWidth="3.4" strokeLinecap="round" />
          <ellipse cx="50" cy="13" rx="20" ry="4.4" fill="rgba(255,255,255,0.7)" {...line} />
        </g>
      );
  }
}
