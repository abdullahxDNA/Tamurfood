import { test, expect, describe } from "bun:test";
import {
  startOfDhakaDayUTC,
  startOfDhakaMonthUTC,
  dhakaDateStartUTC,
  dhakaDateString,
  addDays,
} from "./time";

// Dhaka is UTC+6, so 00:00 Dhaka == 18:00 UTC the previous day. These are the
// boundaries the whole app uses to reckon a "business day", so lock them down.

describe("startOfDhakaDayUTC", () => {
  test("maps a Dhaka afternoon to that Dhaka day's midnight (UTC)", () => {
    // 2026-07-16 09:00 Dhaka  ==  2026-07-16 03:00 UTC
    const now = new Date("2026-07-16T03:00:00Z");
    expect(startOfDhakaDayUTC(now).toISOString()).toBe(
      "2026-07-15T18:00:00.000Z",
    ); // = 2026-07-16 00:00 Dhaka
  });

  test("just-after-midnight Dhaka stays on the new day (the bug we fixed)", () => {
    // 2026-07-16 00:30 Dhaka  ==  2026-07-15 18:30 UTC
    const justAfterMidnight = new Date("2026-07-15T18:30:00Z");
    expect(startOfDhakaDayUTC(justAfterMidnight).toISOString()).toBe(
      "2026-07-15T18:00:00.000Z",
    );
  });

  test("just-before-midnight Dhaka is still the previous day", () => {
    // 2026-07-15 23:30 Dhaka  ==  2026-07-15 17:30 UTC
    const justBeforeMidnight = new Date("2026-07-15T17:30:00Z");
    expect(startOfDhakaDayUTC(justBeforeMidnight).toISOString()).toBe(
      "2026-07-14T18:00:00.000Z",
    ); // = 2026-07-15 00:00 Dhaka
  });

  test("an order placed 00:00–06:00 Dhaka counts on the correct day", () => {
    // This is the exact case the old UTC-based logic got wrong.
    // 2026-07-16 02:00 Dhaka  ==  2026-07-15 20:00 UTC
    const earlyMorning = new Date("2026-07-15T20:00:00Z");
    const dayStart = startOfDhakaDayUTC(earlyMorning);
    // The order's placedAt (20:00 UTC) is AFTER the Dhaka day start (18:00 UTC),
    // so it correctly falls within "today" (Dhaka 2026-07-16).
    expect(earlyMorning >= dayStart).toBe(true);
    expect(dayStart.toISOString()).toBe("2026-07-15T18:00:00.000Z");
  });
});

describe("startOfDhakaMonthUTC", () => {
  test("returns the 1st of the current Dhaka month at 00:00 Dhaka", () => {
    const now = new Date("2026-07-16T03:00:00Z"); // mid-July Dhaka
    expect(startOfDhakaMonthUTC(now).toISOString()).toBe(
      "2026-06-30T18:00:00.000Z",
    ); // = 2026-07-01 00:00 Dhaka
  });

  test("early-July-1 Dhaka still belongs to July, not June", () => {
    // 2026-07-01 03:00 Dhaka  ==  2026-06-30 21:00 UTC
    const firstOfMonth = new Date("2026-06-30T21:00:00Z");
    expect(startOfDhakaMonthUTC(firstOfMonth).toISOString()).toBe(
      "2026-06-30T18:00:00.000Z",
    );
  });
});

describe("dhakaDateStartUTC", () => {
  test("converts a YYYY-MM-DD Dhaka date to its UTC start instant", () => {
    expect(dhakaDateStartUTC("2026-07-16").toISOString()).toBe(
      "2026-07-15T18:00:00.000Z",
    );
  });
});

describe("dhakaDateString", () => {
  test("returns the Dhaka calendar date for an afternoon instant", () => {
    // 2026-07-16 09:00 Dhaka == 2026-07-16 03:00 UTC
    expect(dhakaDateString(new Date("2026-07-16T03:00:00Z"))).toBe(
      "2026-07-16",
    );
  });

  test("00:00–06:00 Dhaka lands on the Dhaka day, not the UTC day (the fix)", () => {
    // 2026-07-19 02:30 Dhaka == 2026-07-18 20:30 UTC. The UTC slice would wrongly
    // say 2026-07-18; the Dhaka date must be 2026-07-19.
    const early = new Date("2026-07-18T20:30:00Z");
    expect(early.toISOString().slice(0, 10)).toBe("2026-07-18"); // UTC (wrong)
    expect(dhakaDateString(early)).toBe("2026-07-19"); // Dhaka (correct)
  });

  test("just-before-midnight Dhaka stays on the same day", () => {
    // 2026-07-18 23:30 Dhaka == 2026-07-18 17:30 UTC
    expect(dhakaDateString(new Date("2026-07-18T17:30:00Z"))).toBe(
      "2026-07-18",
    );
  });
});

describe("addDays", () => {
  test("adds whole days", () => {
    const d = new Date("2026-07-15T18:00:00.000Z");
    expect(addDays(d, 1).toISOString()).toBe("2026-07-16T18:00:00.000Z");
  });

  test("subtracts with a negative count", () => {
    const d = new Date("2026-07-15T18:00:00.000Z");
    expect(addDays(d, -6).toISOString()).toBe("2026-07-09T18:00:00.000Z");
  });
});
