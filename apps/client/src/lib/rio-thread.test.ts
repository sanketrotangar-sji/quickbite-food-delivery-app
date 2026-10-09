import { describe, expect, it } from 'vitest';

import { greetingMessage, parseCachedThread, withDerivedGreeting } from './rio-thread';

describe('rio-thread', () => {
  it('derives greeting and strips stored hello', () => {
    const turns = withDerivedGreeting(
      [
        { id: 'hello', from: 'rio', text: 'stale', at: 1 },
        { id: 'you-1', from: 'you', text: 'hi', at: 2 },
      ],
      'Sam',
    );
    expect(turns[0]?.id).toBe('hello');
    expect(turns[0]?.text).toContain('Sam');
    expect(turns).toHaveLength(2);
    expect(turns[1]?.text).toBe('hi');
  });

  it('parseCachedThread ignores greeting and bad rows', () => {
    const raw = JSON.stringify([
      greetingMessage('X'),
      { id: 'you-1', from: 'you', text: 'order biryani', at: 9 },
      { junk: true },
    ]);
    const parsed = parseCachedThread(raw);
    expect(parsed).toEqual([{ id: 'you-1', from: 'you', text: 'order biryani', at: 9 }]);
  });
});
