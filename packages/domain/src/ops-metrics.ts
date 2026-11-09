/** Pure aggregators for Admin Ops — no I/O. */

export type OrderStatusCount = { status: string; count: number };

export type CountBucket = { key: string; count: number };

export function countByStatus(rows: { status: string }[]): OrderStatusCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.status, (map.get(row.status) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

export function countByKey(rows: { key: string | null | undefined }[]): CountBucket[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (row.key ?? "").trim() || "(unknown)";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Nearest-rank percentile; empty → null. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const clamped = Math.min(100, Math.max(0, p));
  const sorted = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const rank = (clamped / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low]!;
  const weight = rank - low;
  return sorted[low]! * (1 - weight) + sorted[high]! * weight;
}

export type RioTurnSummary = {
  turns: number;
  errors: number;
  errorRate: number;
  p50Ms: number | null;
  p95Ms: number | null;
  byProvider: CountBucket[];
  byModel: CountBucket[];
};

export function summarizeRioTurns(
  rows: {
    latency_ms: number | null;
    error: string | null;
    provider: string | null;
    model: string | null;
  }[],
): RioTurnSummary {
  const turns = rows.length;
  const errors = rows.filter((r) => Boolean(r.error?.trim())).length;
  const latencies = rows
    .map((r) => r.latency_ms)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return {
    turns,
    errors,
    errorRate: turns === 0 ? 0 : errors / turns,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    byProvider: countByKey(rows.map((r) => ({ key: r.provider }))),
    byModel: countByKey(rows.map((r) => ({ key: r.model }))),
  };
}

export type OrderPipelineSummary = {
  total: number;
  byStatus: OrderStatusCount[];
  live: number;
  placed: number;
  cancelled: number;
};

const LIVE_STATUSES = new Set(["placed", "preparing", "ready", "out_for_delivery"]);

export function summarizeOrderPipeline(rows: { status: string }[]): OrderPipelineSummary {
  const byStatus = countByStatus(rows);
  const counts = new Map(byStatus.map((b) => [b.status, b.count]));
  let live = 0;
  for (const status of LIVE_STATUSES) live += counts.get(status) ?? 0;
  return {
    total: rows.length,
    byStatus,
    live,
    placed: counts.get("placed") ?? 0,
    cancelled: counts.get("cancelled") ?? 0,
  };
}
