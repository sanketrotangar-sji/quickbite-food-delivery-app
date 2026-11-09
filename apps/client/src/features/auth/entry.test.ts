import { describe, expect, it } from 'vitest';

import { resolveEntryRoute, type EntryInput } from './entry';

const base: EntryInput = {
  hasSession: false,
  canRide: false,
  lastRole: null,
  hasLocation: false,
  loginSkipped: false,
};

describe('resolveEntryRoute', () => {
  it('shows login first for a fresh guest', () => {
    expect(resolveEntryRoute(base)).toBe('login');
  });

  it('asks for location after the guest skips login', () => {
    expect(resolveEntryRoute({ ...base, loginSkipped: true })).toBe('location');
  });

  it('goes home once a guest has a location', () => {
    expect(resolveEntryRoute({ ...base, loginSkipped: true, hasLocation: true })).toBe('home');
  });

  it('sends riders who last used the rider side to rider tabs without a location', () => {
    expect(resolveEntryRoute({ ...base, hasSession: true, canRide: true, lastRole: 'rider' })).toBe('rider');
  });

  it('ignores a stale rider preference when the account cannot ride', () => {
    expect(
      resolveEntryRoute({ ...base, hasSession: true, lastRole: 'rider', hasLocation: true }),
    ).toBe('home');
  });

  it('asks a signed-in customer for location when none is set', () => {
    expect(resolveEntryRoute({ ...base, hasSession: true })).toBe('location');
  });
});
