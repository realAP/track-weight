import { CommandContext, Context } from "grammy";
import { getEntriesInRange, getAllEntries } from "../db/queries";
import { formatWeight } from "../utils/format";

export async function statsCommand(ctx: CommandContext<Context>): Promise<void> {
  const allEntries = await getAllEntries();

  if (allEntries.length === 0) {
    await ctx.reply("Noch keine Einträge vorhanden.");
    return;
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
  const last7d = await getEntriesInRange(sevenDaysAgo);
  const trend7d = calcTrend(last7d.map((e) => Number(e.weight_kg)));

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30d = await getEntriesInRange(thirtyDaysAgo);
  const trend30d = calcTrend(last30d.map((e) => Number(e.weight_kg)));

  const lines = [
    "Statistiken:\n",
    `Einträge: ${allEntries.length}`,
    `Aktuell: ${formatWeight(latest)}`,
    `Durchschnitt: ${formatWeight(avg)}`,
    `Min: ${formatWeight(min)} / Max: ${formatWeight(max)}`,
    `Veränderung gesamt: ${formatChange(totalChange)}`,
    "",
    `Trend 7 Tage: ${trend7d}`,
    `Trend 30 Tage: ${trend30d}`,
  ];

  // Per-user stats
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
      const uChange = uLatest - uWeights[0];
      lines.push(`  ${name}: ${formatWeight(uLatest)} (${formatChange(uChange)})`);
    }
  }

  await ctx.reply(lines.join("\n"));
}

function calcTrend(weights: number[]): string {
  if (weights.length < 2) return "Zu wenig Daten";
  const change = weights[weights.length - 1] - weights[0];
  return formatChange(change);
}

function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)} kg`;
}
