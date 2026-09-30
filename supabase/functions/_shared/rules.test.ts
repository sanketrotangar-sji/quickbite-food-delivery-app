import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { nextRiderStatus, ticketUrgency, validateAuthForm } from "./rules.ts";

Deno.test("ticketUrgency high for missing order", () => {
  assertEquals(ticketUrgency("never_arrived", "missing items"), "high");
});

Deno.test("nextRiderStatus advances delivery steps", () => {
  assertEquals(nextRiderStatus("ready"), "out_for_delivery");
  assertEquals(nextRiderStatus("out_for_delivery"), "delivered");
  assertEquals(nextRiderStatus("placed"), null);
});

Deno.test("validateAuthForm checks email and password", () => {
  assertEquals(validateAuthForm({ email: "bad", password: "123456" }) !== null, true);
  assertEquals(validateAuthForm({ email: "a@b.co", password: "123456" }), null);
});
