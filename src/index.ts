import { Bot } from "grammy";
import { config } from "./config";
import { runMigrations } from "./db/migrate";
import { startCommand, helpCommand } from "./commands/start";
import { logCommand, handlePlainNumber } from "./commands/log";
import { historyCommand } from "./commands/history";
import { statsCommand } from "./commands/stats";
import { chartCommand } from "./commands/chart";
import {
  reminderCommand,
  handleReminderDayCallback,
  handleReminderDailyCallback,
  handleReminderNextCallback,
  handleReminderCancelCallback,
  handleReminderTimeMessage,
  hasActiveWizard,
} from "./commands/reminder";
import { handleEditCallback, handleEditMessage, cancelEdit } from "./callbacks/edit";
import {
  handleDeleteCallback,
  handleConfirmDeleteCallback,
  handleCancelDeleteCallback,
} from "./callbacks/delete";
import { startReminderService } from "./services/reminder.service";

async function main(): Promise<void> {
  console.log("Starting weight tracker bot...");

  await runMigrations();

  const bot = new Bot(config.botToken);

  // Commands
  bot.command("start", startCommand);
  bot.command("help", helpCommand);
  bot.command("log", logCommand);
  bot.command("history", historyCommand);
  bot.command("stats", statsCommand);
  bot.command("chart", chartCommand);
  bot.command("reminder", reminderCommand);
  bot.command("cancel", async (ctx) => {
    if (ctx.from && cancelEdit(ctx.from.id)) {
      await ctx.reply("Bearbeitung abgebrochen.");
    }
  });

  // Callback queries (inline buttons)
  bot.callbackQuery(/^edit:\d+$/, handleEditCallback);
  bot.callbackQuery(/^delete:\d+$/, handleDeleteCallback);
  bot.callbackQuery(/^confirm_delete:\d+$/, handleConfirmDeleteCallback);
  bot.callbackQuery(/^cancel_delete:\d+$/, handleCancelDeleteCallback);
  bot.callbackQuery(/^reminder_day:\d$/, handleReminderDayCallback);
  bot.callbackQuery("reminder_daily", handleReminderDailyCallback);
  bot.callbackQuery("reminder_next", handleReminderNextCallback);
  bot.callbackQuery("reminder_cancel", handleReminderCancelCallback);

  // Text message handler (plain numbers + edit responses + reminder time)
  bot.on("message:text", async (ctx) => {
    // Check if user is in edit mode
    if (await handleEditMessage(ctx)) return;

    // Check if chat has active reminder wizard
    const chatId = ctx.chat?.id;
    if (chatId && hasActiveWizard(chatId)) {
      if (await handleReminderTimeMessage(ctx)) return;
    }

    // Try to interpret as weight
    await handlePlainNumber(ctx);
  });

  // Error handler
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  // Start reminder cron
  startReminderService(bot);

  // Start bot
  await bot.start({
    onStart: () => console.log("Bot is running!"),
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
