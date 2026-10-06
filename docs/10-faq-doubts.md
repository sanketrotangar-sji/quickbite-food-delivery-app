# 10 — FAQ & doubts (living file)

Add new questions at the bottom under **Your doubts**. Answer with file paths when you can.

---

## Beginner FAQ (seeded)

### 1. Where do I start reading?
[`docs/README.md`](./README.md) → mind map → architecture → this FAQ.

### 2. Why are there three apps?
Mobile for customers/riders, web for kitchen/admin, landing for marketing. One Supabase backend. See [`01-architecture.md`](./01-architecture.md).

### 3. What is RLS in one sentence?
Postgres decides which rows your login may see, even if you know the table name. Details: [`04-security-rls.md`](./04-security-rls.md).

### 4. Why can’t the app just `update` an order’s status?
Because there is no UPDATE policy on `orders`. Status changes go through RPCs that enforce the state machine (`place_order`, `restaurant_set_order_status`, `rider_set_order_status`). See [`05-flows.md`](./05-flows.md).

### 5. Where is the state machine?
SQL RPCs (and shared helpers in `packages/shared` / `_shared/rules.ts`). Diagram: [`05-flows.md`](./05-flows.md).

### 6. Can I change my role from the client?
No. Column privileges + `guard_profile_update` block it. Roles change via admin/owner RPCs (`private.grant_role`). Migrations: `20260919181927_helpers_and_guards.sql`, `20260922154000_single_role_column.sql`.

### 7. I want to be a rider and still order food. Can I?
**No on one account.** Single-role is intentional (ADR-004). Create a second customer account to order, or stay customer and don’t take the rider role on that login.

### 8. Where are theme colours?
Shared hex: `packages/shared/src/brand-tokens.ts`. Mobile wraps them in `apps/client/src/constants/theme.ts`. Manager: `apps/manager/src/styles.css`. Some screens still hard-code near-duplicate oranges (audit Medium).

### 9. What is RIO?
Customer AI assistant edge function. Doc: [`06-rio-assistant.md`](./06-rio-assistant.md). Code: `supabase/functions/rio/`.

### 10. Why does RIO use my JWT?
So cart/order tools obey **your** RLS. The function must not use the service role for those tools.

### 11. Is local Supabase required?
No for your current workflow — **cloud** is home. Local exists if you run Docker + `supabase start` (`supabase/config.toml`). You asked about this in Phase 1; clarified in ADR-003.

### 12. What is `_delivery_quarantine/`?
A **parking lot**, not part of the running app. It holds:

| Subfolder | What it is |
|-----------|------------|
| `seed-data-generated/` | Big generated seed JSON/CSV from Assessment work |
| `tmp/`, `tmp-supabase/` | Temporary copies / tooling leftovers |
| `manager-test-results/` | Old Playwright output |
| `assignment2.md`, `REMAINING.md` | Notes / checklists |

**Is it important at runtime?** No.  
**Is it important historically?** Maybe for graders or regenerating seeds.  
**Phase 3 recommendation:** after a clean seed strategy, delete or stop tracking bulky generated files; keep a small sample if needed. Not required to edit code.

### 13. Where did the old audits go?
[`docs/historical/`](./historical/) — per your request. Current truth starts at [`00-audit.md`](./00-audit.md) + Phase 2 docs.

### 14. Does the manager app use the service role in production?
**Code:** `client.server.ts` can create an admin client, but **no route imports it**. Browser uses anon + JWT. E2E scripts may use the service role key locally. ADR-014.  
**Guard (P6):** `npm run check:secrets` fails if service-role strings appear under `apps/client/src` or if `client.server` is imported from manager routes/UI.

### 15. What package id is the Android app?
`com.sjinnovation.quickbite` — `apps/client/app.json`. Keep it (FCM). Build via EAS (`eas.json`).

### 16. Why is `seed.sql` missing?
It is present as of P8: [`supabase/seed.sql`](../supabase/seed.sql) for local `supabase db reset`. Uses `@quickbite.demo` accounts — see [`supabase/seed-data/README.md`](../supabase/seed-data/README.md). Do not push to cloud until wipe (P7).

### 17. Why migrations and not editing the DB in the dashboard?
Migrations are repeatable history. Dashboard clicks are invisible to git and break teammates/CI. Phase 4 rule: new migration files only.

### 18. What is the biggest security bug right now?
`match_embeddings` can expose other users’ delivery addresses to any logged-in caller. See Critical in [`00-audit.md`](./00-audit.md) and [`06-rio-assistant.md`](./06-rio-assistant.md).

### 19. Order timeout — is it real?
You confirmed we **need** it. Not built yet. Will be a Phase 3 proposal and Phase 4 migration when approved.

### 20. How do I add a doubt without breaking docs?
Copy the template at the bottom; answer yourself or ask in chat referencing this file.

---

## Resolved Phase 1 open questions (your answers)

| # | Short answer |
|---|--------------|
| 1 | Cloud is what you use; local optional / surprising to you. |
| 2 | OK to rebuild seed later with fresh characters; don’t fetishize keeping bulk junk (be careful with admin). |
| 3 | Proper RAG needed; current corpus not trusted. |
| 4 | **Single-role** only — multi-role rejected. |
| 5 | Design proper agent architecture (not tool-count games). |
| 6 | No idea on service role deploy — code shows unused helper. |
| 7 | Yes, implement order acceptance timeout. |
| 8 | Package id final; EAS path. |
| 9 | Quarantine explained above. |
| 10 | Old audits → historical. |

---

## Your doubts

<!-- Add entries like:

### D-001 — title
**Date:**  
**Question:**  
**Answer / files:**  
**Still open?** yes/no

-->

### D-001 — (template ready)
**Date:** —  
**Question:** _(write here)_  
**Answer / files:** _(fill when known)_  
**Still open?** yes
