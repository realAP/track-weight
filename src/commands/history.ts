import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getRecentEntries, getUserEntries, WeightEntry } from "../db/queries";
import { formatWeight, formatDateTime } from "../utils/format";

export type HistoryScope = "me" | "all";

export function buildHistoryText(entries: WeightEntry[], userId: number, scope: HistoryScope): string {
  if (entries.length === 0) {
    return "Noch keine Einträge vorhanden.";
  }

  const scopeLabel = scope === "me" ? "Deine letzten Einträge" : "Letzte Einträge (alle)";
  let text = `${scopeLabel}:\n\n`;

  for (const entry of entries) {
    const isOwn = Number(entry.telegram_user_id) === userId;
    const name = scope === "all" ? (isOwn ? "Du" : entry.display_name) : "";
    const prefix = scope === "all" ? `${name} - ` : "";
    text += `${prefix}${formatWeight(entry.weight_kg)} (${formatDateTime(entry.recorded_at)})`;
    if (isOwn) {
      text += ` [#${entry.id}]`;
    }
    text += "\n";
  }

  return text;
}

export function buildHistoryKeyboard(
  entries: WeightEntry[],
  scope: HistoryScope,
  userId: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Scope toggle row
  const meLabel = scope === "me" ? "Ich ✓" : "Ich";
  const allLabel = scope === "all" ? "Alle ✓" : "Alle";
  keyboard.text(meLabel, `history:${userId}:me`);
  keyboard.text(allLabel, `history:${userId}:all`);
  keyboard.row();

  // Edit/Delete buttons for own entries
  const ownEntries = entries.filter((e) => Number(e.telegram_user_id) === userId);
  for (const entry of ownEntries.slice(0, 5)) {
    keyboard
      .text(
        `✏️ ${formatWeight(entry.weight_kg)} ${formatDateTime(entry.recorded_at)}`,
        `edit:${entry.id}`
      )
      .text("🗑", `delete:${entry.id}`)
      .row();
  }

  return keyboard;
}

export async function loadHistoryEntries(
  scope: HistoryScope,
  userId: number,
  chatId: number
): Promise<WeightEntry[]> {
  if (scope === "me") {
    return getUserEntries(userId, chatId, 15);
  }
  return getRecentEntries(chatId, 15);
}

export async function historyCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const scope: HistoryScope = "me";
  const entries = await loadHistoryEntries(scope, userId, chatId);

  if (entries.length === 0) {
    await ctx.reply("Noch keine Einträge vorhanden.");
    return;
  }

  const text = buildHistoryText(entries, userId, scope);
  const keyboard = buildHistoryKeyboard(entries, scope, userId);

  await ctx.reply(text, { reply_markup: keyboard });
}
