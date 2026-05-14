import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { assignments } from './assignments';
import { createdAt, primaryId, updatedAt } from './columns';
import { reporters } from './reporters';

export const stories = pgTable('stories', {
  id: primaryId(),
  assignment_id: uuid('assignment_id').references(() => assignments.id),
  reporter_id: uuid('reporter_id')
    .notNull()
    .references(() => reporters.id),
  template_key: text('template_key').notNull(),
  title: text('title').notNull().default(''),
  body_md: text('body_md').notNull().default(''),
  status: text('status').notNull().default('draft'),
  current_version: integer('current_version').notNull().default(1),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const story_versions = pgTable(
  'story_versions',
  {
    id: primaryId(),
    story_id: uuid('story_id').references(() => stories.id),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    body_md: text('body_md').notNull(),
    created_at: createdAt(),
  },
  (t) => [unique('story_versions_story_version_uniq').on(t.story_id, t.version)],
);

export const editor_feedback = pgTable('editor_feedback', {
  id: primaryId(),
  story_id: uuid('story_id').references(() => stories.id),
  editor_id: uuid('editor_id').notNull(),
  body_md: text('body_md').notNull(),
  created_at: createdAt(),
});
