"use client"

import { TriangleAlert } from "lucide-react"
import { useStore } from "@/lib/store"
import { availableStock } from "@/lib/decision-engine"
import { Button } from "@/components/ui/button"
import { Panel, PanelHeader } from "@/components/primitives"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<string, string> = {
  short_stock: "Short stock",
  damaged: "Damaged",
  missing: "Missing",
  qc_fail: "QC fail",
}

export function ExceptionsPanel() {
  const { exceptions, products, now, dispatch } = useStore()
  const open = exceptions.filter((e) => e.status === "open")

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader
        title="Exceptions"
        subtitle="Damaged, missing, and failed items needing a decision"
        icon={<TriangleAlert className="size-4 text-danger" />}
        right={
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
              open.length
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-success/30 bg-success/10 text-success",
            )}
          >
            {open.length}
          </span>
        }
      />
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {open.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No open exceptions.
          </p>
        ) : (
          open.map((ex) => {
            const product = products.find((p) => p.sku === ex.sku)
            const canReplace = product ? availableStock(product) >= ex.qty : false
            return (
              <div key={ex.id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
                    {TYPE_LABEL[ex.type]}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {timeAgo(ex.detectedAt, now)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium">{ex.productName}</p>
                <p className="text-xs text-muted-foreground">{ex.note}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      dispatch({
                        type: "RESOLVE_EXCEPTION",
                        exceptionId: ex.id,
                        resolution: canReplace ? "replace" : "backorder",
                      })
                    }
                  >
                    {canReplace ? "Re-pick replacement" : "Partial + backorder"}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    {canReplace ? "stock available" : "no stock — reorder"}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Panel>
  )
}
