import * as cron from "node-cron";
import { Bot, Context } from "grammy";
import { getAllGroupSettings, getUsersWhoLoggedSince, getAllUsersInGroup } from "../db/queries";

export function startReminderService(bot: Bot<Context>): void {
  // Check every minute if any group needs a reminder
  cron.schedule("* * * * *", async () => {
    try {
      await checkReminders(bot);
    } catch (err) {
      console.error("Reminder check error:", err);
    }
  });

  console.log("Reminder service started.");
}

async function checkReminders(bot: Bot<Context>): Promise<void> {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const groups = await getAllGroupSettings();

  for (const group of groups) {
    if (!group.reminder_days || !group.reminder_time) continue;

    const days = group.reminder_days.split(",").map(Number);
    if (!days.includes(currentDay)) continue;
    if (group.reminder_time !== currentTime) continue;

    await sendReminder(bot, group.chat_id, days);
  }
}

async function sendReminder(bot: Bot<Context>, chatId: number, days: number[]): Promise<void> {
  // Find the previous reminder day to check who hasn't logged
  const now = new Date();
  const lastReminderDate = findPreviousReminderDate(now, days);

  const allUsers = await getAllUsersInGroup();
  const loggedUserIds = await getUsersWhoLoggedSince(lastReminderDate);

  const lines: string[] = ["Zeit zum Wiegen! ⚖️\n"];

  if (allUsers.length > 0) {
    const missing = allUsers.filter((u) => !loggedUserIds.includes(u.telegram_id));
    const logged = allUsers.filter((u) => loggedUserIds.includes(u.telegram_id));

    for (const user of logged) {
      lines.push(`✅ ${user.display_name}`);
    }
    for (const user of missing) {
      lines.push(`⚠️ ${user.display_name} - noch nicht eingetragen`);
    }
  }

  lines.push("\nEinfach Gewicht als Zahl senden!");

  try {
    await bot.api.sendMessage(chatId, lines.join("\n"));
  } catch (err) {
    console.error(`Failed to send reminder to chat ${chatId}:`, err);
  }
}

function findPreviousReminderDate(now: Date, days: number[]): Date {
  const currentDay = now.getDay();

  // Find how many days ago the previous reminder was
  for (let daysBack = 1; daysBack <= 7; daysBack++) {
    const checkDay = (currentDay - daysBack + 7) % 7;
    if (days.includes(checkDay)) {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - daysBack);
      prev.setHours(0, 0, 0, 0);
      return prev;
    }
  }

  // Fallback: 7 days ago
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() - 7);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}
