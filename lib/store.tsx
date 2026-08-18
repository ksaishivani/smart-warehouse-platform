"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react"
import {
  seedExceptions,
  seedOrders,
  seedProducts,
} from "./mock-data"
import {
  availableStock,
  planAllocation,
  toProductMap,
} from "./decision-engine"
import {
  STAGE_ORDER,
  type ActivityEntry,
  type Order,
  type OrderStage,
  type Product,
  type Recommendation,
  type WarehouseException,
} from "./types"

const MIN = 60 * 1000

interface State {
  now: number
  products: Product[]
  orders: Order[]
  exceptions: WarehouseException[]
  activity: ActivityEntry[]
  dismissed: string[]
  simRunning: boolean
  seq: number
}

type Action =
  | { type: "TICK" }
  | { type: "TOGGLE_SIM" }
  | { type: "ADVANCE_STAGE"; orderId: string }
  | { type: "ALLOCATE_ORDER"; orderId: string }
  | { type: "ALLOCATE_SKU"; sku: string }
  | { type: "REORDER"; sku: string; qty: number }
  | { type: "RESOLVE_EXCEPTION"; exceptionId: string; resolution: string }
  | { type: "OPTIMIZE_ROUTE"; orderIds: string[] }
  | { type: "APPLY_RECOMMENDATION"; rec: Recommendation }
  | { type: "DISMISS_RECOMMENDATION"; id: string }
  | { type: "INJECT_EXCEPTION" }
  | { type: "CREATE_ORDER" }

function log(
  state: State,
  message: string,
  kind: ActivityEntry["kind"],
): ActivityEntry[] {
  const entry: ActivityEntry = {
    id: `act-${state.seq}`,
    at: state.now,
    message,
    kind,
  }
  return [entry, ...state.activity].slice(0, 80)
}

function nextStage(stage: OrderStage): OrderStage {
  const i = STAGE_ORDER.indexOf(stage)
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)]
}

function allocateOrder(state: State, orderId: string): State {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order) return state
  const products = state.products.map((p) => ({ ...p }))
  const map = toProductMap(products)
  let fully = true
  const lines = order.lines.map((l) => {
    const p = map[l.sku]
    if (!p) return l
    const need = l.qty - l.allocated
    const grant = Math.min(need, availableStock(p))
    p.allocated += grant
    if (l.allocated + grant < l.qty) fully = false
    return { ...l, allocated: l.allocated + grant }
  })
  const orders = state.orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          lines,
          stage: "allocated" as OrderStage,
          status: fully ? ("active" as const) : ("backorder" as const),
        }
      : o,
  )
  return {
    ...state,
    products,
    orders,
    seq: state.seq + 1,
    activity: log(
      state,
      `${order.code}: stock reserved and released to picking${fully ? "" : " (partial — backorder created)"}.`,
      fully ? "success" : "warning",
    ),
  }
}

function allocateSku(state: State, sku: string): State {
  const products = state.products.map((p) => ({ ...p }))
  const map = toProductMap(products)
  const plan = planAllocation(sku, map, state.orders, state.now)
  if (!plan) return state

  const product = products.find((p) => p.sku === sku)!
  let orders = [...state.orders]
  for (const a of plan.allocations) {
    if (a.granted <= 0) {
      orders = orders.map((o) =>
        o.id === a.orderId ? { ...o, status: "backorder" as const } : o,
      )
      continue
    }
    product.allocated += a.granted
    orders = orders.map((o) => {
      if (o.id !== a.orderId) return o
      const lines = o.lines.map((l) =>
        l.sku === sku ? { ...l, allocated: l.allocated + a.granted } : l,
      )
      const fully = lines.every((l) => l.allocated >= l.qty)
      return {
        ...o,
        lines,
        stage: "allocated" as OrderStage,
        status: fully ? ("active" as const) : ("backorder" as const),
      }
    })
  }
  return {
    ...state,
    products,
    orders,
    seq: state.seq + 1,
    activity: log(
      state,
      `Priority allocation applied for ${plan.productName}: ${plan.allocations[0].orderCode} served first.`,
      "decision",
    ),
  }
}

