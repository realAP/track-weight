import { Context } from "grammy";
import { getEntryById, updateWeightEntry, getUserEntriesPaginated, getUserEntryCount } from "../db/queries";
import { parseWeight, formatWeight, formatDateTime } from "../utils/format";
import { logger } from "../utils/logger";
import { buildEditKeyboard } from "../commands/edit";

const PAGE_SIZE = 5;

// Track users who are currently editing an entry (auto-expires after 5 minutes)
const pendingEdits = new Map<number, { entryId: number; expiresAt: number }>(); // telegramUserId -> edit state

const PENDING_TTL_MS = 5 * 60 * 1000;

function cleanExpiredEdits(): void {
  const now = Date.now();
  for (const [key, val] of pendingEdits) {
    if (now > val.expiresAt) pendingEdits.delete(key);
  }
}

export async function handleEditCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  if (!data || !userId) return;

  const entryId = parseInt(data.replace("edit:", ""), 10);
  if (isNaN(entryId)) return;

  const entry = await getEntryById(entryId);
  if (!entry) {
    await ctx.answerCallbackQuery({ text: "Eintrag nicht gefunden." });
    return;
  }

  if (Number(entry.telegram_user_id) !== userId) {
    await ctx.answerCallbackQuery({ text: "Das ist nicht dein Eintrag." });
    return;
  }

  cleanExpiredEdits();
  pendingEdits.set(userId, { entryId, expiresAt: Date.now() + PENDING_TTL_MS });
  logger.info(`User ${userId} started editing entry ${entryId}, pendingEdits size: ${pendingEdits.size}`);

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `Bearbeite: ${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)})\n\nNeues Gewicht eingeben:`,
    { reply_markup: { force_reply: true } }
  );
}

export async function handleEditMessage(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return false;

  cleanExpiredEdits();
  const pending = pendingEdits.get(userId);
  if (pending === undefined) return false;
  const entryId = pending.entryId;

  logger.info(`Edit mode active for user ${userId}, entry ${entryId}, input: "${text}"`);

  const weight = parseWeight(text);
  if (weight === null) {
    await ctx.reply("Ungültiges Gewicht. Bitte eine Zahl eingeben oder /cancel zum Abbrechen.", {
      reply_markup: { force_reply: true },
    });
    return true;
  }

  const entry = await getEntryById(entryId);
  if (!entry) {
    pendingEdits.delete(userId);
    await ctx.reply("Eintrag nicht mehr vorhanden.");
    return true;
  }

  try {
    await updateWeightEntry(entryId, weight);
    pendingEdits.delete(userId);

    await ctx.reply(
      `✏️ Aktualisiert: ${formatWeight(entry.weight_kg)} → ${formatWeight(weight)}`
    );

    // Edit original bot reply to show updated weight
    if (entry.bot_message_id && entry.chat_id) {
      try {
        await ctx.api.editMessageText(
          entry.chat_id,
          entry.bot_message_id,
          `✏️ <s>${formatWeight(entry.weight_kg)}</s> → ${formatWeight(weight)}`,
          { parse_mode: "HTML" }
        );
      } catch {
        logger.warn(`Could not edit bot reply for entry ${entryId}`);
      }
    }
  } catch (err) {
    logger.error(`Failed to update entry ${entryId}:`, err);
    pendingEdits.delete(userId);
    await ctx.reply("Fehler beim Aktualisieren. Bitte versuche es erneut.");
  }

  return true;
}

export function cancelEdit(userId: number): boolean {
  return pendingEdits.delete(userId);
}

export async function handleEditPageCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const callerId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!data || !callerId || !chatId) return;

  const parts = data.split(":");
  if (parts.length !== 3) {
    await ctx.answerCallbackQuery({ text: "Ungültige Aktion" });
    return;
  }

  const ownerId = parseInt(parts[1]);
  const page = parseInt(parts[2]);

  if (callerId !== ownerId) {
    await ctx.answerCallbackQuery({
      text: "Nur wer /edit aufgerufen hat kann die Buttons nutzen.",
      show_alert: true,
    });
    return;
  }

  const totalCount = await getUserEntryCount(ownerId, chatId);
  const offset = page * PAGE_SIZE;
  const entries = await getUserEntriesPaginated(ownerId, chatId, PAGE_SIZE, offset);

  if (entries.length === 0) {
    await ctx.answerCallbackQuery({ text: "Keine Einträge auf dieser Seite." });
    return;
  }

  const keyboard = buildEditKeyboard(entries, page, totalCount, ownerId);
  await ctx.editMessageText("Welchen Eintrag bearbeiten?", { reply_markup: keyboard });
  await ctx.answerCallbackQuery();
}
