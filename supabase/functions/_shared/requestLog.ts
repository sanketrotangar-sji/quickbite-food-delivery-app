/** One JSON line per Edge request for greppable Supabase function logs. */

export type RequestLogInput = {
  fn: string;
  requestId: string;
  ms: number;
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

export function requestLog(entry: RequestLogInput): void {
  const level = entry.ok ? "info" : "error";
  console.log(JSON.stringify({ level, ...entry }));
}
