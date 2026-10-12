import type { RioCard, RioConflict } from "./tools.ts";

type Db = any;

export type ThreadMessage = { role: "user" | "assistant"; content: string };

const HISTORY_LIMIT = 10;

function cardDigest(cards: unknown): string {
  if (!Array.isArray(cards) || cards.length === 0) return "";
  const bits: string[] = [];
  for (const card of cards) {
    if (!card || typeof card !== "object") continue;
    const kind = (card as { kind?: string }).kind;
    if (kind === "restaurants") {
      const places = (card as { places?: { name?: string; dishName?: string; featuredDishId?: string }[] }).places ?? [];
      places.slice(0, 5).forEach((p, i) => {
        bits.push(
          `#${i + 1} ${p.name ?? "Kitchen"}` +
            (p.dishName ? ` · ${p.dishName}` : "") +
            (p.featuredDishId ? ` [${p.featuredDishId}]` : ""),
        );
      });
    }
    if (kind === "menu") {
      const items = (card as { items?: { name?: string; id?: string }[]; restaurantName?: string }).items ?? [];
      const kitchen = (card as { restaurantName?: string }).restaurantName ?? "Kitchen";
      bits.push(`${kitchen} menu:`);
      items.slice(0, 5).forEach((item, i) => {
        bits.push(`#${i + 1} ${item.name ?? "Dish"}${item.id ? ` [${item.id}]` : ""}`);
      });
    }
    if (kind === "cart") {
      const total = (card as { total?: number }).total;
      const name = (card as { restaurantName?: string }).restaurantName ?? "cart";
      bits.push(`cart @ ${name}${total != null ? ` · ₹${total}` : ""}`);
    }
  }
  if (!bits.length) return "";
  return `\n[Cards shown: ${bits.join("; ")}]`;
}

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
    .select("role, content, cards")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) return [];

  return ((rows ?? []) as { role: string; content: string; cards?: unknown }[])
    .reverse()
    .map((row) => {
      const base = String(row.content ?? "").trim();
      const digest = row.role === "rio" || row.role === "assistant" ? cardDigest(row.cards) : "";
      return {
        role: (row.role === "you" ? "user" : "assistant") as "user" | "assistant",
        content: (base + digest).slice(0, 1200),
      };
    })
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
