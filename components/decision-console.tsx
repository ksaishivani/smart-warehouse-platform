"use client"

import { useMemo } from "react"
import {
  Boxes,
  Check,
  RotateCcw,
  Route,
  Sparkles,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { generateRecommendations } from "@/lib/decision-engine"
import type { Recommendation, RecommendationKind } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Panel, PanelHeader } from "@/components/primitives"
import { cn } from "@/lib/utils"

const KIND_META: Record<
  RecommendationKind,
  { icon: typeof Boxes; label: string }
> = {
  allocation: { icon: Boxes, label: "Allocation" },
  reorder: { icon: Truck, label: "Reorder" },
  exception: { icon: TriangleAlert, label: "Exception" },
  prioritization: { icon: Sparkles, label: "Priority" },
  pick_route: { icon: Route, label: "Picking" },
}

const IMPACT_STYLES = {
  high: "border-danger/40 text-danger",
  medium: "border-warning/40 text-warning",
  low: "border-border text-muted-foreground",
}

export function DecisionConsole({ compact = false }: { compact?: boolean }) {
  const store = useStore()
  const { products, orders, exceptions, now, dismissed, dispatch } = store

  const recommendations = useMemo(
    () =>
      generateRecommendations(products, orders, exceptions, now).filter(
        (r) => !dismissed.includes(r.id),
      ),
    [products, orders, exceptions, now, dismissed],
  )

  const shown = compact ? recommendations.slice(0, 3) : recommendations

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader
        title="Decision Console"
        subtitle="Ranked actions the engine recommends right now"
        icon={<Sparkles className="size-4 text-primary" />}
        right={
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary tabular-nums">
            {recommendations.length} open
          </span>
        }
      />
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {shown.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Check className="size-6 text-success" />
            <p className="text-sm">All clear — no pending decisions.</p>
          </div>
        ) : (
          shown.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} dispatch={dispatch} />
          ))
        )}
      </div>
    </Panel>
  )
}

function RecommendationCard({
  rec,
  dispatch,
}: {
  rec: Recommendation
  dispatch: ReturnType<typeof useStore>["dispatch"]
}) {
  const meta = KIND_META[rec.kind]
  const Icon = meta.icon
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
              IMPACT_STYLES[rec.impact],
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold leading-tight">{rec.title}</h3>
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-xs font-semibold tabular-nums text-primary">
            {Math.round(rec.confidence * 100)}%
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            confidence
          </span>
        </div>
      </div>

      <ul className="mt-2.5 space-y-1 border-l border-border pl-3">
        {rec.rationale.map((r, i) => (
          <li key={i} className="text-xs leading-relaxed text-muted-foreground">
            {r}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => dispatch({ type: "APPLY_RECOMMENDATION", rec })}
        >
          <Check className="size-3.5" />
          {rec.primaryAction}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={() => dispatch({ type: "DISMISS_RECOMMENDATION", id: rec.id })}
        >
          <X className="size-3.5" />
          Override
        </Button>
        {rec.kind === "exception" ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <RotateCcw className="size-3" /> auto-detected
          </span>
        ) : null}
      </div>
    </div>
  )
}
