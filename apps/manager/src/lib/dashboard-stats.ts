import type { Order } from "@/lib/quickbite-data";

type DatedOrder = {
  status: string;
  placedAt: string;
  total: number;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(value: string, day: Date) {
  const date = new Date(value);
  return (
    date >= startOfDay(day) && date < new Date(startOfDay(day).getTime() + 24 * 60 * 60 * 1000)
  );
}

export function ordersOnDay<T extends DatedOrder>(orders: T[], day: Date) {
  return orders.filter((order) => order.status !== "cancelled" && isSameDay(order.placedAt, day));
}

export function revenueOf(orders: { total: number }[]) {
  return orders.reduce((sum, order) => sum + order.total, 0);
}

export function aovOf(orders: { total: number }[]) {
  if (orders.length === 0) return 0;
  return revenueOf(orders) / orders.length;
}

export type PerformanceRange = "today" | "7d" | "30d";

export function rangeWindow(range: PerformanceRange, now = new Date()) {
  const end = new Date(now);
  const start = startOfDay(now);
  if (range === "today") {
    return { start, end, days: 1, priorStart: new Date(start.getTime() - 24 * 60 * 60 * 1000), priorEnd: start };
  }
  const days = range === "7d" ? 7 : 30;
  start.setDate(start.getDate() - (days - 1));
  const priorEnd = new Date(start);
  const priorStart = new Date(start);
  priorStart.setDate(priorStart.getDate() - days);
  return { start, end, days, priorStart, priorEnd };
}

export function ordersInRange<T extends DatedOrder>(orders: T[], start: Date, end: Date) {
  return orders.filter((order) => {
    if (order.status === "cancelled") return false;
    const at = new Date(order.placedAt).getTime();
    return at >= start.getTime() && at < end.getTime();
  });
}

export function percentChangeLabel(current: number, prior: number, label = "yesterday") {
  if (prior === 0) return current === 0 ? `Same as ${label}` : `New vs ${label}`;
  const delta = ((current - prior) / prior) * 100;
  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs ${label}`;
}

export function dailySeries<T extends DatedOrder>(orders: T[], start: Date, days: number) {
  const series: { day: string; label: string; orders: number; revenue: number }[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const onDay = ordersOnDay(orders, day);
    series.push({
      day: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      orders: onDay.length,
      revenue: revenueOf(onDay),
    });
  }
  return series;
}

export type PrepHistoryEntry = { status: string; changedAt: string };

export function prepMinutesFromHistory(
  placedAt: string,
  history: PrepHistoryEntry[],
): number | null {
  const readyAt = history.find((entry) => entry.status === "ready")?.changedAt;
  if (!readyAt) return null;
  const startAt =
    history.find((entry) => entry.status === "preparing")?.changedAt ??
    history.find((entry) => entry.status === "placed")?.changedAt ??
    placedAt;
  const minutes = (new Date(readyAt).getTime() - new Date(startAt).getTime()) / 60_000;
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return minutes;
}

export function prepSlaSummary(
  samples: number[],
  targetMinutes: number,
): { avgLabel: string; slaLabel: string; count: number } {
  if (samples.length === 0) {
    return { avgLabel: "—", slaLabel: "No prep samples yet", count: 0 };
  }
  const avg = Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
  const onTime = samples.filter((value) => value <= targetMinutes).length;
  const pct = Math.round((onTime / samples.length) * 100);
  return {
    avgLabel: `${avg} min`,
    slaLabel: `${pct}% within ${targetMinutes} min · ${samples.length} order${samples.length === 1 ? "" : "s"}`,
    count: samples.length,
  };
}

export function greetingFor(now: Date, fullName: string) {
  const hour = now.getHours();
  const first = fullName.trim().split(/\s+/).filter(Boolean)[0] || "there";
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export function compactRupee(amount: number) {
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${Math.round(amount)}`;
}

export function formatRupee(amount: number) {
  return `₹${Math.round(amount).toLocaleString()}`;
}

export function hourlyPace(orders: Order[], now: Date) {
  const hours = Array.from({ length: 16 }, (_, index) => 8 + index);
  const counts = hours.map(
    (hour) =>
      orders.filter((order) => {
        const date = new Date(order.placedAt);
        return isSameDay(order.placedAt, now) && date.getHours() === hour;
      }).length,
  );
  const max = Math.max(...counts, 1);
  return hours.map((hour, index) => {
    const count = counts[index] ?? 0;
    const suffix = hour < 12 ? "AM" : "PM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return {
      hour,
      label: `${hour12} ${suffix}`,
      count,
      height: Math.round((count / max) * 100),
    };
  });
}

