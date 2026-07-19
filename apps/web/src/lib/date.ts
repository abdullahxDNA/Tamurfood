// The Dhaka (Asia/Dhaka) calendar date as YYYY-MM-DD. Use this for default date
// inputs and "today" filters so an entry made in the early-morning window
// (00:00–06:00 Dhaka) isn't stamped with the previous UTC day.
export function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
    new Date(),
  );
}
