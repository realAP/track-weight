import { CommandContext, Context } from "grammy";
import { getUserEntries, WeightEntry } from "../db/queries";
import { formatWeight, formatDateTime } from "../utils/format";

function buildHistoryText(entries: WeightEntry[]): string {
  let text = "Deine Einträge:\n\n";

  for (const entry of entries) {
    text += `${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)}) [#${entry.id}]\n`;
  }

  return text;
}

export async function historyCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const entries = await getUserEntries(userId, chatId, 1000);

  if (entries.length === 0) {
    await ctx.reply("Noch keine Einträge vorhanden.");
    return;
  }

  await ctx.reply(buildHistoryText(entries));
}
