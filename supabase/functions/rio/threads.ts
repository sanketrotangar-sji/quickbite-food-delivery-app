import type { RioCard, RioConflict } from "./tools.ts";

type Db = any;

export type ThreadMessage = { role: "user" | "assistant"; content: string };

const HISTORY_LIMIT = 8;

export async function loadThreadHistory(
  db: Db,
  userId: string,
  threadId: string | null,
): Promise<ThreadMessage[]> {
  if (!threadId) return [];
  const { data: thread, error: threadError } = await db
    .from("rio_threads")
    .select("id")
    .eq("id", threadId)
    .eq("customer_id", userId)
    .maybeSingle();
  if (threadError || !thread) return [];

  const { data: rows, error } = await db
    .from("rio_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) return [];

  return ((rows ?? []) as { role: string; content: string }[])
    .reverse()
    .map((row) => ({
      role: (row.role === "you" ? "user" : "assistant") as "user" | "assistant",
      content: String(row.content ?? "").trim().slice(0, 800),
    }))
    .filter((row) => row.content.length > 0);
}

export async function ensureThread(db: Db, userId: string, threadId: string | null): Promise<string | null> {
  if (threadId) {
    const { data } = await db
      .from("rio_threads")
      .select("id")
      .eq("id", threadId)
      .eq("customer_id", userId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  const { data, error } = await db
    .from("rio_threads")
    .insert({ customer_id: userId, title: "Chat with RIO" })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

export async function appendThreadTurn(
  db: Db,
  threadId: string,
  userText: string,
  assistant: { text: string; cards?: RioCard[]; conflict?: RioConflict | null },
) {
  const rows = [
    { thread_id: threadId, role: "you", content: userText, cards: null, conflict: null },
    {
      thread_id: threadId,
      role: "rio",
      content: assistant.text,
      cards: assistant.cards ?? null,
      conflict: assistant.conflict ?? null,
    },
  ];
  await db.from("rio_messages").insert(rows);
  await db.from("rio_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
}
