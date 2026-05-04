# Phase 8 — Hardening, security, accessibility, observability, release

## Goal

Take the working app from Phases 1–7 and bring it to "MVP ship" quality: prove encryption guarantees, audit RTL/i18n + accessibility, add observability, lock down release configuration, and produce a one-page operational runbook.

## Definition of Done

- A written **security review** in `docs/security.md` that:
  - Demonstrates encryption at rest (REQ-R510): names every storage location (SQLite DB, MMKV, captures dir, secure-store) and the protection mechanism for each, with screenshots of platform settings or code references.
  - Demonstrates encryption in transit (REQ-R520): TLS-only API client, HSTS on the production API, certificate pinning configuration documented (pinning itself optional for MVP but stub provided).
  - Lists all secrets and where they live (env vars, keychain, never in repo).
- An **accessibility + RTL audit** in `docs/a11y-rtl.md` that lists every screen with: EN screenshot, AR screenshot, accessibility label coverage report, and any waivers.
- **Observability**: API emits structured logs (pino), exposes `/metrics` (Prometheus text format), and request tracing IDs are propagated end to end. Client emits Sentry-compatible error reports (Sentry SDK wired in but DSN optional).
- **Release configuration**: EAS profiles (`development`, `preview`, `production`) all build cleanly. `production` profile points at `EXPO_PUBLIC_API_BASE_URL=https://…` and refuses non-HTTPS in code.
- **Runbook** in `docs/runbook.md`: how to seed staging, how to rotate JWT keys, how to revoke a reporter, how to inspect upload queues, how to roll back a migration.
- All tests pass; CI green; zero TypeScript errors; zero ESLint errors.

## Stories satisfied (verification, not new)

REQ-R510, REQ-R520; cross-cutting verification of REQ-R070, R080, R040, R050.

## Tasks

1. Security review:
   - Walk through every file write path; confirm directory + protection class.
   - Add a unit test that the API client constructor throws on a non-HTTPS base URL when `__DEV__ === false`.
   - Confirm tokens never logged: add a pino redactor and a unit test asserting `password`, `accessToken`, `refreshToken`, `Authorization` are scrubbed.
2. Accessibility pass:
   - Audit all `Pressable`/`TouchableOpacity` for `accessibilityRole` + `accessibilityLabel`.
   - Verify color contrast against tokens (WCAG AA).
   - Tap target ≥ 44×44 dp.
3. RTL audit:
   - Confirm no `marginLeft`/`marginRight`/`left`/`right` literals; use `start`/`end`.
   - Verify icon mirroring policy (chevrons, back arrows mirror; brand marks do not).
   - Verify Arabic numerals policy (Western digits in data, Eastern Arabic where editorial wants — document the choice).
4. Observability:
   - Add `/metrics` and a small set of counters: `auth_logins_total{result}`, `assignments_status_changes_total{from,to}`, `uploads_chunks_received_total`, `emergency_alerts_total{was_offline}`.
   - Sentry init in app + API behind env flag.
5. Release prep:
   - Bump app version, set bundle/package identifiers, icons, splash, store metadata stub.
   - EAS submit profiles documented (no actual store submission required for MVP).
6. Update root README with the full developer story end to end.
7. Tag `phase-8-complete` and `mvp-v0.1.0`.

## Tests to add

- `apiClient` constructor + non-HTTPS rejection in production builds.
- Pino redactor unit test.
- A small Detox or Maestro happy-path E2E (optional but strongly preferred): login → accept assignment → capture image → save draft with embedded image → submit (normal priority).

## Risks / open questions

- Certificate pinning vs OTA updates is in tension; MVP ships without pinning, with rotation runbook.
- Sentry DSN, store credentials, and real IdP details are owned by AJ ops; this phase ships placeholders and docs for the swap.
