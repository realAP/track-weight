import { pool } from "./client";

// --- Users ---

export async function upsertUser(telegramId: number, displayName: string): Promise<void> {
  await pool.query(
    `INSERT INTO users (telegram_id, display_name)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET display_name = $2`,
    [telegramId, displayName]
  );
}

export async function getUser(telegramId: number) {
  const result = await pool.query(
    `SELECT telegram_id, display_name FROM users WHERE telegram_id = $1`,
    [telegramId]
  );
  return result.rows[0] ?? null;
}

// --- Weight Entries ---

export interface WeightEntry {
  id: number;
  telegram_user_id: number;
  weight_kg: number;
  recorded_at: Date;
  display_name: string;
}

export async function addWeightEntry(
  telegramUserId: number,
  weightKg: number,
  recordedAt?: Date
): Promise<WeightEntry> {
  const result = await pool.query(
    `INSERT INTO weight_entries (telegram_user_id, weight_kg, recorded_at)
     VALUES ($1, $2, $3)
     RETURNING id, telegram_user_id, weight_kg, recorded_at`,
    [telegramUserId, weightKg, recordedAt ?? new Date()]
  );
  return result.rows[0];
}

export async function getRecentEntries(limit = 10): Promise<WeightEntry[]> {
  const result = await pool.query(
    `SELECT w.id, w.telegram_user_id, w.weight_kg, w.recorded_at, u.display_name
     FROM weight_entries w
     JOIN users u ON u.telegram_id = w.telegram_user_id
     ORDER BY w.recorded_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getUserEntries(telegramUserId: number, limit = 10): Promise<WeightEntry[]> {
  const result = await pool.query(
    `SELECT w.id, w.telegram_user_id, w.weight_kg, w.recorded_at, u.display_name
     FROM weight_entries w
     JOIN users u ON u.telegram_id = w.telegram_user_id
     WHERE w.telegram_user_id = $1
     ORDER BY w.recorded_at DESC
     LIMIT $2`,
    [telegramUserId, limit]
  );
  return result.rows;
}

export async function getEntryById(id: number): Promise<WeightEntry | null> {
  const result = await pool.query(
    `SELECT w.id, w.telegram_user_id, w.weight_kg, w.recorded_at, u.display_name
     FROM weight_entries w
     JOIN users u ON u.telegram_id = w.telegram_user_id
     WHERE w.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateWeightEntry(id: number, weightKg: number): Promise<void> {
  await pool.query(
    `UPDATE weight_entries SET weight_kg = $2, updated_at = NOW() WHERE id = $1`,
    [id, weightKg]
  );
}

export async function deleteWeightEntry(id: number): Promise<void> {
  await pool.query(`DELETE FROM weight_entries WHERE id = $1`, [id]);
}

export async function getEntriesInRange(
  since: Date,
  until?: Date
): Promise<WeightEntry[]> {
  const result = await pool.query(
    `SELECT w.id, w.telegram_user_id, w.weight_kg, w.recorded_at, u.display_name
     FROM weight_entries w
     JOIN users u ON u.telegram_id = w.telegram_user_id
     WHERE w.recorded_at >= $1 AND ($2::timestamptz IS NULL OR w.recorded_at <= $2)
     ORDER BY w.recorded_at ASC`,
    [since, until ?? null]
  );
  return result.rows;
}

export async function getAllEntries(): Promise<WeightEntry[]> {
  const result = await pool.query(
    `SELECT w.id, w.telegram_user_id, w.weight_kg, w.recorded_at, u.display_name
     FROM weight_entries w
     JOIN users u ON u.telegram_id = w.telegram_user_id
     ORDER BY w.recorded_at ASC`
  );
  return result.rows;
}

export async function getUserEntriesInRange(
  telegramUserId: number,
  since: Date
): Promise<WeightEntry[]> {
  const result = await pool.query(
    `SELECT w.id, w.telegram_user_id, w.weight_kg, w.recorded_at, u.display_name
     FROM weight_entries w
     JOIN users u ON u.telegram_id = w.telegram_user_id
     WHERE w.telegram_user_id = $1 AND w.recorded_at >= $2
     ORDER BY w.recorded_at ASC`,
    [telegramUserId, since]
  );
  return result.rows;
}

export async function getUserAllEntries(
  telegramUserId: number
): Promise<WeightEntry[]> {
  const result = await pool.query(
    `SELECT w.id, w.telegram_user_id, w.weight_kg, w.recorded_at, u.display_name
     FROM weight_entries w
     JOIN users u ON u.telegram_id = w.telegram_user_id
     WHERE w.telegram_user_id = $1
     ORDER BY w.recorded_at ASC`,
    [telegramUserId]
  );
  return result.rows;
}

// --- Group Settings ---

export interface GroupSettings {
  chat_id: number;
  reminder_days: string | null;
  reminder_time: string | null;
}

export async function getGroupSettings(chatId: number): Promise<GroupSettings | null> {
  const result = await pool.query(
    `SELECT chat_id, reminder_days, reminder_time FROM group_settings WHERE chat_id = $1`,
    [chatId]
  );
  return result.rows[0] ?? null;
}

export async function upsertGroupSettings(
  chatId: number,
  reminderDays: string | null,
  reminderTime: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO group_settings (chat_id, reminder_days, reminder_time)
     VALUES ($1, $2, $3)
     ON CONFLICT (chat_id) DO UPDATE SET reminder_days = $2, reminder_time = $3`,
    [chatId, reminderDays, reminderTime]
  );
}

export async function getAllGroupSettings(): Promise<GroupSettings[]> {
  const result = await pool.query(
    `SELECT chat_id, reminder_days, reminder_time FROM group_settings
     WHERE reminder_days IS NOT NULL AND reminder_time IS NOT NULL`
  );
  return result.rows;
}

export async function getUsersWhoLoggedSince(since: Date): Promise<number[]> {
  const result = await pool.query(
    `SELECT DISTINCT telegram_user_id FROM weight_entries WHERE recorded_at >= $1`,
    [since]
  );
  return result.rows.map((r: { telegram_user_id: number }) => r.telegram_user_id);
}

export async function getAllUsersInGroup(): Promise<{ telegram_id: number; display_name: string }[]> {
  const result = await pool.query(`SELECT telegram_id, display_name FROM users`);
  return result.rows;
}
