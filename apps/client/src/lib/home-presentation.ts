export type PresentationSource = {
  offerPercent?: number | null;
  prepMinutes?: number | null;
};

export function presentationFor(id: string, source?: PresentationSource) {
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) % 100000;
  const hashedLow = 15 + (hash % 16);
  const hashedHigh = hashedLow + 8 + (hash % 8);
  const reviews = 120 + (hash % 2200);
  const hashedDiscount = [15, 20, 25, 30, 40][hash % 5] ?? 20;
  const minutesLow = source?.prepMinutes != null ? source.prepMinutes : hashedLow;
  const minutesHigh = source?.prepMinutes != null ? source.prepMinutes + 10 : hashedHigh;
  return {
    eta: `${minutesLow}-${minutesHigh} mins`,
    minutesLow,
    reviewsLabel: reviews >= 1000 ? `${(reviews / 1000).toFixed(1)}K` : String(reviews),
    discount: source?.offerPercent != null ? source.offerPercent : hashedDiscount,
    freeAbove: 249,
  };
}

export function placePresentation(place: {
  id: string;
  offerPercent?: number | null;
  prepMinutes?: number | null;
}) {
  return presentationFor(place.id, {
    offerPercent: place.offerPercent,
    prepMinutes: place.prepMinutes,
  });
}
