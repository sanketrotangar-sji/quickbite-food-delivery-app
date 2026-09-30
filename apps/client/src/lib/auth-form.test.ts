import { describe, expect, it } from 'vitest';

import { validateAuthForm } from './auth-form';

describe('validateAuthForm', () => {
  it('rejects invalid email and short passwords', () => {
    expect(validateAuthForm({ email: 'x', password: '123456' })).toMatch(/email/i);
    expect(validateAuthForm({ email: 'a@b.co', password: '12' })).toMatch(/password/i);
  });

  it('requires name when asked', () => {
    expect(validateAuthForm({ email: 'a@b.co', password: '123456', requireName: true })).toMatch(/name/i);
  });

  it('passes valid login fields', () => {
    expect(validateAuthForm({ email: 'a@b.co', password: '123456' })).toBeNull();
  });
});
