# Phase 5 — Multi-modal capture, GPS metadata, offline-first

## Goal

Give the reporter a single in-app surface to capture broadcast-quality video, hi-fi audio, and hi-res images, with everything saved to the device first (works fully offline), GPS-stamped at capture time, and surfaced into a local "captures" library that will later attach to stories (Phase 6). Add an offline content cache for assignment briefs, drafts, and reference content.

## Definition of Done

- Capture screen with three modes — Video / Audio / Image — accessible from the assignment detail screen and from the bottom tab.
- Captures are written to encrypted on-device storage, registered in a local `captures` SQLite table with a `client_uuid`, and visible immediately in a Captures library view.
- Each capture row has GPS lat/lon/accuracy if a fix was available within a configurable window (default 30 s), else `null` — capture never blocks on GPS.
- Airplane-mode test: capture works, GPS is recorded if cached, brief and any draft for the active assignment are still readable.
- A foreground sync engine reconciles `captures` and `drafts` to the server when connectivity returns. (Background upload of the actual media bytes is Phase 7.)

## Stories satisfied

REQ-R230, R240, R250, R260, R280, R390, R400.

### Acceptance criteria

- Video: H.264/AAC MP4, default 1080p30, capped configurable bitrate (≥10 Mbps for "broadcast quality" target).
- Audio: AAC or WAV at ≥48 kHz, mono or stereo selectable.
- Image: JPEG (camera native) at full sensor resolution.
- All captures land in a per-app encrypted directory (iOS: app sandbox + `NSFileProtectionCompleteUntilFirstUserAuthentication`; Android: `EncryptedFile` via Jetpack Security or app-private storage on FBE devices).
- Offline: brief MD, all reference URLs (cached body via `expo-file-system`), and any local draft for an assignment are readable when device is offline.

## Data model deltas

Server-side: none new (captures register into existing `media_assets` once they reach the server in Phase 7; until then, storage_key is null and `upload_status='pending'`).

Client-side SQLite (via `expo-sqlite`):

```sql
CREATE TABLE captures (
  client_uuid TEXT PRIMARY KEY,
  kind TEXT NOT NULL,          -- video|audio|image
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  duration_ms INTEGER,
  capture_at TEXT NOT NULL,    -- ISO
  gps_lat REAL,
  gps_lon REAL,
  gps_accuracy_m REAL,
  local_uri TEXT NOT NULL,
  assignment_id TEXT,
  story_id TEXT,
  upload_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE offline_briefs (
  assignment_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE offline_references (
  url TEXT PRIMARY KEY,
  local_path TEXT NOT NULL,
  content_type TEXT,
  fetched_at TEXT NOT NULL
);

CREATE TABLE drafts (
  story_id TEXT PRIMARY KEY,           -- client-generated for new
  payload_json TEXT NOT NULL,          -- {title, body_md, template_key, attached_capture_uuids[]}
  dirty INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
```

## Modules

```
apps/reporter/src/capture/
├── CameraScreen.tsx              # video + image
├── AudioRecorderScreen.tsx
├── CapturesLibrary.tsx
├── useCapture.ts                 # writes to FS + SQLite
├── gps.ts                        # foreground location, cached fix policy
└── encryption.ts                 # platform-aware file protection helpers

apps/reporter/src/offline/
├── briefCache.ts
├── referenceCache.ts
└── syncEngine.ts                 # connectivity listener; reconciles drafts metadata
```

Libraries: `expo-camera`, `expo-av` (or `expo-audio` if migrated), `expo-image-picker` for fallback, `expo-file-system`, `expo-location`, `expo-network`, `expo-sqlite`. For encrypted storage on Android use `expo-secure-store` for the key, then a small native module (or `expo-file-system` + AES-GCM via `react-native-aes-crypto`) — choose the simplest path that meets the at-rest requirement; document the choice.

## Tasks

1. Drizzle no-op migration; client SQLite migrations script in `apps/reporter/src/db/migrations.ts`.
2. Implement `gps.ts`:
   - Request `Location.getForegroundPermissionsAsync` on first use.
   - Maintain a cached "last good fix" with timestamp + accuracy.
   - `getFixForCapture()` returns the cached fix if `< 30 s` old and accuracy `< 50 m`, else triggers a fresh `getCurrentPositionAsync({ accuracy: High })` with a 5-second timeout. Never blocks capture longer than that.
   - Works offline (Location does not need network on either platform).
3. Camera screen: video recording (start/stop, max duration cap configurable), still capture, mic permission handling. Uses `expo-camera`.
4. Audio recorder screen: start/stop, level meter, save to file.
5. On capture finish:
   - Move file into the app's encrypted dir.
   - Insert SQLite row with `client_uuid`.
   - Fire-and-forget GPS attach.
   - Toast "Saved offline" if `expo-network` reports no connectivity.
6. Captures Library: grid of thumbnails (video + image), audio shown as cards with duration and waveform stub. Filter by assignment.
7. Offline brief cache: when an assignment detail is fetched, write `offline_briefs` row. The detail screen reads from cache first, then refreshes from network.
8. Offline reference cache: when a brief is opened, fetch + cache referenced URL bodies (size cap, e.g. 10 MB total per assignment, oldest evicted).
9. Sync engine: subscribes to `expo-network` state changes; when online, marks capture rows as ready for the Phase-7 uploader and pushes any dirty `drafts` (metadata only) to the server.
10. Tests:
    - `gps.ts` policy tests.
    - SQLite migration test (open + verify tables).
    - Captures Library snapshot, EN + AR.
    - Sync engine: simulate offline → online → drafts marked `dirty=0`.
11. Commit, push, tag `phase-5-complete`.

## Risks / open questions

- True "broadcast-quality" video capture varies by device. Document the encoder settings actually used and known device caps.
- Encryption-at-rest on Android without ejecting Expo: the simplest robust path is to keep captures in app-private storage (already FBE-encrypted on modern Android) and rely on the OS guarantee, while encrypting any *exported* manifests with a key from `expo-secure-store`. Be explicit about this trade-off in the README.
- `expo-av` is being split into `expo-audio` + `expo-video`; pick the version that matches the SDK in use and pin it.
