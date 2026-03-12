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

  console.log("Database migrations completed.");
}
