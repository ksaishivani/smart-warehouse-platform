import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type {
  OrderStage,
  OrderStatus,
  PriorityTier,
} from "@/lib/types"

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  title,
  icon,
  right,
  subtitle,
}: {
  title: string
  icon?: ReactNode
  right?: ReactNode
  subtitle?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {right}
    </div>
  )
}

const PRIORITY_STYLES: Record<PriorityTier, string> = {
  urgent: "bg-danger/15 text-danger border-danger/30",
  high: "bg-warning/15 text-warning border-warning/30",
  standard: "bg-muted text-muted-foreground border-border",
}

export function PriorityPill({ priority }: { priority: PriorityTier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        PRIORITY_STYLES[priority],
      )}
    >
      {priority}
    </span>
  )
}

const STAGE_LABEL: Record<OrderStage, string> = {
  created: "Created",
  prioritized: "Prioritized",
  allocated: "Allocated",
  picking: "Picking",
  packing: "Packing",
  qc: "Quality Check",
  dispatch: "Dispatch",
  shipped: "Shipped",
}

export function StagePill({ stage }: { stage: OrderStage }) {
  const shipped = stage === "shipped"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        shipped
          ? "border-success/30 bg-success/15 text-success"
          : "border-border bg-secondary text-secondary-foreground",
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  )
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  active: "bg-info/15 text-info border-info/30",
  blocked: "bg-danger/15 text-danger border-danger/30",
  backorder: "bg-warning/15 text-warning border-warning/30",
  shipped: "bg-success/15 text-success border-success/30",
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  )
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "info"
  icon?: ReactNode
}) {
  const toneColor = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-info",
  }[tone]
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <span className={cn("font-mono text-2xl font-semibold tabular-nums", toneColor)}>
        {value}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export function MiniBar({
  value,
  max,
  tone = "primary",
}: {
  value: number
  max: number
  tone?: "primary" | "success" | "warning" | "danger" | "info"
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  const bg = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  }[tone]
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", bg)} style={{ width: `${pct}%` }} />
    </div>
  )
}
