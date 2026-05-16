import { sql } from 'drizzle-orm';
import { doublePrecision, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId } from './columns';
import { reporters } from './reporters';

export const news_event_proposals = pgTable('news_event_proposals', {
  id: primaryId(),
  reporter_id: uuid('reporter_id').references(() => reporters.id),
  title: text('title').notNull(),
  description_md: text('description_md').notNull(),
  gps_lat: doublePrecision('gps_lat'),
  gps_lon: doublePrecision('gps_lon'),
  status: text('status').notNull().default('submitted'),
  created_at: createdAt(),
});

export const audit_log = pgTable('audit_log', {
  id: primaryId(),
  actor_id: uuid('actor_id'),
  action: text('action').notNull(),
  target_type: text('target_type'),
  target_id: uuid('target_id'),
  details: jsonb('details').notNull().default(sql`'{}'::jsonb`),
  created_at: createdAt(),
});
