# AJ Now — Reporter App MVP — Build Specification

> **Audience:** Claude Code (and human reviewers). This is the master index for a multi-phase build of the **Reporter App MVP**, the first deliverable of the wider **AJ Now** platform.
>
> Each phase document in this folder is self-contained enough to hand to an agent in isolation. Phases are ordered by dependency. Do not start a later phase until the earlier ones are green (typecheck, lint, tests, smoke run).

---

## 1. Product context

AJ Now is Al Jazeera's next-generation field-to-newsroom platform. The full system has three apps (Reporter, Editor/Admin, Consumer) plus shared AI/data services. **This MVP scope covers only the Reporter App**, restricted to the user stories in `AJ-Now_Requirements.xlsx` whose **Category = "Reporter App"** and **Suggested Priority = "M"** (MVP).

The Reporter App lets a field correspondent:

- Authenticate via email one-time code, with optional biometric unlock of the saved session, and biometric step-up for sensitive submissions. (SSO is deferred.)
- Receive, accept, and progress assignments pushed from the newsroom, plus pick up open assignments and propose new news events.
- Capture broadcast-quality video, hi-fi audio, and hi-res images **offline-first**, with GPS metadata stamped at capture time.
- Draft stories from templates, embed media, version drafts, and submit — with biometric step-up for breaking/sensitive content.
- Upload large media in the background with resumable, chunked transfer that tolerates intermittent connectivity.
- Share live location and trigger emergency alerts during hazardous assignments.
- Operate offline for briefs, drafts, and reference content; everything syncs when connectivity returns.
- Use the app fully in English (LTR) and Arabic (RTL) from day one.
- Trust that on-device data is encrypted at rest and all traffic is encrypted in transit.

> **Out of MVP scope (deferred):** AI quality assessment of media (REQ — non-MVP), AI live transcription/entity tagging, AI proofreading (REQ-R220 is M but is **stubbed** behind a feature flag — see Phase 8), budgeting/payment sub-system, contractor onboarding payments, real-time messaging, AI-driven assignment matching backend, C2PA manifest generation backend. The Reporter App must be designed so these can be plugged in later without architectural rewrites.

---

## 2. The user stories in scope (Reporter App, priority M)

| Req ID | SoW | One-liner |
|---|---|---|
| REQ-R040 | 4.1.1.1 | Native iOS Reporter App |
| REQ-R050 | 4.1.1.1 | Native Android Reporter App |
| REQ-R070 | 4.1.1.1 | English LTR UI |
| REQ-R080 | 4.1.1.1 | Arabic RTL UI |
| REQ-R110 | 4.1.1.2 | Reporter profile (skills, languages, expertise) |
| REQ-R120 | 4.1.1.2a | Fingerprint login |
| REQ-R130 | 4.1.1.2a | Face ID login |
| REQ-R140 | 4.1.1.2a | Reporter login (email one-time code in MVP; SSO deferred) |
| REQ-R150 | 4.1.1.3 | Push notification on new assignment |
| REQ-R160 | 4.1.1.3 | View assignment briefs + reference content |
| REQ-R170 | 4.1.1.3 | Accept / reject assignment |
| REQ-R180 | 4.1.1.3 | Update assignment status (Accepted, In Progress, Filing) |
| REQ-R190 | 4.1.1.8 / .2.6 / .5.4 | View prior work + editor feedback |
| REQ-R200 | 4.1.1.3 / .2.8 | Browse + accept open assignments |
| REQ-R210 | 4.1.4.4 / .4.10 / .3.13 | Propose a news event from the field |
| REQ-R220 | 4.1.2.3 | AI proofreading / style check (stubbed) |
| REQ-R230 | 4.1.1.4 | Capture video |
| REQ-R240 | 4.1.1.4 | Capture audio |
| REQ-R250 | 4.1.1.4 | Capture image |
| REQ-R260 | 4.1.1.4 | All capture saves locally first, even offline |
| REQ-R280 | 4.1.1.5 | Offline access to briefs, drafts, reference |
| REQ-R290 | 4.1.1.6 | Background upload of large media |
| REQ-R300 | 4.1.1.6 | Auto pause/resume upload by network state |
| REQ-R340 | 4.1.1.8 | Story templates |
| REQ-R380 | 4.1.1.8a | Standard submission via valid session (no biometric step-up) |
| REQ-R390 | 4.1.1.9 | GPS metadata at point of capture |
| REQ-R400 | 4.1.1.9 | GPS metadata works offline |
| REQ-R430 | 4.1.1.11 | Live GPS share + emergency alert |
| REQ-R510 | 4.1.1.13 | On-device data encrypted at rest |
| REQ-R520 | 4.1.1.13 | Data encrypted in transit |
| REQ-R550 | B.4 | SSO with Al Jazeera account (DEFERRED post-MVP) |

These are mapped onto phases in section 5.

---

## 3. Technical constraints (locked)

