import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __dbRapportage: Pool | undefined;
}

export const dbRapportage: Pool =
  global.__dbRapportage ??
  new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // ← accepteer zelfondertekend cert
    },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
  });

if (!global.__dbRapportage) global.__dbRapportage = dbRapportage;
