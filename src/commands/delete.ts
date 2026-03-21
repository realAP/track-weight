import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getUserEntries } from "../db/queries";
import { formatWeight, formatDate } from "../utils/format";

export async function deleteCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const entries = await getUserEntries(userId, chatId, 5);

  if (entries.length === 0) {
    await ctx.reply("Du hast noch keine Einträge.");
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const entry of entries) {
    keyboard
      .text(
        `❌ ${formatWeight(entry.weight_kg)} — ${formatDate(entry.recorded_at)}`,
        `delete:${entry.id}`
      )
      .row();
  }

  await ctx.reply("Welchen Eintrag löschen?", { reply_markup: keyboard });
}
