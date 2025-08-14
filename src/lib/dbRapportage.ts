import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __dbRapportage: Pool | undefined;
}

// Gebruik 1 gedeelde pool (serverless warm invocations hergebruiken deze)
export const dbRapportage: Pool =
  global.__dbRapportage ??
  new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // tijdelijk op false
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });
if (!global.__dbRapportage) global.__dbRapportage = dbRapportage;
