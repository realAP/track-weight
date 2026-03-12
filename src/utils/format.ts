export function formatWeight(kg: number): string {
  return `${Number(kg).toFixed(1)} kg`;
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  const d = new Date(date);
  return `${d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  })} ${d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function parseWeight(input: string): number | null {
  const cleaned = input.replace(",", ".").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 20 || num > 500) return null;
  return Math.round(num * 10) / 10;
}

export function parseDate(input: string): Date | null {
  // Supports: DD.MM or DD.MM.YYYY
  const match = input.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = match[3]
    ? parseInt(match[3], 10) + (match[3].length === 2 ? 2000 : 0)
    : new Date().getFullYear();

  const date = new Date(year, month, day, 12, 0, 0);
  if (isNaN(date.getTime())) return null;
  if (date > new Date()) return null; // no future dates
  return date;
}

const DAY_NAMES: Record<number, string> = {
  0: "So",
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
};

export function dayNumberToName(day: number): string {
  return DAY_NAMES[day] ?? `${day}`;
}

export function dayNamesToString(days: number[]): string {
  return days.map(dayNumberToName).join(", ");
}
