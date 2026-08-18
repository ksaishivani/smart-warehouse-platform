const MIN = 60 * 1000
const HOUR = 60 * MIN

export function timeAgo(then: number, now: number): string {
  const diff = Math.max(0, now - then)
  if (diff < MIN) return "just now"
  if (diff < HOUR) return `${Math.round(diff / MIN)}m ago`
  return `${Math.round(diff / HOUR)}h ago`
}

export function dueLabel(dueBy: number, now: number): { label: string; breached: boolean; urgent: boolean } {
  const diff = dueBy - now
  if (diff <= 0) return { label: `${fmt(-diff)} overdue`, breached: true, urgent: true }
  return { label: `in ${fmt(diff)}`, breached: false, urgent: diff < 30 * MIN }
}

function fmt(ms: number): string {
  const mins = Math.round(ms / MIN)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function currency(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
