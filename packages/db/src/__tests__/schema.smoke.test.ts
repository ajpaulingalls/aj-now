import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createClient, type DbClient } from '../client';
import { runMigrations } from '../migrate';
import { reporters } from '../schema/reporters';
import { media_assets } from '../schema/media';

describe('@aj-now/db schema smoke', () => {
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

  it('migrations apply cleanly (idempotent re-run)', async () => {
    await expect(runMigrations(container.getConnectionUri())).resolves.toBeUndefined();
  });

  it('inserts and selects a reporter', async () => {
    const [inserted] = await client.db
      .insert(reporters)
      .values({
        email: 'alice@example.com',
        full_name: 'Alice Reporter',
        preferred_lang: 'en',
      })
      .returning();
    expect(inserted).toBeDefined();
    expect(inserted!.email).toBe('alice@example.com');

    const all = await client.db.select().from(reporters);
    expect(all).toHaveLength(1);
    expect(all[0]!.full_name).toBe('Alice Reporter');
  });

  it('rejects duplicate client_uuid in media_assets', async () => {
    const [reporter] = await client.db
      .insert(reporters)
      .values({ email: 'bob@example.com', full_name: 'Bob' })
      .returning();
    const sameClientUuid = '11111111-1111-1111-1111-111111111111';
    await client.db.insert(media_assets).values({
      reporter_id: reporter!.id,
      kind: 'image',
      mime_type: 'image/jpeg',
      capture_at: new Date(),
      client_uuid: sameClientUuid,
    });
    await expect(
      client.db.insert(media_assets).values({
        reporter_id: reporter!.id,
        kind: 'image',
        mime_type: 'image/jpeg',
        capture_at: new Date(),
        client_uuid: sameClientUuid,
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
