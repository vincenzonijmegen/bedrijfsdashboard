import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export const db = {
  query: (text: string, params: any[] = []) => pool.query(text, params),
};
