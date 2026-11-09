export type PresentationSource = {
  offerPercent?: number | null;
  prepMinutes?: number | null;
  etaMin?: number;
  etaMax?: number;
};

export function presentationFor(_id: string, source?: PresentationSource) {
  const minutesLow =
    source?.etaMin ?? (source?.prepMinutes != null && source.prepMinutes > 0 ? source.prepMinutes : 20);
  const minutesHigh = source?.etaMax ?? minutesLow + 10;
  const discount =
    source?.offerPercent != null && source.offerPercent > 0 ? Math.round(source.offerPercent) : 0;
  return {
    eta: `${minutesLow}-${minutesHigh} mins`,
    minutesLow,
    reviewsLabel: '',
    discount,
    freeAbove: 249,
  };
}

export function placePresentation(place: {
  id: string;
  offerPercent?: number | null;
  prepMinutes?: number | null;
  etaMin?: number;
  etaMax?: number;
}) {
  return presentationFor(place.id, {
    offerPercent: place.offerPercent,
    prepMinutes: place.prepMinutes,
    etaMin: place.etaMin,
    etaMax: place.etaMax,
  });
}

/** "Open", or "Opens 11:00" / "Closed" for kitchens that are shut right now. */
export function openStatusLabel(place: { isOpen: boolean; opensAt?: string | null }) {
  if (place.isOpen) return 'Open';
  return place.opensAt ? `Opens ${place.opensAt.slice(0, 5)}` : 'Closed';
}
