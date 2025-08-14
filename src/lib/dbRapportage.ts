// src/lib/dbRapportage.ts
import { Pool } from "pg";

declare global { var __dbRapportage: Pool | undefined; }

export const dbRapportage: Pool =
  global.__dbRapportage ??
  new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    // ⬇️ stuur keep-alive meteen; helpt tegen handshake-kosten bij “half-warme” invocations
    keepAliveInitialDelayMillis: 0,
  });

if (!global.__dbRapportage) global.__dbRapportage = dbRapportage;
