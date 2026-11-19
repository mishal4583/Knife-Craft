/** The development twin of `jsx-runtime.ts` (Vite's dev server asks for it). Same behaviour. */
import { Fragment, jsxDEV as reactJsxDEV } from "react/jsx-dev-runtime";
import { TEXT_SAFE, convertChildren } from "./convert";

type Props = { children?: unknown } & Record<string, unknown>;

export { Fragment };
export function jsxDEV(
  type: unknown,
  props: Props,
  key: string | undefined,
  isStatic: boolean,
  source: unknown,
  self: unknown,
) {
  let next = props;
  if (props && props.children !== undefined && (TEXT_SAFE(type) || type === Fragment)) {
    const children = convertChildren(props.children as never);
    if (children !== props.children) next = { ...props, children };
  }
  return (reactJsxDEV as (...a: unknown[]) => unknown)(type, next, key, isStatic, source, self);
}
