import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getUserEntriesPaginated, getUserEntryCount, WeightEntry } from "../db/queries";
import { formatWeight, formatDate } from "../utils/format";

const PAGE_SIZE = 5;

export function buildDeleteKeyboard(
  entries: WeightEntry[],
  page: number,
  totalCount: number,
  userId: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const entry of entries) {
    keyboard
      .text(
        `❌ ${formatWeight(entry.weight_kg)} — ${formatDate(entry.recorded_at)}`,
        `delete:${entry.id}`
      )
      .row();
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text("◀ Zurück", `delete_page:${userId}:${page - 1}`);
    }
    keyboard.text(`${page + 1}/${totalPages}`, `delete_page:${userId}:${page}`);
    if (page < totalPages - 1) {
      keyboard.text("Weiter ▶", `delete_page:${userId}:${page + 1}`);
    }
  }

  return keyboard;
}

export async function deleteCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const totalCount = await getUserEntryCount(userId, chatId);

  if (totalCount === 0) {
    await ctx.reply("Du hast noch keine Einträge.");
    return;
  }

  const entries = await getUserEntriesPaginated(userId, chatId, PAGE_SIZE, 0);
  const keyboard = buildDeleteKeyboard(entries, 0, totalCount, userId);

  await ctx.reply("Welchen Eintrag löschen?", { reply_markup: keyboard });
}
