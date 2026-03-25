function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  botToken: requireEnv("BOT_TOKEN"),
  databaseUrl: requireEnv("DATABASE_URL"),
  timezone: process.env.TZ || "Europe/Berlin",
};
