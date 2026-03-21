import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getRecentEntries } from "../db/queries";
import { formatWeight, formatDateTime } from "../utils/format";

export async function historyCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const entries = await getRecentEntries(chatId, 15);

  if (entries.length === 0) {
    await ctx.reply("Noch keine Einträge vorhanden.");
    return;
  }

  let text = "Letzte Einträge:\n\n";

  for (const entry of entries) {
    const isOwn = entry.telegram_user_id === userId;
    const name = isOwn ? "Du" : entry.display_name;
    text += `${name} - ${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)})`;
    if (isOwn) {
      text += ` [#${entry.id}]`;
    }
    text += "\n";
  }

  const ownEntries = entries.filter((e) => e.telegram_user_id === userId);

  if (ownEntries.length > 0) {
    const keyboard = new InlineKeyboard();
    for (const entry of ownEntries.slice(0, 5)) {
      keyboard
        .text(
          `✏️ ${formatWeight(entry.weight_kg)} ${formatDateTime(entry.recorded_at)}`,
          `edit:${entry.id}`
        )
        .text("🗑", `delete:${entry.id}`)
        .row();
    }

    await ctx.reply(text, { reply_markup: keyboard });
  } else {
    await ctx.reply(text);
  }
}
