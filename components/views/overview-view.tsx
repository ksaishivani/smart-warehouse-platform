"use client"

import { useMemo } from "react"
import { AlertTriangle, Boxes, Clock, PackageCheck, Truck } from "lucide-react"
import { useStore } from "@/lib/store"
import { availableStock } from "@/lib/decision-engine"
import { Metric } from "@/components/primitives"
import { DecisionConsole } from "@/components/decision-console"
import { ExceptionsPanel } from "@/components/exceptions-panel"
import { ActivityFeed } from "@/components/activity-feed"

export function OverviewView() {
  const { orders, products, exceptions, now } = useStore()

  const kpis = useMemo(() => {
    const active = orders.filter((o) => o.status !== "shipped")
    const breached = active.filter((o) => o.dueBy < now).length
    const backorders = orders.filter((o) => o.status === "backorder").length
    const shipped = orders.filter((o) => o.status === "shipped").length
    const openEx = exceptions.filter((e) => e.status === "open").length
    const lowStock = products.filter(
      (p) => availableStock(p) + p.incoming <= p.reorderPoint,
    ).length
    return {
      active: active.length,
      breached,
      backorders,
      shipped,
      openEx,
      lowStock,
    }
  }, [orders, products, exceptions, now])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Active orders"
          value={kpis.active}
          icon={<PackageCheck className="size-4" />}
        />
        <Metric
          label="SLA at risk"
          value={kpis.breached}
          tone={kpis.breached ? "danger" : "success"}
          icon={<Clock className="size-4" />}
          hint={kpis.breached ? "overdue now" : "on track"}
        />
        <Metric
          label="Backorders"
          value={kpis.backorders}
          tone={kpis.backorders ? "warning" : "default"}
          icon={<Truck className="size-4" />}
        />
        <Metric
          label="Open exceptions"
          value={kpis.openEx}
          tone={kpis.openEx ? "danger" : "success"}
          icon={<AlertTriangle className="size-4" />}
        />
        <Metric
          label="Low / out of stock"
          value={kpis.lowStock}
          tone={kpis.lowStock ? "warning" : "success"}
          icon={<Boxes className="size-4" />}
        />
        <Metric
          label="Shipped today"
          value={kpis.shipped}
          tone="success"
          icon={<Truck className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-h-[26rem]">
          <DecisionConsole />
        </div>
        <div className="flex flex-col gap-4">
          <div className="min-h-52 flex-1">
            <ExceptionsPanel />
          </div>
          <div className="min-h-52 flex-1">
            <ActivityFeed />
          </div>
        </div>
      </div>
    </div>
  )
}
