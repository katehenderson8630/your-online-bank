
## Goal

Recreate the app from `ex-senator/online-banking-systemic-d6275484U` in this TanStack Start project, using your own Supabase project (`octvuctmhszbtyhixxwd.supabase.co`) as the backend. You said the DB schema/migrations are already applied there, so no migrations will run — this project just consumes it.

## Prerequisites (you)

1. Flip the GitHub repo to **Public** (or confirm the exact URL) so I can read the source.
2. When I request it, paste the **Supabase service role key** into the secure secret form (needed for admin/server-side actions).

## Steps I will run

1. **Fetch source** — pull the full file tree from the repo (routes, components, hooks, styles, assets, package.json).
2. **Port dependencies** — install any packages listed in the repo's `package.json` that aren't already here (via `bun add`). If the repo is Vite + React Router / Next, I'll adapt route files into TanStack Start's `src/routes/` convention while preserving UI, styles, and logic 1:1.
3. **Copy assets & styles** — move `public/*`, images, fonts, and merge Tailwind theme tokens / global CSS into `src/styles.css`.
4. **Point to your Supabase**:
   - Write `.env` values:
     - `VITE_SUPABASE_URL=https://octvuctmhszbtyhixxwd.supabase.co`
     - `VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>`
     - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (same, server-side)
   - Store `SUPABASE_SERVICE_ROLE_KEY` via the secure secret form.
   - Replace any generated Supabase client from the repo with a small `src/integrations/supabase/client.ts` using your URL + anon key. Regenerate `types.ts` from your schema if available; otherwise use `Database = any` as a placeholder.
5. **Auth wiring** — keep the repo's auth flows (login, signup, session) but route them through your Supabase instance. Public routes stay top-level; authenticated routes go under `src/routes/_authenticated/`.
6. **Server functions** — port any Supabase reads/writes into `createServerFn` (`src/lib/*.functions.ts`) with `requireSupabaseAuth` middleware for user-scoped operations. No new Edge Functions.
7. **Metadata** — set real title/description in `__root.tsx` for the banking app (replacing "Lovable App" defaults).
8. **Verify** — hit `/`, sign-in, dashboard, and one write action; confirm rows land in your Supabase.

## Out of scope

- Running SQL migrations against your Supabase (you said it's already set up).
- Copying data/users from the original project.
- Changing feature behavior — this is a like-for-like clone.

## Blocking question

Repo is still 404. Please make `ex-senator/online-banking-systemic-d6275484U` public (or paste the correct URL/zip), then approve this plan and I'll build it.
