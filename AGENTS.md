# QuickBite — agents

Read these before changing code.

1. **Product** — [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) (roles, RPCs, RLS).
2. **How to write code** — [`docs/STANDARDS.md`](docs/STANDARDS.md).
3. **Cursor rules** — `.cursor/rules/` (always apply, including Ponytail).
4. **Ponytail skills** — `.cursor/skills/` (`ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`).
5. **UI skill** — `.cursor/skills/ui-ux-pro-max`. Use it for client screens. Do not restyle from its landing-page pattern.
6. **Status** — [`docs/PROGRESS.md`](docs/PROGRESS.md) after a meaningful change.
7. **Backlog** — [`docs/PLAN.md`](docs/PLAN.md). The audit-fix order is **Audit fixes (2026-11-07)**. Do one step, then stop.

SQL RPCs own order status. Screens do not call Supabase directly — use `@quickbite/api` (after `bindSupabase`). Secrets stay off the client. Ask before schema or destructive git/docker/db commands. Vendor/payment/role extensions use side tables with dual-write before column drops.

Cursor will **block or prompt** on dangerous shell (see `.cursor/hooks/`). Git pre-commit blocks `.env` and service-role leaks.
