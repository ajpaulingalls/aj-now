import { bigint, doublePrecision, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { assignments } from './assignments';
import { createdAt, primaryId } from './columns';
import { reporters } from './reporters';
import { stories } from './stories';

// NOTE: client_uuid intentionally lacks .unique() in the v0 baseline migration.
// Story-002 commit 2 adds the unique constraint via a 0001 append-only migration,
// driven by a true RED→GREEN cycle on the duplicate-insert assertion.
export const media_assets = pgTable('media_assets', {
  id: primaryId(),
  reporter_id: uuid('reporter_id').references(() => reporters.id),
  story_id: uuid('story_id').references(() => stories.id),
  assignment_id: uuid('assignment_id').references(() => assignments.id),
  kind: text('kind').notNull(),
  mime_type: text('mime_type').notNull(),
  byte_size: bigint('byte_size', { mode: 'number' }),
  duration_ms: integer('duration_ms'),
  capture_at: timestamp('capture_at', { withTimezone: true }).notNull(),
  gps_lat: doublePrecision('gps_lat'),
  gps_lon: doublePrecision('gps_lon'),
  gps_accuracy_m: doublePrecision('gps_accuracy_m'),
  storage_key: text('storage_key'),
  upload_status: text('upload_status').notNull().default('pending'),
  client_uuid: uuid('client_uuid').notNull(),
  created_at: createdAt(),
});
