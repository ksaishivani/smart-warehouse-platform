"use client"

import { Brain, Scale } from "lucide-react"
import { DecisionConsole } from "@/components/decision-console"
import { ExceptionsPanel } from "@/components/exceptions-panel"
import { Panel, PanelHeader } from "@/components/primitives"

const LOGIC = [
  {
    title: "Priority scoring",
    body: "Every order gets a blended score from business priority, SLA urgency (time to deadline), customer tier, and order value. This single number breaks every tie.",
  },
  {
    title: "Contested allocation",
    body: "When demand exceeds supply, the highest-scoring order is served first. Remaining orders are partially filled or backordered, and a reorder is proposed for the shortfall.",
  },
  {
    title: "Exception resolution",
    body: "Damaged / missing / QC-failed units check for replacement stock. If available, re-pick without delay; otherwise recommend partial ship + backorder and a purchase order.",
  },
  {
    title: "Pick optimization",
    body: "Allocated orders are batched into a serpentine route ordered by zone then bin to minimize picker travel across the floor.",
  },
]

export function DecisionsView() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="min-h-[30rem]">
        <DecisionConsole />
      </div>
      <div className="flex flex-col gap-4">
        <Panel>
          <PanelHeader
            title="How the engine decides"
            subtitle="The logic behind every recommendation"
            icon={<Brain className="size-4 text-primary" />}
          />
          <ul className="divide-y divide-border">
            {LOGIC.map((l) => (
              <li key={l.title} className="flex gap-3 p-4">
                <Scale className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{l.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {l.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="min-h-52">
          <ExceptionsPanel />
        </div>
      </div>
    </div>
  )
}
