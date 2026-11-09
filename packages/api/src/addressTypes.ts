export type AddressLabel = 'home' | 'work' | 'other';

export type SavedAddress = {
  id: string;
  label: AddressLabel;
  nickname: string;
  line: string;
  area: string;
  landmark: string;
  lat?: number;
  lng?: number;
};

export type AddressDraft = Omit<SavedAddress, 'id'>;

export function defaultNickname(label: AddressLabel) {
  if (label === 'home') return 'Home';
  if (label === 'work') return 'Work';
  return 'Other';
}

export function displayNickname(address: Pick<SavedAddress, 'label' | 'nickname'>) {
  const nickname = address.nickname.trim();
  return nickname || defaultNickname(address.label);
}

export function addressIcon(label: AddressLabel) {
  if (label === 'home') return 'home-outline' as const;
  if (label === 'work') return 'briefcase-outline' as const;
  return 'location-outline' as const;
}

export function formatDeliveryAddress(address: SavedAddress) {
  const place = [address.line, address.area, address.landmark].map((part) => part.trim()).filter(Boolean);
  return `${displayNickname(address)} — ${place.join(', ')}`;
}

export function parseAddressList(raw: string | null): SavedAddress[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isAddress);
  } catch {
    return [];
  }
}

function isAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<SavedAddress>;
  const hasNoCoordinates = row.lat === undefined && row.lng === undefined;
  const hasValidCoordinates =
    typeof row.lat === 'number' &&
    Number.isFinite(row.lat) &&
    row.lat >= -90 &&
    row.lat <= 90 &&
    typeof row.lng === 'number' &&
    Number.isFinite(row.lng) &&
    row.lng >= -180 &&
    row.lng <= 180;
  return (
    typeof row.id === 'string' &&
    (row.label === 'home' || row.label === 'work' || row.label === 'other') &&
    typeof row.nickname === 'string' &&
    typeof row.line === 'string' &&
    typeof row.area === 'string' &&
    typeof row.landmark === 'string' &&
    (hasNoCoordinates || hasValidCoordinates)
  );
}
