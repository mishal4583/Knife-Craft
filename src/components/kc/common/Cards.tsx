import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, Stars } from "./primitives";
import { CurrencyPill, MasteryBar, ProgressBar, StatRow, UnlockBadge } from "./Indicators";
import type {
  Achievement,
  Board,
  Customer,
  DailyOrder,
  Decoration,
  Knife,
  Recipe,
  Technique,
} from "@/types/game";

/* ── generic shells ─────────────────────────────────────── */

export function CardShell({
  children,
  onClick,
  className,
  dim,
  selected,
}: {
  children: ReactNode;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
  dim?: boolean | undefined;
  selected?: boolean | undefined;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "press lift card-warm block w-full rounded-[20px] p-3 text-left",
        selected && "ring-2 ring-copper/45",
        dim && "opacity-70 saturate-[0.7]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function LockedCard({
  title,
  requirement,
  glyph,
  onClick,
}: {
  title: string;
  requirement: string;
  glyph?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <CardShell onClick={onClick} dim>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-walnut/10 text-[20px] grayscale">
          {glyph ?? "🔒"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-black text-walnut/70">{title}</p>
          <p className="font-hand text-[15px] leading-tight text-walnut/50">Not yet learned</p>
        </div>
      </div>
      <div className="mt-2">
        <UnlockBadge requirement={requirement} />
      </div>
    </CardShell>
  );
}

/* ── domain cards ───────────────────────────────────────── */

export function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick?: () => void }) {
  if (!recipe.unlocked) {
    return (
      <LockedCard
        title={recipe.name}
        glyph={recipe.emoji}
        requirement={recipe.unlockRequirement ?? "Locked"}
        onClick={onClick}
      />
    );
  }
  return (
    <CardShell onClick={onClick} className="-rotate-[0.4deg]">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cream/70 text-[24px]">
          {recipe.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-display text-[16px] font-black leading-tight text-walnut-dark">
              {recipe.name}
            </p>
            {recipe.completed ? <Badge tone="sage">Done</Badge> : null}
          </div>
          <p className="font-hand text-[15px] leading-tight text-walnut/65">
            {recipe.ingredients.join(" · ")}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Stars n={recipe.difficulty} max={5} size={10} />
            <span className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-walnut/45">
              {recipe.best !== null ? `Best ${recipe.best}%` : "Not prepared"}
            </span>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

export function IngredientCard({
  name,
  glyph,
  technique,
}: {
  name: string;
  glyph: string;
  technique?: string | undefined;
}) {
  return (
    <div className="card-warm flex items-center gap-2 rounded-2xl px-3 py-2">
      <span className="text-[18px]" aria-hidden>
        {glyph}
      </span>
      <div className="min-w-0">
        <p className="truncate font-ui text-[12px] font-extrabold text-walnut-dark">{name}</p>
        {technique ? (
          <p className="font-hand text-[14px] leading-none text-copper">{technique}</p>
        ) : null}
      </div>
    </div>
  );
}

export function KnifeCard({
  knife,
  equipped,
  selected,
  onClick,
}: {
  knife: Knife;
  equipped?: boolean | undefined;
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <CardShell onClick={onClick} selected={selected} dim={!knife.owned}>
      <div className="flex items-center gap-3">
        <KnifeGlyph tone={knife.owned ? "steel" : "muted"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-black leading-tight text-walnut-dark">
            {knife.name}
          </p>
          <p className="font-hand text-[15px] leading-tight text-walnut/60">{knife.tagline}</p>
        </div>
        {equipped ? <Badge tone="copper">Equipped</Badge> : null}
      </div>
      {knife.owned ? (
        <div className="mt-2 flex items-center justify-between">
          <Stars n={knife.stars} size={11} />
          <span className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-walnut/45">
            Level {knife.level}
          </span>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <UnlockBadge requirement={knife.unlockRequirement ?? "Locked"} />
          {knife.price ? <CurrencyPill amount={knife.price} /> : null}
        </div>
      )}
    </CardShell>
  );
}

export function KnifeGlyph({ tone = "steel" }: { tone?: "steel" | "muted" }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="shrink-0">
      <path
        d="M6 30 C14 18, 24 11, 32 9 L34 13 C27 18, 18 25, 12 33 Z"
        fill={tone === "steel" ? "#D9D3C8" : "#C6BEB2"}
        stroke="#8A8377"
        strokeWidth="0.8"
      />
      <path d="M6 30 L12 33 L9 37 Z" fill="#8A8377" opacity="0.5" />
      <rect
        x="30"
        y="6"
        width="10"
        height="5.5"
        rx="2.4"
        transform="rotate(-24 30 6)"
        fill="var(--color-walnut)"
      />
    </svg>
  );
}

export function BoardCard({
  board,
  equipped,
  onClick,
}: {
  board: Board;
  equipped?: boolean | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <CardShell onClick={onClick} selected={equipped} dim={!board.owned}>
      <div
        className="mb-2 h-[62px] w-full rounded-[14px] shadow-soft"
        style={{
          background: `repeating-linear-gradient(96deg, ${board.tone[0]} 0 6px, ${board.tone[1]} 6px 12px, ${board.tone[2]} 12px 15px)`,
        }}
        aria-hidden
      />
      <p className="truncate font-display text-[14px] font-black leading-tight text-walnut-dark">
        {board.name}
      </p>
      <p className="truncate font-hand text-[14px] leading-tight text-walnut/60">{board.note}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {board.owned ? (
          <Badge tone={equipped ? "copper" : "cream"}>{equipped ? "In use" : "Owned"}</Badge>
        ) : (
          <UnlockBadge requirement={board.unlockRequirement ?? "Locked"} />
        )}
        {!board.owned && board.price ? <CurrencyPill amount={board.price} /> : null}
      </div>
    </CardShell>
  );
}

export function TechniqueCard({
  technique,
  onClick,
}: {
  technique: Technique;
  onClick?: (() => void) | undefined;
}) {
  if (!technique.unlocked) {
    return (
      <LockedCard
        title={technique.name}
        glyph={technique.glyph}
        requirement={technique.unlockRequirement ?? "Locked"}
        onClick={onClick}
      />
    );
  }
  return (
    <CardShell onClick={onClick}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cream/70 font-display text-[16px] font-black text-copper">
          {technique.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-black leading-tight text-walnut-dark">
            {technique.name}
          </p>
          <p className="truncate font-hand text-[15px] leading-tight text-walnut/60">
            {technique.note}
          </p>
        </div>
        <Stars n={technique.stars} size={10} />
      </div>
      <div className="mt-2">
        <MasteryBar label="Mastery" value={technique.mastery} />
      </div>
    </CardShell>
  );
}

export function DecorCard({
  item,
  onClick,
}: {
  item: Decoration;
  onClick?: (() => void) | undefined;
}) {
  return (
    <CardShell onClick={onClick} dim={!item.owned} selected={item.placed}>
      <div className="grid h-[58px] place-items-center rounded-[14px] bg-cream/60 text-[26px]">
        {item.glyph}
      </div>
      <p className="mt-2 truncate font-ui text-[12px] font-extrabold text-walnut-dark">
        {item.name}
      </p>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="font-hand text-[14px] text-walnut/55">{item.category}</span>
        {item.owned ? (
          <Badge tone={item.placed ? "copper" : "sage"}>{item.placed ? "Placed" : "Owned"}</Badge>
        ) : (
          <CurrencyPill amount={item.price} />
        )}
      </div>
    </CardShell>
  );
}

export function OrderCard({
  order,
  onPrepare,
  compact,
}: {
  order: DailyOrder;
  onPrepare?: () => void;
  compact?: boolean | undefined;
}) {
  return (
    <div className="paper rounded-[20px] border border-walnut/20 p-4 shadow-soft">
      <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.2em] text-copper">
        {order.day}'s Order
      </p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-[20px] font-black leading-none text-walnut-dark">
            {order.name}
          </p>
          <p className="font-hand text-[16px] leading-tight text-walnut/70">
            {order.ingredients.join(" · ")}
          </p>
        </div>
        <span className="text-[28px]" aria-hidden>
          {order.emoji}
        </span>
      </div>
      {!compact ? <p className="mt-2 font-hand text-[16px] text-walnut/60">{order.note}</p> : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <CurrencyPill amount={order.reward} />
        {onPrepare ? (
          <button
            type="button"
            onClick={onPrepare}
            className="press wood rounded-2xl border border-walnut-dark/50 px-5 py-2 font-ui text-[13px] font-extrabold text-ivory shadow-soft"
          >
            Prepare
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <CardShell className="rotate-[0.3deg]">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream/70 text-[20px]">
          {customer.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-ui text-[10px] font-extrabold uppercase tracking-[0.14em] text-copper">
            {customer.name}
          </p>
          <p className="font-hand text-[17px] leading-tight text-walnut-dark">“{customer.line}”</p>
          <p className="mt-0.5 font-ui text-[10px] font-bold text-walnut/50">
            Favourite: {customer.favorite} · {customer.visits} visits
          </p>
        </div>
      </div>
    </CardShell>
  );
}

export function AchievementCard({ achievement }: { achievement: Achievement }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[18px] border p-3",
        achievement.done ? "border-olive/30 bg-sage/15" : "border-walnut/15 bg-walnut/5 opacity-75",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px]",
          achievement.done ? "bg-sage/30 text-olive" : "bg-walnut/10 text-walnut/40",
        )}
        aria-hidden
      >
        {achievement.done ? "✓" : "○"}
      </span>
      <div className="min-w-0">
        <p className="truncate font-ui text-[12px] font-extrabold text-walnut-dark">
          {achievement.name}
        </p>
        <p className="truncate font-hand text-[15px] leading-tight text-walnut/60">
          {achievement.desc}
        </p>
      </div>
    </div>
  );
}

export function JournalEntry({ date, text }: { date: string; text: string }) {
  return (
    <div className="border-l-2 border-copper/30 pl-3">
      <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.2em] text-copper">
        {date}
      </p>
      <p className="font-hand text-[17px] leading-snug text-walnut-dark">{text}</p>
    </div>
  );
}

export function ScoreRow({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="min-w-0 flex-1 truncate font-ui text-[12px] font-bold text-walnut-dark">
        {name}
      </span>
      <span className="w-[86px]">
        <ProgressBar value={score} thickness={6} />
      </span>
      <span className="w-9 text-right font-ui text-[11px] font-extrabold text-walnut/70">
        {score}%
      </span>
    </div>
  );
}

export { StatRow };
