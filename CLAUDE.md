# Tamurfood

Private B2B bakery ordering platform.

## Tech Stack

Bun, React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui, Hono, Better Auth, PostgreSQL, Drizzle ORM, Supabase Realtime.

## Project Structure

```
tamurfood/
├── package.json              # Root: workspaces, shared dev scripts
├── .env / .env.example       # Environment variables (DATABASE_URL, etc.)
├── supabase/config.toml      # Local Supabase config
├── apps/
│   ├── web/                  # React 19 + Vite frontend (port 5173)
│   │   ├── src/
│   │   │   ├── main.tsx      # Router + QueryClient providers
│   │   │   ├── index.css     # Tailwind v4 theme
│   │   │   ├── lib/utils.ts  # cn() helper
│   │   │   ├── components/ui/  # shadcn/ui components
│   │   │   └── routes/       # TanStack file-based routes
│   │   ├── components.json   # shadcn/ui config
│   │   └── vite.config.ts    # Tailwind + Router plugins, /api proxy
│   └── server/               # Hono backend on Bun (port 3000)
│       └── src/index.ts      # Hono app entry
└── packages/
    └── db/                   # Drizzle ORM schema + migrations
        ├── src/schema.ts     # Table definitions
        ├── src/index.ts      # Drizzle client export
        └── drizzle.config.ts # Drizzle Kit config
```

## Conventions

- **Monorepo:** Bun workspaces (`apps/*`, `packages/*`)
- **Imports:** Use `@/` alias in frontend (maps to `apps/web/src/`)
- **Package names:** `@tamurfood/web`, `@tamurfood/server`, `@tamurfood/db`
- **Styling:** Tailwind CSS v4 with shadcn/ui components (New York style)
- **Routing:** TanStack Router file-based routing in `apps/web/src/routes/`
- **Database:** Drizzle ORM with PostgreSQL (local Supabase)
- **Server exports:** Hono uses Bun's default export pattern (`export default { port, fetch }`)

## Commands

```bash
bun dev                       # Start frontend + backend concurrently
bun run --cwd packages/db generate  # Generate Drizzle migration
bun run --cwd packages/db migrate   # Run Drizzle migrations
bun run --cwd packages/db studio    # Open Drizzle Studio
supabase start                # Start local Supabase (PostgreSQL on port 54322)
supabase stop                 # Stop local Supabase
```
