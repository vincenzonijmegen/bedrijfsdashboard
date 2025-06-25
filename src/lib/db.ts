// lib/db.ts
import { Pool } from "pg";

import postgres from "postgres";
export const sql = postgres(process.env.DATABASE_URL!);



const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export const db = {
query: (text: string, params: unknown[] = []) => pool.query(text, params),
};
