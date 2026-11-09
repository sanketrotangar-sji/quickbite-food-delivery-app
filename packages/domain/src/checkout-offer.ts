/**
 * Mirrors private.resolve_checkout_offer in SQL.
 * Kitchen % vs best unused CRM campaign — campaign applies only when >= kitchen.
 */

export type CheckoutOfferInput = {
  kitchenOfferPercent: number | null | undefined;
  campaignOfferPercent: number | null | undefined;
  campaignId: string | null | undefined;
  enrollmentId: string | null | undefined;
};

export type CheckoutOfferResult = {
  offerPercent: number;
  campaignId: string | null;
  enrollmentId: string | null;
};

export function resolveCheckoutOffer(input: CheckoutOfferInput): CheckoutOfferResult {
  const kitchen = Math.max(0, Math.min(100, Math.trunc(Number(input.kitchenOfferPercent ?? 0) || 0)));
  const campaignRaw = input.campaignOfferPercent;
  const campaign =
    campaignRaw == null || campaignRaw === undefined
      ? null
      : Math.max(0, Math.min(100, Math.trunc(Number(campaignRaw) || 0)));

  const offer = Math.max(kitchen, campaign ?? 0);
  if (campaign == null || campaign < kitchen) {
    return { offerPercent: offer, campaignId: null, enrollmentId: null };
  }
  return {
    offerPercent: offer,
    campaignId: input.campaignId ?? null,
    enrollmentId: input.enrollmentId ?? null,
  };
}
