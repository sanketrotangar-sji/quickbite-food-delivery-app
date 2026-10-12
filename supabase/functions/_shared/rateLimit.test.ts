import { assertEquals } from "jsr:@std/assert@1";
import { checkRateLimit, resetRateLimits } from "./rateLimit.ts";

Deno.test("checkRateLimit allows up to limit then blocks", () => {
  resetRateLimits();
  const opts = { limit: 3, windowMs: 60_000 };
  assertEquals(checkRateLimit("u1", opts).ok, true);
  assertEquals(checkRateLimit("u1", opts).ok, true);
  assertEquals(checkRateLimit("u1", opts).ok, true);
  const blocked = checkRateLimit("u1", opts);
  assertEquals(blocked.ok, false);
  if (!blocked.ok) assertEquals(blocked.retryAfterSec >= 1, true);
});

Deno.test("checkRateLimit isolates keys", () => {
  resetRateLimits();
  const opts = { limit: 1, windowMs: 60_000 };
  assertEquals(checkRateLimit("a", opts).ok, true);
  assertEquals(checkRateLimit("b", opts).ok, true);
  assertEquals(checkRateLimit("a", opts).ok, false);
});
