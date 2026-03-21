import { CommandContext, Context } from "grammy";
import { upsertUser } from "../db/queries";

const HELP_TEXT = `Gewichts-Tracker Bot

Einfach eine Zahl senden um dein Gewicht einzutragen.

Befehle:
/log <gewicht> - Gewicht eintragen
/log <gewicht> <DD.MM> - Gewicht nachtragen
/history - Letzte Einträge anzeigen
/stats - Statistiken anzeigen
/chart - Gewichtsverlauf als Grafik
/chart 7d|30d|90d|all - Grafik für Zeitraum
/reminder - Erinnerung einrichten
/reminder off - Erinnerung deaktivieren
/edit - Eintrag bearbeiten
/delete - Eintrag löschen
/help - Diese Hilfe anzeigen`;

export async function startCommand(ctx: CommandContext<Context>): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  await upsertUser(user.id, user.first_name);

  await ctx.reply(
    `Willkommen, ${user.first_name}!\n\n${HELP_TEXT}`
  );
}

export async function helpCommand(ctx: CommandContext<Context>): Promise<void> {
  await ctx.reply(HELP_TEXT);
}
