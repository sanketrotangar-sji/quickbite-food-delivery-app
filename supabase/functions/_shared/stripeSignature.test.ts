import { assertEquals } from "jsr:@std/assert@1";
import { verifyStripeSignature } from "./stripeSignature.ts";

async function sign(secret: string, payload: string, timestamp: number) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  const hex = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

Deno.test("verifyStripeSignature accepts valid header", async () => {
  const secret = "whsec_test_secret";
  const body = '{"id":"evt_1"}';
  const ts = Math.floor(Date.now() / 1000);
  const header = await sign(secret, body, ts);
  assertEquals(await verifyStripeSignature(body, header, secret), true);
});

Deno.test("verifyStripeSignature rejects bad signature", async () => {
  const secret = "whsec_test_secret";
  const body = '{"id":"evt_1"}';
  const ts = Math.floor(Date.now() / 1000);
  assertEquals(
    await verifyStripeSignature(body, `t=${ts},v1=deadbeef`, secret),
    false,
  );
});

Deno.test("verifyStripeSignature rejects missing header", async () => {
  assertEquals(
    await verifyStripeSignature("{}", null, "whsec_test_secret"),
    false,
  );
});
