import { describe, expect, it } from "vitest";

import {
  countByKey,
  countByStatus,
  percentile,
  summarizeOrderPipeline,
  summarizeRioTurns,
} from "./ops-metrics.ts";

describe("countByStatus", () => {
  it("histograms and sorts by count", () => {
    expect(
      countByStatus([
        { status: "placed" },
        { status: "delivered" },
        { status: "placed" },
        { status: "cancelled" },
      ]),
    ).toEqual([
      { status: "placed", count: 2 },
      { status: "cancelled", count: 1 },
      { status: "delivered", count: 1 },
    ]);
  });
});

describe("percentile", () => {
  it("returns null for empty", () => {
    expect(percentile([], 50)).toBeNull();
  });

  it("returns single value", () => {
    expect(percentile([10], 95)).toBe(10);
  });

  it("interpolates p50 on even set", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
  });

  it("returns max for p100", () => {
    expect(percentile([1, 2, 3], 100)).toBe(3);
  });
});

describe("summarizeRioTurns", () => {
  it("computes error rate and latency", () => {
    const summary = summarizeRioTurns([
      { latency_ms: 100, error: null, provider: "groq", model: "a" },
      { latency_ms: 200, error: "timeout", provider: "groq", model: "a" },
      { latency_ms: 300, error: null, provider: "ollama", model: "b" },
    ]);
    expect(summary.turns).toBe(3);
    expect(summary.errors).toBe(1);
    expect(summary.errorRate).toBeCloseTo(1 / 3);
    expect(summary.p50Ms).toBe(200);
    expect(summary.byProvider[0]).toEqual({ key: "groq", count: 2 });
  });

  it("handles empty", () => {
    const summary = summarizeRioTurns([]);
    expect(summary).toMatchObject({
      turns: 0,
      errors: 0,
      errorRate: 0,
      p50Ms: null,
      p95Ms: null,
    });
  });
});

describe("summarizeOrderPipeline", () => {
  it("flags live placed and cancelled", () => {
    const summary = summarizeOrderPipeline([
      { status: "placed" },
      { status: "preparing" },
      { status: "delivered" },
      { status: "cancelled" },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.live).toBe(2);
    expect(summary.placed).toBe(1);
    expect(summary.cancelled).toBe(1);
  });
});

describe("countByKey", () => {
  it("buckets null as unknown", () => {
    expect(countByKey([{ key: null }, { key: "x" }, { key: "x" }])).toEqual([
      { key: "x", count: 2 },
      { key: "(unknown)", count: 1 },
    ]);
  });
});
