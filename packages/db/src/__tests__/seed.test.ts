import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import { createClient, type DbClient } from '../client';
import { runMigrations } from '../migrate';
import { isSeeded, seedDemo } from '../seed';
import { reporters } from '../schema/reporters';
import { assignments, assignment_recipients } from '../schema/assignments';
import { stories } from '../schema/stories';

describe('@aj-now/db seed', () => {
  let container: StartedPostgreSqlContainer;
  let client: DbClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16').start();
    client = createClient(container.getConnectionUri());
    await runMigrations(container.getConnectionUri());
  });

  afterAll(async () => {
    await client.close();
    await container.stop();
  });

  beforeEach(async () => {
    const tables = await client.sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '__drizzle_migrations'`;
    if (tables.length === 0) return;
    const list = tables.map((r) => `"${r.tablename}"`).join(', ');
    await client.sql.unsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  });

  it('isSeeded returns false on a fresh database', async () => {
    expect(await isSeeded(client)).toBe(false);
  });

  it('seedDemo inserts 3 reporters with the expected preferred_lang distribution', async () => {
    await seedDemo(client);

    const all = await client.db.select().from(reporters);
    expect(all).toHaveLength(3);

    const langs = all.map((r) => r.preferred_lang).sort();
    expect(langs).toEqual(['ar', 'en', 'en']);

    const bilingual = all.find((r) => r.languages.length === 2);
    expect(bilingual).toBeDefined();
    expect(bilingual!.languages.sort()).toEqual(['ar', 'en']);
  });

  it('seedDemo inserts 1 open-pool and 1 directly-assigned assignment', async () => {
    await seedDemo(client);

    const allAssignments = await client.db.select().from(assignments);
    expect(allAssignments).toHaveLength(2);

    const openPool = allAssignments.filter((a) => a.is_open_pool);
    const direct = allAssignments.filter((a) => !a.is_open_pool);
    expect(openPool).toHaveLength(1);
    expect(direct).toHaveLength(1);

    const openPoolRecipients = await client.db
      .select()
      .from(assignment_recipients)
      .where(eq(assignment_recipients.assignment_id, openPool[0]!.id));
    expect(openPoolRecipients).toHaveLength(0);

    const directRecipients = await client.db
      .select()
      .from(assignment_recipients)
      .where(eq(assignment_recipients.assignment_id, direct[0]!.id));
    expect(directRecipients).toHaveLength(1);
  });

  it('seedDemo inserts 3 stories with distinct template_key values', async () => {
    await seedDemo(client);

    const allStories = await client.db.select().from(stories);
    expect(allStories).toHaveLength(3);

    const keys = allStories.map((s) => s.template_key).sort();
    expect(new Set(keys).size).toBe(3);

    for (const s of allStories) {
      expect(s.status).toBe('draft');
    }
  });

  it('isSeeded returns true after seedDemo', async () => {
    await seedDemo(client);
    expect(await isSeeded(client)).toBe(true);
  });

  it('seedDemo throws "already seeded" on a populated database without inserting new rows', async () => {
    await seedDemo(client);
    const before = await client.db.select().from(reporters);

    await expect(seedDemo(client)).rejects.toThrow(/already seeded/i);

    const after = await client.db.select().from(reporters);
    expect(after).toHaveLength(before.length);
  });
});
