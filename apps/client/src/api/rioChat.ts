import type { RioCard, RioConflict } from '@/api/rio';
import { throwApiError } from '@/api/errors';
import { supabase } from '@/api/supabaseClient';

export type RioChatMessage = {
  id: string;
  from: 'rio' | 'you';
  text: string;
  at: number;
  cards?: RioCard[];
  conflict?: RioConflict | null;
  settled?: boolean;
};

const MAX_MESSAGES = 40;

export async function loadLatestRioThread(customerId: string): Promise<{
  threadId: string | null;
  messages: RioChatMessage[];
}> {
  const { data: thread, error } = await supabase
    .from('rio_threads')
    .select('id')
    .eq('customer_id', customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwApiError(error, 'Could not load RIO chat.');
  if (!thread) return { threadId: null, messages: [] };

  const { data: rows, error: msgError } = await supabase
    .from('rio_messages')
    .select('id, role, content, cards, conflict, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(MAX_MESSAGES);
  if (msgError) throwApiError(msgError, 'Could not load RIO messages.');

  const messages: RioChatMessage[] = (rows ?? []).map((row) => {
    const cards = (row.cards as RioCard[] | null) ?? undefined;
    const settled =
      Array.isArray(cards) && cards.some((card) => card.kind === 'cart' && card.settled === true);
    return {
      id: row.id,
      from: row.role as 'rio' | 'you',
      text: row.content,
      at: new Date(row.created_at).getTime(),
      cards,
      conflict: settled ? null : ((row.conflict as RioConflict | null) ?? null),
      settled: settled || undefined,
    };
  });

  return { threadId: thread.id, messages };
}

export async function createRioThread(customerId: string, title?: string): Promise<string> {
  const { data, error } = await supabase
    .from('rio_threads')
    .insert({ customer_id: customerId, title: title ?? 'Chat with RIO' })
    .select('id')
    .single();
  if (error || !data) throwApiError(error ?? {}, 'Could not start RIO chat.');
  return data.id;
}

export async function appendRioMessages(
  threadId: string,
  messages: Array<{
    from: 'rio' | 'you';
    text: string;
    cards?: RioCard[];
    conflict?: RioConflict | null;
  }>,
) {
  if (messages.length === 0) return;
  const rows = messages.map((message) => ({
    thread_id: threadId,
    role: message.from,
    content: message.text,
    cards: message.cards ?? null,
    conflict: message.conflict ?? null,
  }));
  const { error } = await supabase.from('rio_messages').insert(rows);
  if (error) throwApiError(error, 'Could not save RIO chat.');
  await supabase.from('rio_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
}

function withSettledCarts(cards: RioCard[]): RioCard[] {
  return cards.map((card) =>
    card.kind === 'cart' ? { ...card, confirm: false, settled: true } : card,
  );
}

/** Persist confirm/conflict settlement so reload cannot re-offer Confirm. */
export async function settleRioMessageCards(messageId: string, cards: RioCard[]) {
  const settledCards = withSettledCarts(cards);
  const { error } = await supabase
    .from('rio_messages')
    .update({ cards: settledCards, conflict: null })
    .eq('id', messageId);
  if (error) throwApiError(error, 'Could not update RIO chat.');
  return settledCards;
}

/** Best-effort: settle any cloud cart cards still showing Confirm in this thread. */
export async function settleOpenConfirmInThread(threadId: string | null) {
  if (!threadId) return;
  const { data: rows, error } = await supabase
    .from('rio_messages')
    .select('id, cards')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !rows) return;
  for (const row of rows) {
    const cards = (row.cards as RioCard[] | null) ?? [];
    if (!cards.some((card) => card.kind === 'cart' && card.confirm === true && !card.settled)) continue;
    await supabase
      .from('rio_messages')
      .update({ cards: withSettledCarts(cards), conflict: null })
      .eq('id', row.id);
  }
}

/** Trim oldest cloud messages beyond cap (best-effort). */
export async function trimRioThread(threadId: string) {
  const { data: rows } = await supabase
    .from('rio_messages')
    .select('id, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(MAX_MESSAGES + 10);
  const excess = (rows ?? []).slice(MAX_MESSAGES);
  if (excess.length === 0) return;
  await supabase.from('rio_messages').delete().in(
    'id',
    excess.map((row) => row.id),
  );
}
