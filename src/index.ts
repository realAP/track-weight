import { Bot } from "grammy";
import { config } from "./config";
import { runMigrations } from "./db/migrate";
import { startCommand, helpCommand } from "./commands/start";
import { logCommand, handlePlainNumber } from "./commands/log";
import { historyCommand } from "./commands/history";
import { statsCommand } from "./commands/stats";
import { chartCommand } from "./commands/chart";
import { reminderCommand, handleReminderCallback } from "./commands/reminder";
import { handleEditCallback, handleEditMessage, cancelEdit } from "./callbacks/edit";
import {
  handleDeleteCallback,
  handleConfirmDeleteCallback,
  handleCancelDeleteCallback,
} from "./callbacks/delete";
import { chartCallbackHandler } from "./callbacks/chart";
import { startReminderService } from "./services/reminder.service";
import { logger, cleanOldLogs } from "./utils/logger";
import { loggingMiddleware } from "./middleware/logging";

async function main(): Promise<void> {
  logger.info("Starting weight tracker bot...");

  cleanOldLogs();

  await runMigrations();

  const bot = new Bot(config.botToken);

  // Log all interactions
  bot.use(loggingMiddleware);

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

  // Chart callbacks (interactive chart buttons)
  bot.callbackQuery(/^chart:/, chartCallbackHandler);

  // Reminder callbacks (all prefixed with rd:, rh:, rm:)
  bot.callbackQuery(/^r[dhm]:/, handleReminderCallback);

  // Text message handler (plain numbers + edit responses)
  bot.on("message:text", async (ctx) => {
    // Check if user is in edit mode
    if (await handleEditMessage(ctx)) return;

    // Try to interpret as weight
    await handlePlainNumber(ctx);
  });

  // Error handler
  bot.catch((err) => {
    logger.error("Bot error:", err);
  });

  // Start reminder cron
  startReminderService(bot);

  // Start bot
  await bot.start({
    onStart: () => logger.info("Bot is running!"),
  });
}

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
