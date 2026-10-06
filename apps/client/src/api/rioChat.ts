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

  const messages: RioChatMessage[] = (rows ?? []).map((row) => ({
    id: row.id,
    from: row.role as 'rio' | 'you',
    text: row.content,
    at: new Date(row.created_at).getTime(),
    cards: (row.cards as RioCard[] | null) ?? undefined,
    conflict: (row.conflict as RioConflict | null) ?? null,
  }));

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
