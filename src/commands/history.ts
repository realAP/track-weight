import { CommandContext, Context, InlineKeyboard } from "grammy";
import {
  getUserEntriesPaginated,
  getUserEntryCount,
  getRecentEntriesPaginated,
  getEntryCount,
  WeightEntry,
} from "../db/queries";
import { formatWeight, formatDateTime } from "../utils/format";

export type HistoryScope = "me" | "all";

const PAGE_SIZE = 10;

export function buildHistoryText(entries: WeightEntry[], userId: number, scope: HistoryScope): string {
  if (entries.length === 0) {
    return "Noch keine Einträge vorhanden.";
  }

  const scopeLabel = scope === "me" ? "Deine Einträge" : "Alle Einträge";
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
  userId: number,
  page: number,
  totalCount: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Scope toggle row
  const meLabel = scope === "me" ? "Ich ✓" : "Ich";
  const allLabel = scope === "all" ? "Alle ✓" : "Alle";
  keyboard.text(meLabel, `history:${userId}:me:0`);
  keyboard.text(allLabel, `history:${userId}:all:0`);
  keyboard.row();

  // Edit/Delete buttons for own entries (max 5)
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

  // Pagination row
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text("◀ Zurück", `history:${userId}:${scope}:${page - 1}`);
    }
    keyboard.text(`${page + 1}/${totalPages}`, `history:${userId}:${scope}:${page}`);
    if (page < totalPages - 1) {
      keyboard.text("Weiter ▶", `history:${userId}:${scope}:${page + 1}`);
    }
  }

  return keyboard;
}

export async function loadHistoryEntries(
  scope: HistoryScope,
  userId: number,
  chatId: number,
  page: number
): Promise<{ entries: WeightEntry[]; totalCount: number }> {
  const offset = page * PAGE_SIZE;
  if (scope === "me") {
    const [entries, totalCount] = await Promise.all([
      getUserEntriesPaginated(userId, chatId, PAGE_SIZE, offset),
      getUserEntryCount(userId, chatId),
    ]);
    return { entries, totalCount };
  }
  const [entries, totalCount] = await Promise.all([
    getRecentEntriesPaginated(chatId, PAGE_SIZE, offset),
    getEntryCount(chatId),
  ]);
  return { entries, totalCount };
}

export async function historyCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const scope: HistoryScope = "me";
  const page = 0;
  const { entries, totalCount } = await loadHistoryEntries(scope, userId, chatId, page);

  if (entries.length === 0) {
    await ctx.reply("Noch keine Einträge vorhanden.");
    return;
  }

  const text = buildHistoryText(entries, userId, scope);
  const keyboard = buildHistoryKeyboard(entries, scope, userId, page, totalCount);

  await ctx.reply(text, { reply_markup: keyboard });
}
