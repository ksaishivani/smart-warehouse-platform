"use client"

import { Activity } from "lucide-react"
import { useStore } from "@/lib/store"
import { Panel, PanelHeader } from "@/components/primitives"
import { timeOfDay } from "@/lib/format"
import { cn } from "@/lib/utils"

const DOT: Record<string, string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  decision: "bg-primary",
}

export function ActivityFeed() {
  const { activity } = useStore()
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader
        title="Live Activity"
        subtitle="Every decision and event, timestamped"
        icon={<Activity className="size-4" />}
      />
      <div className="flex-1 overflow-y-auto p-3">
        <ol className="space-y-2.5">
          {activity.map((a) => (
            <li key={a.id} className="flex gap-2.5 text-xs">
              <span className="pt-1">
                <span className={cn("block size-2 rounded-full", DOT[a.kind])} />
              </span>
              <div className="min-w-0">
                <p className="leading-relaxed text-foreground">{a.message}</p>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {timeOfDay(a.at)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  )
}
