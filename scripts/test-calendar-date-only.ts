import assert from "node:assert/strict";
import {
  addDaysToDateOnly,
  dateOnlyFromLocalDate,
  dateOnlyToLocalDate,
  formatDateOnly,
  formatReleaseDateParts,
  parseDateOnly,
} from "../src/lib/date-only.ts";

process.env.TZ = "Asia/Baghdad";

assert.deepEqual(parseDateOnly("2026-07-12"), { year: 2026, month: 7, day: 12 });
assert.equal(parseDateOnly("2026-02-30"), null, "invalid calendar dates must be rejected");
assert.equal(parseDateOnly("12/07/2026"), null, "only date-only ISO input is accepted");

const shortlyAfterMidnightInBaghdad = new Date(2026, 6, 12, 0, 30, 0, 0);
assert.equal(
  dateOnlyFromLocalDate(shortlyAfterMidnightInBaghdad),
  "2026-07-12",
  "local calendar keys must not shift to the previous UTC day",
);
assert.equal(
  shortlyAfterMidnightInBaghdad.toISOString().slice(0, 10),
  "2026-07-11",
  "the regression fixture must demonstrate the old UTC date shift",
);

assert.equal(addDaysToDateOnly("2026-07-31", 1), "2026-08-01");
assert.equal(addDaysToDateOnly("2026-03-01", -1), "2026-02-28");
assert.equal(dateOnlyFromLocalDate(dateOnlyToLocalDate("2026-07-12")!), "2026-07-12");
assert.equal(formatDateOnly("2026-07-12"), "July 12, 2026");
assert.deepEqual(formatReleaseDateParts("2026-07-12"), {
  dayMonth: "12 July",
  year: "2026",
  full: "12 July 2026",
});

console.log("Calendar date-only tests passed.");
