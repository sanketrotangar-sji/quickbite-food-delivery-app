/** Client-side status line while RIO runs — plain language for the user. */
export function rioStatusHint(prompt: string): string {
  const q = prompt.toLowerCase();
  if (/\b(complaint|refund|missing|never arrived|not arrived|support|ticket|issue)\b/.test(q)) {
    return 'Opening a support ticket…';
  }
  if (/\b(order|track|delivery|where|status|late|arrived)\b/.test(q)) {
    return 'Checking your order…';
  }
  if (/\b(recommend|craving|spicy|veg|under|budget|what should|suggest|eat)\b/.test(q)) {
    return 'Searching the menu…';
  }
  return 'RIO is thinking…';
}
