import { Context } from "grammy";
import {
  buildStatsText,
  buildStatsKeyboard,
  loadStatsEntries,
  StatsScope,
} from "../commands/stats";

export async function statsCallbackHandler(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("stats:")) return;

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
      text: "Nur wer /stats aufgerufen hat kann die Buttons nutzen.",
      show_alert: true,
    });
    return;
  }

  const scope = scopeStr as StatsScope;
  const entries = await loadStatsEntries(scope, callerId, chatId);

  const text = buildStatsText(entries, scope, callerId);
  const keyboard = buildStatsKeyboard(scope, callerId);

  await ctx.editMessageText(text, { reply_markup: keyboard });
  await ctx.answerCallbackQuery();
}
