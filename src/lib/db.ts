import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

declare global {
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export { pool };

/** Backwards-compatible wrapper so old code keeps working */
export interface DB {
  query: typeof query;
  getClient: typeof getClient;
  pool: Pool;
}
export const db: DB = { query, getClient, pool };
