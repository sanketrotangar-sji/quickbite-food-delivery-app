import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  activateLlmConfig,
  loadLlmConfigs,
  updateLlmChatModel,
  type AdminLlmConfig,
} from '@/api/admin';
import { Button } from '@/components/ui/button';

function providerLabel(provider: AdminLlmConfig['provider']) {
  return provider === 'groq' ? 'Groq' : 'Ollama';
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

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Provider</p>
          <h2 className="mt-1 text-xl font-extrabold">{providerLabel(row.provider)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.provider === 'groq'
              ? 'Cloud OpenAI-compatible chat via Groq.'
              : 'Local OpenAI-compatible chat via Ollama.'}
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

      <label className="mt-5 block text-xs font-bold uppercase text-muted-foreground" htmlFor={`model-${row.id}`}>
        Chat model
      </label>
      <input
        id={`model-${row.id}`}
        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={model}
        onChange={(event) => setModel(event.target.value)}
        disabled={busy}
        placeholder={row.provider === 'groq' ? 'openai/gpt-oss-20b' : 'llama3.2'}
      />

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

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase text-primary">Configuration</p>
      <h1 className="mt-1 text-3xl font-extrabold">AI provider</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        RIO and future agents call one shared chat function. Switching provider here only changes
        which OpenAI-compatible endpoint is used — tools and behavior stay the same. API keys and
        the Ollama host stay in Supabase secrets, not in this screen. Edge functions cache the active
        llm_config for up to 60 seconds after you save or activate, so a new model may take a minute
        to apply on warm isolates.
      </p>

      {active ? (
        <p className="mt-4 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-sm font-semibold">
          Active now: {providerLabel(active.provider)} · {active.chat_model}
        </p>
      ) : null}

      {configs.error ? (
        <p className="mt-4 text-sm font-semibold text-destructive">{(configs.error as Error).message}</p>
      ) : null}
      {error ? <p className="mt-4 text-sm font-semibold text-destructive">{error}</p> : null}

      <div className="mt-6 grid gap-4">
        {(configs.data ?? []).map((row) => (
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

      <div className="mt-8 rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Embeddings (not switchable)</p>
        <p className="mt-1">
          RAG vectors always use Ollama <code className="text-xs">nomic-embed-text</code> (768-d). Changing
          the chat provider above does not change the embedding model — mixing models would break similarity search.
        </p>
      </div>
    </div>
  );
}
