import type {
  Order,
  Product,
  Recommendation,
  WarehouseException,
} from "./types"

const MIN = 60 * 1000

export type ProductMap = Record<string, Product>

export function toProductMap(products: Product[]): ProductMap {
  return products.reduce<ProductMap>((acc, p) => {
    acc[p.sku] = p
    return acc
  }, {})
}

export function availableStock(p: Product): number {
  return Math.max(0, p.onHand - p.allocated)
}

export function computeOrderValue(order: Order, map: ProductMap): number {
  return order.lines.reduce(
    (sum, l) => sum + l.qty * (map[l.sku]?.unitPrice ?? 0),
    0,
  )
}

export interface ScoreFactor {
  label: string
  points: number
}

export interface ScoreResult {
  score: number
  factors: ScoreFactor[]
}

/**
 * Priority scoring blends business priority, SLA urgency, customer value,
 * and order size into a single comparable number. This is what the engine
 * uses to break ties when inventory is contended.
 */
export function scoreOrder(
  order: Order,
  now: number,
  map: ProductMap,
): ScoreResult {
  const factors: ScoreFactor[] = []

  const tierPts = { urgent: 100, high: 60, standard: 30 }[order.priority]
  factors.push({ label: `${order.priority} priority`, points: tierPts })

  const minsToDue = (order.dueBy - now) / MIN
  const slaPts =
    minsToDue <= 0 ? 55 : Math.round(Math.max(0, 45 * (1 - minsToDue / 240)))
  factors.push({
    label: minsToDue <= 0 ? "SLA breached" : `due in ${formatMins(minsToDue)}`,
    points: slaPts,
  })

  const custPts = { platinum: 20, gold: 10, standard: 0 }[order.customerTier]
  if (custPts) {
    factors.push({ label: `${order.customerTier} customer`, points: custPts })
  }

  const value = computeOrderValue(order, map)
  const valuePts = Math.min(20, Math.round(value / 500))
  if (valuePts) {
    factors.push({ label: `$${Math.round(value)} order value`, points: valuePts })
  }

  const score = factors.reduce((a, f) => a + f.points, 0)
  return { score, factors }
}

