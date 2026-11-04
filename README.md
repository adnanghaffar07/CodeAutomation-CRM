# CodeAutomation CRM

Sales and business-development CRM. Next.js 14, Tailwind, Prisma, Supabase (Auth + Postgres).

Plan and progress: [docs/PLAN.md](docs/PLAN.md) · [docs/SHERAZ-ACTION-PLAN.md](docs/SHERAZ-ACTION-PLAN.md)

## Run locally

Prerequisites: Node 20.12+ and a Supabase project (cloud).

```bash
npm install
# create .env and .env.local from .env.example: Supabase URL, publishable key,
# DATABASE_URL (transaction pooler) and DIRECT_URL (session pooler)
npx prisma db push      # create tables
npm run db:setup        # app role, row-level security, API lock-down, seed workspace
npm run db:test         # proves workspaces cannot see each other's data
npm run dev             # http://localhost:3000
```

`db:setup` creates the `crm_app` role and switches `DATABASE_URL` to it. The app must connect as `crm_app`, never as `postgres`, because `postgres` bypasses row-level security.

Checks: `npm run typecheck`, `npm run build`, `npm test`.
