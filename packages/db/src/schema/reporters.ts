import { sql } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, updatedAt } from './columns';

export const reporters = pgTable('reporters', {
  id: primaryId(),
  external_id: text('external_id').unique(),
  email: text('email').unique().notNull(),
  full_name: text('full_name').notNull(),
  preferred_lang: text('preferred_lang').notNull().default('en'),
  skills: text('skills').array().notNull().default(sql`'{}'`),
  languages: text('languages').array().notNull().default(sql`'{}'`),
  expertise: text('expertise').array().notNull().default(sql`'{}'`),
  device_pubkey: text('device_pubkey'),
  created_at: createdAt(),
  updated_at: updatedAt(),
});
