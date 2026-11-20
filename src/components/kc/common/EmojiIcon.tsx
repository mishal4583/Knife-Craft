import { createElement } from "react";
import { iconFor, normalizeEmoji } from "@/lib/emojiIcons";
import { ICON_RIM, iconColorFor } from "@/lib/iconColors";

/**
 * One drawn icon in place of an emoji (see lib/emojiIcons.ts and lib/emoji-jsx). It is as big as the text it stands in (1.1 em), in the colour of the thing it stands for
 * (lib/iconColors.ts: a carrot orange, a drop blue) over a thin dark rim, and keeps the emoji character as hidden text, so a screen reader and every text search read what they always read.
 *
 * The hidden text is made with `createElement`, not JSX: JSX here goes through the emoji runtime, which would turn that very character into this icon again.
 */
export function EmojiIcon({ emoji }: { emoji: string }) {
  const found = iconFor(emoji);
  if (!found) return <>{emoji}</>;
  return (
    <span className={"picture" in found ? "gi gi-pic" : "gi"} role="img" aria-label={emoji}>
      {"picture" in found ? (
        <img
          src={found.picture}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          className="gi-img"
        />
      ) : "icon" in found ? (
        <>
          <found.icon
            aria-hidden="true"
            strokeWidth={4.6}
            color={ICON_RIM}
            className="gi-svg gi-rim"
          />
          <found.icon
            aria-hidden="true"
            strokeWidth={2.2}
            color={iconColorFor(normalizeEmoji(emoji))}
            className="gi-svg gi-top"
          />
        </>
      ) : (
        <span aria-hidden="true" className="gi-dot" style={{ background: found.dot }} />
      )}
      {createElement("span", { className: "gi-txt", "aria-hidden": true }, emoji)}
    </span>
  );
}
