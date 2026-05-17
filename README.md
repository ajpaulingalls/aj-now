# AJ Now

Monorepo for **AJ Now** — Al Jazeera's mobile-first reporting platform. This repo will eventually house multiple parts of the system (Reporter App, Editor App, API, shared packages). The first deliverable is the **Reporter App MVP**.

## Status

Phase 1 (foundation) shipped: workspace + `@aj-now/{config,db,auth,ui-tokens,api-contract}` + local-dev docker stack (Postgres + RustFS) + seed script + lefthook + GitHub Actions CI. Phase 2 (API server) is next.

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Monorepo | Bun workspaces |
| Mobile app | Expo (latest, dev build) + expo-router |
| API | `Bun.serve` + Hono |
| Data layer | Drizzle ORM in shared `@aj-now/db` |
| Database | Postgres 16 |
| Object storage | RustFS (S3-compatible), via Docker locally |
| Auth (MVP) | Email-code login; biometric unlock for stored sessions; SSO deferred |

## Prerequisites

- **Bun 1.3+** — `curl -fsSL https://bun.sh/install | bash`
- **Docker** — for the local Postgres + RustFS stack

## Quick start

```bash
git clone <repo>
cd aj-now
bun install                    # also runs `lefthook install` via prepare
cp .env.example .env           # edit if you have port conflicts — see Troubleshooting
docker compose -f infra/docker-compose.yml up -d --wait
bun run db:migrate
bun run db:seed
bun run test                   # warm: ~3-5s per package; first run pulls postgres:16
```

`--wait` blocks until both services report healthy, so `db:migrate` does not race a cold Postgres.

## Common scripts

| Script               | What it does |
|----------------------|---|
| `bun run typecheck`  | `tsc --noEmit` across every workspace package |
| `bun run lint`       | `eslint .` across every workspace package |
| `bun run test`       | `vitest run` across every workspace package |
| `bun run db:migrate` | Apply `@aj-now/db` migrations against `$DATABASE_URL` |
| `bun run db:seed`    | Insert demo data: 3 reporters + 2 assignments + 3 template stories |
| `bun run db:generate`| `drizzle-kit generate` from `packages/db/src/schema/` |

Lefthook runs `bun run typecheck` + `bun run lint` on every commit and `bun run test` on every push.

## Project layout

```
apps/             (Phase 3+: reporter/, api/)
packages/
  config/          Shared tsconfig + eslint + prettier
  db/              Drizzle schema + migrations + seedDemo
  auth/            jose ES256 sign/verify helpers (KeyLike injection; no env reads)
  ui-tokens/       Theme + RTL primitives
  api-contract/    Zod schemas + route constants shared by client + server
infra/             Local-dev docker-compose + EAS placeholder
scripts/           Entry points (db:seed)
docs/              Phased build specification
.github/workflows/ CI (postgres:16 service, full gates)
```

## Troubleshooting

- **Port 5432 already in use.** A host-side Postgres will intercept the docker-published port. Set `HOST_PG_PORT=5433` in `.env` and bump `DATABASE_URL` to use 5433. Same trick for `HOST_S3_PORT` / `HOST_S3_CONSOLE_PORT` if 9000/9001 collide.
- **Testcontainers slow on first run.** `@aj-now/db` tests start a `postgres:16` container; cold-start can stretch past 90s during the image pull. Warm runs are ~3-5s. `vitest.config.ts` sets `hookTimeout: 180_000` for this reason.
- **`bun run db:seed` errors "already seeded".** By design (fail-fast on a populated DB). Reset with `docker compose -f infra/docker-compose.yml down -v` then re-run `db:migrate` + `db:seed`.
- **`JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` blank in `.env.example`.** Intentional. Phase 1 doesn't read them — `@aj-now/auth` takes `KeyLike` as a parameter (no env reads). Phase 2's API server will generate or load real keys.

## Working with the spec

Hand Claude Code **one phase at a time**. Each phase doc in `docs/` is a self-contained contract — finish it, review at the gate, then move to the next.

- **Roadmap:** [`docs/00-OVERVIEW.md`](./docs/00-OVERVIEW.md)
- **Current phase:** [`docs/01-phase-1-foundation.md`](./docs/01-phase-1-foundation.md)
- **Per-package notes for AI agents:** [`CLAUDE.md`](./CLAUDE.md)
