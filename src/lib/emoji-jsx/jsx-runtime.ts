/**
 * THE JSX RUNTIME THE GAME'S SCREENS USE (developer 2026-11-19, Playgama 4.3.2: no emoji in place of icons). It is React's own runtime with one addition:
 * wherever a screen renders TEXT inside an element (a plain string, a `{value}`, a template), an emoji that has an icon in lib/emojiIcons.ts is drawn as that
 * icon (the character stays as hidden text). Vite is told to use it by `jsxImportSource: "emoji-jsx"` (vite.config.ts); the type checker and the QA scripts
 * keep React's own runtime, which is the same minus the icons.
 */
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from "react/jsx-runtime";
import { TEXT_SAFE, convertChildren } from "./convert";

type Props = { children?: unknown } & Record<string, unknown>;

function convert(type: unknown, props: Props): Props {
  if (props && props.children !== undefined && (TEXT_SAFE(type) || type === Fragment)) {
    const children = convertChildren(props.children as never);
    if (children !== props.children) return { ...props, children };
  }
  return props;
}

export { Fragment };
export function jsx(type: unknown, props: Props, key?: string) {
  return (reactJsx as (t: unknown, p: Props, k?: string) => unknown)(
    type,
    convert(type, props),
    key,
  );
}
export function jsxs(type: unknown, props: Props, key?: string) {
  return (reactJsxs as (t: unknown, p: Props, k?: string) => unknown)(
    type,
    convert(type, props),
    key,
  );
}
