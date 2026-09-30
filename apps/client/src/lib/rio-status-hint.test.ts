import { describe, expect, it } from 'vitest';

import { rioStatusHint } from './rio-status-hint';

describe('rioStatusHint', () => {
  it('detects order tracking prompts', () => {
    expect(rioStatusHint('Where is my delivery?')).toContain('order');
  });
  it('detects support prompts', () => {
    expect(rioStatusHint('My order never arrived')).toContain('support');
  });
  it('detects menu search prompts', () => {
    expect(rioStatusHint('Something spicy under 200')).toContain('menu');
  });
});
