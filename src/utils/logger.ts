import fs from "fs";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || "./logs";
const RETENTION_DAYS = 14;

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFile(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `bot-${date}.log`);
}

function formatMessage(level: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  let line = `[${ts}] [${level}] ${message}`;
  if (data !== undefined) {
    line += ` ${typeof data === "string" ? data : JSON.stringify(data)}`;
  }
  return line + "\n";
}

function write(level: string, message: string, data?: unknown): void {
  const line = formatMessage(level, message, data);
  process.stdout.write(line);
  try {
    ensureLogDir();
    fs.appendFileSync(getLogFile(), line);
  } catch {
    // If file logging fails, stdout already has it
  }
}

export const logger = {
  info(message: string, data?: unknown): void {
    write("INFO", message, data);
  },
  error(message: string, data?: unknown): void {
    write("ERROR", message, data);
  },
  warn(message: string, data?: unknown): void {
    write("WARN", message, data);
  },
};

export function cleanOldLogs(): void {
  try {
    ensureLogDir();
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOG_DIR);
    for (const file of files) {
      if (!file.startsWith("bot-") || !file.endsWith(".log")) continue;
      const filePath = path.join(LOG_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old log file: ${file}`);
      }
    }
  } catch {
    // Non-critical
  }
}
