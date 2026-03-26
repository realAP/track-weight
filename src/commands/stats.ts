import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getAllEntries, getUserAllEntries, WeightEntry } from "../db/queries";
import { formatWeight } from "../utils/format";

export type StatsScope = "me" | "all";

function calcTrend(weights: number[]): string {
  if (weights.length < 2) return "Zu wenig Daten";
  const change = weights[weights.length - 1] - weights[0];
  return formatChange(change);
}

function formatChange(change: number, baseline?: number): string {
  const sign = change > 0 ? "+" : "";
  let result = `${sign}${change.toFixed(1)} kg`;
  if (baseline) {
    const pct = (change / baseline) * 100;
    const pctSign = pct > 0 ? "+" : "";
    result += ` (${pctSign}${pct.toFixed(1)}%)`;
  }
  return result;
}

export function buildStatsKeyboard(scope: StatsScope, userId: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const meLabel = scope === "me" ? "Ich ✓" : "Ich";
  const allLabel = scope === "all" ? "Alle ✓" : "Alle";
  keyboard.text(meLabel, `stats:${userId}:me`);
  keyboard.text(allLabel, `stats:${userId}:all`);
  return keyboard;
}

export function buildStatsText(allEntries: WeightEntry[], scope: StatsScope, userId: number): string {
  if (allEntries.length === 0) {
    return "Noch keine Einträge vorhanden.";
  }

  const weights = allEntries.map((e) => Number(e.weight_kg));
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  const totalChange = latest - first;

  const now = new Date();

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7d = allEntries.filter((e) => new Date(e.recorded_at) >= sevenDaysAgo);
  const trend7d = calcTrend(last7d.map((e) => Number(e.weight_kg)));

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30d = allEntries.filter((e) => new Date(e.recorded_at) >= thirtyDaysAgo);
  const trend30d = calcTrend(last30d.map((e) => Number(e.weight_kg)));

  const header = scope === "me" ? "Deine Statistiken" : "Gruppen-Statistiken";

  const lines = [
    `${header}:\n`,
    `Einträge: ${allEntries.length}`,
    `Aktuell: ${formatWeight(latest)}`,
    `Durchschnitt: ${formatWeight(avg)}`,
    `Min: ${formatWeight(min)} / Max: ${formatWeight(max)}`,
    `Veränderung gesamt: ${formatChange(totalChange, first)}`,
    "",
    `Trend 7 Tage: ${trend7d}`,
    `Trend 30 Tage: ${trend30d}`,
  ];

  // Per-user breakdown only in "all" scope
  if (scope === "all") {
    const userMap = new Map<string, number[]>();
    for (const entry of allEntries) {
      const name = entry.display_name;
      if (!userMap.has(name)) userMap.set(name, []);
      userMap.get(name)!.push(Number(entry.weight_kg));
    }

    if (userMap.size > 1) {
      lines.push("\nPro Person:");
      for (const [name, uWeights] of userMap) {
        const uLatest = uWeights[uWeights.length - 1];
        const uFirst = uWeights[0];
        const uChange = uLatest - uFirst;
        lines.push(`  ${name}: ${formatWeight(uLatest)} (${formatChange(uChange, uFirst)})`);
      }
    }
  }

  return lines.join("\n");
}

export async function loadStatsEntries(
  scope: StatsScope,
  userId: number,
  chatId: number
): Promise<WeightEntry[]> {
  if (scope === "me") {
    return getUserAllEntries(userId, chatId);
  }
  return getAllEntries(chatId);
}

export async function statsCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const scope: StatsScope = "me";
  const entries = await loadStatsEntries(scope, userId, chatId);

  if (entries.length === 0) {
    await ctx.reply("Noch keine Einträge vorhanden.");
    return;
  }

  const text = buildStatsText(entries, scope, userId);
  const keyboard = buildStatsKeyboard(scope, userId);

  await ctx.reply(text, { reply_markup: keyboard });
}
