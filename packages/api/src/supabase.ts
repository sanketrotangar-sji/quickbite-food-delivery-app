import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@quickbite/db";

/** Apps may pin different @supabase/supabase-js minors; Database schema is what matters. */
export type QuickBiteClient = SupabaseClient<Database, "public", any>;

let bound: QuickBiteClient | null = null;

/** Call once from each app after createClient. */
export function bindSupabase(client: unknown) {
  bound = client as QuickBiteClient;
}

export function db(): QuickBiteClient {
  if (!bound) {
    throw new Error("@quickbite/api: call bindSupabase(client) before using the API.");
  }
  return bound;
}
