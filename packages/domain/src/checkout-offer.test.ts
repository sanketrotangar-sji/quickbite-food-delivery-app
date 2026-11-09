import { describe, expect, it } from "vitest";

import { resolveCheckoutOffer } from "./checkout-offer.ts";

describe("resolveCheckoutOffer", () => {
  it("uses kitchen only when no campaign", () => {
    expect(
      resolveCheckoutOffer({
        kitchenOfferPercent: 10,
        campaignOfferPercent: null,
        campaignId: null,
        enrollmentId: null,
      }),
    ).toEqual({ offerPercent: 10, campaignId: null, enrollmentId: null });
  });

  it("uses campaign when higher than kitchen", () => {
    expect(
      resolveCheckoutOffer({
        kitchenOfferPercent: 5,
        campaignOfferPercent: 20,
        campaignId: "camp-1",
        enrollmentId: "enr-1",
      }),
    ).toEqual({ offerPercent: 20, campaignId: "camp-1", enrollmentId: "enr-1" });
  });

  it("keeps kitchen and clears campaign when campaign is lower", () => {
    expect(
      resolveCheckoutOffer({
        kitchenOfferPercent: 15,
        campaignOfferPercent: 10,
        campaignId: "camp-1",
        enrollmentId: "enr-1",
      }),
    ).toEqual({ offerPercent: 15, campaignId: null, enrollmentId: null });
  });

  it("applies campaign when equal to kitchen", () => {
    expect(
      resolveCheckoutOffer({
        kitchenOfferPercent: 10,
        campaignOfferPercent: 10,
        campaignId: "camp-1",
        enrollmentId: "enr-1",
      }),
    ).toEqual({ offerPercent: 10, campaignId: "camp-1", enrollmentId: "enr-1" });
  });

  it("clamps kitchen percent into 0..100", () => {
    expect(
      resolveCheckoutOffer({
        kitchenOfferPercent: 150,
        campaignOfferPercent: null,
        campaignId: null,
        enrollmentId: null,
      }),
    ).toEqual({ offerPercent: 100, campaignId: null, enrollmentId: null });
  });
});
