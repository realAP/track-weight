import { CommandContext, Context, InlineKeyboard } from "grammy";
import { upsertUser, addWeightEntry, setBotMessageId } from "../db/queries";
import { parseWeight, parseDate, formatWeight, formatDate, dayNumberToName } from "../utils/format";

const PENDING_TTL_MS = 5 * 60 * 1000;

// Track users waiting to enter weight for a specific date
const pendingBacklog = new Map<number, { date: Date; expiresAt: number }>(); // telegramUserId -> date + TTL

// Track users waiting to enter a custom date
const pendingCustomDate = new Map<number, { expiresAt: number }>(); // telegramUserId -> TTL

function cleanExpiredBacklog(): void {
  const now = Date.now();
  for (const [key, val] of pendingBacklog) {
    if (now > val.expiresAt) pendingBacklog.delete(key);
  }
  for (const [key, val] of pendingCustomDate) {
    if (now > val.expiresAt) pendingCustomDate.delete(key);
  }
}

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
    cleanExpiredBacklog();
    pendingCustomDate.set(userId, { expiresAt: Date.now() + PENDING_TTL_MS });
    await ctx.answerCallbackQuery();
    await ctx.reply("Datum eingeben (DD.MM oder DD.MM.YYYY):", {
      reply_markup: { force_reply: true, selective: false },
    });
    return;
  }

  const date = new Date(value + "T12:00:00");
  if (isNaN(date.getTime())) {
    await ctx.answerCallbackQuery({ text: "Ungültiges Datum." });
    return;
  }

  cleanExpiredBacklog();
  pendingBacklog.set(userId, { date, expiresAt: Date.now() + PENDING_TTL_MS });
  await ctx.answerCallbackQuery();
  const dayName = dayNumberToName(date.getDay());
  const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  await ctx.reply(`Gewicht für ${dayName} ${dateStr} eingeben:`, {
    reply_markup: { force_reply: true, selective: false },
  });
}

export async function handleBacklogMessage(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text?.trim();
  if (!userId || !text) return false;

  cleanExpiredBacklog();

  // Check if user is entering a custom date
  if (pendingCustomDate.has(userId)) {
    const date = parseDate(text);
    if (!date) {
      await ctx.reply("Ungültiges Datum. Format: DD.MM oder DD.MM.YYYY\n/cancel zum Abbrechen.", {
      reply_markup: { force_reply: true, selective: false },
    });
      return true;
    }
    pendingCustomDate.delete(userId);
    pendingBacklog.set(userId, { date, expiresAt: Date.now() + PENDING_TTL_MS });
    const dayName = dayNumberToName(date.getDay());
    const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    await ctx.reply(`Gewicht für ${dayName} ${dateStr} eingeben:`, {
      reply_markup: { force_reply: true, selective: false },
    });
    return true;
  }

  // Check if user is entering weight for a backlog date
  const pending = pendingBacklog.get(userId);
  if (pending === undefined) return false;
  const date = pending.date;

  const weight = parseWeight(text);
  if (weight === null) {
    await ctx.reply("Ungültiges Gewicht. Bitte eine Zahl eingeben oder /cancel zum Abbrechen.", {
      reply_markup: { force_reply: true, selective: false },
    });
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
