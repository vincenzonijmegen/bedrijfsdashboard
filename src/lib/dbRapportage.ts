// Bestand: src/lib/dbRapportage.ts

import { Pool } from 'pg';

// Toekomstbestendige opzet: hier zou je later de replica-URL kunnen invoegen
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_RAPPORTAGE || process.env.DATABASE_URL,
});

export const dbRapportage = {
  query: (text: string, params?: any[]) => pool.query(text, params),
};
