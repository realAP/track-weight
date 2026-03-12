import { CommandContext, Context, InputFile, InlineKeyboard } from "grammy";
import {
  getEntriesInRange,
  getAllEntries,
  getUserEntriesInRange,
  getUserAllEntries,
} from "../db/queries";
import { generateWeightChart, ChartMode } from "../services/chart.service";

export type ChartScope = "me" | "all";
export type ChartPeriod = "7d" | "30d" | "90d" | "all";

export function buildChartKeyboard(
  scope: ChartScope,
  mode: ChartMode,
  period: ChartPeriod,
  userId: number
): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Row 1: Scope
  const meLabel = scope === "me" ? "Ich ✓" : "Ich";
  const allLabel = scope === "all" ? "Alle ✓" : "Alle";
  kb.text(meLabel, `chart:${userId}:me:${mode}:${period}`);
  kb.text(allLabel, `chart:${userId}:all:${mode}:${period}`);
  kb.row();

  // Row 2: Mode
  const absLabel = mode === "absolute" ? "Absolut ✓" : "Absolut";
  const relLabel = mode === "relative" ? "Relativ ✓" : "Relativ";
  kb.text(absLabel, `chart:${userId}:${scope}:absolute:${period}`);
  kb.text(relLabel, `chart:${userId}:${scope}:relative:${period}`);
  kb.row();

  // Row 3: Period
  const periods: ChartPeriod[] = ["7d", "30d", "90d", "all"];
  for (const p of periods) {
    const label = p === period ? `${p} ✓` : p;
    kb.text(label, `chart:${userId}:${scope}:${mode}:${p}`);
  }

  return kb;
}

export function getSinceDate(period: ChartPeriod): Date | null {
  if (period === "all") return null;
  const now = new Date();
  const days = parseInt(period);
  now.setDate(now.getDate() - days);
  return now;
}

export async function loadChartEntries(
  scope: ChartScope,
  period: ChartPeriod,
  telegramUserId: number
) {
  const since = getSinceDate(period);

  if (scope === "me") {
    return since
      ? await getUserEntriesInRange(telegramUserId, since)
      : await getUserAllEntries(telegramUserId);
  } else {
    return since
      ? await getEntriesInRange(since)
      : await getAllEntries();
  }
}

export async function chartCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const scope: ChartScope = "me";
  const mode: ChartMode = "absolute";
  const period: ChartPeriod = "30d";

  const entries = await loadChartEntries(scope, period, userId);

  if (entries.length < 2) {
    await ctx.reply("Zu wenig Einträge für eine Grafik (mindestens 2 nötig).");
    return;
  }

  const imageBuffer = await generateWeightChart(entries, mode);
  const keyboard = buildChartKeyboard(scope, mode, period, userId);

  await ctx.replyWithPhoto(new InputFile(imageBuffer, "chart.png"), {
    caption: `Gewichtsverlauf (${period})`,
    reply_markup: keyboard,
  });
}
