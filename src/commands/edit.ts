import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getUserEntriesPaginated, getUserEntryCount, WeightEntry } from "../db/queries";
import { formatWeight, formatDate } from "../utils/format";

const PAGE_SIZE = 5;

export function buildEditKeyboard(
  entries: WeightEntry[],
  page: number,
  totalCount: number,
  userId: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const entry of entries) {
    keyboard
      .text(
        `✏️ ${formatWeight(entry.weight_kg)} — ${formatDate(entry.recorded_at)}`,
        `edit:${entry.id}`
      )
      .row();
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text("◀ Zurück", `edit_page:${userId}:${page - 1}`);
    }
    keyboard.text(`${page + 1}/${totalPages}`, `edit_page:${userId}:${page}`);
    if (page < totalPages - 1) {
      keyboard.text("Weiter ▶", `edit_page:${userId}:${page + 1}`);
    }
  }

  return keyboard;
}

export async function editCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const totalCount = await getUserEntryCount(userId, chatId);

  if (totalCount === 0) {
    await ctx.reply("Du hast noch keine Einträge.");
    return;
  }

  const entries = await getUserEntriesPaginated(userId, chatId, PAGE_SIZE, 0);
  const keyboard = buildEditKeyboard(entries, 0, totalCount, userId);

  await ctx.reply("Welchen Eintrag bearbeiten?", { reply_markup: keyboard });
}
