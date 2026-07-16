// Business days are reckoned in Bangladesh time (Asia/Dhaka, UTC+6, no DST).
// Order/payment timestamps are stored as UTC, so day/week/month windows must be
// anchored to Dhaka midnight — otherwise "today" would start at 6am Dhaka (UTC
// midnight) and early-morning activity would land on the wrong day. These
// helpers return the UTC instant of a Dhaka day boundary, independent of the
// server's own timezone.

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

// UTC instant of 00:00 (Dhaka) for the Dhaka day containing `now`.
export function startOfDhakaDayUTC(now = new Date()): Date {
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const midnight = Date.UTC(
    dhaka.getUTCFullYear(),
    dhaka.getUTCMonth(),
    dhaka.getUTCDate(),
  );
  return new Date(midnight - DHAKA_OFFSET_MS);
}

// UTC instant of the 1st of the current Dhaka month at 00:00 (Dhaka).
export function startOfDhakaMonthUTC(now = new Date()): Date {
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const firstOfMonth = Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), 1);
  return new Date(firstOfMonth - DHAKA_OFFSET_MS);
}

// UTC instant of 00:00 (Dhaka) for a given YYYY-MM-DD Dhaka calendar date.
export function dhakaDateStartUTC(dateStr: string): Date {
  const utcMidnight = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(utcMidnight - DHAKA_OFFSET_MS);
}

// Add whole days to a UTC instant.
export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
