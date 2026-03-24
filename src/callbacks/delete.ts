import { Context, InlineKeyboard } from "grammy";
import { getEntryById, deleteWeightEntry, getUserEntriesPaginated, getUserEntryCount } from "../db/queries";
import { formatWeight, formatDateTime } from "../utils/format";
import { logger } from "../utils/logger";
import { buildDeleteKeyboard } from "../commands/delete";

const PAGE_SIZE = 5;

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

  if (Number(entry.telegram_user_id) !== userId) {
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

  if (Number(entry.telegram_user_id) !== userId) {
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

export async function handleDeletePageCallback(ctx: Context): Promise<void> {
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
      text: "Nur wer /delete aufgerufen hat kann die Buttons nutzen.",
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

  const keyboard = buildDeleteKeyboard(entries, page, totalCount, ownerId);
  await ctx.editMessageText("Welchen Eintrag löschen?", { reply_markup: keyboard });
  await ctx.answerCallbackQuery();
}
