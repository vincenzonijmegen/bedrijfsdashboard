import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __dbRapportage: Pool | undefined;
}

// Gebruik 1 gedeelde pool (serverless warm invocations hergebruiken deze)
export const dbRapportage: Pool =
  global.__dbRapportage ??
  new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, // kies jouw var
    ssl: { rejectUnauthorized: true },
    max: 5,                   // genoeg voor serverless
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,          // ⬅️ belangrijk tegen idle disconnects
  });

if (!global.__dbRapportage) global.__dbRapportage = dbRapportage;
