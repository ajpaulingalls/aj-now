# Phase 1 — Foundation: monorepo, shared packages, infra, CI

> Read `00-OVERVIEW.md` first. Do not start later phases until this one is green.

## Goal

Stand up the empty house: monorepo with Bun workspaces, shared `packages/*`, Postgres + RustFS via Docker Compose, Drizzle ORM with an initial schema, lint/typecheck/test scripts that all pass on an empty codebase, and CI that runs them on every PR.

## Definition of Done

- `bun install` succeeds at repo root.
- `bun run typecheck`, `bun run lint`, `bun run test` all pass (zero tests is fine; the *runners* must work).
- `docker compose up -d` brings up Postgres on `localhost:5432` and RustFS on `localhost:9000` / console `:9001`.
- `bun run db:migrate` applies the v0 schema to the running Postgres.
- `bun run db:seed` populates a handful of demo reporters, assignment templates, and one open assignment.
- GitHub Actions workflow runs install + typecheck + lint + test on push and PR; green on `main`.
- README at repo root explains how to clone, install, run the dev DB, run the API stub (placeholder for Phase 2), and run the Expo app (placeholder for Phase 3).

## Stories satisfied

None directly — this phase is infrastructure.

## Repo layout to create

```
aj-now/
├── apps/                                 # empty (apps added in later phases)
├── packages/
│   ├── config/
│   │   ├── tsconfig.base.json
│   │   ├── eslint.config.js
│   │   ├── prettier.config.js
│   │   └── package.json
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── reporters.ts
│   │   │   │   ├── assignments.ts
│   │   │   │   ├── stories.ts
│   │   │   │   ├── media.ts
│   │   │   │   ├── events.ts
│   │   │   │   └── index.ts          # barrel
│   │   │   ├── client.ts             # drizzle client factory
│   │   │   ├── zod.ts                # drizzle-zod generated schemas
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   ├── migrations/               # generated; commit them
│   │   └── package.json
│   ├── api-contract/
│   │   ├── src/
│   │   │   ├── routes.ts             # path constants
│   │   │   ├── types.ts              # request/response shapes (re-export from db/zod where possible)
│   │   │   └── index.ts
│   │   └── package.json
│   ├── auth/
│   │   ├── src/
│   │   │   ├── jwt.ts                # sign/verify helpers
│   │   │   ├── claims.ts             # claim shapes + zod
│   │   │   └── index.ts
│   │   └── package.json
│   └── ui-tokens/
│       ├── src/
│       │   ├── colors.ts
│       │   ├── spacing.ts
│       │   ├── typography.ts
│       │   ├── rtl.ts                # helpers (start/end, mirroring)
│       │   └── index.ts
│       └── package.json
├── infra/
│   ├── docker-compose.yml
│   └── eas.json                      # placeholder, populated in Phase 3
├── scripts/
│   └── seed.ts
├── .github/workflows/ci.yml
├── .env.example
├── .gitignore
├── bun.lockb
├── package.json
├── lefthook.yml
├── tsconfig.base.json                # re-exports from packages/config
└── README.md
```

## Root `package.json` essentials

- `"private": true`
- `"workspaces": ["apps/*", "packages/*"]`
- Scripts:
  - `dev`: orchestrates `bun --filter './apps/*' dev` (no-op until apps exist)
  - `typecheck`: `bun --filter '*' typecheck`
  - `lint`: `bun --filter '*' lint`
  - `test`: `bun --filter '*' test`
  - `db:migrate`: `bun --filter @aj-now/db migrate`
  - `db:seed`: `bun run scripts/seed.ts`
  - `db:generate`: `bun --filter @aj-now/db generate`

Package names are `@aj-now/<name>`.

## Drizzle schema v0

Postgres. UUID primary keys (`gen_random_uuid()`), `timestamptz` for all dates, soft-delete with `deleted_at` where it makes sense.

