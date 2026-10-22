import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { AudioManager } from "@/game/AudioManager";

/**
 * SHOP_CARD — the Market's product card (developer 2026-10-22: "make the
 * ingredient shop card exactly like this … improve all the shop cards"): a
 * wooden frame with brass rivets, the item's name on a hanging plank with
 * leaves, the item's picture (ShopItemArt), then a parchment body with the
 * price on a coin pill, the details, a wooden − / + stepper, crate tiles for
 * the bulk sizes, a green leaf Buy button and the wallet before → after.
 * Presentation only: every number still comes from the card's own quote.
 */

/** A small painted leaf (decoration only). */
export function Leaf({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("pointer-events-none", className)}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M3 21C3 11 9 4 21 3c-1 11-8 17-18 18z"
        fill="url(#kc-leaf)"
        stroke="#2f5a1f"
        strokeWidth="1.2"
      />
      <path d="M4 20C9 15 13 11 19 5" stroke="#cfe6a8" strokeWidth="1.1" fill="none" />
    </svg>
  );
}

/** The one gradient the leaves share (rendered once by ShopCard). */
function LeafDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="kc-leaf" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3f7a2a" />
          <stop offset="1" stopColor="#8cc152" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** A gold coin with a $ (the price pill). */
export function CoinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <circle cx="16" cy="17" r="13" fill="#b87a17" />
      <circle cx="16" cy="15.5" r="13" fill="url(#kc-coin)" stroke="#a86d12" strokeWidth="1.4" />
      <circle
        cx="16"
        cy="15.5"
        r="9.5"
        fill="none"
        stroke="#fff2b8"
        strokeWidth="1.2"
        opacity=".7"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="15"
        fontWeight="900"
        fill="#8a5410"
        fontFamily="Nunito, sans-serif"
      >
        $
      </text>
      <defs>
        <radialGradient id="kc-coin" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff3a6" />
          <stop offset=".55" stopColor="#f5c43a" />
          <stop offset="1" stopColor="#d9951f" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** A little wooden crate of produce (stock pill, unit line, bulk tiles). */
export function CrateIcon({ size = 20, full = true }: { size?: number; full?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      {full ? (
        <>
          <circle cx="11" cy="11" r="4.5" fill="#e8a93a" />
          <circle cx="17" cy="9.5" r="4.5" fill="#f2c75a" />
          <circle cx="22" cy="11.5" r="4" fill="#d98c2b" />
        </>
      ) : null}
      <path d="M4 13h24l-2.5 15h-19z" fill="#c98a4b" stroke="#6b3f1d" strokeWidth="1.4" />
      <path d="M6 18.5h20M6.8 23.5h18.4" stroke="#8a5428" strokeWidth="1.3" />
      <path d="M11 13v15M21 13v15" stroke="#8a5428" strokeWidth="1" opacity=".6" />
    </svg>
  );
}

/** A wicker basket (the Buy button). */
function BasketIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <path d="M9 13c0-6 14-6 14 0" fill="none" stroke="#f3d27a" strokeWidth="2.4" />
      <circle cx="12.5" cy="12" r="3" fill="#f0a531" />
      <circle cx="18.5" cy="11.5" r="3.2" fill="#e7c24d" />
      <path d="M4 14h24l-3 13H7z" fill="#f3c766" stroke="#7a4c17" strokeWidth="1.4" />
      <path d="M6 19h20M7.5 23.5h17M12 14v13M20 14v13" stroke="#b07a2a" strokeWidth="1.2" />
    </svg>
  );
}

/** Clock and cutlery line icons for the details line. */
export function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9" fill="#fffaf0" stroke="#6f5a45" strokeWidth="2" />
      <path d="M12 7v5l3.5 2" stroke="#6f5a45" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
