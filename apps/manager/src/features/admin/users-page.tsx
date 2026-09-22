import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { loadAdminUsers } from '@/api/admin';

export function AdminUsersPage() {
  const users = useQuery({ queryKey: ['admin-users'], queryFn: loadAdminUsers });
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (users.data ?? []).filter((row) => {
      if (!needle) return true;
      return `${row.full_name ?? ''} ${row.email} ${row.role}`.toLowerCase().includes(needle);
    });
  }, [users.data, query]);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase text-primary">Directory</p>
      <h1 className="mt-1 text-3xl font-extrabold">Users</h1>
      <input
        className="mt-5 w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm"
        placeholder="Search name, email, or role"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {users.error ? <p className="mt-4 text-sm font-semibold text-destructive">{(users.error as Error).message}</p> : null}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {shown.map((row) => (
          <div key={row.id} className="grid gap-1 border-b border-border px-4 py-4 last:border-0 sm:grid-cols-[1.2fr_1fr]">
            <div className="min-w-0">
              <p className="truncate font-extrabold">{row.full_name || 'Unnamed'}</p>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
            </div>
            <p className="text-sm font-semibold text-primary">{row.role}</p>
          </div>
        ))}
        {shown.length === 0 ? <p className="p-8 text-sm text-muted-foreground">No people match.</p> : null}
      </div>
    </div>
  );
}
