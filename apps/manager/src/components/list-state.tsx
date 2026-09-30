import type { ReactNode } from 'react';

export function ListLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}

export function ListEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function ListError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
      <p className="text-base font-semibold text-foreground">Something went wrong</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function ListShell({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: { title: string; body: string } | null;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) return <ListLoading />;
  if (error) return <ListError message={error} onRetry={onRetry} />;
  if (empty) return <ListEmpty title={empty.title} body={empty.body} />;
  return children;
}
