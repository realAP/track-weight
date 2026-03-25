import { Context, InputFile, InputMediaBuilder } from "grammy";
import { generateWeightChart, ChartMode } from "../services/chart.service";
import {
  buildChartKeyboard,
  loadChartEntries,
  ChartScope,
  ChartPeriod,
} from "../commands/chart";

export async function chartCallbackHandler(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("chart:")) return;

  const parts = data.split(":");
  if (parts.length !== 5) {
    await ctx.answerCallbackQuery({ text: "Ungültige Aktion" });
    return;
  }

  const [, ownerIdStr, scopeStr, modeStr, periodStr] = parts;
  const ownerId = parseInt(ownerIdStr);
  const callerId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!callerId || !chatId || callerId !== ownerId) {
    await ctx.answerCallbackQuery({
      text: "Nur wer /chart aufgerufen hat kann die Buttons nutzen.",
      show_alert: true,
    });
    return;
  }

  const scope = scopeStr as ChartScope;
  const mode = modeStr as ChartMode;
  const period = periodStr as ChartPeriod;

  const entries = await loadChartEntries(scope, period, callerId, chatId);

  if (entries.length < 2) {
    await ctx.answerCallbackQuery({
      text: "Zu wenig Einträge für diese Auswahl.",
      show_alert: true,
    });
    return;
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = await generateWeightChart(entries, mode);
  } catch {
    await ctx.answerCallbackQuery({ text: "Fehler bei der Chart-Erstellung.", show_alert: true });
    return;
  }
  const keyboard = buildChartKeyboard(scope, mode, period, ownerId);

  const scopeLabel = scope === "me" ? "Dein" : "Gruppen";
  const modeLabel = mode === "relative" ? ", relativ" : "";
  const caption = `${scopeLabel}-Gewichtsverlauf (${period}${modeLabel})`;

  const media = InputMediaBuilder.photo(new InputFile(imageBuffer, "chart.png"), {
    caption,
  });

  await ctx.editMessageMedia(media, { reply_markup: keyboard });
  await ctx.answerCallbackQuery();
}
