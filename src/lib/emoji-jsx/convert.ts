import { Children, createElement, isValidElement, type ReactNode } from "react";
import { EmojiIcon } from "@/components/kc/common/EmojiIcon";
import { iconFor } from "@/lib/emojiIcons";

/** One emoji picture: its code points, then any variation selectors, skin tones and zero-width-joined pictures. */
const PICTURE =
  /\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;
const QUICK = /\p{Extended_Pictographic}/u;

/** A string with its pictures that have an icon swapped for the icon; the rest of the text is untouched. Returns null when nothing changed. */
export function withIcons(text: string): ReactNode[] | null {
  if (!QUICK.test(text)) return null;
  const out: ReactNode[] = [];
  let last = 0;
  let changed = false;
  for (const m of text.matchAll(PICTURE)) {
    if (!iconFor(m[0])) continue;
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(createElement(EmojiIcon, { key: `e${at}`, emoji: m[0] }));
    last = at + m[0].length;
    changed = true;
  }
  if (!changed) return null;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The children of an element with every string that holds an emoji with an icon turned into text and icons. Returns the same children when none does. */
export function convertChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return withIcons(children) ?? children;
  if (!Array.isArray(children)) return children;
  let changed = false;
  const next = Children.map(children as ReactNode[], (child, index) => {
    if (typeof child !== "string") return child;
    const swapped = withIcons(child);
    if (!swapped) return child;
    changed = true;
    return createElement("span", { key: `t${index}`, className: "gi-text" }, swapped);
  });
  return changed ? next : children;
}

/** An element type whose children may hold text that is safe to turn into elements. */
export const TEXT_SAFE = (type: unknown): boolean =>
  typeof type === "string" &&
  ![
    "option",
    "textarea",
    "title",
    "style",
    "script",
    "text",
    "tspan",
    "pre",
    "code",
    "svg",
    "path",
    "g",
    "input",
    "select",
    "optgroup",
  ].includes(type);

export { isValidElement };
