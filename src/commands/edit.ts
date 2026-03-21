import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getUserEntries } from "../db/queries";
import { formatWeight, formatDate } from "../utils/format";

export async function editCommand(ctx: CommandContext<Context>): Promise<void> {
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
        `✏️ ${formatWeight(entry.weight_kg)} — ${formatDate(entry.recorded_at)}`,
        `edit:${entry.id}`
      )
      .row();
  }

  await ctx.reply("Welchen Eintrag bearbeiten?", { reply_markup: keyboard });
}
