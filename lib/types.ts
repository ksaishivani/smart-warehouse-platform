export type PriorityTier = "urgent" | "high" | "standard"

export type CustomerTier = "platinum" | "gold" | "standard"

export type OrderStage =
  | "created"
  | "prioritized"
  | "allocated"
  | "picking"
  | "packing"
  | "qc"
  | "dispatch"
  | "shipped"

export const STAGE_ORDER: OrderStage[] = [
  "created",
  "prioritized",
  "allocated",
  "picking",
  "packing",
  "qc",
  "dispatch",
  "shipped",
]

export type OrderStatus = "active" | "blocked" | "backorder" | "shipped"

export type ExceptionType = "short_stock" | "damaged" | "missing" | "qc_fail"

export type ExceptionStatus = "open" | "resolved"

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  zone: string
  bin: string
  onHand: number
  allocated: number
  reorderPoint: number
  reorderQty: number
  incoming: number
  unitCost: number
  unitPrice: number
}

export interface OrderLine {
  sku: string
  name: string
  qty: number
  allocated: number
  picked: number
}

export interface Order {
  id: string
  code: string
  customer: string
  customerTier: CustomerTier
  priority: PriorityTier
  createdAt: number
  dueBy: number
  stage: OrderStage
  status: OrderStatus
  lines: OrderLine[]
  value: number
  /** computed priority score from the decision engine */
  score?: number
}

export interface WarehouseException {
  id: string
  type: ExceptionType
  orderId?: string
  orderCode?: string
  sku: string
  productName: string
  qty: number
  zone: string
  detectedAt: number
  status: ExceptionStatus
  note: string
}

export type RecommendationKind =
  | "allocation"
  | "reorder"
  | "exception"
  | "prioritization"
  | "pick_route"

export interface RecommendationAction {
  label: string
  description: string
}

export interface Recommendation {
  id: string
  kind: RecommendationKind
  title: string
  rationale: string[]
  confidence: number
  impact: "high" | "medium" | "low"
  relatedOrderId?: string
  relatedSku?: string
  /** opaque payload the store uses to apply the recommendation */
  apply: { type: string; payload: Record<string, unknown> }
  primaryAction: string
}

export interface ActivityEntry {
  id: string
  at: number
  message: string
  kind: "info" | "success" | "warning" | "danger" | "decision"
}
