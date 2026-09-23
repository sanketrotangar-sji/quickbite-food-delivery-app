import { describe, expect, it } from 'vitest';

import { formatDeliveryAddress, parseAddressList, type SavedAddress } from './addresses';

const home: SavedAddress = {
  id: '5e383462-303b-4455-9408-55ffb68be356',
  label: 'home',
  nickname: 'Home',
  line: '204 Palm Residency',
  area: 'Margao',
  landmark: 'Opposite the chapel',
  lat: 15.2832,
  lng: 73.9865,
};

describe('saved addresses', () => {
  it('keeps valid legacy and coordinate-backed rows during migration', () => {
    const legacy = { ...home, id: 'legacy', lat: undefined, lng: undefined };
    expect(parseAddressList(JSON.stringify([home, legacy]))).toEqual([home, legacy]);
  });

  it('drops malformed coordinate pairs before Supabase import', () => {
    expect(parseAddressList(JSON.stringify([{ ...home, lng: undefined }]))).toEqual([]);
    expect(parseAddressList(JSON.stringify([{ ...home, lat: 120 }]))).toEqual([]);
  });

  it('formats the immutable order snapshot', () => {
    expect(formatDeliveryAddress(home)).toBe(
      'Home — 204 Palm Residency, Margao, Opposite the chapel',
    );
  });
});