function advanceStage(state: State, orderId: string): State {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order || order.stage === "shipped") return state
  const target = nextStage(order.stage)

  // Shipping deducts physical inventory and clears the reservation.
  if (target === "shipped") {
    const products = state.products.map((p) => {
      const line = order.lines.find((l) => l.sku === p.sku)
      if (!line) return p
      return {
        ...p,
        onHand: Math.max(0, p.onHand - line.allocated),
        allocated: Math.max(0, p.allocated - line.allocated),
      }
    })
    const orders = state.orders.map((o) =>
      o.id === orderId
        ? { ...o, stage: target, status: "shipped" as const }
        : o,
    )
    return {
      ...state,
      products,
      orders,
      seq: state.seq + 1,
      activity: log(
        state,
        `${order.code} dispatched — inventory decremented and reservation cleared.`,
        "success",
      ),
    }
  }

  const orders = state.orders.map((o) =>
    o.id === orderId ? { ...o, stage: target } : o,
  )
  return {
    ...state,
    orders,
    seq: state.seq + 1,
    activity: log(state, `${order.code} advanced to ${target}.`, "info"),
  }
}

function reorder(state: State, sku: string, qty: number): State {
  const products = state.products.map((p) =>
    p.sku === sku ? { ...p, incoming: p.incoming + qty } : p,
  )
  const p = products.find((x) => x.sku === sku)
  return {
    ...state,
    products,
    seq: state.seq + 1,
    activity: log(
      state,
      `Purchase order raised: ${qty} × ${p?.name ?? sku} inbound.`,
      "decision",
    ),
  }
}

function resolveException(
  state: State,
  exceptionId: string,
  resolution: string,
): State {
  const ex = state.exceptions.find((e) => e.id === exceptionId)
  if (!ex) return state

  // Write off the damaged/missing units so on-hand stays accurate.
  const products = state.products.map((p) => {
    if (p.sku !== ex.sku) return p
    return {
      ...p,
      onHand: Math.max(0, p.onHand - ex.qty),
      incoming: resolution === "backorder" ? p.incoming + p.reorderQty : p.incoming,
    }
  })

  const orders =
    resolution === "backorder" && ex.orderId
      ? state.orders.map((o) =>
          o.id === ex.orderId ? { ...o, status: "backorder" as const } : o,
        )
      : state.orders

  const exceptions = state.exceptions.map((e) =>
    e.id === exceptionId ? { ...e, status: "resolved" as const } : e,
  )

  return {
    ...state,
    products,
    orders,
    exceptions,
    seq: state.seq + 1,
    activity: log(
      state,
      resolution === "replace"
        ? `Exception cleared: re-picked ${ex.qty} × ${ex.productName}, damaged unit written off.`
        : `Exception cleared: ${ex.orderCode ?? "order"} set to partial ship + backorder, reorder raised.`,
      resolution === "replace" ? "success" : "warning",
    ),
  }
}

function injectException(state: State): State {
  const candidates = state.orders.filter(
    (o) => o.stage === "picking" || o.stage === "packing" || o.stage === "qc",
  )
  if (candidates.length === 0) return state
  const order = candidates[state.seq % candidates.length]
  const line = order.lines[0]
  const product = state.products.find((p) => p.sku === line.sku)
  const types = ["damaged", "missing", "qc_fail"] as const
  const type = types[state.seq % types.length]
  const ex: WarehouseException = {
    id: `e-${state.seq}`,
    type,
    orderId: order.id,
    orderCode: order.code,
    sku: line.sku,
    productName: line.name,
    qty: 1,
    zone: product?.zone ?? "?",
    detectedAt: state.now,
    status: "open",
    note:
      type === "damaged"
        ? `Damaged unit flagged at bin ${product?.bin ?? "?"}.`
        : type === "missing"
          ? `Expected unit not found in bin ${product?.bin ?? "?"}.`
          : `Unit failed quality check during ${order.code}.`,
  }
  return {
    ...state,
    exceptions: [ex, ...state.exceptions],
    seq: state.seq + 1,
    activity: log(
      state,
      `New exception: ${type.replace("_", " ")} on ${line.name} (${order.code}).`,
      "danger",
    ),
  }
}

const NEW_CUSTOMERS = [
  { name: "Harbor Freight Co.", tier: "gold" as const },
  { name: "Lumen Living", tier: "standard" as const },
  { name: "Apex Sports", tier: "platinum" as const },
  { name: "Riverside Goods", tier: "standard" as const },
]

