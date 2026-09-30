export const RIO_USER_ERROR = "Sorry, I couldn't connect right now. Please try again.";

export function userFacingRioError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  if (!raw.trim()) return RIO_USER_ERROR;
  if (/POST\s+\/|openai|chat\/completions|Unknown request URL|https?:\/\/|FunctionsHttpError|Edge Function/i.test(raw)) {
    return RIO_USER_ERROR;
  }
  if (raw.length > 160) return RIO_USER_ERROR;
  return raw;
}
