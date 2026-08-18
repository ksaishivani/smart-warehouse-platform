"use client"

import { useMemo } from "react"
import { BarChart3, TriangleAlert } from "lucide-react"
import { useStore } from "@/lib/store"
import { availableStock, toProductMap } from "@/lib/decision-engine"
import { type OrderStage } from "@/lib/types"
import { Panel, PanelHeader } from "@/components/primitives"
import { currency } from "@/lib/format"
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

const WIP_STAGES: OrderStage[] = [
  "created",
  "allocated",
  "picking",
  "packing",
  "qc",
  "dispatch",
]

export function AnalyticsView() {
  const { orders, products, exceptions, now } = useStore()
  const map = useMemo(() => toProductMap(products), [products])

  const stats = useMemo(() => {
    const shipped = orders.filter((o) => o.status === "shipped").length
    const backorders = orders.filter((o) => o.status === "backorder").length
    const openEx = exceptions.filter((e) => e.status === "open").length
    const breached = orders.filter(
      (o) => o.status !== "shipped" && o.dueBy < now,
    ).length
    const activeTotal = orders.filter((o) => o.status !== "shipped").length

    const invValue = products.reduce((s, p) => s + p.onHand * p.unitCost, 0)
    const skusAtRisk = products.filter(
      (p) => availableStock(p) + p.incoming <= p.reorderPoint,
    ).length

    const onTime =
      activeTotal === 0 ? 100 : Math.round(((activeTotal - breached) / activeTotal) * 100)

    // Fill rate: lines fully allocatable from available stock
    const totalLines = orders
      .filter((o) => o.status !== "shipped")
      .flatMap((o) => o.lines)
    const fillable = totalLines.filter(
      (l) => (map[l.sku] ? map[l.sku].onHand : 0) >= l.qty,
    ).length
    const fillRate =
      totalLines.length === 0 ? 100 : Math.round((fillable / totalLines.length) * 100)

    return { shipped, backorders, openEx, breached, invValue, skusAtRisk, onTime, fillRate }
  }, [orders, products, exceptions, now, map])

  const stageCounts = useMemo(() => {
    const counts = WIP_STAGES.map((s) => ({
      stage: s,
      count: orders.filter((o) => o.stage === s).length,
    }))
    return counts
  }, [orders])

  const bottleneck = useMemo(() => {
    let top = stageCounts[0]
    for (const c of stageCounts) if (c.count > top.count) top = c
    return top
  }, [stageCounts])

  const zoneLoad = useMemo(() => {
    const zones: Record<string, number> = {}
    for (const o of orders) {
      if (o.status === "shipped") continue
      for (const l of o.lines) {
        const z = map[l.sku]?.zone ?? "?"
        zones[z] = (zones[z] ?? 0) + l.qty
      }
    }
    return Object.entries(zones).sort((a, b) => a[0].localeCompare(b[0]))
  }, [orders, map])

  const maxStage = Math.max(1, ...stageCounts.map((c) => c.count))
  const maxZone = Math.max(1, ...zoneLoad.map(([, v]) => v))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="On-time rate" value={`${stats.onTime}%`} tone={stats.onTime >= 90 ? "success" : stats.onTime >= 70 ? "warning" : "danger"} />
        <Kpi label="Order fill rate" value={`${stats.fillRate}%`} tone={stats.fillRate >= 90 ? "success" : "warning"} />
        <Kpi label="Orders shipped" value={stats.shipped} />
        <Kpi label="Inventory value" value={currency(stats.invValue)} />
        <Kpi label="SLA breaches" value={stats.breached} tone={stats.breached ? "danger" : "success"} />
        <Kpi label="Backorders" value={stats.backorders} tone={stats.backorders ? "warning" : "default"} />
        <Kpi label="Open exceptions" value={stats.openEx} tone={stats.openEx ? "danger" : "success"} />
        <Kpi label="SKUs at risk" value={stats.skusAtRisk} tone={stats.skusAtRisk ? "warning" : "success"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Work In Progress by Stage"
            subtitle="Where orders are piling up"
            icon={<BarChart3 className="size-4" />}
          />
          <div className="space-y-3 p-4">
            {stageCounts.map((c) => (
              <div key={c.stage} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {STAGE_LABEL[c.stage]}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={cn(
                      "flex h-full items-center justify-end rounded px-2 font-mono text-[11px] font-semibold tabular-nums",
                      c.stage === bottleneck.stage && bottleneck.count > 0
                        ? "bg-warning text-warning-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                    style={{ width: `${Math.max(6, (c.count / maxStage) * 100)}%` }}
                  >
                    {c.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {bottleneck.count > 1 ? (
            <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-xs leading-relaxed text-foreground">
                <span className="font-semibold text-warning">Bottleneck detected:</span>{" "}
                {STAGE_LABEL[bottleneck.stage]} holds {bottleneck.count} orders — the most
                of any stage. Add capacity here to improve flow.
              </p>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader
            title="Zone Workload"
            subtitle="Units demanded per warehouse zone"
            icon={<BarChart3 className="size-4" />}
          />
          <div className="space-y-3 p-4">
            {zoneLoad.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active demand.
              </p>
            ) : (
              zoneLoad.map(([zone, units]) => (
                <div key={zone} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                    Zone {zone}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="flex h-full items-center justify-end rounded bg-info px-2 font-mono text-[11px] font-semibold tabular-nums text-info-foreground"
                      style={{ width: `${Math.max(6, (units / maxZone) * 100)}%` }}
                    >
                      {units}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "info"
}) {
  const toneColor = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
  }[tone]
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", toneColor)}>
        {value}
      </p>
    </div>
  )
}