/** Aligns with kitchen_open_order_threshold default in automation (preparing count). */
export const DEFAULT_KITCHEN_CAPACITY = 8;

export function kitchenLoad(preparing: number, threshold = DEFAULT_KITCHEN_CAPACITY) {
  const safeThreshold = Math.max(1, threshold);
  const ratio = Math.min(1, preparing / safeThreshold);
  const percent = Math.round(ratio * 100);
  if (preparing === 0) {
    return { label: "Quiet", bar: "w-1/6", percent: 0, preparing, threshold: safeThreshold };
  }
  if (preparing < safeThreshold) {
    return { label: "Normal", bar: "w-2/5", percent, preparing, threshold: safeThreshold };
  }
  return { label: "Busy", bar: "w-4/5", percent: Math.max(percent, 100), preparing, threshold: safeThreshold };
}

export function servicePeriodLabel(now: Date) {
  const hour = now.getHours();
  if (hour < 11) return "Breakfast service";
  if (hour < 16) return "Lunch service";
  return "Dinner service";
}

export function areaFromAddress(address: string, fallback: string) {
  const area = address.split(",")[0]?.trim();
  return area || fallback;
}

/** Live relative time from placedAt (recompute at render; pair with useMinuteTick). */
export function orderElapsed(placedAt: string, nowMs = Date.now()) {
  const minutes = Math.max(0, Math.round((nowMs - new Date(placedAt).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function statsOnDay(
  rows: { status: string; placed_at: string; total_amount: number }[],
  day: Date,
) {
  return rows.filter((row) => row.status !== "cancelled" && isSameDay(row.placed_at, day));
}

export function statsRevenue(rows: { total_amount: number }[]) {
  return rows.reduce((sum, row) => sum + Number(row.total_amount), 0);
}

export function hourlyPaceFromStats(
  rows: { placed_at: string; status: string }[],
  now: Date,
) {
  const hours = Array.from({ length: 16 }, (_, index) => 8 + index);
  const counts = hours.map(
    (hour) =>
      rows.filter((row) => {
        if (row.status === "cancelled") return false;
        const date = new Date(row.placed_at);
        return isSameDay(row.placed_at, now) && date.getHours() === hour;
      }).length,
  );
  const max = Math.max(...counts, 1);
  return hours.map((hour, index) => {
    const count = counts[index] ?? 0;
    const suffix = hour < 12 ? "AM" : "PM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return {
      hour,
      label: `${hour12} ${suffix}`,
      count,
      height: Math.round((count / max) * 100),
    };
  });
}

export function longestWaitLabel(placed: Order[], now: Date) {
  if (placed.length === 0) return "No waiting orders";
  const oldest = placed.reduce((min, order) => (order.placedAt < min.placedAt ? order : min));
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(oldest.placedAt).getTime()) / 60000),
  );
  return `Longest wait is ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Minutes from placed/preparing → ready using status history (not wall-clock on live rows). */
export function avgPrepLabel(orders: Order[], now: Date) {
  const samples: number[] = [];
  for (const order of orders) {
    if (!isSameDay(order.placedAt, now)) continue;
    const readyAt = order.history.find((entry) => entry.status === "ready")?.changedAt;
    if (!readyAt) continue;
    const startAt =
      order.history.find((entry) => entry.status === "preparing")?.changedAt ??
      order.history.find((entry) => entry.status === "placed")?.changedAt ??
      order.placedAt;
    const minutes = (new Date(readyAt).getTime() - new Date(startAt).getTime()) / 60_000;
    if (Number.isFinite(minutes) && minutes >= 0) samples.push(minutes);
  }
  if (samples.length === 0) return { value: "—", change: "No prep samples yet" };
  const avg = Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
  return {
    value: `${avg} min`,
    change: `Avg prep (to ready) · ${samples.length} order${samples.length === 1 ? "" : "s"}`,
  };
}
