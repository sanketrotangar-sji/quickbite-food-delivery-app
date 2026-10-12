import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  clarifyReply,
  redactPii,
  shouldClarify,
  validateToolArgs,
} from "./guardrails.ts";

Deno.test("redactPii masks email and phone", () => {
  const raw = "Call me at +91 98765 43210 or mail a@b.co please";
  const out = redactPii(raw);
  assertEquals(out.includes("a@b.co"), false);
  assertEquals(out.includes("98765"), false);
  assertEquals(out.includes("[email]"), true);
  assertEquals(out.includes("[phone]") || out.includes("[number]"), true);
});

Deno.test("validateToolArgs rejects cart add without menu id", () => {
  const v = validateToolArgs("cart", { op: "add" });
  assertEquals(v.ok, false);
});

Deno.test("validateToolArgs accepts find_offers with query", () => {
  const v = validateToolArgs("find_offers", { query: "dosa" });
  assertEquals(v.ok, true);
  if (v.ok) assertEquals(v.args.query, "dosa");
});

Deno.test("shouldClarify below threshold", () => {
  assertEquals(shouldClarify(0.4), true);
  assertEquals(shouldClarify(0.8), false);
});

Deno.test("clarifyReply is customer-facing", () => {
  const text = clarifyReply("low confidence (0.40): weak");
  assertEquals(text.toLowerCase().includes("craving"), true);
  assertEquals(text.includes("low confidence"), false);
});
