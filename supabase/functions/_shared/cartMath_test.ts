import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cartFingerprint, cartHash, cartTotals, inDeliveryRange, money } from "./cartMath.ts";

Deno.test("cartTotals matches useCart / place_order offer math", () => {
  const empty = cartTotals(0, 10, false);
  assertEquals(empty.total, 0);
  assertEquals(empty.deliveryFee, 0);

  const withOffer = cartTotals(200, 10, true);
  assertEquals(withOffer.discountAmount, 20);
  assertEquals(withOffer.discountedSubtotal, 180);
  assertEquals(withOffer.deliveryFee, 40);
  assertEquals(withOffer.total, 220);

  const noOffer = cartTotals(150, 0, true);
  assertEquals(noOffer.discountAmount, 0);
  assertEquals(noOffer.total, 190);
});

Deno.test("money rounds to paise", () => {
  assertEquals(money(10.006), 10.01);
  assertEquals(money(10.004), 10);
});

Deno.test("inDeliveryRange uses 8 km default", () => {
  assertEquals(inDeliveryRange(7.9), true);
  assertEquals(inDeliveryRange(8), true);
  assertEquals(inDeliveryRange(8.1), false);
  assertEquals(inDeliveryRange(null), null);
});

Deno.test("cartFingerprint is order-independent for lines", () => {
  const a = cartFingerprint({
    restaurantId: "r1",
    lines: [
      { menuItemId: "m2", quantity: 1 },
      { menuItemId: "m1", quantity: 2 },
    ],
    total: 100,
  });
  const b = cartFingerprint({
    restaurantId: "r1",
    lines: [
      { menuItemId: "m1", quantity: 2 },
      { menuItemId: "m2", quantity: 1 },
    ],
    total: 100,
  });
  assertEquals(a, b);
});

Deno.test("cartHash changes when qty changes", async () => {
  const base = {
    restaurantId: "r1",
    lines: [{ menuItemId: "m1", quantity: 1 }],
    total: 100,
  };
  const h1 = await cartHash(base);
  const h2 = await cartHash({ ...base, lines: [{ menuItemId: "m1", quantity: 2 }], total: 140 });
  assertNotEquals(h1, h2);
  assertEquals(h1.length, 64);
});
