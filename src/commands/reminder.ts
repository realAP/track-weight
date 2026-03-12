import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getGroupSettings, upsertGroupSettings } from "../db/queries";
import { dayNamesToString } from "../utils/format";

interface WizardState {
  days: Set<number>;
  hour: number;
  minute: number;
  step: "days" | "hour" | "minute";
}

// Track wizard state per chat
const wizardState = new Map<number, WizardState>();

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

  // Show current settings + start wizard
  const settings = await getGroupSettings(chatId);
  let currentInfo = "";
  if (settings?.reminder_days && settings?.reminder_time) {
    const days = settings.reminder_days.split(",").map(Number);
    currentInfo = `\nAktuell: ${dayNamesToString(days)} um ${settings.reminder_time}\n`;
  }

  const state: WizardState = { days: new Set(), hour: 8, minute: 0, step: "days" };
  wizardState.set(chatId, state);

  await ctx.reply(
    `⚙️ Erinnerung einrichten${currentInfo}\n` +
    `Schritt 1/3: Wochentage wählen\n` +
    buildStatusLine(state),
    { reply_markup: buildDayKeyboard(state) }
  );
}

function buildStatusLine(state: WizardState): string {
  const days = state.days.size > 0
    ? dayNamesToString(Array.from(state.days).sort())
    : "—";
  const time = `${state.hour.toString().padStart(2, "0")}:${state.minute.toString().padStart(2, "0")}`;
  return `\n📅 Tage: ${days}\n⏰ Uhrzeit: ${time}`;
}

function buildDayKeyboard(state: WizardState): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Day toggle buttons - 2 rows
  for (let i = 0; i < DAY_BUTTONS.length; i++) {
    const { day, label } = DAY_BUTTONS[i];
    const selected = state.days.has(day);
    keyboard.text(selected ? `✅ ${label}` : `  ${label}  `, `rd:${day}`);
    if (i === 3) keyboard.row(); // break after Do
  }

  keyboard.row();
  keyboard.text("📅 Täglich", "rd:daily");
  keyboard.text("📅 Mo-Fr", "rd:weekdays");

  keyboard.row();
  if (state.days.size > 0) {
    keyboard.text("Weiter → Uhrzeit", "rd:to_hour");
  }
  keyboard.text("❌ Abbrechen", "rd:cancel");

  return keyboard;
}

function buildHourKeyboard(state: WizardState): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Hour selection: common wake-up times in rows
  const hours = [
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];

  for (const row of hours) {
    for (const h of row) {
      const label = h === state.hour ? `[${h}]` : `${h}`;
      keyboard.text(label, `rh:${h}`);
    }
    keyboard.row();
  }

  keyboard.text("← Zurück", "rd:back_days");
  keyboard.text("Weiter → Minuten", "rd:to_minute");
  keyboard.text("❌ Abbrechen", "rd:cancel");

  return keyboard;
}

function buildMinuteKeyboard(state: WizardState): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  for (let i = 0; i < minutes.length; i++) {
    const m = minutes[i];
    const label = m === state.minute
      ? `[${m.toString().padStart(2, "0")}]`
      : `:${m.toString().padStart(2, "0")}`;
    keyboard.text(label, `rm:${m}`);
    if (i % 4 === 3) keyboard.row();
  }

  keyboard.row();
  keyboard.text("← Zurück", "rd:back_hour");
  keyboard.text("✅ Speichern", "rd:save");
  keyboard.text("❌ Abbrechen", "rd:cancel");

  return keyboard;
}

function getStepText(state: WizardState): string {
  switch (state.step) {
    case "days":
      return "⚙️ Erinnerung einrichten\nSchritt 1/3: Wochentage wählen";
    case "hour":
      return "⚙️ Erinnerung einrichten\nSchritt 2/3: Stunde wählen";
    case "minute":
      return "⚙️ Erinnerung einrichten\nSchritt 3/3: Minute wählen";
  }
}

function getKeyboardForStep(state: WizardState): InlineKeyboard {
  switch (state.step) {
    case "days": return buildDayKeyboard(state);
    case "hour": return buildHourKeyboard(state);
    case "minute": return buildMinuteKeyboard(state);
  }
}

async function updateWizardMessage(ctx: Context, state: WizardState): Promise<void> {
  const text = getStepText(state) + buildStatusLine(state);
  await ctx.editMessageText(text, {
    reply_markup: getKeyboardForStep(state),
  });
}

// --- Callback Handlers ---

export async function handleReminderCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const data = ctx.callbackQuery?.data;
  if (!chatId || !data) return;

  let state = wizardState.get(chatId);
  if (!state) {
    state = { days: new Set(), hour: 8, minute: 0, step: "days" };
    wizardState.set(chatId, state);
  }

  await ctx.answerCallbackQuery();

  // Day toggles
  if (data.startsWith("rd:")) {
    const action = data.replace("rd:", "");

    if (action === "cancel") {
      wizardState.delete(chatId);
      await ctx.editMessageText("Erinnerungs-Setup abgebrochen.");
      return;
    }

    if (action === "daily") {
      state.days = new Set([0, 1, 2, 3, 4, 5, 6]);
      await updateWizardMessage(ctx, state);
      return;
    }

    if (action === "weekdays") {
      state.days = new Set([1, 2, 3, 4, 5]);
      await updateWizardMessage(ctx, state);
      return;
    }

    if (action === "to_hour") {
      if (state.days.size === 0) return;
      state.step = "hour";
      await updateWizardMessage(ctx, state);
      return;
    }

    if (action === "to_minute") {
      state.step = "minute";
      await updateWizardMessage(ctx, state);
      return;
    }

    if (action === "back_days") {
      state.step = "days";
      await updateWizardMessage(ctx, state);
      return;
    }

    if (action === "back_hour") {
      state.step = "hour";
      await updateWizardMessage(ctx, state);
      return;
    }

    if (action === "save") {
      if (state.days.size === 0) return;
      const timeStr = `${state.hour.toString().padStart(2, "0")}:${state.minute.toString().padStart(2, "0")}`;
      const daysStr = Array.from(state.days).sort().join(",");
      const dayNames = dayNamesToString(Array.from(state.days).sort());

      await upsertGroupSettings(chatId, daysStr, timeStr);
      wizardState.delete(chatId);

      await ctx.editMessageText(
        `✅ Erinnerung gespeichert!\n\n📅 ${dayNames}\n⏰ ${timeStr}\n\n/reminder off zum Deaktivieren`
      );
      return;
    }

    // Day number toggle
    const dayNum = parseInt(action, 10);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      if (state.days.has(dayNum)) {
        state.days.delete(dayNum);
      } else {
        state.days.add(dayNum);
      }
      await updateWizardMessage(ctx, state);
      return;
    }
  }

  // Hour selection
  if (data.startsWith("rh:")) {
    const hour = parseInt(data.replace("rh:", ""), 10);
    if (!isNaN(hour) && hour >= 0 && hour <= 23) {
      state.hour = hour;
      await updateWizardMessage(ctx, state);
    }
    return;
  }

  // Minute selection
  if (data.startsWith("rm:")) {
    const minute = parseInt(data.replace("rm:", ""), 10);
    if (!isNaN(minute) && minute >= 0 && minute <= 59) {
      state.minute = minute;
      await updateWizardMessage(ctx, state);
    }
    return;
  }
}
