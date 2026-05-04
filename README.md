# AJ Now

Monorepo for **AJ Now** — Al Jazeera's mobile-first reporting platform. This repo will eventually house multiple parts of the system (Reporter App, Editor App, API, shared packages). The first deliverable is the **Reporter App MVP**.

## Status

🚧 **Pre-build.** This repo currently contains the phased build specification only. Implementation begins with Phase 1.

## Documentation

The full phased specification lives in [`docs/`](./docs):

- **[docs/README.md](./docs/README.md)** — start here. Spec-pack overview, how to use it with Claude Code, locked technical decisions, and what's deferred.
- **[docs/00-OVERVIEW.md](./docs/00-OVERVIEW.md)** — product context, in-scope MVP stories, monorepo layout, conventions.
- **docs/01 → 08** — one file per build phase, each with goal, definition of done, stories satisfied, data-model deltas, API endpoints, client surface, numbered tasks, tests, and risks.

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Monorepo | Bun workspaces |
| Mobile app | Expo (latest, dev build) + expo-router |
| API | `Bun.serve` + Hono |
| Data layer | Drizzle ORM in shared `packages/db` |
| Database | Postgres |
| Object storage | RustFS (S3-compatible), via Docker locally |
| Auth (MVP) | Email-code login; biometric unlock for stored sessions; SSO deferred |

## Planned monorepo layout

```
apps/
  reporter/        Expo dev build
  api/             Bun.serve + Hono
packages/
  db/              Drizzle schema + migrations (shared)
  api-contract/    Request/response types shared by client + server
  config/          Shared tsconfig, eslint, prettier
  auth/            Token + session helpers
  ui-tokens/       Theme + i18n primitives
docs/              Phased build specification
```

## Working with the spec

Hand Claude Code **one phase at a time**. Each phase doc is a self-contained contract — finish it, review at the gate, then move to the next.
