import { Context, NextFunction } from "grammy";
import { logger } from "../utils/logger";

export async function loggingMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const user = ctx.from;
  const chat = ctx.chat;
  const userId = user?.id ?? "unknown";
  const userName = user?.first_name ?? "unknown";
  const chatId = chat?.id ?? "unknown";
  const chatType = chat?.type ?? "unknown";

  if (ctx.message?.text) {
    const text = ctx.message.text;
    const isCommand = text.startsWith("/");
    logger.info(
      `${isCommand ? "CMD" : "MSG"} | user=${userId} (${userName}) chat=${chatId} (${chatType}) | ${text}`
    );
  } else if (ctx.callbackQuery?.data) {
    logger.info(
      `BTN | user=${userId} (${userName}) chat=${chatId} (${chatType}) | ${ctx.callbackQuery.data}`
    );
  }

  try {
    await next();
  } catch (err) {
    logger.error(
      `ERR | user=${userId} (${userName}) chat=${chatId} (${chatType})`,
      err instanceof Error ? { message: err.message, stack: err.stack } : err
    );
    throw err;
  }
}
