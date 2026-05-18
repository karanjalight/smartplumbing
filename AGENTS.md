<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Product context

- **Vision and objectives:** `docs/PROJECT_PROPOSAL.md` (smart water billing, tenants, landlords, M-Pesa, PWA).
- **API reference:** add or update `docs/API.md` when backend or integration docs are available.
- **Backend / database:** `docs/SUPABASE.md` describes the Supabase schema (`supabase/migrations/`), RLS rules, storage buckets, and how the `lib/*-data.ts` helpers map onto real tables. Update it whenever you change the schema or wire a new screen to the database.
