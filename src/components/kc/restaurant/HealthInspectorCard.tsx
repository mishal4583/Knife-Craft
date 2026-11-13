import { KButton } from "../common/primitives";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { formatUsd } from "@/game/money";
import { cn } from "@/lib/utils";
import {
  VISIT_GAP,
  type InspectorCheckId,
  type InspectorGrade,
  type InspectorRow,
  type InspectorView,
} from "@/game/restaurant/healthInspector";

const ICON: Record<InspectorCheckId, string> = {
  cleaning: "🧹",
  expired: "🗑️",
  "fridge-room": "❄️",
  "dish-soap": "🧼",
  "cleaning-liquid": "🧴",
};
const FIX: Record<InspectorCheckId, string> = {
  cleaning: "Clean",
  expired: "Throw out",
  "fridge-room": "Fridge",
  "dish-soap": "Buy",
  "cleaning-liquid": "Buy",
};
const MARK = { PASS: "✓", WARNING: "⚠", FAIL: "✕" } as const;
const GRADE_TONE: Record<InspectorGrade, string> = {
  A: "bg-sage text-ivory",
  B: "bg-gold text-walnut-dark",
  C: "bg-tomato text-ivory",
};

function Rows({
  rows,
  onFix,
}: {
  rows: readonly InspectorRow[];
  onFix?: (id: InspectorCheckId) => void;
}) {
  return (
    <ul className="mt-2 grid gap-1.5" data-testid="psc-inspector-rows">
      {rows.map((r) => (
        <li
          key={r.id}
          data-check={r.id}
          data-verdict={r.verdict}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-ivory/70 px-2.5 py-1"
        >
          <span
            className={cn(
              "w-5 text-center font-ui text-[14px] font-black",
              r.verdict === "PASS"
                ? "text-sage"
                : r.verdict === "FAIL"
                  ? "text-tomato"
                  : "text-copper",
            )}
          >
            {MARK[r.verdict]}
          </span>
          <span className="flex-1 font-ui text-[13px] font-bold leading-tight text-walnut-dark">
            {ICON[r.id]} {r.glance}
          </span>
          {onFix && r.verdict !== "PASS" ? (
            <KButton
              size="sm"
              variant="ghost"
              className="min-h-12 shrink-0 px-3"
              data-testid={`psc-inspector-fix-${r.id}`}
              onClick={() => onFix(r.id)}
            >
              {FIX[r.id]} →
            </KButton>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The health inspector on the Pre-Service Check (restaurant/healthInspector.ts, developer 2026-11-13). Display only; App runs the visit.
 * "due": what he will look at, live, each with a way to fix it first, and "Let him in". "done": the grade and what it did.
 */
export function HealthInspectorCard({
  view,
  onLetIn,
  onFix,
}: {
  view: InspectorView;
  onLetIn: () => void;
  onFix: (id: InspectorCheckId) => void;
}) {
  if (view.status === "done") {
    const v = view.visit;
    return (
      <div
        className="mb-2 rounded-2xl border border-walnut/15 bg-ivory/80 p-3"
        data-testid="psc-inspector"
        data-status="done"
        data-grade={v.grade}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-[30px] font-black shadow-lift",
              GRADE_TONE[v.grade],
            )}
          >
            {v.grade}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-ui text-[13.5px] font-extrabold text-walnut-dark">
              🕵️ Health inspection · Grade {v.grade}
              <InfoTip label="About the health inspector">
                He grades the restaurant as it is: cleaning, expired food, fridge room, soap and
                cleaning liquid. Grade A earns Hype and he stays away longest; a failed check costs
                a fine and he is back soon.
              </InfoTip>
            </p>
            <p
              className="font-ui text-[12.5px] font-bold text-walnut/75"
              data-testid="psc-inspector-effect"
            >
              {v.grade === "A"
                ? v.hype > 0
                  ? `✨ +${v.hype} Hype`
                  : "✨ Spotless"
                : v.grade === "B"
                  ? "⚠ A warning · no fine"
                  : v.fine > 0
                    ? `💸 Fine ${formatUsd(v.fine)}`
                    : "✕ Failed · no fine this time"}{" "}
              · back in {view.backIn} services
            </p>
          </div>
        </div>
        {v.grade !== "A" ? <Rows rows={v.rows.filter((r) => r.verdict !== "PASS")} /> : null}
      </div>
    );
  }
  return (
    <div
      className="mb-2 rounded-2xl border border-copper/40 bg-gold/15 p-3"
      id="psc-inspector"
      data-testid="psc-inspector"
      data-status="due"
      data-grade={view.grade}
    >
      <p className="flex items-center gap-1.5 font-ui text-[13.5px] font-extrabold text-walnut-dark">
        🕵️ Health inspector at the door
        <InfoTip label="About the health inspector">
          He grades the restaurant as it is right now. Fix what you can first, then let him in.
          Grade A: Hype, and he stays away {VISIT_GAP.A} services. Grade B: a warning. Grade C: a
          fine, and he is back in {VISIT_GAP.C}.
        </InfoTip>
      </p>
      <p className="font-ui text-[12.5px] text-walnut/70" data-testid="psc-inspector-preview">
        Now: Grade {view.grade}
        {view.grade === "A"
          ? ` · ✨ +${view.hype} Hype`
          : view.grade === "C" && view.fine > 0
            ? ` · 💸 fine ${formatUsd(view.fine)}`
            : ""}
      </p>
      <Rows rows={view.rows} onFix={onFix} />
      <KButton
        full
        variant="copper"
        className="mt-2 h-auto min-h-12 py-2 leading-tight"
        data-testid="psc-inspector-let-in"
        onClick={onLetIn}
      >
        🚪 Let him in
      </KButton>
    </div>
  );
}
