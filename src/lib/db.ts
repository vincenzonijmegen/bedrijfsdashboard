// src/lib/db.ts
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

declare global {
  // voorkom meerdere pools bij hot-reload in dev
  // eslint-disable-next-line no-var
  var __PG_POOL__: Pool | undefined;
}

const pool: Pool =
  global.__PG_POOL__ ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') {
  global.__PG_POOL__ = pool;
}

// Losse query helper
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

// Client voor transacties
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

// desnoods exporteer de pool ook
export { pool };
