import { CommandContext, Context, InputFile } from "grammy";
import { getEntriesInRange, getAllEntries } from "../db/queries";
import { generateWeightChart } from "../services/chart.service";

export async function chartCommand(ctx: CommandContext<Context>): Promise<void> {
  const period = ctx.match.trim().toLowerCase() || "30d";

  let since: Date | null = null;
  const now = new Date();

  switch (period) {
    case "7d":
      since = new Date(now);
      since.setDate(since.getDate() - 7);
      break;
    case "30d":
      since = new Date(now);
      since.setDate(since.getDate() - 30);
      break;
    case "90d":
      since = new Date(now);
      since.setDate(since.getDate() - 90);
      break;
    case "all":
      since = null;
      break;
    default:
      await ctx.reply("Zeitraum: 7d, 30d, 90d oder all");
      return;
  }

  const entries = since ? await getEntriesInRange(since) : await getAllEntries();

  if (entries.length < 2) {
    await ctx.reply("Zu wenig Einträge für eine Grafik (mindestens 2 nötig).");
    return;
  }

  const imageBuffer = await generateWeightChart(entries);
  await ctx.replyWithPhoto(new InputFile(imageBuffer, "chart.png"), {
    caption: `Gewichtsverlauf (${period})`,
  });
}
