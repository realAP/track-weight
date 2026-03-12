import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getGroupSettings, upsertGroupSettings } from "../db/queries";
import { dayNumberToName, dayNamesToString } from "../utils/format";

// Track wizard state per chat
const wizardState = new Map<number, { days: Set<number> }>();

const DAY_BUTTONS = [
  { day: 1, label: "Mo" },
  { day: 2, label: "Di" },
  { day: 3, label: "Mi" },
  { day: 4, label: "Do" },
  { day: 5, label: "Fr" },
  { day: 6, label: "Sa" },
  { day: 0, label: "So" },
];

export async function reminderCommand(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const arg = ctx.match.trim().toLowerCase();

  if (arg === "off") {
    await upsertGroupSettings(chatId, null, null);
    wizardState.delete(chatId);
    await ctx.reply("Erinnerung deaktiviert.");
    return;
  }

  if (arg === "status") {
    const settings = await getGroupSettings(chatId);
    if (!settings?.reminder_days || !settings?.reminder_time) {
      await ctx.reply("Keine Erinnerung eingerichtet. Starte mit /reminder");
      return;
    }
    const days = settings.reminder_days.split(",").map(Number);
    await ctx.reply(
      `Erinnerung: ${dayNamesToString(days)} um ${settings.reminder_time}`
    );
    return;
  }

  // Start wizard
  wizardState.set(chatId, { days: new Set() });
  await ctx.reply("Wochentage für die Erinnerung wählen:", {
    reply_markup: buildDayKeyboard(new Set()),
  });
}

function buildDayKeyboard(selectedDays: Set<number>): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const { day, label } of DAY_BUTTONS) {
    const selected = selectedDays.has(day);
    keyboard.text(selected ? `✅ ${label}` : label, `reminder_day:${day}`);
  }

  keyboard.row();

  if (selectedDays.size > 0) {
    keyboard.text("Weiter →", "reminder_next");
  }

  keyboard.text("Täglich", "reminder_daily");
  keyboard.text("Abbrechen", "reminder_cancel");

  return keyboard;
}

export async function handleReminderDayCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const data = ctx.callbackQuery?.data;
  if (!chatId || !data) return;

  const day = parseInt(data.replace("reminder_day:", ""), 10);
  if (isNaN(day)) return;

  let state = wizardState.get(chatId);
  if (!state) {
    state = { days: new Set() };
    wizardState.set(chatId, state);
  }

  if (state.days.has(day)) {
    state.days.delete(day);
  } else {
    state.days.add(day);
  }

  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({
    reply_markup: buildDayKeyboard(state.days),
  });
}

export async function handleReminderDailyCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  wizardState.set(chatId, { days: new Set([0, 1, 2, 3, 4, 5, 6]) });

  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Täglich gewählt. Uhrzeit eingeben (z.B. 08:00):");
}

export async function handleReminderNextCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const state = wizardState.get(chatId);
  if (!state || state.days.size === 0) {
    await ctx.answerCallbackQuery({ text: "Bitte mindestens einen Tag wählen." });
    return;
  }

  const dayNames = dayNamesToString(Array.from(state.days).sort());

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`${dayNames} gewählt. Uhrzeit eingeben (z.B. 08:00):`);
}

export async function handleReminderCancelCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId) wizardState.delete(chatId);

  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Erinnerungs-Setup abgebrochen.");
}

export async function handleReminderTimeMessage(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text?.trim();
  if (!chatId || !text) return false;

  const state = wizardState.get(chatId);
  if (!state) return false;

  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    await ctx.reply("Bitte Uhrzeit im Format HH:MM eingeben (z.B. 08:00).");
    return true;
  }

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    await ctx.reply("Ungültige Uhrzeit. Bitte im Format HH:MM eingeben.");
    return true;
  }

  const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const daysStr = Array.from(state.days).sort().join(",");
  const dayNames = dayNamesToString(Array.from(state.days).sort());

  await upsertGroupSettings(chatId, daysStr, timeStr);
  wizardState.delete(chatId);

  await ctx.reply(`Erinnerung eingerichtet: ${dayNames} um ${timeStr}`);
  return true;
}

export function hasActiveWizard(chatId: number): boolean {
  return wizardState.has(chatId);
}
