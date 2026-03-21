import { CommandContext, Context, InlineKeyboard } from "grammy";
import { upsertUser, addWeightEntry, setBotMessageId } from "../db/queries";
import { parseWeight, parseDate, formatWeight, formatDate, dayNumberToName } from "../utils/format";

// Track users waiting to enter weight for a specific date
const pendingBacklog = new Map<number, Date>(); // telegramUserId -> date

// Track users waiting to enter a custom date
const pendingCustomDate = new Map<number, true>(); // telegramUserId -> waiting

export async function nachtragenCommand(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const keyboard = new InlineKeyboard();
  const now = new Date();

  for (let daysBack = 1; daysBack <= 7; daysBack++) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysBack);
    const dayName = dayNumberToName(date.getDay());
    const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    const isoDate = date.toISOString().slice(0, 10);

    let label: string;
    if (daysBack === 1) {
      label = `Gestern — ${dayName} ${dateStr}`;
    } else if (daysBack === 2) {
      label = `Vorgestern — ${dayName} ${dateStr}`;
    } else {
      label = `${dayName} — ${dateStr}`;
    }

    keyboard.text(label, `backlog:${isoDate}`).row();
  }

  keyboard.text("📅 Anderes Datum", "backlog:custom").row();

  await ctx.reply("Für welchen Tag nachtragen?", { reply_markup: keyboard });
}

export async function handleBacklogCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;
  if (!data || !userId) return;

  const value = data.replace("backlog:", "");

  if (value === "custom") {
    pendingCustomDate.set(userId, true);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Datum eingeben (DD.MM oder DD.MM.YYYY):");
    return;
  }

  const date = new Date(value + "T12:00:00");
  if (isNaN(date.getTime())) {
    await ctx.answerCallbackQuery({ text: "Ungültiges Datum." });
    return;
  }

  pendingBacklog.set(userId, date);
  await ctx.answerCallbackQuery();
  const dayName = dayNumberToName(date.getDay());
  const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  await ctx.editMessageText(`Gewicht für ${dayName} ${dateStr} eingeben:`);
}

export async function handleBacklogMessage(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return false;

  // Check if user is entering a custom date
  if (pendingCustomDate.has(userId)) {
    const date = parseDate(text);
    if (!date) {
      await ctx.reply("Ungültiges Datum. Format: DD.MM oder DD.MM.YYYY\n/cancel zum Abbrechen.");
      return true;
    }
    pendingCustomDate.delete(userId);
    pendingBacklog.set(userId, date);
    const dayName = dayNumberToName(date.getDay());
    const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    await ctx.reply(`Gewicht für ${dayName} ${dateStr} eingeben:`);
    return true;
  }

  // Check if user is entering weight for a backlog date
  const date = pendingBacklog.get(userId);
  if (date === undefined) return false;

  const weight = parseWeight(text);
  if (weight === null) {
    await ctx.reply("Ungültiges Gewicht. Bitte eine Zahl eingeben oder /cancel zum Abbrechen.");
    return true;
  }

  const chatId = ctx.chat?.id;
  if (!chatId) return true;

  await upsertUser(userId, ctx.from!.first_name);
  const entry = await addWeightEntry(userId, chatId, weight, date);
  pendingBacklog.delete(userId);

  const reply = await ctx.reply(`✅ ${formatWeight(weight)} eingetragen (${formatDate(date)})`, {
    reply_parameters: { message_id: ctx.message!.message_id },
  });
  await setBotMessageId(entry.id, reply.message_id);

  return true;
}

export function cancelBacklog(userId: number): boolean {
  const hadDate = pendingBacklog.delete(userId);
  const hadCustom = pendingCustomDate.delete(userId);
  return hadDate || hadCustom;
}
