export const RIO_USER_ERROR =
  "I hit a snag checking that. Want me to try again or pick another kitchen?";

export function userFacingRioError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  if (!raw.trim()) return RIO_USER_ERROR;
  if (/sign in to talk to rio/i.test(raw)) return 'Sign in to talk to RIO.';
  if (/POST\s+\/|openai|chat\/completions|Unknown request URL|https?:\/\/|FunctionsHttpError|Edge Function|stack|sql/i.test(raw)) {
    return RIO_USER_ERROR;
  }
  if (raw.length > 160) return RIO_USER_ERROR;
  return raw;
}
