const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60_000],
  ["month", 30 * 24 * 60 * 60_000],
  ["day", 24 * 60 * 60_000],
  ["hour", 60 * 60_000],
  ["minute", 60_000],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/** "5 minutes ago", "3 days ago"; anything under a minute is "just now". */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const elapsed = now - timestamp;
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) return formatter.format(-Math.floor(elapsed / ms), unit);
  }
  return "just now";
}
