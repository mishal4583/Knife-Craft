import { createElement } from "react";
import { iconFor } from "@/lib/emojiIcons";

/**
 * One drawn icon in place of an emoji (see lib/emojiIcons.ts and lib/emoji-jsx). It is as big as the text it stands in (1.1 em), takes the text's colour,
 * and keeps the emoji character as hidden text, so a screen reader and every text search read what they always read.
 *
 * The hidden text is made with `createElement`, not JSX: JSX here goes through the emoji runtime, which would turn that very character into this icon again.
 */
export function EmojiIcon({ emoji }: { emoji: string }) {
  const found = iconFor(emoji);
  if (!found) return <>{emoji}</>;
  return (
    <span className="gi" role="img" aria-label={emoji}>
      {"icon" in found ? (
        <found.icon aria-hidden="true" strokeWidth={2.1} className="gi-svg" />
      ) : (
        <span aria-hidden="true" className="gi-dot" style={{ background: found.dot }} />
      )}
      {createElement("span", { className: "gi-txt", "aria-hidden": true }, emoji)}
    </span>
  );
}
