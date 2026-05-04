# Phase 2 — API server and authentication

## Goal

Stand up the API stub on `Bun.serve` + Hono with **passwordless email-code authentication** as the baseline, JWT issuance, refresh-token rotation, and reporter profile CRUD. This is the back end the Expo app talks to in Phase 3.

> **Auth direction (decided):** MVP uses **email one-time codes** (6-digit, short-lived). Passwords are skipped entirely for MVP. **SSO (REQ-R550) is deferred to a post-MVP phase** so we can ship without waiting on IdP details. The SoW (4.1.1.2a, 4.1.1.8a) requires "standard credentials" + biometric step-up for sensitive content; an email-code login satisfies "standard credentials" and biometric step-up still happens at submission time (Phase 6).

## Definition of Done

- `apps/api` boots with `bun run --filter @aj-now/api dev` and listens on `:4000`.
- All routes have Hono handlers, Zod request + response schemas, contract types in `@aj-now/api-contract`, and Vitest tests with at least one happy path and one failure path each.
- A real reporter can: request a login code by email, submit the code, get an access token + refresh token, read their profile, update their profile, and exchange a refresh token for a new access token.
- In dev, the email "send" goes to a local maildev / log sink (no real SMTP needed). The code is also returned in the response **only when `NODE_ENV !== 'production'`** for ergonomic test scripts.
- Audit log rows are written for `auth.code.requested`, `auth.code.consumed`, `auth.refresh`, `auth.refresh.reuse`, `auth.logout`, `profile.update`.
- All requests over the wire are JSON. All responses include a request ID header (`x-request-id`).
- README "Run the API" section is correct and copy-pasteable.

## Stories satisfied

- **REQ-R110** — profile create/read/update endpoints.
- **REQ-R140** — reporter login (passwordless email code; UI in Phase 3).
- **REQ-R510** — encryption at rest (server side: code hashes only stored, refresh-token hashes only stored, secrets never logged).
- **REQ-R520** — encryption in transit (HTTPS-only contract; dev runs over HTTP on localhost but `Strict-Transport-Security` header is set in production builds and the Expo client refuses non-HTTPS in release).
- **REQ-R550 (SSO) — explicitly deferred to a later phase.** An `IdentityProvider` interface is shipped so SSO can be added without refactoring core auth.

### Acceptance criteria

- Requesting a code for an **unknown** email returns `202` with the same shape and timing as a known email — never reveals whether the email exists.
- Login codes are 6 digits, single-use, expire after **10 minutes**, and are invalidated when consumed or when a newer code for the same email is requested.
- Per-email rate limit: **5 code requests / 15 min** and **5 verify attempts per code** before the code is burned and a new request is required.
- Codes are stored hashed (sha256 with a per-row salt); never logged in cleartext, even in dev.
- Refresh token is rotated on use; old refresh token is invalidated; reuse triggers full revocation of that reporter's session family and an `auth.refresh.reuse` audit row.
- Profile update on `preferred_lang` accepts only `'en'` or `'ar'`. Skills/languages/expertise are arrays of trimmed non-empty strings, max 20 each.
- All endpoints except `/auth/*` and `/healthz` require a valid bearer JWT.

## Data model deltas

`reporters.password_hash` is **not** added in Phase 1 (it was already removed for this approach — see Phase 1 update). Add to `packages/db`:

```ts
login_codes {
  id              uuid pk
  email           citext not null            // case-insensitive
  code_hash       text not null              // sha256(salt || code)
  salt            text not null
  attempts        int  not null default 0
  consumed_at     timestamptz
  created_at      timestamptz not null default now()
  expires_at      timestamptz not null       // created_at + 10 min
  request_ip      inet
  user_agent      text
}
-- index: (email, created_at desc), partial index where consumed_at is null

refresh_tokens {
  id              uuid pk
  reporter_id     uuid fk -> reporters.id
  family_id       uuid not null              // for rotation/reuse detection
  token_hash      text not null              // sha256 of the opaque token
  user_agent      text
  ip              inet
  created_at      timestamptz not null default now()
  expires_at      timestamptz not null
  revoked_at      timestamptz
}
```

