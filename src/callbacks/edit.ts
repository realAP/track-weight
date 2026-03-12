import { Context } from "grammy";
import { getEntryById, updateWeightEntry } from "../db/queries";
import { parseWeight, formatWeight, formatDateTime } from "../utils/format";

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

  if (entry.telegram_user_id !== userId) {
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
    `Aktualisiert: ${formatWeight(entry.weight_kg)} → ${formatWeight(weight)}`
  );
  return true;
}

export function cancelEdit(userId: number): boolean {
  return pendingEdits.delete(userId);
}