function createOrder(state: State): State {
  const pool = state.products.filter((p) => availableStock(p) > 0)
  if (pool.length === 0) return state
  const product = pool[state.seq % pool.length]
  const cust = NEW_CUSTOMERS[state.seq % NEW_CUSTOMERS.length]
  const priorities = ["urgent", "high", "standard"] as const
  const priority = priorities[state.seq % priorities.length]
  const dueOffset =
    priority === "urgent"
      ? 45 * MIN
      : priority === "high"
        ? 3 * 60 * MIN
        : 8 * 60 * MIN
  const code = `ORD-${4830 + state.seq}`
  const order: Order = {
    id: `o-${state.seq}`,
    code,
    customer: cust.name,
    customerTier: cust.tier,
    priority,
    createdAt: state.now,
    dueBy: state.now + dueOffset,
    stage: "created",
    status: "active",
    value: 0,
    lines: [
      {
        sku: product.sku,
        name: product.name,
        qty: 1 + ((state.seq * 3) % 6),
        allocated: 0,
        picked: 0,
      },
    ],
  }
  return {
    ...state,
    orders: [order, ...state.orders],
    seq: state.seq + 1,
    activity: log(state, `New ${priority} order ${code} from ${cust.name}.`, "info"),
  }
}

function tick(state: State): State {
  let next: State = { ...state, now: state.now + 30 * 1000 }

  // Occasionally auto-advance an in-flight order to keep the board alive.
  const inFlight = next.orders.filter(
    (o) =>
      o.status === "active" &&
      o.stage !== "shipped" &&
      o.stage !== "created" &&
      o.stage !== "prioritized",
  )
  if (inFlight.length && next.seq % 3 === 0) {
    next = advanceStage(next, inFlight[next.seq % inFlight.length].id)
  }
  if (next.seq % 11 === 0) next = createOrder(next)
  if (next.seq % 17 === 0) next = injectException(next)
  return { ...next, seq: next.seq + 1 }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "TICK":
      return tick(state)
    case "TOGGLE_SIM":
      return { ...state, simRunning: !state.simRunning }
    case "ADVANCE_STAGE":
      return advanceStage(state, action.orderId)
    case "ALLOCATE_ORDER":
      return allocateOrder(state, action.orderId)
    case "ALLOCATE_SKU":
      return allocateSku(state, action.sku)
    case "REORDER":
      return reorder(state, action.sku, action.qty)
    case "RESOLVE_EXCEPTION":
      return resolveException(state, action.exceptionId, action.resolution)
    case "OPTIMIZE_ROUTE":
      return {
        ...state,
        seq: state.seq + 1,
        activity: log(
          state,
          `Pick wave generated for ${action.orderIds.length} orders (zone-optimized).`,
          "decision",
        ),
      }
    case "INJECT_EXCEPTION":
      return injectException(state)
    case "CREATE_ORDER":
      return createOrder(state)
    case "DISMISS_RECOMMENDATION":
      return { ...state, dismissed: [...state.dismissed, action.id] }
    case "APPLY_RECOMMENDATION": {
      const { apply } = action.rec
      let s = state
      switch (apply.type) {
        case "allocate_order":
          s = allocateOrder(state, apply.payload.orderId as string)
          break
        case "allocate_sku":
          s = allocateSku(state, apply.payload.sku as string)
          break
        case "reorder":
          s = reorder(state, apply.payload.sku as string, apply.payload.qty as number)
          break
        case "resolve_exception":
          s = resolveException(
            state,
            apply.payload.exceptionId as string,
            apply.payload.resolution as string,
          )
          break
        case "optimize_route":
          s = {
            ...state,
            seq: state.seq + 1,
            activity: log(
              state,
              `Pick wave generated for ${(apply.payload.orderIds as string[]).length} orders (zone-optimized).`,
              "decision",
            ),
          }
          break
      }
      return { ...s, dismissed: [...s.dismissed, action.rec.id] }
    }
    default:
      return state
  }
}

function init(): State {
  const now = Date.now()
  return {
    now,
    products: seedProducts(),
    orders: seedOrders(now),
    exceptions: seedExceptions(now),
    activity: [
      {
        id: "act-init",
        at: now,
        message: "Warehouse control system online. 9 open orders synced.",
        kind: "info",
      },
    ],
    dismissed: [],
    simRunning: false,
    seq: 1,
  }
}

interface StoreValue extends State {
  dispatch: React.Dispatch<Action>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    if (!state.simRunning) return
    const id = setInterval(() => dispatch({ type: "TICK" }), 2000)
    return () => clearInterval(id)
  }, [state.simRunning])

  const value = useMemo(() => ({ ...state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
