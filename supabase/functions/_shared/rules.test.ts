import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { ticketUrgency } from "./rules.ts";

Deno.test("ticketUrgency high for missing order", () => {
  assertEquals(ticketUrgency("never_arrived", "missing items"), "high");
});
