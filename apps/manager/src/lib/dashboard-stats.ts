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

export function percentChangeLabel(today: number, yesterday: number) {
  if (yesterday === 0) return today === 0 ? "Same as yesterday" : "New vs yesterday";
  const delta = ((today - yesterday) / yesterday) * 100;
  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs yesterday`;
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

export function kitchenLoad(preparing: number) {
  if (preparing === 0) return { label: "Quiet", bar: "w-1/6", percent: 16 };
  if (preparing <= 3) return { label: "Normal", bar: "w-2/5", percent: 40 };
  return { label: "Busy", bar: "w-4/5", percent: 80 };
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

export function avgPrepLabel(orders: Order[], now: Date) {
  const samples = orders.filter(
    (order) =>
      (order.status === "preparing" || order.status === "ready") && isSameDay(order.placedAt, now),
  );
  if (samples.length === 0) return { value: "—", change: "No prep samples yet" };
  const minutes = samples.map(
    (order) => (now.getTime() - new Date(order.placedAt).getTime()) / 60000,
  );
  const avg = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
  return { value: `${avg} min`, change: "From today's kitchen times" };
}
