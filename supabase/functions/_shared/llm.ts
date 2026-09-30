/**
 * Shared OpenAI-compatible chat client for Edge Functions.
 *
 * Reads the single active row from public.llm_config and routes to Groq or
 * Ollama by swapping base URL / API key — one code path, not two integrations.
 * Secrets (GROQ_API_KEY, OLLAMA_BASE_URL) never live in the database.
 */

export type LlmProvider = "groq" | "ollama";

export type LlmConfigRow = {
  id: string;
  provider: LlmProvider;
  chat_model: string;
  is_active: boolean;
};

export type ChatCompletionMessage = Record<string, unknown>;

export type CallLlmOptions = {
  /** Supabase client that can SELECT llm_config (user JWT or service role). */
  db: { from: (table: string) => any };
  messages: ChatCompletionMessage[];
  tools?: unknown[];
  tool_choice?: string | Record<string, unknown>;
  temperature?: number;
  max_tokens?: number;
  parallel_tool_calls?: boolean;
};

export type CallLlmResult = {
  provider: LlmProvider;
  model: string;
  response: Response;
  payload: any;
};

export type StreamLlmOptions = CallLlmOptions & {
  onToken: (text: string) => void;
};

const RETIRED_GROQ_MODELS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
]);

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function fallbackModel(provider: LlmProvider) {
  if (provider === "groq") {
    const chosen = Deno.env.get("GROQ_MODEL")?.trim();
    if (chosen && !RETIRED_GROQ_MODELS.has(chosen)) return chosen;
    return "openai/gpt-oss-20b";
  }
  return "llama3.2";
}

/** Resolve OpenAI-compatible endpoint + auth from provider + secrets. */
export function resolveProviderEndpoint(provider: LlmProvider, chatModel: string) {
  const model = chatModel.trim() || fallbackModel(provider);

  if (provider === "groq") {
    const apiKey = Deno.env.get("GROQ_API_KEY")?.trim();
    if (!apiKey) {
      throw new Error(
        "RIO is missing its Groq key. Set GROQ_API_KEY on the function, then try again.",
      );
    }
    return {
      provider,
      model,
      // Groq OpenAI-compatible API requires the /v1 prefix.
      baseUrl: "https://api.groq.com/openai/v1",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      } as Record<string, string>,
    };
  }

  const host = Deno.env.get("OLLAMA_BASE_URL")?.trim();
  if (!host) {
    throw new Error(
      "RIO is missing OLLAMA_BASE_URL. Set it to your Ollama host (e.g. http://host.docker.internal:11434), then try again.",
    );
  }
  return {
    provider,
    model,
    baseUrl: `${trimSlash(host)}/v1`,
    headers: {
      "content-type": "application/json",
    } as Record<string, string>,
  };
}

type LlmConfigCache = { value: LlmConfigRow; expiresAt: number };
let llmConfigCache: LlmConfigCache | null = null;
const LLM_CONFIG_TTL_MS = 60_000;

export async function readActiveLlmConfig(
  db: CallLlmOptions["db"],
): Promise<LlmConfigRow> {
  if (llmConfigCache && llmConfigCache.expiresAt > Date.now()) {
    return llmConfigCache.value;
  }

  const { data, error } = await db
    .from("llm_config")
    .select("id, provider, chat_model, is_active")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`RIO could not read llm_config: ${error.message}`);
  }

  let value: LlmConfigRow;
  if (!data) {
    // Soft fallback so a missing migration/seed does not hard-kill chat.
    value = {
      id: "env-fallback",
      provider: "groq",
      chat_model: fallbackModel("groq"),
      is_active: true,
    };
  } else {
    const provider = data.provider === "ollama" ? "ollama" : "groq";
    value = {
      id: data.id,
      provider,
      chat_model: typeof data.chat_model === "string" ? data.chat_model : fallbackModel(provider),
      is_active: true,
    };
  }

  llmConfigCache = { value, expiresAt: Date.now() + LLM_CONFIG_TTL_MS };
  return value;
}

/**
 * One function for every chat provider: POST /v1/chat/completions with
 * base_url / model / key swapped from the active llm_config row.
 */
export async function callLLM(options: CallLlmOptions): Promise<CallLlmResult> {
  const active = await readActiveLlmConfig(options.db);
  const endpoint = resolveProviderEndpoint(active.provider, active.chat_model);

  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages: options.messages,
    max_tokens: options.max_tokens ?? 700,
    temperature: options.temperature ?? 0.3,
  };
  if (options.tools) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice ?? "auto";
    body.parallel_tool_calls = options.parallel_tool_calls ?? false;
  }

  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: "POST",
    headers: endpoint.headers,
    body: JSON.stringify(body),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    provider: endpoint.provider,
    model: endpoint.model,
    response,
    payload,
  };
}

/**
 * Stream final assistant text (no tools). Used after the tool loop so the UI
 * can paint tokens before the full reply is ready.
 */
export async function streamLLM(options: StreamLlmOptions): Promise<{
  provider: LlmProvider;
  model: string;
  text: string;
}> {
  const active = await readActiveLlmConfig(options.db);
  const endpoint = resolveProviderEndpoint(active.provider, active.chat_model);

  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages: options.messages,
    max_tokens: options.max_tokens ?? 700,
    temperature: options.temperature ?? 0.3,
    stream: true,
  };

  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: "POST",
    headers: endpoint.headers,
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new Error(llmFailureMessage(endpoint.provider, response, payload));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta;
        const piece =
          (typeof delta?.content === "string" && delta.content) ||
          (typeof delta?.reasoning === "string" && delta.reasoning) ||
          "";
        if (piece) {
          text += piece;
          options.onToken(piece);
        }
      } catch {
        // Skip malformed SSE chunks.
      }
    }
  }

  return { provider: endpoint.provider, model: endpoint.model, text };
}

/** Human-readable failure for RIO (keeps provider name out of the happy path). */
export function llmFailureMessage(
  provider: LlmProvider,
  response: Response,
  payload: any,
) {
  const label = provider === "groq" ? "Groq" : "Ollama";
  if (response.status === 429) {
    return provider === "groq"
      ? "RIO hit the free Groq limit. Wait a minute and try again."
      : "RIO hit an Ollama rate limit. Wait a moment and try again.";
  }
  const message = payload?.error?.message ?? payload?.message;
  const detail = typeof message === "string" ? message.replace(/\s+/g, " ").slice(0, 180) : "";
  return detail
    ? `RIO could not reach ${label}: ${detail}`
    : `RIO could not reach ${label} (${response.status}).`;
}
