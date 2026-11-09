import { corsHeaders } from "../_shared/cors.ts";
import type { RioCard, RioConflict } from "./tools.ts";

export type RioTurnReply = {
  text: string;
  cards: RioCard[];
  conflict: RioConflict | null;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function emitTokenChunks(
  text: string,
  onToken: (token: string) => void | Promise<void>,
  chunkSize = 24,
) {
  for (let i = 0; i < text.length; i += chunkSize) {
    await onToken(text.slice(i, i + chunkSize));
  }
}

export function streamRioResponse(
  requestId: string,
  agent: string,
  run: (callbacks: {
    onToken: (token: string) => Promise<void>;
    onProgress: (text: string) => Promise<void>;
  }) => Promise<{ outcome: RioTurnReply; threadId: string | null; chunked?: boolean }>,
): Response {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const writeLine = async (payload: unknown) => {
    await writer.write(encoder.encode(`${JSON.stringify(payload)}\n`));
  };

  void (async () => {
    try {
      const { outcome, threadId, chunked } = await run({
        onToken: async (token) => {
          await writeLine({ type: "token", text: token });
        },
        onProgress: async (text) => {
          await writeLine({ type: "progress", text });
        },
      });
      if (chunked && outcome.text) {
        await emitTokenChunks(outcome.text, (token) => writeLine({ type: "token", text: token }));
      }
      await writeLine({
        type: "done",
        text: outcome.text,
        cards: outcome.cards,
        conflict: outcome.conflict,
        threadId,
        agent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "RIO could not answer just now.";
      console.error(`rio [${requestId}] stream`, message);
      const calm = message.startsWith("Sign in")
        ? message
        : "I hit a snag checking that. Want me to try again or pick another kitchen?";
      try {
        await writeLine({ type: "token", text: calm });
        await writeLine({ type: "done", text: calm, cards: [], conflict: null, threadId: null });
      } catch {
        await writeLine({ type: "error", error: calm });
      }
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
