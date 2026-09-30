/** Client-side auth form checks before calling Supabase Auth. */

export function validateAuthForm(input: {
  email: string;
  password: string;
  fullName?: string;
  requireName?: boolean;
}): string | null {
  const email = input.email.trim();
  const password = input.password;
  if (!email || !email.includes('@')) return 'Enter a valid email.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (input.requireName && !input.fullName?.trim()) return 'Name is required.';
  return null;
}
