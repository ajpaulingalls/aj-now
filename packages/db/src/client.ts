import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema/index';

export type DbClient = {
  db: PostgresJsDatabase<typeof schema>;
  sql: Sql;
};

export function createClient(databaseUrl: string): DbClient {
  const sql = postgres(databaseUrl);
  const db = drizzle(sql, { schema });
  return { db, sql };
}
