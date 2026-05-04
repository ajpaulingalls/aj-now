# Phase 7 — Background resumable upload + GPS safety / emergency

## Goal

Two related capabilities:

1. **Background, chunked, resumable media upload** that survives app backgrounding, network drops, and OS-killed processes.
2. **GPS safety:** live location share to the newsroom for the duration of an assignment, periodic check-ins, and a one-tap emergency alert. All of this must work offline-tolerant — alerts queue and transmit when connectivity returns.

## Definition of Done

- Captures with `upload_status='pending'` are uploaded in the background, in chunks, with resume after process restart. Server reassembles and stores the asset; `upload_status` transitions through `uploading → uploaded` (or `failed` with retry policy).
- Network-aware: uploader pauses on no-connectivity / metered-network (configurable) and resumes when conditions return. UI surfaces queue state.
- Reporter can toggle "Share live location" on an active assignment; the server receives a stream of `location_pings` while the toggle is on.
- Reporter can trigger an emergency alert (long-press SOS in the nav bar, with confirmation). Alert payload includes last known GPS, battery, network state. If offline, alert is queued and delivered ASAP, marked `was_offline=true`.
- Periodic check-in: configurable interval (default 30 min during an active "in_progress" assignment) prompts reporter to confirm safety; missed check-ins escalate (server-side flag — escalation UI is post-MVP).

## Stories satisfied

REQ-R290, R300, R430.

### Acceptance criteria

- Killing the app mid-upload and relaunching resumes the same upload from the last completed chunk (no re-upload of completed bytes).
- Toggling airplane mode mid-upload pauses cleanly; restoring connectivity resumes within `≤ 10 s`.
- An emergency alert sent in airplane mode is persisted and delivered within `≤ 30 s` of connectivity returning, with `was_offline=true`.
- Live location updates are throttled (default every 15 s; max every 5 s), and the reporter is given an obvious in-app indicator that location is being shared.

## Data model deltas

```ts
media_uploads {
  id              uuid pk
  media_asset_id  uuid fk -> media_assets.id
  client_uuid     uuid not null
  total_bytes     bigint not null
  chunk_size      int not null
  chunks_total    int not null
  chunks_received int not null default 0
  status          text not null default 'in_progress'  -- in_progress|completed|failed
  storage_key     text                                  -- final key
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
}

media_upload_chunks {
  id              uuid pk
  upload_id       uuid fk -> media_uploads.id
  chunk_index     int not null
  byte_range_start bigint not null
  byte_range_end   bigint not null
  sha256          text not null
  received_at     timestamptz not null default now()
  unique(upload_id, chunk_index)
}

location_shares {
  id              uuid pk
  reporter_id     uuid fk -> reporters.id
  assignment_id   uuid fk -> assignments.id
  started_at      timestamptz not null default now()
  ended_at        timestamptz
}

location_pings {
  id              uuid pk
  share_id        uuid fk -> location_shares.id
  ts              timestamptz not null
  lat             double precision not null
  lon             double precision not null
  accuracy_m      double precision
  battery_pct     int
  network         text
}

safety_checkins {
  id              uuid pk
  reporter_id     uuid fk -> reporters.id
  assignment_id   uuid fk -> assignments.id
  ts              timestamptz not null default now()
  status          text not null   -- 'ok'|'missed'
}

emergency_alerts {
  id              uuid pk
  reporter_id     uuid fk -> reporters.id
  assignment_id   uuid fk -> assignments.id
  triggered_at    timestamptz not null
  received_at     timestamptz not null default now()
  was_offline     boolean not null default false
  lat             double precision
  lon             double precision
  battery_pct     int
  network         text
}
```

## API endpoints (`/v1`)

Uploads:
| Method | Path | Notes |
|---|---|---|
| POST | `/uploads` | start: `{ clientUuid, kind, mimeType, totalBytes, chunkSize, captureAt, gps?, assignmentId?, storyId? }` → returns `{ uploadId, chunksTotal }` |
| PUT | `/uploads/:id/chunks/:index` | binary body; header `content-range`; returns `{ received: n }` |
| POST | `/uploads/:id/complete` | client-asserted finalize; server verifies + writes `media_assets.storage_key` |
| GET | `/uploads/:id` | status incl. `chunks_received` (used for resume) |

Safety:
| Method | Path | Notes |
|---|---|---|
| POST | `/safety/share/start` | `{ assignmentId }` → `{ shareId }` |
| POST | `/safety/share/:id/ping` | `{ ts, lat, lon, accuracy?, battery?, network? }` |
| POST | `/safety/share/:id/end` | |
| POST | `/safety/checkin` | `{ assignmentId, status }` |
| POST | `/safety/emergency` | `{ triggeredAt, lat?, lon?, battery?, network?, wasOffline }` |

## Client surface

- Uploader: a singleton `UploadManager` running on app start. Persists queue in SQLite. Uses `expo-background-fetch` for periodic resume attempts when app is backgrounded; while foregrounded, runs continuously. Each chunk is an HTTPS PUT with the auth header.
- Network awareness via `expo-network`; respects an "uploads on Wi-Fi only" toggle (default off — field reporters often only have cellular).
- Upload tray UI: list of in-flight + queued uploads with progress, retry, cancel.
- Safety UI:
  - SOS button visible on every screen when the reporter has an `in_progress` assignment.
  - "Share location" toggle on assignment detail.
  - Check-in modal driven by a local timer + push.

## Tasks

1. Server: add migrations + endpoints. Implement chunk reassembly to RustFS/S3 using multipart upload (or streamed assemble). Validate chunk SHA, total size, and final SHA against client claim.
2. Client `UploadManager`:
   - Read `captures` rows where `upload_status='pending'`.
   - For each, call `POST /uploads` (idempotent on `clientUuid`), then iterate chunks in order, persisting `chunks_received` locally.
   - On 4xx: mark failed; on 5xx/network: backoff + retry (exponential, capped at 60s).
   - On app cold-start, query `GET /uploads/:id` to get authoritative `chunks_received` before resuming.
3. Background fetch task registered with `expo-background-fetch` to nudge the manager when backgrounded.
4. Safety module: foreground location subscription with throttling; emergency button with persisted offline queue; checkin scheduler.
5. Tests:
   - Upload happy path with deliberate kill-restart between chunks (simulate by clearing in-memory state and reconnecting from disk).
   - Chunk SHA mismatch → server rejects, client retries that chunk.
   - Emergency offline → online persistence + `was_offline=true`.
   - Location-share throttle: server receives no more than 1 ping per ~15 s in default mode.
6. Commit, push, tag `phase-7-complete`.

## Risks / open questions

- True iOS background uploads ideally use `URLSession` background tasks; that requires a custom native module beyond `expo-background-fetch`. For MVP, document the limitation: uploads continue while the app is foregrounded or in the background-fetch window; long uploads may need the user to keep the app open.
- Battery impact of continuous location share is significant. Default cadence is 15 s; expose this as a setting.
- Emergency alert deliverability through push to the newsroom is out of scope for the Reporter App; the server records it and the future Editor app surfaces it.
