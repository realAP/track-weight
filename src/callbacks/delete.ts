import { Context, InlineKeyboard } from "grammy";
import { getEntryById, deleteWeightEntry } from "../db/queries";
import { formatWeight, formatDateTime } from "../utils/format";
import { logger } from "../utils/logger";

export async function handleDeleteCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  if (!data || !userId) return;

  const entryId = parseInt(data.replace("delete:", ""), 10);
  if (isNaN(entryId)) return;

  const entry = await getEntryById(entryId);
  if (!entry) {
    await ctx.answerCallbackQuery({ text: "Eintrag nicht gefunden." });
    return;
  }

  if (entry.telegram_user_id !== userId) {
    await ctx.answerCallbackQuery({ text: "Das ist nicht dein Eintrag." });
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("Ja, löschen", `confirm_delete:${entryId}`)
    .text("Abbrechen", `cancel_delete:${entryId}`);

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)}) wirklich löschen?`,
    { reply_markup: keyboard }
  );
}

export async function handleConfirmDeleteCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  if (!data || !userId) return;

  const entryId = parseInt(data.replace("confirm_delete:", ""), 10);
  if (isNaN(entryId)) return;

  const entry = await getEntryById(entryId);
  if (!entry) {
    await ctx.answerCallbackQuery({ text: "Eintrag nicht gefunden." });
    return;
  }

  if (entry.telegram_user_id !== userId) {
    await ctx.answerCallbackQuery({ text: "Das ist nicht dein Eintrag." });
    return;
  }

  await deleteWeightEntry(entryId);
  await ctx.answerCallbackQuery({ text: "Gelöscht!" });
  await ctx.editMessageText(
    `🗑 ${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)}) gelöscht.`
  );

  // Edit original bot reply to show deletion
  if (entry.bot_message_id && entry.chat_id) {
    try {
      await ctx.api.editMessageText(
        entry.chat_id,
        entry.bot_message_id,
        `🗑 <s>${formatWeight(entry.weight_kg)}</s> gelöscht`,
        { parse_mode: "HTML" }
      );
    } catch {
      logger.warn(`Could not edit bot reply for entry ${entryId}`);
    }
  }
}

export async function handleCancelDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: "Abgebrochen." });
  await ctx.deleteMessage();
}
