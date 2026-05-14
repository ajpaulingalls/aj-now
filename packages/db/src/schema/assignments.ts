import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId } from './columns';
import { reporters } from './reporters';

export const assignments = pgTable('assignments', {
  id: primaryId(),
  title: text('title').notNull(),
  brief_md: text('brief_md').notNull(),
  reference_urls: jsonb('reference_urls').notNull().default(sql`'[]'::jsonb`),
  is_open_pool: boolean('is_open_pool').notNull().default(false),
  priority: text('priority').notNull().default('normal'),
  created_by: uuid('created_by').notNull(),
  created_at: createdAt(),
});

export const assignment_recipients = pgTable(
  'assignment_recipients',
  {
    id: primaryId(),
    assignment_id: uuid('assignment_id').references(() => assignments.id),
    reporter_id: uuid('reporter_id').references(() => reporters.id),
    status: text('status').notNull().default('pending'),
    status_changed_at: timestamp('status_changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('assignment_recipients_assignment_reporter_uniq').on(t.assignment_id, t.reporter_id)],
);
