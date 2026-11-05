# CodeAutomation CRM

Sales and business-development CRM. Next.js 14, Tailwind, Prisma, Supabase (Auth + Postgres).

Plan and progress: [docs/PLAN.md](docs/PLAN.md) · [docs/SHERAZ-ACTION-PLAN.md](docs/SHERAZ-ACTION-PLAN.md)

## Run locally

Prerequisites: Node 20.12+ and a Supabase project (cloud).

```bash
npm install
# create .env and .env.local from .env.example: Supabase URL, publishable key,
# DATABASE_URL (transaction pooler) and DIRECT_URL (session pooler)
npm run setup           # tables + app role + security rules + seed + isolation test
npm run dev             # http://localhost:3000
```

### First sign-in
Public sign-up is off, so the first admin is created from the command line (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`):

```bash
npm run admin:link -- sheraz@codeautomation.dev "Sheraz" ceo_admin
```

Open the file it names in `.invite-links/` (not printed, not committed), follow the link within about an hour and choose a password. After that, invite everyone else from Settings → Users.

`npm run setup` runs three steps in order (`prisma db push`, `db:setup`, `db:test`; each also runs on its own). `db:setup` creates the `crm_app` role and switches `DATABASE_URL` to it. The app must connect as `crm_app`, never as `postgres`, because `postgres` bypasses row-level security.

Checks: `npm run typecheck`, `npm run build`, `npm test`.

### Sample data
`npm run seed:sample` adds 24 fictional companies and 80 contacts (tagged `sample`) so the screens have something to show. `npm run seed:sample -- clear` removes exactly those rows.
