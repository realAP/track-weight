import { pool } from "./client";

export async function runMigrations(): Promise<void> {
  // Migration tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Base schema
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS weight_entries (
      id SERIAL PRIMARY KEY,
      telegram_user_id BIGINT NOT NULL REFERENCES users(telegram_id),
      chat_id BIGINT NOT NULL,
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

  // Run versioned migrations
  await runVersionedMigrations();

  console.log("Database migrations completed.");
}

interface Migration {
  name: string;
  up: string;
}

const migrations: Migration[] = [
  // Future migrations go here, e.g.:
  // {
  //   name: "002_add_goal_weight",
  //   up: `ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_kg NUMERIC(5,2);`,
  // },
];

async function runVersionedMigrations(): Promise<void> {
  for (const migration of migrations) {
    const result = await pool.query(
      `SELECT 1 FROM migrations WHERE name = $1`,
      [migration.name]
    );

    if (result.rows.length === 0) {
      console.log(`Running migration: ${migration.name}`);
      await pool.query(migration.up);
      await pool.query(
        `INSERT INTO migrations (name) VALUES ($1)`,
        [migration.name]
      );
    }
  }
}
