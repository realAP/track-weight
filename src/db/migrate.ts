import { pool } from "./client";

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS weight_entries (
      id SERIAL PRIMARY KEY,
      telegram_user_id BIGINT NOT NULL REFERENCES users(telegram_id),
      chat_id BIGINT NOT NULL DEFAULT 0,
      weight_kg NUMERIC(5,2) NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS group_settings (
      chat_id BIGINT PRIMARY KEY,
      reminder_days TEXT,
      reminder_time TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Add chat_id column to existing weight_entries tables
  await pool.query(`
    ALTER TABLE weight_entries ADD COLUMN IF NOT EXISTS chat_id BIGINT NOT NULL DEFAULT 0;
  `);

  console.log("Database migrations completed.");
}