export function CutleryIcon() {
  return (
    <svg width="18" height="16" viewBox="0 0 28 24" aria-hidden className="shrink-0">
      <circle cx="14" cy="12" r="7.5" fill="#dfe3e6" stroke="#6f7a82" strokeWidth="1.6" />
      <circle cx="14" cy="12" r="4.6" fill="#f4f6f7" />
      <path
        d="M3 3v6M5 3v6M7 3v6M3 9c0 2 4 2 4 0M5 11v11"
        stroke="#5c4a3a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M24 3c-2 2-2 7 0 8v11"
        stroke="#5c4a3a"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 24 18" aria-hidden className="shrink-0">
      <path
        d="M2 15l6-6 4 4 8-9M14 4h6v6"
        fill="none"
        stroke="#4f8a2f"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The wooden frame, the name plank and the parchment body. */
export function ShopCard({
  title,
  art,
  children,
  ring = null,
  className,
  ref,
  ...rest
}: {
  ref?: Ref<HTMLElement> | undefined;
  title: ReactNode;
  /** The picture (ShopItemArt); none for an upgrade card (it isn't a product card then). */
  art?: ReactNode;
  children: ReactNode;
  /** A focused card (ring-2) or one needed today. */
  ring?: "focus" | "need" | "owned" | null;
} & Omit<HTMLAttributes<HTMLElement>, "title"> &
  Record<`data-${string}`, string | number | boolean | undefined>) {
  return (
    <article
      {...rest}
      ref={ref}
      className={cn(
        art ? "product-card shop-card" : "shop-card",
        ring === "focus" && "ring-2 ring-copper/80",
        ring === "need" && "ring-1 ring-copper/60 shop-card--need",
        ring === "owned" && "shop-card--owned",
        className,
      )}
    >
      <LeafDefs />
      <div className="shop-card__inner">
        <div className="shop-card__plank">
          <Leaf className="shop-card__leaf shop-card__leaf--l" />
          <Leaf className="shop-card__leaf shop-card__leaf--r" flip />
          <span className="shop-card__rope shop-card__rope--l" aria-hidden />
          <span className="shop-card__rope shop-card__rope--r" aria-hidden />
          <h3 className="shop-card__title">{title}</h3>
        </div>
        {art ?? <div className="h-1.5" aria-hidden />}
        <div className="shop-card__body">
          <span className="shop-card__rivet shop-card__rivet--tl" aria-hidden />
          <span className="shop-card__rivet shop-card__rivet--tr" aria-hidden />
          <span className="shop-card__rivet shop-card__rivet--bl" aria-hidden />
          <span className="shop-card__rivet shop-card__rivet--br" aria-hidden />
          {children}
        </div>
      </div>
    </article>
  );
}

/** The price on a coin pill: "$2.36 / kg". */
export function PricePill({ price, per }: { price: string; per?: string | undefined }) {
  return (
    <div className="shop-card__price" data-testid="shop-price">
      <CoinIcon />
      <span className="font-display text-[17px] font-black leading-none text-walnut-dark">
        {price}
      </span>
      {per ? (
        <span className="font-ui text-[12px] font-bold leading-none text-walnut/70">/ {per}</span>
      ) : null}
    </div>
  );
}

/** One centred details line (an icon and a few words). */
export function ShopLine({
  children,
  hand = false,
  className,
  ...rest
}: {
  children: ReactNode;
  /** The handwritten, italic look (shelf life · dishes). */
  hand?: boolean;
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <p
      {...rest}
      className={cn(
        "mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center leading-tight",
        hand
          ? "font-hand text-[14px] italic text-walnut/75"
          : "font-ui text-[12px] font-bold text-walnut-dark/85",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** The wooden − value + stepper (each button 48 px). */
export function WoodStepper({
  value,
  sub,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
}: {
  value: ReactNode;
  /** A second small line under the value ("4,000 napkins"). */
  sub?: ReactNode;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
}) {
  return (
    <div className="shop-card__stepper">
      <Leaf className="shop-card__stepper-leaf shop-card__stepper-leaf--l" />
      <Leaf className="shop-card__stepper-leaf shop-card__stepper-leaf--r" flip />
      <button
        type="button"
        onClick={onMinus}
        className="press shop-card__step grid h-12 w-12 place-items-center rounded-full"
        aria-label={minusLabel}
      >
        −
      </button>
      <span className="shop-card__value">
        <span className="font-ui text-[17px] font-black leading-none" data-testid="stepper-value">
          {value}
        </span>
        {sub ? (
          <span className="mt-0.5 block font-ui text-[10px] font-bold leading-none text-ivory/75">
            {sub}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onPlus}
        className="press shop-card__step grid h-12 w-12 place-items-center rounded-full"
        aria-label={plusLabel}
      >
        +
      </button>
    </div>
  );
}

/**
 * The green leaf Buy button (≥ 48 px). `tone`: "go" when the purchase can be
 * made, "short" when it can't (still tappable: it says why), "done" for an
 * owned / equipped item (disabled), "wood" for a quieter action (Equip).
 */
export function BuyButton({
  children,
  onClick,
  tone = "go",
  disabled = false,
  icon = true,
  className,
}: {
  children: ReactNode;
  onClick?: (() => void) | undefined;
  tone?: "go" | "short" | "done" | "wood";
  disabled?: boolean;
  icon?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={
        onClick
          ? () => {
              AudioManager.playSfx("tap");
              onClick();
            }
          : undefined
      }
      className={cn("press shop-card__buy", `shop-card__buy--${tone}`, className)}
    >
      {tone === "go" ? (
        <>
          <Leaf className="shop-card__buy-leaf shop-card__buy-leaf--l" />
          <Leaf className="shop-card__buy-leaf shop-card__buy-leaf--r" flip />
        </>
      ) : null}
      {icon && tone !== "done" ? <BasketIcon size={18} /> : null}
      <span className="relative">{children}</span>
    </button>
  );
}

/** "$11,291.99 → $11,289.63" with a trend arrow, or a warning in copper. */
export function WalletLine({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return (
    <p
      className={cn(
        "wallet-line mt-1.5 flex items-center justify-center gap-1 text-center font-ui text-[12px] font-bold leading-tight",
        warn ? "text-copper" : "text-walnut/70",
      )}
    >
      {warn ? null : <TrendIcon />}
      <span>{children}</span>
    </p>
  );
}
