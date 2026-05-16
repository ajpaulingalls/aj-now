# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project at a glance

AJ Now is Al Jazeera's mobile-first field-to-newsroom platform. The first deliverable is the **Reporter App MVP** — an offline-first iOS/Android app for field correspondents.

Repo state today: monorepo skeleton plus three shipped library packages — `@aj-now/config`, `@aj-now/db`, `@aj-now/auth`. **No `apps/` directory, no `infra/`, no `scripts/`, no CI workflow yet** — they land in later Phase 1 stories. The authoritative roadmap is `docs/00-OVERVIEW.md` followed by `docs/01-phase-1-foundation.md` through `docs/08-phase-8-hardening-and-cross-cutting.md`. **Do not read ahead** — each phase doc is a self-contained contract.

## Common commands

Prefer the root workspace scripts (`bun run …`) — these are the integration points lefthook and CI will hit:

- `bun install` — install workspace deps (Bun, not npm/pnpm/yarn)
- `bun run typecheck` — `tsc --noEmit` across every package
- `bun run lint` — `eslint .` across every package
- `bun run test` — `vitest run` across every package
- `bun run db:migrate` — apply `@aj-now/db` migrations against `$DATABASE_URL` (requires a running Postgres)
- `bun run db:generate` — `drizzle-kit generate` from `packages/db/src/schema/` (commit the generated SQL)
- `bun run db:seed` — **NOT YET IMPLEMENTED**; `scripts/seed.ts` lands in story-006. Running today fails fast.

Single-package and single-file variants:

- `bun --filter @aj-now/<pkg> <script>` — run one package's script (e.g. `bun --filter @aj-now/db test`)
- Single test file: `cd packages/<pkg> && bunx vitest run src/path/to/file.test.ts`

Formatting: no root `format` script. Prettier config lives at `packages/config/prettier.config.js`; run `bunx prettier --write .` from the repo root.

## Architecture — what exists today

- **Bun workspaces** (`apps/*`, `packages/*`). Package names follow `@aj-now/<name>`.
- **`@aj-now/config`** — shared tooling. Exports `tsconfig.base` (neutral strict + module config), `tsconfig.lib` (declaration + maps for library packages), `tsconfig.app` (noEmit for future app packages), plus ESLint flat config and Prettier config. A `__tests__/strict.fixture/` directory holds a regression guard for `noUncheckedIndexedAccess` — its test is `run.sh`, not vitest. Don't delete or weaken it.
- **`@aj-now/db`** — Drizzle ORM + postgres-js. 9 tables across 5 schema modules under `src/schema/`, plus `columns.ts` helpers (`primaryId`, `createdAt`, `updatedAt`) you should reuse when adding tables. Append-only migrations under `migrations/` (drizzle-kit generates, `runMigrations(databaseUrl)` applies). Drizzle-zod insert/select schemas exposed via `./zod`.
- **`@aj-now/auth`** — jose JWT plumbing (ES256). `signAccessToken` / `verifyAccessToken` / `signRefreshToken` / `verifyRefreshToken` take a `KeyLike` parameter — they do **not** read env vars. Zod `AccessClaimSchema` / `RefreshClaimSchema` validate verified payloads. Default TTLs: 15min access, 7d refresh.
- **TypeScript everywhere**, strict: `strict: true` + `noUncheckedIndexedAccess: true` (indexed access returns `T | undefined`). Library packages extend `@aj-now/config/tsconfig.lib`.

## Architecture — planned per docs

Locked stack, sourced from `README.md` and `docs/00-OVERVIEW.md` §3. None of this is built yet:

- **Expo SDK 53+ EAS dev build** (not Expo Go) for the Reporter app — Phase 3
- **`Bun.serve` + Hono REST API** with email-code login + JWT issuance — Phase 2
- **Postgres + RustFS** (S3-compatible object storage) via `docker-compose` for local dev — Phase 1 story-006
- **lefthook** pre-commit (typecheck + lint) and **GitHub Actions CI** with `postgres:16` service — Phase 1 story-007
- **i18next + EN/AR + RTL** from day 1 (`Expo I18nManager.forceRTL`) — Phase 3
- **SSO (REQ-R550) deferred**; email-code login is MVP

See `docs/01-phase-1-foundation.md` (and later phase docs) for the full data model, API surface, and task ordering for each phase.

## Workspace library package scaffold

Every new library package follows this shape (validate against `packages/db/` or `packages/auth/`):

- `tsconfig.json` extends `@aj-now/config/tsconfig.lib`, overrides `noEmit: true` (source-only workspace packages; consumers import TS directly, no `.d.ts` shipped)
- `eslint.config.js`: `import config from '@aj-now/config/eslint'; export default config;`
- Scripts use a `bunx` prefix — `bunx tsc --noEmit`, `bunx eslint .`, `bunx vitest run` — because bare `eslint` isn't on PATH from the `bun --filter` invocation context

## Non-obvious gotchas

- **`packages/db` integration tests require Docker.** They use `testcontainers` with `postgres:16`. The `vitest.config.ts` sets `hookTimeout: 180_000` because Docker daemon pressure can stretch cold-start beyond 90s; warm-path runs in ~3-5s.
- **`@aj-now/auth` does not read env vars.** Phase 2's server entry point will read `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` from `.env` and pass the keys in. Tests use `jose.generateKeyPair('ES256')`.
- **No type drift across packages.** Shared types live in `packages/*`. The same shape in two places is a bug.
- **Migrations are append-only.** Never edit a shipped migration; add a new one.
- **`bun run db:seed` fails today** — `scripts/seed.ts` is unimplemented (story-006). Don't be surprised.

## Conventions

The authoritative list lives in `docs/00-OVERVIEW.md` §6 — read it there to avoid drift. Enforceable on day-one work in this repo: conventional commits scoped per package (`feat(db):`, `chore(workspace):`, etc.), one logical change per commit, and no inline secrets (track new env vars in `.env.example`; `.env` is gitignored). The per-API-route and per-screen rules in §6 only become enforceable when Phases 2 and 3 land.

## Where to look next

- **Roadmap:** `docs/00-OVERVIEW.md`
- **Current phase spec:** `docs/01-phase-1-foundation.md`
- **README:** repo-level overview and locked tech stack

If you're operating with the `xp-agents` plugin loaded, `shared_mental_model.json` contains curated Constraints + Wisdom for in-flight work — but it's plugin-only state, not durable project documentation.
