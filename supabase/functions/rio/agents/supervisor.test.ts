import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { finalizeRoute, routeIntent, routeTag } from "./supervisor.ts";

Deno.test("routeIntent support for refund", () => {
  const r = routeIntent("I want a refund, food was cold");
  assertEquals(r.agent, "support");
});

Deno.test("routeIntent dispatch for ETA", () => {
  const r = routeIntent("where's my order ETA?", { hasActiveOrder: true });
  assertEquals(r.agent, "dispatch");
  assertEquals(r.confidence >= 0.8, true);
});

Deno.test("routeIntent order for dosa", () => {
  const r = routeIntent("I want a masala dosa");
  assertEquals(r.agent, "order");
  assertEquals(r.confidence >= 0.85, true);
});

Deno.test("routeIntent order for want-food without known dish keyword", () => {
  const r = routeIntent("get me something spicy from nearby");
  assertEquals(r.agent, "order");
});

Deno.test("finalizeRoute clarifies low confidence", () => {
  const r = finalizeRoute({ agent: "order", confidence: 0.4, reason: "weak" });
  assertEquals(r.agent, "clarify");
});

Deno.test("routeTag format", () => {
  assertEquals(routeTag({ agent: "order", confidence: 0.85, reason: "x" }), "route:order:0.85");
});
