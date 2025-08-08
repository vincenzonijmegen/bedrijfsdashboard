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

// Strakke, getypeerde helper voor nieuwe code
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

// Client voor transacties (BEGIN/COMMIT)
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export { pool };

/* ------------------------------------------------------------------ */
/* Backwards-compatible wrapper zodat legacy code niets hoeft te wijzigen */
/* ------------------------------------------------------------------ */

type LooseQueryResult = Promise<
  Pick<QueryResult<any>, 'rowCount' | 'command' | 'oid' | 'fields'> & { rows: any[] }
>;

// Los getypeerde query: gedraagt zich als “oude” db.query (rows: any[])
const legacyQuery = (text: string, params: any[] = []): LooseQueryResult => {
  return query<any>(text, params) as unknown as LooseQueryResult;
};

// Exporteer een db-wrapper met losse typing voor .query,
// plus getClient en pool voor wie het nodig heeft.
export const db = {
  query: legacyQuery,
  getClient,
  pool,
};