Migration is additive. **First-time login auto-provisions a `reporters` row** for any email present in an `allowed_reporter_emails` allowlist table seeded from `infra/seed.ts` (so we don't need open public sign-up). The allowlist is the MVP's substitute for SSO.

```ts
allowed_reporter_emails {
  email           citext pk
  full_name       text
  preferred_lang  text not null default 'en'
  added_at        timestamptz not null default now()
}
```

## API endpoints

Base path `/v1`. All bodies and responses Zod-validated. Errors follow:

```json
{ "error": { "code": "string", "message": "string", "details": { } } }
```

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/healthz` | none | — | `{ ok: true }` |
| POST | `/v1/auth/code/request` | none | `{ email }` | `202 { ok: true, devCode?: string }` |
| POST | `/v1/auth/code/verify` | none | `{ email, code }` | `{ accessToken, refreshToken, reporter }` |
| POST | `/v1/auth/refresh` | none | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/v1/auth/logout` | bearer | `{ refreshToken }` | `204` |
| GET | `/v1/me` | bearer | — | `Reporter` |
| PATCH | `/v1/me` | bearer | partial `Reporter` | `Reporter` |

`Reporter` shape (response): `{ id, email, fullName, preferredLang, skills[], languages[], expertise[], createdAt, updatedAt }`. Never returns hashes or codes.

JWT specifics:
- Algorithm: `EdDSA` (Ed25519) via `jose`. Keys generated by `bun run scripts/gen-keys.ts` and base64-stored in env.
- Access token TTL: 15 min. Refresh token TTL: 30 days, rotating.
- Claims: `{ sub: <reporter.id>, email, roles: ['reporter'], preferred_lang }`.

## Tasks

1. Create `apps/api` with `package.json` (depends on `@aj-now/db`, `@aj-now/api-contract`, `@aj-now/auth`, `hono`, `jose`, `pino`, `zod`). No `argon2` needed for MVP.
2. `src/server.ts`: `Bun.serve({ port: 4000, fetch: app.fetch })` with graceful shutdown.
3. `src/app.ts`: Hono app with middlewares: request id, pino logger (with redaction list), CORS (allow Expo dev origins from env), JSON body limit 1 MB, error normalizer, per-IP + per-email rate limiter (in-memory token bucket; pluggable to Redis later).
4. `src/middleware/auth.ts`: bearer extraction + JWT verify.
5. `src/routes/auth.ts`:
   - `POST /auth/code/request`: lookup `allowed_reporter_emails`; always respond `202` regardless. If allowed, generate `code = randomDigits(6)`, salt, hash, insert row, expire any prior unconsumed codes for that email, send via `Mailer` interface. In non-prod, also return `devCode`.
   - `POST /auth/code/verify`: look up newest unconsumed unexpired code for email; constant-time compare; on success, mark consumed, upsert reporter (auto-provision from allowlist), issue tokens.
6. `src/lib/mailer.ts`: `Mailer` interface with `LogMailer` (default in dev) and `SmtpMailer` stub. Templated HTML + text email.
7. `src/lib/identity-provider.ts`: define `IdentityProvider` interface (`describe(): { kind }`) so a future `OidcIdentityProvider` slots in cleanly. Ship `EmailCodeIdentityProvider` only.
8. Refresh tokens: opaque random 32-byte URL-safe strings; store sha256 in DB; rotate on every use; reuse → revoke family + audit.
9. `src/routes/me.ts`: GET + PATCH. PATCH validates with Zod, never lets `email` or `id` change.
10. Add scripts: `dev` (`bun run --hot src/server.ts`), `start`, `typecheck`, `lint`, `test`.
11. Vitest tests with a per-test Postgres schema (fresh schema per test).
12. Document new env vars in root `.env.example` and README.
13. Commit, push, tag `phase-2-complete`.

## Tests to add

- Code request: known email → 202 + row created; unknown email → 202 + no row created; both responses indistinguishable in body and timing (within tolerance).
- Code verify: success rotates/issues tokens; expired code → 401; wrong code increments attempts; 5 wrong attempts burns the code; consumed code can't be reused.
- Rate limit: 6th request inside 15 min returns `429`.
- Refresh: rotation happy path; reuse → family revoked + audit row.
- Me: GET requires bearer, PATCH validates `preferredLang` enum, PATCH ignores `id`/`email`.
- Audit log: each protected action writes a row.
- Pino redaction: a unit test asserts `code`, `accessToken`, `refreshToken`, `Authorization` are scrubbed from log output.

## Risks / open questions

- **SMTP provider** for production not chosen — `SmtpMailer` is a stub. Pick provider (SES / SendGrid / Mailgun) before staging.
- **Allowlist management** has no admin UI in MVP; reporters are added via seed script + DB inserts. Editor App (future) will own this.
- **SSO (REQ-R550) deferred** per user direction. The `IdentityProvider` interface keeps the door open; expect a later "Phase 9 — SSO integration" once IdP issuer / JWKS / scopes are known.
- Codes-by-email will eventually need bot/abuse protection (CAPTCHA on the request endpoint) — not in MVP but flagged.
