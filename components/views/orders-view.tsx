"use client"

import { Fragment, useMemo, useState } from "react"
import { ArrowRight, ChevronDown, PackageCheck } from "lucide-react"
import { useStore } from "@/lib/store"
import { scoreOrder, toProductMap, computeOrderValue } from "@/lib/decision-engine"
import type { Order } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Panel,
  PanelHeader,
  PriorityPill,
  StagePill,
  StatusPill,
} from "@/components/primitives"
import { currency, dueLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

export function OrdersView() {
  const { orders, products, now, dispatch } = useStore()
  const map = useMemo(() => toProductMap(products), [products])
  const [expanded, setExpanded] = useState<string | null>(null)

  const ranked = useMemo(
    () =>
      orders
        .map((o) => ({ order: o, ...scoreOrder(o, now, map) }))
        .sort((a, b) => {
          if (a.order.status === "shipped" && b.order.status !== "shipped") return 1
          if (b.order.status === "shipped" && a.order.status !== "shipped") return -1
          return b.score - a.score
        }),
    [orders, now, map],
  )

  return (
    <Panel>
      <PanelHeader
        title="Order Queue"
        subtitle="Ranked by the engine's blended priority score"
        icon={<PackageCheck className="size-4" />}
        right={
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {orders.filter((o) => o.status !== "shipped").length} active
          </span>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Due</th>
              <th className="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ order, score, factors }) => {
              const due = dueLabel(order.dueBy, now)
              const isOpen = expanded === order.id
              const value = computeOrderValue(order, map)
              return (
                <Fragment key={order.id}>
                  <tr
                    className={cn(
                      "border-b border-border/60 transition-colors hover:bg-secondary/40",
                      order.status === "shipped" && "opacity-55",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setExpanded(isOpen ? null : order.id)}
                        className="flex items-center gap-1.5 text-left"
                      >
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                        <span>
                          <span className="font-mono font-medium">{order.code}</span>
                          <span className="block text-xs text-muted-foreground">
                            {order.customer}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <PriorityPill priority={order.priority} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                        {score}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StagePill stage={order.stage} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "font-mono text-xs tabular-nums",
                          due.breached
                            ? "text-danger"
                            : due.urgent
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        {due.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <OrderAction order={order} dispatch={dispatch} />
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-border/60 bg-background/40">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Line items · {currency(value)}
                            </p>
                            <ul className="space-y-1">
                              {order.lines.map((l) => (
                                <li
                                  key={l.sku}
                                  className="flex items-center justify-between rounded border border-border bg-card px-2.5 py-1.5 text-xs"
                                >
                                  <span>{l.name}</span>
                                  <span className="font-mono tabular-nums text-muted-foreground">
                                    {l.allocated}/{l.qty} alloc
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Score breakdown · {score}
                            </p>
                            <ul className="space-y-1">
                              {factors.map((f, i) => (
                                <li
                                  key={i}
                                  className="flex items-center justify-between rounded border border-border bg-card px-2.5 py-1.5 text-xs"
                                >
                                  <span className="capitalize text-muted-foreground">
                                    {f.label}
                                  </span>
                                  <span className="font-mono tabular-nums text-primary">
                                    +{f.points}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function OrderAction({
  order,
  dispatch,
}: {
  order: Order
  dispatch: ReturnType<typeof useStore>["dispatch"]
}) {
  if (order.status === "shipped") {
    return <span className="text-xs text-muted-foreground">Complete</span>
  }
  if (order.stage === "created" || order.stage === "prioritized") {
    return (
      <Button
        size="sm"
        variant="secondary"
        className="h-7 gap-1"
        onClick={() => dispatch({ type: "ALLOCATE_ORDER", orderId: order.id })}
      >
        Allocate
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-7 gap-1"
      onClick={() => dispatch({ type: "ADVANCE_STAGE", orderId: order.id })}
    >
      Advance
      <ArrowRight className="size-3.5" />
    </Button>
  )
}
