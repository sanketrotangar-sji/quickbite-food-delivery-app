import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  activateLlmConfig,
  loadLlmConfigs,
  updateLlmChatModel,
  type AdminLlmConfig,
} from '@/api/admin';
import { Button } from '@/components/ui/button';

/** Hosted Ollama chat models (see https://ollama.buildyourai.consulting/api/docs). */
const CLOUD_OLLAMA_CHAT_MODELS = ['llama3.2:latest', 'qwen2.5:3b'] as const;

const CLOUD_OLLAMA_HOST = 'https://ollama.buildyourai.consulting';
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const EMBEDDING_DIMS = 1024;

function providerLabel(provider: AdminLlmConfig['provider']) {
  return provider === 'groq' ? 'Groq' : 'Cloud Ollama';
}

function ProviderCard({
  row,
  busy,
  onSaveModel,
  onActivate,
}: {
  row: AdminLlmConfig;
  busy: boolean;
  onSaveModel: (id: string, model: string) => void;
  onActivate: (id: string) => void;
}) {
  const [model, setModel] = useState(row.chat_model);

  useEffect(() => {
    setModel(row.chat_model);
  }, [row.chat_model, row.id]);

  const dirty = model.trim() !== row.chat_model;
  const isOllama = row.provider === 'ollama';

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Provider</p>
          <h2 className="mt-1 text-xl font-extrabold">{providerLabel(row.provider)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.provider === 'groq'
              ? 'Cloud chat via Groq (OpenAI-compatible). Key: GROQ_API_KEY secret.'
              : `Hosted Ollama chat at ${CLOUD_OLLAMA_HOST}. Host: OLLAMA_BASE_URL secret (same host as RAG embeddings).`}
          </p>
        </div>
        {row.is_active ? (
          <span className="rounded-md bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">Active</span>
        ) : (
          <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            Standby
          </span>
        )}
      </div>

      {isOllama ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Cloud Ollama endpoint</p>
          <p className="mt-1 font-mono text-[11px] break-all">{CLOUD_OLLAMA_HOST}</p>
          <p className="mt-1">
            Chat uses <code className="text-[11px]">/v1/chat/completions</code>. Set the secret with{' '}
            <code className="text-[11px]">supabase secrets set OLLAMA_BASE_URL=…</code> — not stored in this
            database.
          </p>
        </div>
      ) : null}

      <label className="mt-5 block text-xs font-bold uppercase text-muted-foreground" htmlFor={`model-${row.id}`}>
        Chat model
      </label>
      <input
        id={`model-${row.id}`}
        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={model}
        onChange={(event) => setModel(event.target.value)}
        disabled={busy}
        placeholder={row.provider === 'groq' ? 'openai/gpt-oss-20b' : 'llama3.2:latest'}
      />

      {isOllama ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {CLOUD_OLLAMA_CHAT_MODELS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={model.trim() === preset ? 'default' : 'outline'}
              disabled={busy}
              onClick={() => setModel(preset)}
            >
              {preset}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !dirty}
          onClick={() => onSaveModel(row.id, model)}
        >
          Save model
        </Button>
        <Button type="button" disabled={busy || row.is_active} onClick={() => onActivate(row.id)}>
          {row.is_active ? 'Currently active' : 'Activate'}
        </Button>
      </div>
    </div>
  );
}

export function AdminAiPage() {
  const queryClient = useQueryClient();
  const configs = useQuery({ queryKey: ['admin-llm-config'], queryFn: loadLlmConfigs });
  const [error, setError] = useState<string | null>(null);

  const saveModel = useMutation({
    mutationFn: ({ id, model }: { id: string; model: string }) => updateLlmChatModel(id, model),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-llm-config'] });
    },
    onError: (err) => setError((err as Error).message),
  });

  const activate = useMutation({
    mutationFn: (id: string) => activateLlmConfig(id),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-llm-config'] });
    },
    onError: (err) => setError((err as Error).message),
  });

  const busy = saveModel.isPending || activate.isPending;
  const active = (configs.data ?? []).find((row) => row.is_active);
  const sorted = [...(configs.data ?? [])].sort((a, b) => {
    // Groq first, then Cloud Ollama
    if (a.provider === b.provider) return 0;
    return a.provider === 'groq' ? -1 : 1;
  });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase text-primary">Configuration</p>
      <h1 className="mt-1 text-3xl font-extrabold">AI provider</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        RIO chat uses one active provider below (Groq or Cloud Ollama). RAG embeddings always use the
        hosted Ollama embedding model and are not switched here. API keys and{' '}
        <code className="text-xs">OLLAMA_BASE_URL</code> stay in Supabase Edge secrets. Config is cached
        up to ~60s on warm edge isolates after you save or activate.
      </p>

      {active ? (
        <p className="mt-4 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-sm font-semibold">
          Active chat: {providerLabel(active.provider)} · {active.chat_model}
        </p>
      ) : null}

      {configs.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">{(configs.error as Error).message}</p>
      ) : null}
      {error ? <p className="mt-4 text-sm font-semibold text-destructive">{error}</p> : null}

      <div className="mt-6 grid gap-4">
        {sorted.map((row) => (
          <ProviderCard
            key={row.id}
            row={row}
            busy={busy}
            onSaveModel={(id, model) => saveModel.mutate({ id, model })}
            onActivate={(id) => activate.mutate(id)}
          />
        ))}
        {configs.isLoading ? <p className="text-sm text-muted-foreground">Loading providers…</p> : null}
        {!configs.isLoading && (configs.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No llm_config rows yet. Apply the AI foundation migration.</p>
        ) : null}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">RAG / embeddings</p>
        <h2 className="mt-1 text-xl font-extrabold">Cloud Ollama (fixed)</h2>
        <p className="mt-2 text-muted-foreground">
          Not switchable from this screen — changing the embedding model requires a vector rebuild.
          Host and model must match the curated index.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <dt className="text-xs font-bold uppercase text-muted-foreground">Host</dt>
            <dd className="mt-1 font-mono text-xs break-all text-foreground">{CLOUD_OLLAMA_HOST}</dd>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <dt className="text-xs font-bold uppercase text-muted-foreground">Secret</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">OLLAMA_BASE_URL</dd>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <dt className="text-xs font-bold uppercase text-muted-foreground">Model</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{EMBEDDING_MODEL}</dd>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <dt className="text-xs font-bold uppercase text-muted-foreground">Dimensions</dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{EMBEDDING_DIMS}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          API: <code className="text-[11px]">POST /api/embed</code> · docs:{' '}
          <a
            className="font-semibold text-primary underline-offset-2 hover:underline"
            href="https://ollama.buildyourai.consulting/api/docs#embeddings"
            target="_blank"
            rel="noreferrer"
          >
            ollama.buildyourai.consulting/api/docs
          </a>
        </p>
      </div>
    </div>
  );
}
