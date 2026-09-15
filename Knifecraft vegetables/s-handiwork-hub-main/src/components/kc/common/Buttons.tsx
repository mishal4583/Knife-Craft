import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KButton } from "./primitives";

type Common = {
  children: ReactNode;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  disabled?: boolean;
  className?: string;
};

export function WoodButton(p: Common) {
  return <KButton variant="wood" {...p} />;
}

export function CreamButton(p: Common) {
  return <KButton variant="cream" {...p} />;
}

export function GhostButton(p: Common) {
  return <KButton variant="ghost" {...p} />;
}

export function CopperButton(p: Common) {
  return <KButton variant="copper" {...p} />;
}

export function IconButton({
  label,
  onClick,
  children,
  tone = "cream",
  className,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  tone?: "cream" | "dark";
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "press grid h-11 w-11 shrink-0 place-items-center rounded-full border shadow-soft",
        tone === "cream"
          ? "border-walnut/20 bg-ivory/85 text-walnut"
          : "border-ivory/35 bg-walnut-dark/45 text-ivory backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </button>
  );
}

export { KButton };