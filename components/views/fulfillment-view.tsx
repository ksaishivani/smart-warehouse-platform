"use client"

import { useMemo } from "react"
import { ArrowRight, MapPin, Workflow } from "lucide-react"
import { useStore } from "@/lib/store"
import { buildPickRoute, toProductMap } from "@/lib/decision-engine"
import { STAGE_ORDER, type Order, type OrderStage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Panel, PanelHeader, PriorityPill } from "@/components/primitives"
import { dueLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

const STAGE_LABEL: Record<OrderStage, string> = {
  created: "Created",
  prioritized: "Prioritized",
  allocated: "Allocated",
  picking: "Picking",
  packing: "Packing",
  qc: "QC",
  dispatch: "Dispatch",
  shipped: "Shipped",
}

// Columns shown on the board (prioritized is folded into Created).
const BOARD_STAGES: OrderStage[] = [
  "created",
  "allocated",
  "picking",
  "packing",
  "qc",
  "dispatch",
  "shipped",
]

export function FulfillmentView() {
  const { orders, products, now, dispatch } = useStore()
  const map = useMemo(() => toProductMap(products), [products])

  const grouped = useMemo(() => {
    const g: Record<OrderStage, Order[]> = {
      created: [],
      prioritized: [],
      allocated: [],
      picking: [],
      packing: [],
      qc: [],
      dispatch: [],
      shipped: [],
    }
    for (const o of orders) g[o.stage].push(o)
    // Fold prioritized into created column
    g.created = [...g.created, ...g.prioritized]
    return g
  }, [orders])

  const pickable = useMemo(
    () => orders.filter((o) => o.stage === "allocated" || o.stage === "picking"),
    [orders],
  )
  const route = useMemo(() => buildPickRoute(pickable, map), [pickable, map])

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Fulfillment Pipeline"
          subtitle="Order → Prioritize → Allocate → Pick → Pack → QC → Dispatch → Ship"
          icon={<Workflow className="size-4" />}
        />
        <div className="flex gap-3 overflow-x-auto p-3">
          {BOARD_STAGES.map((stage) => (
            <div key={stage} className="flex w-56 shrink-0 flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {STAGE_LABEL[stage]}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {grouped[stage].length}
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-2 min-h-24">
                {grouped[stage].length === 0 ? (
                  <span className="px-1 py-4 text-center text-xs text-muted-foreground/60">
                    empty
                  </span>
                ) : (
                  grouped[stage].map((o) => (
                    <StageCard key={o.id} order={o} now={now} dispatch={dispatch} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Optimized Pick Route"
          subtitle={`Serpentine path across ${pickable.length} order(s) to minimize picker travel`}
          icon={<MapPin className="size-4" />}
          right={
            pickable.length >= 2 ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={() =>
                  dispatch({
                    type: "OPTIMIZE_ROUTE",
                    orderIds: pickable.map((o) => o.id),
                  })
                }
              >
                Generate wave
              </Button>
            ) : null
          }
        />
        <div className="p-3">
          {route.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No orders staged for picking.
            </p>
          ) : (
            <ol className="flex flex-wrap items-stretch gap-2">
              {route.map((stop, i) => (
                <li key={`${stop.order}-${stop.sku}-${i}`} className="flex items-center gap-2">
                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded bg-primary/15 font-mono text-[11px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span className="font-mono text-xs font-medium">
                        {stop.zone} · {stop.bin}
                      </span>
                    </div>
                    <span className="mt-1 block max-w-40 truncate text-xs text-muted-foreground">
                      {stop.qty} × {stop.name}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {stop.order}
                    </span>
                  </div>
                  {i < route.length - 1 ? (
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Panel>
    </div>
  )
}

function StageCard({
  order,
  now,
  dispatch,
}: {
  order: Order
  now: number
  dispatch: ReturnType<typeof useStore>["dispatch"]
}) {
  const due = dueLabel(order.dueBy, now)
  const canAllocate = order.stage === "created" || order.stage === "prioritized"
  const isShipped = order.stage === "shipped"
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium">{order.code}</span>
        <PriorityPill priority={order.priority} />
      </div>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {order.customer}
      </span>
      <div className="mt-2 flex items-center justify-between">
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            due.breached ? "text-danger" : due.urgent ? "text-warning" : "text-muted-foreground",
          )}
        >
          {due.label}
        </span>
        {!isShipped ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[11px] text-primary hover:text-primary"
            onClick={() =>
              dispatch(
                canAllocate
                  ? { type: "ALLOCATE_ORDER", orderId: order.id }
                  : { type: "ADVANCE_STAGE", orderId: order.id },
              )
            }
          >
            {canAllocate ? "Allocate" : "Advance"}
            <ArrowRight className="size-3" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
