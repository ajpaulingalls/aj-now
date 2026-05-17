#!/usr/bin/env bun
import { createClient, seedDemo } from '@aj-now/db';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Aborting seed.');
  process.exit(1);
}

const client = createClient(databaseUrl);
try {
  const report = await seedDemo(client);
  console.log('Seeded demo data:', report);
} finally {
  await client.close();
}
