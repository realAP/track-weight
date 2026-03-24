import { Context } from "grammy";
import { getEntryById, updateWeightEntry, getUserEntriesPaginated, getUserEntryCount } from "../db/queries";
import { parseWeight, formatWeight, formatDateTime } from "../utils/format";
import { logger } from "../utils/logger";
import { buildEditKeyboard } from "../commands/edit";

const PAGE_SIZE = 5;

// Track users who are currently editing an entry
const pendingEdits = new Map<number, number>(); // telegramUserId -> entryId

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

  pendingEdits.set(userId, entryId);

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `Bearbeite: ${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)})\n\nNeues Gewicht eingeben:`
  );
}

export async function handleEditMessage(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return false;

  const entryId = pendingEdits.get(userId);
  if (entryId === undefined) return false;

  const weight = parseWeight(text);
  if (weight === null) {
    await ctx.reply("Ungültiges Gewicht. Bitte eine Zahl eingeben oder /cancel zum Abbrechen.");
    return true;
  }

  const entry = await getEntryById(entryId);
  if (!entry) {
    pendingEdits.delete(userId);
    await ctx.reply("Eintrag nicht mehr vorhanden.");
    return true;
  }

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
