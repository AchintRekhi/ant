@AGENTS.md

# ANT — gym progress tracker

Full-stack gym tracking app with a social layer. Plan/roadmap lives at
`~/.claude/plans/gym-app-decide-swift-parasol.md`.

## Stack
- Next.js 16 (App Router, TS) + Tailwind 4. Turbopack is default; `next lint` removed.
- Supabase: Auth + Postgres 17 + Storage. RLS is the security model — write policies per table.
- Charts: Recharts (added in Phase 3).

## Next 16 gotchas (already handled)
- `middleware.ts` → `proxy.ts` (Node runtime, no edge). Session refresh lives in `src/proxy.ts`.
- `cookies()`/`headers()` are async — must be `await`ed (see `src/lib/supabase/server.ts`).

## Supabase project
- Project ref: `iuqfrwwrayfckmmfoltk` (name `ant`, region `ap-south-1`, org `AchintRekhi`).
- Keys are in `.env.local` (gitignored). `.env.example` documents the shape.
- **Migrations:** keep SQL files in `supabase/migrations/`. Apply via the Supabase MCP
  (once loaded) or the Management API: `POST /v1/projects/iuqfrwwrayfckmmfoltk/database/query`.
- Supabase MCP is installed (local scope) — its tools load after a Claude Code restart.

## Conventions
- Store all measurements in metric; convert to the user's unit at the UI layer only.
- DOB is never exposed — only a derived `age`.
