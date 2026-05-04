# Phase 6 — Story drafting, templates, submission, biometric step-up, AI proof stub

## Goal

Let the reporter compose, version, and submit stories from templates, with media captures embedded, with the right authentication ceremony at submit time, and with an AI proofreading hook stubbed behind a feature flag.

## Definition of Done

- Reporter can create a draft from a template, edit title + body (rich text → Markdown), embed captures from the local Captures library, save (auto-saves to local SQLite + syncs metadata to server), and submit.
- Submission rules:
  - `priority='normal'` → standard submission, valid (email-code) session is sufficient (REQ-R380).
  - `priority='breaking'` or `priority='sensitive'` (or template = `breaking`) → biometric step-up required at submit time, recorded server-side.
- Drafts are versioned: every successful save creates a new `story_versions` row server-side and bumps `current_version`.
- AI proofreading: a "Check style" button calls `/v1/stories/:id/proofread` which returns a stubbed result (`{ suggestions: [...] }`); the client renders inline suggestion chips. Feature gated by `EXPO_PUBLIC_FEATURE_AI_PROOF=true`.
- Reporter can view editor feedback inline on a previously submitted story (extends Phase 4 history).

## Stories satisfied

REQ-R220 (stub), REQ-R340, REQ-R380, REQ-R190 (feedback inline), reinforcement of REQ-R510 (drafts encrypted at rest).

### Acceptance criteria

- Submitting a `breaking` template without successful biometric within the last 60 seconds returns `403 step_up_required`.
- After a successful step-up, an `auth.stepup` audit row is written and linked to the submission.
- Drafts cannot be deleted; they can be archived (status `archived`).
- Markdown round-trip: editor → MD → preview is loss-free for the supported subset (headings, bold, italic, lists, blockquote, links, embedded media tokens).
- Embedded media tokens take the form `![media:<client_uuid>]` in MD; the renderer resolves them to local URIs (offline) or the server URL (after upload).

## Data model deltas

```ts
story_submissions {
  id              uuid pk
  story_id        uuid fk -> stories.id
  version         int not null
  submitted_by    uuid fk -> reporters.id
  submitted_at    timestamptz not null default now()
  auth_method     text not null      // 'session' | 'biometric'
  stepup_event_id uuid               // FK to audit_log.id when biometric
  priority        text not null      // 'normal' | 'breaking' | 'sensitive'
}

story_templates {
  key             text pk             // 'standard'|'breaking'|'feature'
  name_en         text not null
  name_ar         text not null
  body_md         text not null       // template body
  default_priority text not null default 'normal'
}
```

Seed three templates.

## API endpoints (`/v1`)

| Method | Path | Notes |
|---|---|---|
| GET | `/story-templates` | list |
| POST | `/stories` | create draft `{ assignmentId?, templateKey }` |
| GET | `/stories/:id` | full incl. current version |
| PATCH | `/stories/:id` | save: `{ title, body_md, attachedClientUuids[] }` → bumps version |
| POST | `/stories/:id/submit` | `{ priority, authMethod, stepupNonce? }` |
| POST | `/stories/:id/proofread` | stub returns `{ suggestions: [{range, message, replacement?}] }` |
| GET | `/stories/:id/feedback` | list editor feedback |

Step-up flow:
1. Client decides "breaking" → calls `POST /v1/auth/stepup/start` → server returns a `stepupNonce` valid 90 s.
2. Client performs `LocalAuthentication.authenticateAsync({ promptMessage })`.
3. Client calls `/stories/:id/submit` with the nonce + `authMethod='biometric'`.
4. Server consumes the nonce (single-use), writes audit row, links it.

## Client surface

- New tab `Drafts` (or merged into Assignments view).
- `editor/[storyId].tsx`: split toolbar (template picker on create, then title input, body editor, attach-media drawer pulling from Captures Library, "Preview", "Save", "Submit").
- Editor: `@10play/tentap-editor` or `react-native-pell-rich-editor` — pick the one that ships MD output cleanly. Document the choice.
- Submit button modal: shows priority badge; if breaking/sensitive, prompts biometric and disables submit on failure.
- Proofread results panel (RTL-safe).

## Tasks

1. Drizzle migrations + seed templates.
2. API endpoints + Zod + tests, including step-up nonce store (in-memory with TTL is fine for MVP; document upgrade to Redis later).
3. Editor screen with template loader, save (debounced 1s), and submit flows.
4. Embedded media token resolver (Markdown renderer plugin).
5. Proofread stub: returns 1–2 fake suggestions (`{ range:[12,18], message:"Consider 'said' instead of 'stated'", replacement:'said' }`) so UI is testable.
6. Biometric step-up integration with `expo-local-authentication`.
7. Tests:
   - Submission of `breaking` without nonce → 403.
   - Successful step-up flow records audit row.
   - Versioning: 3 saves → version=3, 3 `story_versions` rows.
   - Markdown media token resolution online vs offline.
8. Commit, push, tag `phase-6-complete`.

## Risks / open questions

- Real proofreading model selection is out of scope. The contract is intentionally narrow (`suggestions[]`) so a real backend can drop in later.
- Rich-text → Markdown round-tripping is the most common bug source; lock down a subset and reject everything else at editor input level.
