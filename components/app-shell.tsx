"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { generateRecommendations } from "@/lib/decision-engine"
import { timeOfDay } from "@/lib/format"
import { OverviewView } from "@/components/views/overview-view"
import { OrdersView } from "@/components/views/orders-view"
import { InventoryView } from "@/components/views/inventory-view"
import { FulfillmentView } from "@/components/views/fulfillment-view"
import { DecisionsView } from "@/components/views/decisions-view"
import { AnalyticsView } from "@/components/views/analytics-view"

type Tab = "overview" | "orders" | "inventory" | "fulfillment" | "decisions" | "analytics"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Mission Control" },
  { id: "orders", label: "Orders" },
  { id: "inventory", label: "Inventory" },
  { id: "fulfillment", label: "Fulfillment" },
  { id: "decisions", label: "Decision Engine" },
  { id: "analytics", label: "Analytics" },
]

export function AppShell() {
  const { products, orders, exceptions, now, dismissed, simRunning, dispatch } = useStore()
  const [tab, setTab] = useState<Tab>("overview")

  const openExceptions = exceptions.filter((e) => e.status === "open").length
  const pendingDecisions = useMemo(
    () =>
      generateRecommendations(products, orders, exceptions, now).filter(
        (r) => !dismissed.includes(r.id),
      ).length,
    [products, orders, exceptions, now, dismissed],
  )

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex items-center gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
              <span className="font-mono text-sm font-bold text-primary">PZ</span>
            </div>
            <div className="leading-tight">
              <div className="font-mono text-sm font-semibold tracking-tight">PALLETIZED</div>
              <div className="text-[11px] text-muted-foreground">Warehouse Operations Control</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 md:flex">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  simRunning ? "animate-pulse bg-success" : "bg-muted-foreground",
                )}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {simRunning ? "SIMULATION LIVE" : "PAUSED"}
              </span>
            </div>
            <button
              onClick={() => dispatch({ type: "TOGGLE_SIM" })}
              className={cn(
                "rounded-md border px-3 py-1.5 font-mono text-xs font-medium transition-colors",
                simRunning
                  ? "border-border bg-secondary text-foreground hover:bg-muted"
                  : "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
              )}
            >
              {simRunning ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() => dispatch({ type: "TICK" })}
              className="rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Step
            </button>
            <button
              onClick={() => dispatch({ type: "INJECT_EXCEPTION" })}
              className="hidden rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:bg-muted sm:block"
            >
              Inject event
            </button>
          </div>
        </div>

        <nav className="flex items-stretch gap-0 overflow-x-auto border-t border-border px-2 lg:px-4">
          {TABS.map((t) => {
            const active = tab === t.id
            const badge =
              t.id === "decisions" ? pendingDecisions : t.id === "overview" ? openExceptions : 0
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-medium">{t.label}</span>
                {badge > 0 ? (
                  <span
                    className={cn(
                      "flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold",
                      t.id === "decisions"
                        ? "bg-primary text-primary-foreground"
                        : "bg-danger text-white",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                ) : null}
              </button>
            )
          })}
          <div className="ml-auto hidden items-center pr-2 md:flex">
            <span className="font-mono text-xs text-muted-foreground">{timeOfDay(now)}</span>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6">
        {tab === "overview" ? <OverviewView /> : null}
        {tab === "orders" ? <OrdersView /> : null}
        {tab === "inventory" ? <InventoryView /> : null}
        {tab === "fulfillment" ? <FulfillmentView /> : null}
        {tab === "decisions" ? <DecisionsView /> : null}
        {tab === "analytics" ? <AnalyticsView /> : null}
      </main>
    </div>
  )
}