- **Monorepo** managed by **Bun** workspaces.
- **Mobile app:** latest **Expo** (SDK 53+ at time of writing) with an **EAS development build** — *not* Expo Go — because we need biometrics, background upload, native filesystem encryption, and (later) custom native modules.
- **API server:** runs in **`Bun.serve`** (latest). HTTP framework allowed: **Hono** (already used in our other PoC). REST + JSON. WebSockets only where needed (Phase 7 safety channel).
- **Data layer:** **Drizzle ORM** with **PostgreSQL**. Schema, types, and Zod validators live in a **shared workspace package** consumed by both client and server. No type drift between layers.
- **Auth:** Passwordless **email one-time codes** for MVP (no passwords). Refresh tokens stored client-side in the OS keychain, optionally biometric-protected. Bearer JWTs, short-lived access + refresh. **SSO (OIDC) is deferred to a post-MVP phase**; an `IdentityProvider` interface keeps the seam clean.
- **Storage:** Object storage abstraction. Local dev uses **RustFS** (S3-compatible) via Docker Compose. Production target is Azure Blob; the abstraction must hide that.
- **Notifications:** Expo Push Notifications service for MVP.
- **i18n:** `i18next` + `react-i18next` + Expo's `I18nManager` for RTL.
- **Testing:** **Vitest** for the API and shared packages, **Jest + React Native Testing Library** for the app, **Playwright** for the (later) admin web. Add at least one happy-path E2E per phase.
- **Code quality:** TypeScript strict mode everywhere, **ESLint** + **Prettier**, **Lefthook** pre-commit (`typecheck`, `lint`, `test --changed`).
- **CI:** GitHub Actions matrix (`bun install && bun run typecheck && bun run lint && bun run test`). EAS build job is documented but not auto-triggered.

---

## 4. Monorepo layout (target)

```
aj-now/
├── apps/
│   ├── reporter/                 # Expo dev build (iOS, Android, Web stub)
│   └── api/                      # Bun.serve + Hono
├── packages/
│   ├── db/                       # Drizzle schema, migrations, Zod schemas, shared TS types
│   ├── api-contract/             # Shared request/response types + route paths
│   ├── auth/                     # JWT/OIDC helpers shared by client + server
│   ├── config/                   # tsconfig base, eslint config, prettier config
│   └── ui-tokens/                # design tokens (colors, spacing, typography, RTL helpers)
├── infra/
│   ├── docker-compose.yml        # Postgres + RustFS for local dev
│   └── eas.json                  # EAS build profiles
├── scripts/
│   └── seed.ts                   # seed dev DB with reporters, assignments, templates
├── .github/workflows/
├── bun.lockb
├── package.json                  # workspaces: ["apps/*", "packages/*"]
├── lefthook.yml
├── tsconfig.base.json
└── README.md
```

---

## 5. Phase plan

| Phase | File | What it delivers | Stories addressed |
|---|---|---|---|
| 1 | `01-phase-1-foundation.md` | Monorepo scaffold, Bun workspaces, shared packages, Postgres + RustFS docker compose, Drizzle schema v0, CI, lefthook | (cross-cutting) |
| 2 | `02-phase-2-api-and-auth.md` | `Bun.serve` + Hono API, email-code login, JWT issuance, refresh tokens with rotation, profile CRUD, audit log | REQ-R110, R140, R510 (server side), R520 — R550 deferred |
| 3 | `03-phase-3-expo-app-shell.md` | Expo dev build, navigation, theming, i18n EN/AR + RTL, email-code login, biometric unlock, secure storage | REQ-R040, R050, R070, R080, R120, R130, R140, R510 (client), R520 — R550 deferred |
| 4 | `04-phase-4-assignments.md` | Assignment lifecycle (server + client), push notifications, briefs viewer, accept/reject, status updates, open-assignments pool, propose-news-event flow, prior-work history | REQ-R150, R160, R170, R180, R190, R200, R210 |
| 5 | `05-phase-5-capture-and-offline.md` | Multi-modal capture (video/audio/image), local encrypted storage of captures, GPS tagging (online + offline), offline brief & draft access, sync engine | REQ-R230, R240, R250, R260, R280, R390, R400 |
| 6 | `06-phase-6-story-filing.md` | Story drafts, templates, rich text + media embedding, draft versioning, submission flow with biometric step-up rule, AI proofreading stub | REQ-R220, R340, R380, R190 (feedback display), R510 |
| 7 | `07-phase-7-background-upload-and-safety.md` | Chunked resumable background uploads, network-aware pause/resume, GPS safety: live share + check-in + emergency alert (offline-queueable) | REQ-R290, R300, R430 |
| 8 | `08-phase-8-hardening-and-cross-cutting.md` | Security review (encryption at rest/in transit), accessibility pass, RTL audit, observability, error boundaries, release checklist | REQ-R510, R520, plus polish |

Each phase document has the same shape:

1. **Goal + Definition of Done**
2. **Stories satisfied (with acceptance criteria)**
3. **Data model deltas** (Drizzle migrations to add)
4. **API endpoints** (path, method, request, response, errors)
5. **Client surface** (screens, components, navigation changes)
6. **Tasks** (numbered, in build order)
7. **Tests to add**
8. **Risks / open questions**

---

## 6. Conventions Claude Code must follow

- Always run `bun install`, `bun run typecheck`, `bun run lint`, `bun run test` before declaring a phase complete. Surface failures, do not silently skip.
- Never inline secrets. Use `.env.example` + a real `.env` ignored by git. Document every new env var in the phase doc and in the root README.
- Commit per logical task, not per phase. Conventional commits: `feat(reporter):`, `feat(api):`, `chore(db):`, `test(reporter):`, etc.
- Migrations are append-only. Never edit a shipped migration; add a new one.
- Shared types live in `packages/*`. If the same shape exists in two places, that's a bug.
- Every API route has: a Hono handler, a Zod request schema, a Zod response schema, an entry in `packages/api-contract`, and at least one Vitest test.
- Every screen has: a snapshot test, an English+Arabic visual smoke test (jest-image-snapshot or a fixture render), and an a11y label audit.
- Push to `origin/main` after each phase, tagged `phase-N-complete`.

---

## 7. Reading order for the agent

1. This file (`00-OVERVIEW.md`).
2. `01-phase-1-foundation.md` — set up the repo.
3. Then phases 2 → 8 in order. Do **not** read ahead; each phase's doc has everything needed for that phase.
