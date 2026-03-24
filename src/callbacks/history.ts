import { Context } from "grammy";
import {
  buildHistoryText,
  buildHistoryKeyboard,
  loadHistoryEntries,
  HistoryScope,
} from "../commands/history";

export async function historyCallbackHandler(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("history:")) return;

  const parts = data.split(":");
  if (parts.length !== 3) {
    await ctx.answerCallbackQuery({ text: "Ungültige Aktion" });
    return;
  }

  const [, ownerIdStr, scopeStr] = parts;
  const ownerId = parseInt(ownerIdStr);
  const callerId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!callerId || !chatId || callerId !== ownerId) {
    await ctx.answerCallbackQuery({
      text: "Nur wer /history aufgerufen hat kann die Buttons nutzen.",
      show_alert: true,
    });
    return;
  }

  const scope = scopeStr as HistoryScope;
  const entries = await loadHistoryEntries(scope, callerId, chatId);

  const text = buildHistoryText(entries, callerId, scope);
  const keyboard = buildHistoryKeyboard(entries, scope, callerId);

  await ctx.editMessageText(text, { reply_markup: keyboard });
  await ctx.answerCallbackQuery();
}