function formatMins(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Orders that still need stock reserved. */
function isUnallocated(order: Order): boolean {
  return (
    order.status !== "shipped" &&
    (order.stage === "created" || order.stage === "prioritized")
  )
}

export interface AllocationPlan {
  sku: string
  productName: string
  available: number
  demand: number
  contested: boolean
  allocations: {
    orderId: string
    orderCode: string
    requested: number
    granted: number
    shortfall: number
    score: number
  }[]
}

/**
 * Greedy priority allocation. When demand exceeds supply for a SKU, the
 * highest-scoring orders are served first; remaining orders are left short
 * and become reorder / backorder candidates.
 */
export function planAllocation(
  sku: string,
  products: ProductMap,
  orders: Order[],
  now: number,
): AllocationPlan | null {
  const product = products[sku]
  if (!product) return null

  const claimants = orders
    .filter((o) => isUnallocated(o) && o.lines.some((l) => l.sku === sku))
    .map((o) => ({
      order: o,
      requested: o.lines.find((l) => l.sku === sku)!.qty,
      score: scoreOrder(o, now, products).score,
    }))
    .sort((a, b) => b.score - a.score)

  if (claimants.length === 0) return null

  let remaining = availableStock(product)
  const demand = claimants.reduce((s, c) => s + c.requested, 0)

  const allocations = claimants.map((c) => {
    const granted = Math.min(c.requested, remaining)
    remaining -= granted
    return {
      orderId: c.order.id,
      orderCode: c.order.code,
      requested: c.requested,
      granted,
      shortfall: c.requested - granted,
      score: c.score,
    }
  })

  return {
    sku,
    productName: product.name,
    available: availableStock(product),
    demand,
    contested: demand > availableStock(product),
    allocations,
  }
}

/**
 * The main brain: produces a ranked list of recommended actions across
 * allocation, reordering, exception handling, and pick optimization.
 */
export function generateRecommendations(
  products: Product[],
  orders: Order[],
  exceptions: WarehouseException[],
  now: number,
): Recommendation[] {
  const map = toProductMap(products)
  const recs: Recommendation[] = []

  // ---- Exceptions first: these block active fulfillment ----
  for (const ex of exceptions.filter((e) => e.status === "open")) {
    const product = map[ex.sku]
    const canReplace = product ? availableStock(product) >= ex.qty : false
    recs.push({
      id: `rec-ex-${ex.id}`,
      kind: "exception",
      title:
        ex.type === "qc_fail"
          ? `QC failure on ${ex.productName}`
          : `${ex.type === "damaged" ? "Damaged" : "Missing"} stock: ${ex.productName}`,
      rationale: [
        `${ex.qty} unit(s) flagged in zone ${ex.zone}${ex.orderCode ? ` while fulfilling ${ex.orderCode}` : ""}.`,
        canReplace
          ? `${availableStock(product!)} replacement unit(s) available — re-pick without delaying the order.`
          : `No replacement stock available — recommend partial ship + backorder and trigger a reorder.`,
        `Write off ${ex.qty} unit(s) so on-hand counts stay accurate.`,
      ],
      confidence: canReplace ? 0.92 : 0.74,
      impact: "high",
      relatedOrderId: ex.orderId,
      relatedSku: ex.sku,
      apply: {
        type: "resolve_exception",
        payload: {
          exceptionId: ex.id,
          resolution: canReplace ? "replace" : "backorder",
        },
      },
      primaryAction: canReplace ? "Re-pick replacement" : "Ship partial + backorder",
    })
  }

  // ---- Allocation for unallocated orders ----
  const skusNeedingAllocation = new Set<string>()
  for (const o of orders.filter(isUnallocated)) {
    for (const l of o.lines) skusNeedingAllocation.add(l.sku)
  }

  const handledOrders = new Set<string>()
  for (const sku of skusNeedingAllocation) {
    const plan = planAllocation(sku, map, orders, now)
    if (!plan || !plan.contested) continue

    const winner = plan.allocations[0]
    const losers = plan.allocations.slice(1)
    const winnerOrder = orders.find((o) => o.id === winner.orderId)!
    handledOrders.add(winner.orderId)
    losers.forEach((l) => handledOrders.add(l.orderId))

    const rationale: string[] = [
      `${plan.demand} units demanded but only ${plan.available} available for ${plan.productName}.`,
      `${winner.orderCode} scores highest (${winner.score}) — allocate ${winner.granted} of ${winner.requested}${
        winner.shortfall ? `, ${winner.shortfall} short` : " (fully covered)"
      }.`,
    ]
    losers.forEach((l) => {
      rationale.push(
        l.granted > 0
          ? `${l.orderCode} (score ${l.score}) gets ${l.granted}, ${l.shortfall} backordered.`
          : `${l.orderCode} (score ${l.score}) is deferred to backorder — no stock left.`,
      )
    })
    const totalShort = plan.allocations.reduce((s, a) => s + a.shortfall, 0)
    if (totalShort > 0) {
      rationale.push(`Reorder ${totalShort}+ units to clear the backorder queue.`)
    }

    recs.push({
      id: `rec-alloc-${sku}`,
      kind: "allocation",
      title: `Contested stock: ${plan.productName}`,
      rationale,
      confidence: 0.88,
      impact: "high",
      relatedOrderId: winnerOrder.id,
      relatedSku: sku,
      apply: { type: "allocate_sku", payload: { sku } },
      primaryAction: "Apply priority allocation",
    })
  }

  // ---- Clean allocations for orders that can be fully covered ----
  for (const o of orders.filter(isUnallocated)) {
    if (handledOrders.has(o.id)) continue
    const canFulfill = o.lines.every(
      (l) => availableStock(map[l.sku]) >= l.qty,
    )
    if (!canFulfill) continue
    const { score } = scoreOrder(o, now, map)
    recs.push({
      id: `rec-release-${o.id}`,
      kind: "allocation",
      title: `Release ${o.code} to picking`,
      rationale: [
        `All ${o.lines.length} line(s) fully in stock.`,
        `Priority score ${score} — reserve stock and drop the pick task now.`,
      ],
      confidence: 0.95,
      impact: o.priority === "urgent" ? "high" : "medium",
      relatedOrderId: o.id,
      apply: { type: "allocate_order", payload: { orderId: o.id } },
      primaryAction: "Allocate & release",
    })
  }

  // ---- Reorder recommendations ----
  for (const p of products) {
    const avail = availableStock(p)
    const projected = avail + p.incoming
    if (projected > p.reorderPoint) continue
    const deficit = p.reorderPoint - projected
    const qty = Math.max(p.reorderQty, deficit)
    recs.push({
      id: `rec-reorder-${p.sku}`,
      kind: "reorder",
      title:
        avail === 0
          ? `Out of stock: ${p.name}`
          : `Low stock: ${p.name}`,
      rationale: [
        `${avail} available vs reorder point ${p.reorderPoint}${
          p.incoming ? ` (${p.incoming} already inbound)` : ""
        }.`,
        `Recommended purchase order: ${qty} units at $${p.unitCost.toFixed(2)}/unit.`,
        avail === 0
          ? "Currently blocking any new orders for this SKU."
          : "Reorder now to avoid stockout at current demand.",
      ],
      confidence: avail === 0 ? 0.9 : 0.8,
      impact: avail === 0 ? "high" : "medium",
      relatedSku: p.sku,
      apply: { type: "reorder", payload: { sku: p.sku, qty } },
      primaryAction: `Raise PO for ${qty}`,
    })
  }

  // ---- Pick route optimization ----
  const pickable = orders.filter(
    (o) => o.stage === "allocated" || o.stage === "picking",
  )
  if (pickable.length >= 2) {
    const tasks = pickable.flatMap((o) =>
      o.lines.map((l) => ({ zone: map[l.sku]?.zone ?? "?", order: o.code })),
    )
    const zones = Array.from(new Set(tasks.map((t) => t.zone))).sort()
    recs.push({
      id: "rec-pickroute",
      kind: "pick_route",
      title: `Batch pick ${pickable.length} orders`,
      rationale: [
        `${tasks.length} pick tasks across zones ${zones.join(", ")}.`,
        `Serpentine route by zone → bin cuts an estimated ${Math.round(
          25 + tasks.length * 4,
        )}% of picker travel vs order-by-order.`,
      ],
      confidence: 0.7,
      impact: "medium",
      apply: {
        type: "optimize_route",
        payload: { orderIds: pickable.map((o) => o.id) },
      },
      primaryAction: "Generate pick wave",
    })
  }

  const impactRank = { high: 0, medium: 1, low: 2 }
  return recs.sort(
    (a, b) =>
      impactRank[a.impact] - impactRank[b.impact] || b.confidence - a.confidence,
  )
}

/** Optimized serpentine pick path for a set of orders. */
export function buildPickRoute(
  orders: Order[],
  map: ProductMap,
): { zone: string; bin: string; sku: string; name: string; qty: number; order: string }[] {
  const stops = orders.flatMap((o) =>
    o.lines.map((l) => {
      const p = map[l.sku]
      return {
        zone: p?.zone ?? "?",
        bin: p?.bin ?? "?",
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        order: o.code,
      }
    }),
  )
  return stops.sort((a, b) =>
    a.zone === b.zone ? a.bin.localeCompare(b.bin) : a.zone.localeCompare(b.zone),
  )
}