```ts
// packages/db/src/schema/reporters.ts
reporters {
  id              uuid pk default gen_random_uuid()
  external_id     text unique     // future SSO subject claim (nullable in MVP — email-code login)
  email           text unique not null
  full_name       text not null
  preferred_lang  text not null default 'en'   // 'en' | 'ar'
  skills          text[] not null default '{}'
  languages       text[] not null default '{}'
  expertise       text[] not null default '{}'
  device_pubkey   text                    // for push + future signing; nullable
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
}

// assignments.ts
assignments {
  id              uuid pk
  title           text not null
  brief_md        text not null              // Markdown brief
  reference_urls  jsonb not null default '[]' // [{label,url}]
  is_open_pool    boolean not null default false
  priority        text not null default 'normal' // 'normal' | 'breaking' | 'sensitive'
  created_by      uuid not null              // editor id (FK skipped in MVP — editor table later)
  created_at      timestamptz not null default now()
}

assignment_recipients {
  id              uuid pk
  assignment_id   uuid fk -> assignments.id
  reporter_id     uuid fk -> reporters.id
  status          text not null default 'pending' // pending|accepted|rejected|in_progress|filing|submitted|completed
  status_changed_at timestamptz not null default now()
  unique(assignment_id, reporter_id)
}

// stories.ts
stories {
  id              uuid pk
  assignment_id   uuid nullable fk -> assignments.id   // nullable for self-proposed stories
  reporter_id     uuid not null fk -> reporters.id
  template_key    text not null                       // 'standard' | 'breaking' | 'feature'
  title           text not null default ''
  body_md         text not null default ''
  status          text not null default 'draft'      // draft|submitted|published|rejected
  current_version int not null default 1
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
}

story_versions {
  id              uuid pk
  story_id        uuid fk -> stories.id
  version         int not null
  title           text not null
  body_md         text not null
  created_at      timestamptz not null default now()
  unique(story_id, version)
}

editor_feedback {
  id              uuid pk
  story_id        uuid fk -> stories.id
  editor_id       uuid not null
  body_md         text not null
  created_at      timestamptz not null default now()
}

// media.ts
media_assets {
  id              uuid pk
  reporter_id     uuid fk -> reporters.id
  story_id        uuid nullable fk -> stories.id
  assignment_id   uuid nullable fk -> assignments.id
  kind            text not null                  // 'video'|'audio'|'image'
  mime_type       text not null
  byte_size       bigint
  duration_ms     int                            // null for image
  capture_at      timestamptz not null
  gps_lat         double precision               // nullable: not all captures geotagged
  gps_lon         double precision
  gps_accuracy_m  double precision
  storage_key     text                           // object storage key once uploaded
  upload_status   text not null default 'pending' // pending|uploading|uploaded|failed
  client_uuid     uuid not null                  // assigned on device for offline idempotency
  unique(client_uuid)
  created_at      timestamptz not null default now()
}

// events.ts
news_event_proposals {
  id              uuid pk
  reporter_id     uuid fk -> reporters.id
  title           text not null
  description_md  text not null
  gps_lat         double precision
  gps_lon         double precision
  status          text not null default 'submitted' // submitted|triaged|accepted|rejected
  created_at      timestamptz not null default now()
}

audit_log {
  id              uuid pk
  actor_id        uuid
  action          text not null
  target_type     text
  target_id       uuid
  details         jsonb not null default '{}'
  created_at      timestamptz not null default now()
}
```

The migration generated from this is the v0 baseline; commit it.

## Tasks (in order)

1. `git init` aj-now repo. Add `.gitignore` (Node, Bun, Expo, env, RustFS data, `node_modules`, `dist`, `.expo`, `ios/build`, `android/build`).
2. Root `package.json` with workspaces, scripts above.
3. `packages/config`: shared `tsconfig.base.json` (strict, `moduleResolution: "Bundler"`, `esnext` libs, `noUncheckedIndexedAccess: true`), shared ESLint flat config (typescript-eslint, react/react-native rules — gated by env), shared Prettier config.
4. Each other package's `tsconfig.json` extends the base; each gets `lint`/`typecheck`/`test` scripts.
5. `packages/db`: install drizzle-orm + drizzle-kit + drizzle-zod + postgres (`pg`), implement schema, generate first migration, write `client.ts` (factory taking a connection string from env), write `zod.ts` exporting `insert*`/`select*` schemas. Vitest test that schema typechecks and a smoke insert works against a test container.
6. `packages/api-contract`: route path constants and shared types.
7. `packages/auth`: `signAccessToken`, `verifyAccessToken`, `signRefreshToken`, `verifyRefreshToken` using `jose`. Zod schema for claims (`sub`, `email`, `roles`, `reporter_id`, `iat`, `exp`).
8. `packages/ui-tokens`: tokens + RTL helpers (`isRTL(lang)`, `start`/`end`).
9. `infra/docker-compose.yml`: Postgres 16 + **RustFS** (S3-compatible object store; image `rustfs/rustfs:latest`, default port `9000`, console `9001`). Mount a named volume at `/data`. Set `RUSTFS_ROOT_USER` / `RUSTFS_ROOT_PASSWORD` from env. Add health checks. `.env.example` declares `DATABASE_URL`, `S3_ENDPOINT=http://localhost:9000`, `S3_REGION=us-east-1`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET=aj-now-media`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `EXPO_PUBLIC_API_BASE_URL`.
10. `scripts/seed.ts`: 3 reporters (one EN, one AR, one bilingual), 1 open-pool assignment, 1 directly assigned assignment to reporter A, 3 templates entries.
11. `lefthook.yml`: pre-commit `bun run typecheck && bun run lint`, pre-push `bun run test`.
12. `.github/workflows/ci.yml`: matrix on `ubuntu-latest`, install Bun, run scripts. Cache Bun and `node_modules` per workspace.
13. `README.md`: prerequisites (Bun, Docker, Node 20), setup steps, common scripts, troubleshooting.
14. Commit, push, tag `phase-1-complete`.

## Tests to add

- `packages/db`: vitest smoke test using a Postgres testcontainer (or, if too heavy, `pg-mem` shim) that runs migrations and inserts one reporter.
- `packages/auth`: vitest tests for sign/verify round-trip and tampered-token rejection.
- `packages/ui-tokens`: vitest tests for `isRTL` and `start`/`end` helpers.

## Risks / open questions
- **RustFS S3 compatibility:** RustFS implements the S3 API; we use the AWS SDK v3 / `@aws-sdk/client-s3` against a custom endpoint. If a specific S3 op the upload pipeline needs (multipart, presigned PUT) is incomplete in RustFS, fall back to a thin server-side proxy on the API. Verify multipart upload + presigned URL flows in Phase 7 before relying on them in production.


- **Bun + drizzle-kit:** drizzle-kit historically expected Node; if the CLI doesn't run cleanly under Bun, fall back to `bunx drizzle-kit` or invoke via `node` for the migration step only. Document the workaround.
- **Postgres in CI:** use `services: postgres:16` block; not Docker Compose.
- **RustFS not needed in CI** for Phase 1; only used by later phases.
