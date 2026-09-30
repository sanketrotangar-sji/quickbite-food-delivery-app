import { describe, expect, it } from "vitest";

import {
  computeBumpedEta,
  hasRole,
  isAdmin,
  isPartner,
  nextKitchenStatus,
  nextRiderStatus,
  pickNearestRider,
  shouldRunKitchenLoadBump,
  ticketUrgency,
  validateAuthForm,
} from "./index.ts";

describe("auth roles", () => {
  it("hasRole matches single profile role", () => {
    expect(hasRole({ role: "rider" }, "rider")).toBe(true);
    expect(hasRole({ role: "customer" }, "admin")).toBe(false);
  });

  it("isPartner and isAdmin", () => {
    expect(isPartner({ role: "restaurant_manager" })).toBe(true);
    expect(isPartner({ role: "customer" })).toBe(false);
    expect(isAdmin({ role: "admin" })).toBe(true);
  });
});

describe("ticketUrgency", () => {
  it("flags safety issues high", () => {
    expect(ticketUrgency("delivery", "Order never arrived")).toBe("high");
  });
  it("flags delay medium", () => {
    expect(ticketUrgency("late", "Food was cold")).toBe("medium");
  });
  it("defaults low", () => {
    expect(ticketUrgency("question", "Where is my receipt?")).toBe("low");
  });
});

describe("kitchen load", () => {
  it("bumps when over threshold and not in cooldown", () => {
    expect(shouldRunKitchenLoadBump(9, 8, false)).toBe(true);
    expect(shouldRunKitchenLoadBump(8, 8, false)).toBe(false);
    expect(shouldRunKitchenLoadBump(20, 8, true)).toBe(false);
  });

  it("adds bump to coalesced eta", () => {
    expect(computeBumpedEta(40, 30, 15)).toBe(55);
    expect(computeBumpedEta(null, 25, 15)).toBe(40);
  });
});

describe("nextKitchenStatus", () => {
  it("advances placed → preparing → ready", () => {
    expect(nextKitchenStatus("placed")).toBe("preparing");
    expect(nextKitchenStatus("preparing")).toBe("ready");
    expect(nextKitchenStatus("ready")).toBeNull();
  });
});

describe("nextRiderStatus", () => {
  it("advances ready → out_for_delivery → delivered", () => {
    expect(nextRiderStatus("ready")).toBe("out_for_delivery");
    expect(nextRiderStatus("out_for_delivery")).toBe("delivered");
    expect(nextRiderStatus("preparing")).toBeNull();
  });
});

describe("validateAuthForm", () => {
  it("rejects bad email and short password", () => {
    expect(validateAuthForm({ email: "x", password: "123456" })).toMatch(/email/i);
    expect(validateAuthForm({ email: "a@b.co", password: "123" })).toMatch(/password/i);
  });
  it("requires name on signup", () => {
    expect(validateAuthForm({ email: "a@b.co", password: "123456", requireName: true, fullName: "  " })).toMatch(
      /name/i,
    );
  });
  it("accepts valid login fields", () => {
    expect(validateAuthForm({ email: "a@b.co", password: "123456" })).toBeNull();
  });
});

describe("pickNearestRider", () => {
  it("prefers closer rider then lower load", () => {
    const picked = pickNearestRider([
      { riderId: "a", distanceKm: 2, openLoad: 0 },
      { riderId: "b", distanceKm: 0.4, openLoad: 1 },
      { riderId: "c", distanceKm: 0.4, openLoad: 0 },
    ]);
    expect(picked?.riderId).toBe("c");
  });
});
