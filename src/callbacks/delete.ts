import { Context, InlineKeyboard } from "grammy";
import { getEntryById, deleteWeightEntry } from "../db/queries";
import { formatWeight, formatDateTime } from "../utils/format";

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
    `${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)}) gelöscht.`
  );
}

export async function handleCancelDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({ text: "Abgebrochen." });
  await ctx.deleteMessage();
}
