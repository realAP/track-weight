import { CommandContext, Context } from "grammy";
import { upsertUser, addWeightEntry, setBotMessageId } from "../db/queries";
import { parseWeight, parseDate, formatWeight, formatDate } from "../utils/format";

export async function logCommand(ctx: CommandContext<Context>): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const args = ctx.match.trim().split(/\s+/);
  if (!args[0]) {
    await ctx.reply("Bitte Gewicht angeben: /log 82.5");
    return;
  }

  const weight = parseWeight(args[0]);
  if (weight === null) {
    await ctx.reply("Ungültiges Gewicht. Bitte eine Zahl zwischen 20 und 500 eingeben.");
    return;
  }

  let recordedAt: Date | undefined;
  if (args[1]) {
    const parsed = parseDate(args[1]);
    if (!parsed) {
      await ctx.reply("Ungültiges Datum. Format: DD.MM oder DD.MM.YYYY");
      return;
    }
    recordedAt = parsed;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await upsertUser(user.id, user.first_name);
  const entry = await addWeightEntry(user.id, chatId, weight, recordedAt);

  const dateStr = recordedAt ? ` (${formatDate(recordedAt)})` : "";
  const reply = await ctx.reply(`✅ ${formatWeight(weight)} eingetragen${dateStr}`, {
    reply_parameters: { message_id: ctx.message!.message_id },
  });
  await setBotMessageId(entry.id, reply.message_id);
}

export async function handlePlainNumber(ctx: Context): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text || !ctx.from) return;

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const weight = parseWeight(text);
  if (weight === null) return;

  await upsertUser(ctx.from.id, ctx.from.first_name);
  const entry = await addWeightEntry(ctx.from.id, chatId, weight);

  const reply = await ctx.reply(`✅ ${formatWeight(weight)} eingetragen`, {
    reply_parameters: { message_id: ctx.message!.message_id },
  });
  await setBotMessageId(entry.id, reply.message_id);
}
