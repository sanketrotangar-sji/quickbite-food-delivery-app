import { useEffect, useRef, useState } from 'react';

import { createRioThread, loadLatestRioThread, type RioChatMessage } from '@quickbite/api/mobile/rioChat';
import {
  greetingMessage,
  parseCachedThread,
  threadCacheKey,
  withDerivedGreeting,
} from '@/lib/rio-thread';
import { storage } from '@/lib/storage';

/**
 * Cloud is source of truth for RIO turns. MMKV is synchronous paint-fast cache only.
 * Greeting is always derived from the display name — never trusted from storage.
 */
export function useRioThread(userId: string | null, firstName: string) {
  const threadIdRef = useRef<string | null>(null);
  const threadGen = useRef(0);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<RioChatMessage[]>(() => {
    if (!userId) return [greetingMessage(firstName)];
    const cached = parseCachedThread(storage.getString(threadCacheKey(userId)) ?? null);
    return withDerivedGreeting(cached ?? [], firstName);
  });

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      threadIdRef.current = null;
      setMessages([greetingMessage(firstName)]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    void (async () => {
      try {
        const cloud = await loadLatestRioThread(userId);
        if (cancelled) return;
        threadIdRef.current = cloud.threadId;
        if (cloud.messages.length > 0) {
          const next = withDerivedGreeting(cloud.messages, firstName);
          setMessages(next);
          storage.set(threadCacheKey(userId), JSON.stringify(cloud.messages));
        } else {
          const raw = storage.getString(threadCacheKey(userId)) ?? null;
          if (cancelled) return;
          const local = parseCachedThread(raw);
          setMessages(withDerivedGreeting(local ?? [], firstName));
        }
      } catch {
        if (cancelled) return;
        const raw = storage.getString(threadCacheKey(userId)) ?? null;
        if (cancelled) return;
        const local = parseCachedThread(raw);
        setMessages(withDerivedGreeting(local ?? [], firstName));
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // firstName only refreshes greeting text below — avoid re-fetch on rename
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    setMessages((current) => withDerivedGreeting(current, firstName));
  }, [firstName]);

  useEffect(() => {
    if (!userId || !hydrated) return;
    const turns = messages.filter((row) => row.id !== 'hello');
    storage.set(threadCacheKey(userId), JSON.stringify(turns));
  }, [hydrated, messages, userId]);

  function startNewChat() {
    threadGen.current += 1;
    setMessages([greetingMessage(firstName)]);
    threadIdRef.current = null;
    if (userId) {
      void createRioThread(userId)
        .then((id) => {
          threadIdRef.current = id;
        })
        .catch(() => {
          // Offline / migration not applied — local-only new chat still works.
        });
      storage.set(threadCacheKey(userId), JSON.stringify([]));
    }
  }

  return {
    hydrated,
    messages,
    setMessages,
    threadIdRef,
    threadGen,
    startNewChat,
    started: messages.some((message) => message.from === 'you'),
  };
}
