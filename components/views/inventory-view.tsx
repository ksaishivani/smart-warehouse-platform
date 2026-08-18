"use client"

import { useMemo } from "react"
import { Boxes, TruckIcon } from "lucide-react"
import { useStore } from "@/lib/store"
import { availableStock } from "@/lib/decision-engine"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Panel, PanelHeader, MiniBar } from "@/components/primitives"
import { cn } from "@/lib/utils"

type Health = "out" | "low" | "ok"

function health(p: Product): Health {
  const avail = availableStock(p)
  if (avail <= 0) return "out"
  if (avail + p.incoming <= p.reorderPoint) return "low"
  return "ok"
}

export function InventoryView() {
  const { products, dispatch } = useStore()

  const sorted = useMemo(() => {
    const rank = { out: 0, low: 1, ok: 2 }
    return [...products].sort((a, b) => rank[health(a)] - rank[health(b)])
  }, [products])

  return (
    <Panel>
      <PanelHeader
        title="Inventory & Stock Monitor"
        subtitle="Available = on-hand minus reserved. Reorder point flags risk."
        icon={<Boxes className="size-4" />}
        right={
          <div className="flex items-center gap-3 text-xs">
            <Legend tone="bg-danger" label="Out" />
            <Legend tone="bg-warning" label="Low" />
            <Legend tone="bg-success" label="OK" />
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">SKU / Product</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">On hand</th>
              <th className="px-4 py-2 font-medium">Reserved</th>
              <th className="px-4 py-2 font-medium">Available</th>
              <th className="px-4 py-2 font-medium">Level</th>
              <th className="px-4 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const h = health(p)
              const avail = availableStock(p)
              const tone = h === "out" ? "danger" : h === "low" ? "warning" : "success"
              return (
                <tr
                  key={p.id}
                  className="border-b border-border/60 transition-colors hover:bg-secondary/40"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                    <span className="block font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.category}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs">Zone {p.zone}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {p.bin}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{p.onHand}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-muted-foreground">
                    {p.allocated}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold tabular-nums",
                        h === "out"
                          ? "text-danger"
                          : h === "low"
                            ? "text-warning"
                            : "text-foreground",
                      )}
                    >
                      {avail}
                    </span>
                    {p.incoming > 0 ? (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-info">
                        <TruckIcon className="size-3" />
                        {p.incoming}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="w-28">
                      <MiniBar
                        value={avail}
                        max={Math.max(p.reorderPoint * 2, p.onHand)}
                        tone={tone}
                      />
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                        reorder @ {p.reorderPoint}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {h === "ok" ? (
                      <span className="text-xs text-muted-foreground">Healthy</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7"
                        onClick={() =>
                          dispatch({ type: "REORDER", sku: p.sku, qty: p.reorderQty })
                        }
                      >
                        Reorder {p.reorderQty}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 rounded-full", tone)} />
      {label}
    </span>
  )
}
