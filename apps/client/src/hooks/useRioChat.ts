import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';

import { askRio, askRioStream, type RioCard } from '@/api/rio';
import {
  settleOpenConfirmInThread,
  settleRioMessageCards,
  type RioChatMessage,
} from '@/api/rioChat';
import { formatDeliveryAddress, type SavedAddress } from '@/lib/addresses';
import { userFacingRioError } from '@/lib/rio-errors';
import { rioStatusHint } from '@/lib/rio-status-hint';
import { slimCards } from '@/lib/rio-thread';
import { cartQueryKey } from '@/hooks/useCart';
import { ordersQueryKey } from '@/hooks/useOrders';

type RioAction =
  | { type: 'confirm_order'; cartHash?: string }
  | { type: 'replace_cart'; menuItemId: string };

type UseRioChatArgs = {
  session: Session | null;
  selected: SavedAddress | null | undefined;
  hydrated: boolean;
  messages: RioChatMessage[];
  setMessages: Dispatch<SetStateAction<RioChatMessage[]>>;
  threadIdRef: MutableRefObject<string | null>;
  threadGen: MutableRefObject<number>;
};

export function useRioChat({
  session,
  selected,
  hydrated,
  messages,
  setMessages,
  threadIdRef,
  threadGen,
}: UseRioChatArgs) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [statusHint, setStatusHint] = useState('RIO is thinking…');

  async function settleMessage(messageId: string, cards: RioCard[] | undefined) {
    const nextCards = (cards ?? []).map((card) =>
      card.kind === 'cart' ? { ...card, confirm: false, settled: true } : card,
    );
    setMessages((current) =>
      current.map((row) =>
        row.id === messageId
          ? { ...row, settled: true, conflict: null, cards: nextCards.length ? nextCards : row.cards }
          : row,
      ),
    );
    try {
      if (/^[0-9a-f-]{36}$/i.test(messageId) && nextCards.length > 0) {
        await settleRioMessageCards(messageId, nextCards);
      } else {
        await settleOpenConfirmInThread(threadIdRef.current);
      }
    } catch {
      // Local + AsyncStorage still hide Confirm.
    }
  }

  async function send(prompt: string, action?: RioAction): Promise<boolean> {
    const text = prompt.trim();
    if (!hydrated) return false;
    if (busy.current) return false;
    if (!text && !action) return false;
    if (!session) return false;

    const gen = threadGen.current;
    const now = Date.now();
    const you: RioChatMessage | null = text
      ? { id: `you-${now}`, from: 'you', text, at: now }
      : action?.type === 'confirm_order'
        ? { id: `you-${now}`, from: 'you', text: 'Confirm order', at: now }
        : null;
    const history = [...messages, ...(you ? [you] : [])].filter((message) => message.id !== 'hello');
    if (you) setMessages((current) => [...current, you]);
    setDraft('');
    busy.current = true;
    setStatusHint(rioStatusHint(text || (action?.type === 'confirm_order' ? 'confirm order' : '')));
    setThinking(true);

    const lastCards = [...history].reverse().find((message) => message.cards && message.cards.length > 0)?.cards;
    const streamId = `rio-${now}`;
    let streamed = false;
    try {
      const request = {
        messages: [{ role: 'user' as const, content: you?.text ?? (text || 'Confirm order') }],
        threadId: threadIdRef.current,
        deliveryAddress: selected ? formatDeliveryAddress(selected) : null,
        deliveryAddressId: selected?.id ?? null,
        deliveryLat: selected?.lat ?? null,
        deliveryLng: selected?.lng ?? null,
        action: action?.type,
        menuItemId: action?.type === 'replace_cart' ? action.menuItemId : undefined,
        cartHash: action?.type === 'confirm_order' ? action.cartHash : undefined,
        context: lastCards ? JSON.stringify(slimCards(lastCards)) : undefined,
      };
      const reply = action
        ? await askRio(request)
        : await askRioStream(request, {
            onProgress: (hint) => {
              if (threadGen.current !== gen) return;
              setStatusHint(hint);
            },
            onToken: (token) => {
              if (threadGen.current !== gen) return;
              if (!streamed) {
                streamed = true;
                setThinking(false);
                setMessages((current) => [
                  ...current,
                  { id: streamId, from: 'rio', text: token, at: Date.now() },
                ]);
                return;
              }
              setMessages((current) =>
                current.map((message) =>
                  message.id === streamId ? { ...message, text: message.text + token } : message,
                ),
              );
            },
          });
      if (threadGen.current !== gen) return false;
      if (reply.threadId) threadIdRef.current = reply.threadId;
      const replyAt = Date.now();
      setMessages((current) => {
        const withoutStream = current.filter((message) => message.id !== streamId);
        return [
          ...withoutStream,
          {
            id: streamId,
            from: 'rio',
            text: reply.text,
            at: replyAt,
            cards: reply.cards,
            conflict: reply.conflict,
          },
        ];
      });
      if (reply.cards.some((card) => card.kind === 'cart' || card.kind === 'order') || action) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: cartQueryKey }),
          queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
        ]);
      }
      const placed = reply.cards.some((card) => card.kind === 'order');
      const cartUpdated = reply.cards.some((card) => card.kind === 'cart') && !reply.conflict;
      return action?.type === 'confirm_order' ? placed : action?.type === 'replace_cart' ? cartUpdated : true;
    } catch (error) {
      if (threadGen.current !== gen) return false;
      console.warn('[RIO] send failed', error);
      const recovery = userFacingRioError(error);
      const errAt = Date.now();
      setMessages((current) => {
        const existing = current.find((message) => message.id === streamId);
        // Keep any tokens already painted; append a short recovery line.
        if (existing && streamed && existing.text.trim()) {
          const suffix = existing.text.trim().endsWith(recovery) ? '' : `\n\n${recovery}`;
          return current.map((message) =>
            message.id === streamId
              ? { ...message, text: `${message.text.trim()}${suffix}`, at: errAt }
              : message,
          );
        }
        const withoutStream = current.filter((message) => message.id !== streamId);
        return [
          ...withoutStream,
          {
            id: `rio-${errAt}`,
            from: 'rio',
            text: recovery,
            at: errAt,
          },
        ];
      });
      return false;
    } finally {
      busy.current = false;
      if (threadGen.current === gen) {
        setThinking(false);
      }
    }
  }

  function resetBusy() {
    busy.current = false;
    setThinking(false);
    setDraft('');
  }

  return {
    draft,
    setDraft,
    thinking,
    statusHint,
    send,
    settleMessage,
    resetBusy,
  };
}
