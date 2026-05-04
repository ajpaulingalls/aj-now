# Phase 4 — Assignments lifecycle, push, open pool, news event proposals

## Goal

Deliver the end-to-end assignment workflow: editor-created assignments reach the reporter via push, the reporter reads briefs + reference materials, accepts/rejects, drives status forward, browses an open-assignments pool, proposes new news events, and reviews their prior work and editor feedback.

## Definition of Done

- A seeded assignment pushed to a logged-in reporter triggers an Expo push notification on a real device. Tapping it deep-links to the assignment detail.
- Reporter can: view assignment details (title, brief MD, reference list), accept (status `accepted`), reject (with optional reason), advance to `in_progress` and `filing`. All transitions are server-validated.
- Reporter can browse `/open-pool`, view items, and `claim` an open assignment, which creates an `assignment_recipients` row with status `accepted`.
- Reporter can submit a news event proposal with title, description, and (optional) GPS — Phase 5 fills GPS in automatically; here it is manual or skipped.
- Reporter can view a History tab listing their submitted/published stories with the latest editor feedback inlined.
- All state is server-authoritative; the client uses TanStack Query with optimistic updates and rollback on error.

## Stories satisfied

REQ-R150, R160, R170, R180, R190, R200, R210.

### Acceptance criteria

- Status transitions: only `pending → accepted | rejected`, `accepted → in_progress`, `in_progress → filing`, `filing → submitted` (Phase 6 emits `submitted`). Server returns 409 on illegal transitions.
- Assignment detail screen renders Markdown brief; reference URLs open in in-app browser.
- Open-pool listing excludes assignments the reporter has already accepted/rejected.
- Push notifications are scoped to the device's `expo_push_token` registered per session; logout removes the token from the server.

## Data model deltas

```ts
push_tokens {
  id              uuid pk
  reporter_id     uuid fk -> reporters.id
  expo_push_token text not null
  platform        text not null      // 'ios' | 'android'
  created_at      timestamptz not null default now()
  last_seen_at    timestamptz not null default now()
  unique(expo_push_token)
}
```

`assignment_recipients.status` enum widened in code (still `text`).

## API endpoints (`/v1`)

| Method | Path | Notes |
|---|---|---|
| POST | `/me/push-tokens` | register Expo push token |
| DELETE | `/me/push-tokens/:token` | unregister on logout |
| GET | `/assignments` | reporter's assignments; filter `?status=` |
| GET | `/assignments/:id` | full detail incl. brief + references |
| POST | `/assignments/:id/accept` | → status `accepted` |
| POST | `/assignments/:id/reject` | body `{ reason? }` |
| POST | `/assignments/:id/status` | body `{ status: 'in_progress' \| 'filing' }` |
| GET | `/assignments/open` | open pool |
| POST | `/assignments/:id/claim` | from open pool |
| POST | `/news-events` | propose a news event `{ title, description, gps? }` |
| GET | `/me/work-history` | prior stories + latest feedback (paginated) |

Push delivery: when an editor tool (or a seed script) creates an `assignment_recipients` row with `status='pending'`, a server worker (`apps/api/src/workers/notify.ts`) sends an Expo push to all of that reporter's tokens with `{ title, body, data: { type: 'assignment.new', assignmentId } }`.

For MVP the "editor tool" is two endpoints used by tests/seed only:
| POST | `/dev/assignments` | create assignment + recipients (gated `NODE_ENV !== 'production'`) |
| POST | `/dev/feedback` | post feedback on a story (gated) |

## Client surface

New screens (under `(tabs)`):

- `assignments/index.tsx` — list (My Assignments, segmented filter: pending/active/done).
- `assignments/[id].tsx` — detail; accept/reject/status buttons; "Open in story editor" (Phase 6 hooks).
- `open-pool/index.tsx` — list of open-pool items with claim CTA.
- `propose/index.tsx` — form for a news event proposal.
- `history/index.tsx` — prior work + feedback.

Push: register token in a `usePushRegistration` hook, called after login. Foreground notifications routed by `expo-notifications` listener into a small in-app toast + deep-link to the assignment.

## Tasks

1. Drizzle migration for `push_tokens`.
2. Implement endpoints + Zod schemas + contract types.
3. `notify.ts` worker function called from `accept/reject/status/claim` and `dev/assignments` to fan out Expo pushes (use `expo-server-sdk` in the API).
4. Client: TanStack Query hooks for all endpoints. Optimistic update on status transitions.
5. Markdown rendering: `react-native-markdown-display` or `react-native-marked` — pick one and stick with it.
6. Reference URL opening via `expo-web-browser` (`openBrowserAsync`).
7. Push token registration hook + listeners; in-app toast component (RTL-safe).
8. History screen: paginated query, latest feedback rendered as a quote block.
9. Tests:
   - API: status-transition state machine (legal + illegal), open-pool exclusion logic, push token de-dup, work-history pagination.
   - Client: list + detail snapshots EN/AR, accept/reject mutation rollback, push payload routing.
10. Commit, push, tag `phase-4-complete`.

## Risks / open questions

- Expo push requires running on real devices for full validation; simulators only see local notifications. CI tests use mocked `expo-server-sdk`.
- Real editor app (creating assignments + feedback) is out of scope for MVP. The `/dev/*` endpoints are the seam to be replaced later.
